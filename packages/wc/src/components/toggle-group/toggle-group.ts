import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ToggleSize, ToggleVariant } from "../toggle/toggle.js"
import { toggleGroupContext, type ToggleGroupContextValue, type ToggleGroupOrientation } from "./toggle-group-context.js"
import type { TecToggleGroupItem } from "./toggle-group-item.js"
import { toggleGroupStyles } from "./toggle-group.styles.js"

export type { ToggleGroupOrientation } from "./toggle-group-context.js"

/**
 * Follows React Aria's ToggleButtonGroup. In single selection mode (the default) the group is a
 * `radiogroup` and its items are `radio`s (`aria-checked`); with `multiple` it is a `toolbar` of
 * toggle buttons (`aria-pressed`). One item is in the tab order; the arrow keys move focus between
 * items (Left/Right, or Up/Down when vertical; mirrored in RTL), Home/End jump to the ends, and
 * <kbd>Space</kbd>/<kbd>Enter</kbd> toggle the focused item.
 *
 * `variant` and `size` set on the group apply to every item. `spacing="0"` joins the items into a
 * segmented control (shared borders, rounded outer corners only).
 *
 * @summary A set of two-state buttons that can be toggled on or off.
 *
 * @tag tec-toggle-group
 *
 * @slot - `tec-toggle-group-item` elements (they may be wrapped in other elements).
 *
 * @csspart base - The flex container holding the items.
 *
 * @cssprop --tec-toggle-group-gap - Gap between items (default `calc(0.25rem * spacing)`).
 *
 * @fires tec-value-change - The user changed the selection. Cancelable (`preventDefault()` keeps the current selection). `detail: { value, values }` (`value` is the first selected value).
 */
export class TecToggleGroup extends TectonElement {
  static styles = [hostStyles, toggleGroupStyles]

  /** Several items can be on at once (a toolbar of toggle buttons) instead of at most one (radio-like). */
  @property({ type: Boolean, reflect: true }) multiple = false

  /**
   * The initial selection (the `value` attribute): an item value, or with `multiple` a
   * space-separated list of values.
   */
  @property({ attribute: "value" }) defaultValue = ""

  #values: string[] | undefined

  /** The selected item values (current state). Until set, it follows the `value` attribute. */
  @property({ attribute: false })
  get values(): string[] {
    if (this.#values) return this.#values
    const values = this.defaultValue.split(/\s+/).filter(Boolean)
    return this.multiple ? values : this.defaultValue ? [this.defaultValue] : []
  }
  set values(values: string[]) {
    const list = [...new Set((values ?? []).map(String))]
    this.#values = this.multiple ? list : list.slice(0, 1)
  }

  /** The selected value (the first one with `multiple`), `""` when none. Setting it selects that one item. */
  get value(): string {
    return this.values[0] ?? ""
  }
  set value(value: string) {
    this.values = value ? [value] : []
  }

  /** Applied to every item (overrides the items' own `variant`). */
  @property({ reflect: true }) variant?: ToggleVariant

  /** Applied to every item (overrides the items' own `size`). */
  @property({ reflect: true }) size?: ToggleSize

  /** Gap between items in 0.25rem steps. `0` joins the items into one segmented control. */
  @property({ type: Number, reflect: true }) spacing = 2

  /** Layout and arrow-key axis. */
  @property({ reflect: true }) orientation: ToggleGroupOrientation = "horizontal"

  /** Disables every item. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The user cannot turn off the last selected item (a selection always exists once made). */
  @property({ type: Boolean, reflect: true, attribute: "disallow-empty" }) disallowEmpty = false

  #provider = new ContextProvider(this, { context: toggleGroupContext, initialValue: undefined })
  #lastSelected: string | undefined

  #roving = new RovingFocusController<TecToggleGroupItem>(this, {
    items: () => this.items,
    orientation: () => this.orientation,
    loop: false,
    homeEnd: true,
    isDisabled: (item) => this.disabled || item.disabled,
  })

  #observer = new MutationObserver((records) => {
    const relevant = (n: Node) => n instanceof Element && (n.localName === "tec-toggle-group-item" || !!n.querySelector("tec-toggle-group-item"))
    if (records.some((r) => (r.type === "attributes" ? relevant(r.target) : [...r.addedNodes, ...r.removedNodes].some(relevant)))) this.requestUpdate()
  })

  /** The items of this group (not of nested groups), in DOM order. */
  get items(): TecToggleGroupItem[] {
    return [...this.querySelectorAll<TecToggleGroupItem>("tec-toggle-group-item")].filter((i) => i.closest("tec-toggle-group") === this)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "disabled"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** Focuses the item in the tab order. */
  override focus(options?: FocusOptions): void {
    this.#roving.focus(options)
  }

  #toggle = (item: TecToggleGroupItem, _event?: Event) => {
    if (this.disabled || item.disabled) return
    const current = this.values
    const on = current.includes(item.value)
    let next: string[]
    if (on) {
      if (this.disallowEmpty && current.length === 1) return
      next = current.filter((v) => v !== item.value)
    } else {
      next = this.multiple ? [...current, item.value] : [item.value]
    }
    if (this.emit<{ value: string; values: string[] }>("tec-value-change", { detail: { value: next[0] ?? "", values: next }, cancelable: true })) {
      this.values = next
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = this.multiple ? "toolbar" : "radiogroup"
    this.internals.ariaOrientation = this.orientation
    this.internals.ariaDisabled = this.disabled ? "true" : null
    const value: ToggleGroupContextValue = {
      variant: this.variant,
      size: this.size,
      spacing: this.spacing,
      orientation: this.orientation,
      multiple: this.multiple,
      disabled: this.disabled,
      values: this.values,
      toggle: this.#toggle,
      items: () => this.items,
    }
    this.#provider.setValue(value, true)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // Single selection: the selected item is the tab stop (like a radio group).
    const selected = this.multiple ? undefined : this.values[0]
    if (selected !== this.#lastSelected) {
      this.#lastSelected = selected
      const item = this.items.find((i) => i.value === selected && !i.disabled)
      if (item) this.#roving.setActive(item)
    }
  }

  protected override render() {
    const gap = `calc(0.25rem * ${Number.isFinite(this.spacing) ? this.spacing : 2})`
    return html`<div class="base" part="base" style=${styleMap({ gap: `var(--tec-toggle-group-gap, ${gap})` })}>
      <slot @slotchange=${() => this.#roving.update()}></slot>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-toggle-group": TecToggleGroup
  }
}
