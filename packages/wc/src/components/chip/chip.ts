import { html, nothing, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { X } from "lucide"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { badgeStyles } from "../badge/badge.styles.js"
import { chipStyles } from "./chip.styles.js"

/** The badge colours a chip can take. */
export type ChipVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "success" | "warning" | "info"
/** Filled surface or coloured border. */
export type ChipAppearance = "solid" | "outline"
/** Height 20 / 24 / 28 px. */
export type ChipSize = "default" | "md" | "lg"

/** What a `tec-chip-group` tells its chips (set by the group, not by authors). */
interface ChipGroupLink {
  selectable: boolean
  removable: boolean
  removeLabel: string
  removeHint: string
  requestRemove(chip: TecChip): void
}

/**
 * A chip is a row of its `tec-chip-group` grid: the group moves focus between chips with the arrow
 * keys, selects them with <kbd>Space</kbd>/<kbd>Enter</kbd> or a click (with `selection-mode`) and
 * removes them with <kbd>Delete</kbd>/<kbd>Backspace</kbd> or the remove button (with `removable`).
 * It uses the badge look: the same `variant`, `appearance` and `size` render the same way.
 *
 * @summary An interactive label: a selectable and/or removable tag inside a `tec-chip-group`.
 *
 * @tag tec-chip
 *
 * @slot - The label.
 * @slot start - A leading icon (tightens the leading padding; sized with the chip).
 * @slot end - A trailing icon.
 *
 * @csspart base - The chip box (the grid cell).
 * @csspart remove - The remove button (rendered when the group is `removable`).
 *
 * @cssprop --tec-chip-radius - Corner radius (default fully rounded).
 * @cssprop --tec-icon-size - Size of slotted icons (0.75rem / 0.875rem / 1rem by size).
 *
 * @cssstate selected - The chip is selected.
 * @cssstate removable - The group is removable (a remove button is shown).
 * @cssstate interactive - The chip can be selected or removed (hover brightens it).
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 */
export class TecChip extends TectonElement {
  static styles = [hostStyles, badgeStyles, chipStyles]

  /** Identifies the chip in the group's `values` and in `tec-remove`. Defaults to the label text. */
  @property({ reflect: true }) value = ""

  /** The colour (the badge variants). */
  @property({ reflect: true }) variant: ChipVariant = "secondary"

  /** `solid` fills the chip, `outline` draws a coloured border. */
  @property({ reflect: true }) appearance: ChipAppearance = "solid"

  /** Height 20 / 24 / 28 px; slotted icons scale with it. */
  @property({ reflect: true }) size: ChipSize = "default"

  /** Disables the chip: it cannot be focused, selected or removed. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Whether the chip is selected (only meaningful with the group's `selection-mode`). As an attribute: the initial selection. */
  @property({ type: Boolean, reflect: true }) selected = false

  /** @internal Set by the owning `tec-chip-group`. */
  @state() group: ChipGroupLink | null = null

  #text = ""

  constructor() {
    super()
    new HasSlotController(this, "start", "end", { states: true })
  }

  /** The chip's key: `value`, or its trimmed text. */
  get key(): string {
    return this.value || this.textValue
  }

  /** The plain-text label (the accessible name of the row). */
  get textValue(): string {
    return (this.textContent ?? "").replace(/\s+/g, " ").trim()
  }

  #onSlotChange = () => {
    if (this.textValue !== this.#text) this.requestUpdate()
  }

  #onRemoveClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (!this.disabled) this.group?.requestRemove(this)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const group = this.group
    this.#text = this.textValue
    this.internals.role = "row"
    this.internals.ariaLabel = this.#text || null
    this.internals.ariaSelected = group?.selectable ? String(this.selected) : null
    this.internals.ariaDisabled = this.disabled ? "true" : null
    const internals = this.internals as ElementInternals & { ariaDescription?: string | null }
    internals.ariaDescription = group?.removable && !this.disabled ? group.removeHint || null : null
    this.toggleState("selected", !!group?.selectable && this.selected)
    this.toggleState("removable", !!group?.removable)
    this.toggleState("interactive", !!group && (group.selectable || group.removable))
  }

  protected override render() {
    const group = this.group
    return html`<span class="base" part="base" role="gridcell"
      ><slot name="start"></slot><slot @slotchange=${this.#onSlotChange}></slot><slot name="end"></slot>${group?.removable
        ? html`<button
            class="remove"
            part="remove"
            type="button"
            tabindex="-1"
            aria-label=${`${group.removeLabel} ${this.#text}`.trim()}
            ?disabled=${this.disabled}
            @click=${this.#onRemoveClick}
          >
            ${icon(X, { size: 12 })}
          </button>`
        : nothing}</span
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chip": TecChip
  }
}
