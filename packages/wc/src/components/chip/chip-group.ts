import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecChip } from "./chip.js"
import { chipGroupStyles } from "./chip.styles.js"

/** Whether (and how many) chips can be selected. */
export type ChipSelectionMode = "none" | "single" | "multiple"

/** Detail of `tec-value-change` on a chip group. */
export interface ChipGroupValueChangeDetail {
  /** The first selected value (the selection in `single` mode), or `null`. */
  value: string | null
  /** Every selected value, in document order. */
  values: string[]
}

/** Detail of `tec-remove` (fired on the chip). */
export interface ChipRemoveDetail {
  value: string
}

/**
 * The group is an ARIA `grid` whose rows are the chips (the React Aria `TagGroup` pattern): one tab
 * stop, arrow keys between chips (mirrored in RTL, wrapping), <kbd>Home</kbd>/<kbd>End</kbd>.
 * Name it with `aria-label` (or `aria-labelledby`).
 *
 * - `selection-mode="single" | "multiple"`: a click, <kbd>Space</kbd> or <kbd>Enter</kbd> toggles
 *   the focused chip; `tec-value-change` fires (cancelable) and `values` holds the selection.
 * - `removable`: every chip gets a remove button, and <kbd>Delete</kbd>/<kbd>Backspace</kbd> remove
 *   the focused chip (or every selected chip when the focused one is selected). Each chip fires a
 *   cancelable `tec-remove`; unless a listener calls `preventDefault()` the chip element is removed
 *   and focus moves to the next chip.
 *
 * The element itself is the wrapping flex row (gap 0.375rem), so layout classes on it
 * (`items-center`, `gap-2`, `flex-col`) apply.
 *
 * @summary A set of selectable and/or removable chips (tags).
 *
 * @tag tec-chip-group
 *
 * @slot - `tec-chip` elements.
 * @slot empty - Shown when the group has no chips (e.g. "No filters.").
 *
 * @cssstate has-chips - The group contains at least one chip.
 *
 * @fires tec-value-change - The user changed the selection. Cancelable. `detail: { value, values }`.
 * @fires tec-remove - Fired on each chip the user removes (bubbles). Cancelable: `preventDefault()` keeps the chip. `detail: { value }`.
 */
export class TecChipGroup extends TectonElement {
  static styles = [hostStyles, chipGroupStyles]

  /** `none` (default), `single` or `multiple` selection. */
  @property({ attribute: "selection-mode", reflect: true }) selectionMode: ChipSelectionMode = "none"

  /** Shows a remove button on every chip and enables <kbd>Delete</kbd>/<kbd>Backspace</kbd>. */
  @property({ type: Boolean, reflect: true }) removable = false

  /** Accessible label of the remove buttons (followed by the chip's text: "Remove Top Balder"). */
  @property({ attribute: "remove-label" }) removeLabel = "Remove"

  /** Description announced on removable chips. Empty for none. */
  @property({ attribute: "remove-hint" }) removeHint = "Press Delete to remove tag."

  #roving = new RovingFocusController<TecChip>(this, {
    items: () => this.chips,
    orientation: "horizontal",
    loop: true,
    homeEnd: true,
  })

  #observer = new MutationObserver(() => this.#syncChips())

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("focusin", () => this.#setLive(true))
    this.addEventListener("focusout", (event) => {
      if (!this.contains(event.relatedTarget as Node | null)) this.#setLive(false)
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true })
    this.#syncChips()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** The chips of this group, in document order. */
  get chips(): TecChip[] {
    return [...this.querySelectorAll<TecChip>("tec-chip")].filter((c) => c.closest("tec-chip-group") === this)
  }

  /** The selected values (`value` of each selected chip). Setting it selects exactly those chips (no event). */
  get values(): string[] {
    if (this.selectionMode === "none") return []
    return this.chips.filter((c) => c.selected).map((c) => c.key)
  }

  set values(values: string[]) {
    const set = new Set(values)
    let first = true
    for (const chip of this.chips) {
      const on = set.has(chip.key) && (this.selectionMode !== "single" || first)
      if (on) first = false
      chip.selected = on
    }
  }

  /** The first selected value, or `null`. */
  get value(): string | null {
    return this.values[0] ?? null
  }

  #requestRemove = (chip: TecChip) => this.#remove([chip], chip)

  #syncChips(): void {
    const chips = this.chips
    const link = {
      selectable: this.selectionMode !== "none",
      removable: this.removable,
      removeLabel: this.removeLabel,
      removeHint: this.removeHint,
      requestRemove: this.#requestRemove,
    }
    for (const chip of chips) {
      const current = chip.group
      if (
        !current ||
        current.selectable !== link.selectable ||
        current.removable !== link.removable ||
        current.removeLabel !== link.removeLabel ||
        current.removeHint !== link.removeHint
      )
        chip.group = link
    }
    const has = chips.length > 0
    this.toggleState("has-chips", has)
    // An empty group is a plain `group` (a grid needs rows) and takes focus when its last chip goes.
    this.internals.role = has ? "grid" : "group"
    this.internals.ariaMultiSelectable = has && this.selectionMode === "multiple" ? "true" : null
    if (has) this.removeAttribute("tabindex")
    this.#roving.update()
  }

  #setLive(on: boolean): void {
    this.internals.ariaLive = on ? "polite" : null
    this.internals.ariaRelevant = on ? "additions" : null
  }

  #chipFromEvent(event: Event): TecChip | undefined {
    const chips = this.chips
    return event.composedPath().find((t): t is TecChip => chips.includes(t as TecChip))
  }

  #onClick = (event: MouseEvent) => {
    const chip = this.#chipFromEvent(event)
    if (!chip || chip.disabled || event.defaultPrevented) return
    chip.focus({ preventScroll: true })
    this.#toggle(chip)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const chip = this.#chipFromEvent(event)
    if (!chip || chip.disabled) return
    if (event.key === " " || event.key === "Enter") {
      if (this.selectionMode === "none") return
      event.preventDefault()
      this.#toggle(chip)
    } else if ((event.key === "Delete" || event.key === "Backspace") && this.removable) {
      event.preventDefault()
      const targets = this.selectionMode !== "none" && chip.selected ? this.chips.filter((c) => c.selected && !c.disabled) : [chip]
      this.#remove(targets, chip)
    }
  }

  #toggle(chip: TecChip): void {
    if (this.selectionMode === "none") return
    const chips = this.chips
    const next = chips.filter((c) => (c === chip ? !c.selected : this.selectionMode === "multiple" && c.selected))
    const values = next.map((c) => c.key)
    if (!this.emit<ChipGroupValueChangeDetail>("tec-value-change", { detail: { value: values[0] ?? null, values }, cancelable: true })) return
    for (const c of chips) c.selected = next.includes(c)
  }

  #remove(targets: TecChip[], focused: TecChip): void {
    if (!this.removable) return
    const before = this.chips
    const removed: TecChip[] = []
    for (const chip of targets) {
      if (chip.dispatchEvent(new CustomEvent<ChipRemoveDetail>("tec-remove", { detail: { value: chip.key }, bubbles: true, composed: true, cancelable: true }))) {
        removed.push(chip)
      }
    }
    if (!removed.length) return
    const hadFocus = this.contains(document.activeElement) || before.some((c) => c.matches(":focus"))
    // Focus goes to the next remaining chip after the focused one, else the previous one.
    const index = before.indexOf(focused)
    const remaining = before.filter((c) => !removed.includes(c) && !c.disabled)
    const after = before.slice(index + 1).find((c) => remaining.includes(c))
    const prior = before.slice(0, index).reverse().find((c) => remaining.includes(c))
    for (const chip of removed) chip.remove()
    this.#syncChips()
    if (!hadFocus) return
    const target = after ?? prior
    if (target) this.#roving.setActive(target, { focus: true })
    else {
      this.tabIndex = -1
      this.focus()
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("selectionMode") && this.selectionMode === "single") {
      // Keep at most one selected chip.
      let seen = false
      for (const chip of this.chips) {
        if (chip.selected && seen) chip.selected = false
        if (chip.selected) seen = true
      }
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#syncChips()
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.#syncChips()}></slot><span class="empty"><slot name="empty"></slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chip-group": TecChipGroup
  }
}
