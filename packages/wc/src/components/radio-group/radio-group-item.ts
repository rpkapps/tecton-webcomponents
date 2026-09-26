import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { radioGroupContext } from "./radio-group-context.js"
import { radioGroupItemStyles } from "./radio-group.styles.js"

/**
 * The element itself is the `radio` (it takes focus; the group manages which item is in the tab
 * order). It is labelable: a `<label for="item-id">` names it and checks it when clicked, so it fits
 * `tec-field` layouts and choice cards. Content in the default slot is an inline label instead.
 *
 * @summary A radio button inside a `tec-radio-group`.
 *
 * @tag tec-radio-group-item
 *
 * @slot - Optional label text next to the circle. Alternatively label the item with `<label for>` or `aria-label`.
 *
 * @csspart base - The wrapper of the circle and the label.
 * @csspart control - The 16px circle.
 * @csspart indicator - The dot shown when checked.
 * @csspart label - The label text container.
 *
 * @cssstate checked - The item is checked.
 * @cssstate disabled - The item (or its group) is disabled.
 * @cssstate user-invalid - The group displays invalidity.
 */
export class TecRadioGroupItem extends TectonElement {
  static styles = [hostStyles, radioGroupItemStyles]
  /** Form-associated only so `<label for>` can target it; the group submits the value. */
  static formAssociated = true

  /** The value the group takes when this item is checked. */
  @property({ reflect: true }) value = ""

  /** Disables this item (skipped by the arrow keys, cannot be checked). */
  @property({ type: Boolean, reflect: true }) disabled = false

  #group = new ContextConsumer(this, { context: radioGroupContext, subscribe: true })
  #slots = new HasSlotController(this, "[default]")
  #fieldsetDisabled = false

  constructor() {
    super()
    this.addEventListener("click", () => this.#check())
    this.addEventListener("keydown", (event) => {
      if (event.key === " " && !event.defaultPrevented) {
        event.preventDefault()
        this.#check()
      }
    })
  }

  /** Whether this item is the group's checked item. */
  get checked(): boolean {
    const group = this.#group.value
    return !!group && !!this.value && group.value === this.value
  }

  /** Disabled itself, through its group or a disabled `<fieldset>`. */
  get isDisabled(): boolean {
    return this.disabled || this.#fieldsetDisabled || !!this.#group.value?.disabled
  }

  /** @internal */
  formDisabledCallback(disabled: boolean): void {
    this.#fieldsetDisabled = disabled
    this.requestUpdate()
  }

  #check(): void {
    if (this.isDisabled) return
    this.#group.value?.select(this)
    if (document.activeElement !== this && !this.matches(":focus")) this.focus()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const checked = this.checked
    const disabled = this.isDisabled
    this.internals.role = "radio"
    this.internals.ariaChecked = String(checked)
    this.internals.ariaDisabled = disabled ? "true" : null
    this.toggleState("checked", checked)
    this.toggleState("disabled", disabled)
    this.toggleState("user-invalid", !!this.#group.value?.invalid)
  }

  protected override render() {
    const hasLabel = this.#slots.test("[default]")
    return html`<span class="base" part="base">
      <span class="control" part="control"><span class="indicator" part="indicator"></span></span>
      <span class="label" part="label" ?hidden=${!hasLabel}><slot></slot></span>
    </span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-radio-group-item": TecRadioGroupItem
  }
}
