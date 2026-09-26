import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ToggleSize, ToggleVariant } from "../toggle/toggle.js"
import { toggleStyles } from "../toggle/toggle.styles.js"
import { toggleGroupContext } from "./toggle-group-context.js"
import { toggleGroupItemStyles } from "./toggle-group.styles.js"

/**
 * The element itself is the semantic node: a `radio` (`aria-checked`) in a single-selection group,
 * a toggle `button` (`aria-pressed`) in a `multiple` group. Name icon-only items with `aria-label`.
 *
 * @summary A toggle button inside a `tec-toggle-group`.
 *
 * @tag tec-toggle-group-item
 *
 * @slot - The label. Icons placed directly in the default slot (icon-only items) are sized to 1rem.
 * @slot start - A leading icon (tightens the leading padding).
 * @slot end - A trailing icon (tightens the trailing padding).
 *
 * @csspart base - The visual button box.
 *
 * @cssprop --tec-toggle-radius - Corner radius (default `--tec-radius-md`; only the outer corners in a joined group).
 * @cssprop --tec-icon-size - Size of slotted icons (default 1rem).
 *
 * @cssstate pressed - The item is on.
 * @cssstate disabled - The item (or its group) is disabled.
 * @cssstate outline - The effective variant is `outline`.
 * @cssstate sm - The effective size is `sm`.
 * @cssstate lg - The effective size is `lg`.
 * @cssstate joined - The group has `spacing="0"`.
 * @cssstate first - First item of a joined group.
 * @cssstate last - Last item of a joined group.
 * @cssstate vertical - The group is vertical.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 */
export class TecToggleGroupItem extends TectonElement {
  static styles = [hostStyles, toggleStyles, toggleGroupItemStyles]

  /** Identifies the item in the group's `value` / `values`. */
  @property({ reflect: true }) value = ""

  /** Disables this item (skipped by the arrow keys, cannot be toggled). */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The visual style when the group sets none. */
  @property({ reflect: true }) variant: ToggleVariant = "default"

  /** The size when the group sets none. */
  @property({ reflect: true }) size: ToggleSize = "default"

  #group = new ContextConsumer(this, { context: toggleGroupContext, subscribe: true })

  constructor() {
    super()
    new HasSlotController(this, "start", "end", { states: true })
    this.addEventListener("click", (event) => {
      if (!this.isDisabled) this.#group.value?.toggle(this, event)
    })
    this.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.defaultPrevented && !event.repeat) {
        event.preventDefault()
        if (!this.isDisabled) this.#group.value?.toggle(this, event)
      }
    })
  }

  /** Whether the item is on. */
  get pressed(): boolean {
    return !!this.#group.value?.values.includes(this.value)
  }

  /** Disabled itself or through its group. */
  get isDisabled(): boolean {
    return this.disabled || !!this.#group.value?.disabled
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const group = this.#group.value
    const pressed = this.pressed
    const disabled = this.isDisabled
    const multiple = !!group?.multiple
    this.internals.role = multiple || !group ? "button" : "radio"
    this.internals.ariaPressed = multiple || !group ? String(pressed) : null
    this.internals.ariaChecked = multiple || !group ? null : String(pressed)
    this.internals.ariaDisabled = disabled ? "true" : null
    const variant = group?.variant ?? this.variant
    const size = group?.size ?? this.size
    this.toggleState("pressed", pressed)
    this.toggleState("disabled", disabled)
    this.toggleState("outline", variant === "outline")
    this.toggleState("sm", size === "sm")
    this.toggleState("lg", size === "lg")
    const joined = group?.spacing === 0
    const items = joined ? group.items() : []
    this.toggleState("joined", joined)
    this.toggleState("first", joined && items[0] === this)
    this.toggleState("last", joined && items[items.length - 1] === this)
    this.toggleState("vertical", group?.orientation === "vertical")
  }

  protected override render() {
    return html`<span class="base" part="base"><slot name="start"></slot><slot></slot><slot name="end"></slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-toggle-group-item": TecToggleGroupItem
  }
}
