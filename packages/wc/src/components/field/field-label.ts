import { ContextConsumer } from "@lit/context"
import type { PropertyValues } from "lit"
import { containsFlat, deepActiveElement } from "../../internal/focus.js"
import { TecLabel } from "../label/label.js"
import { fieldContext } from "./field-context.js"
import { fieldLabelStyles } from "./field.styles.js"

/**
 * A `tec-label` for fields. Without `for` it labels the control of its `tec-field` (or the control it
 * contains); it dims while the field is disabled.
 *
 * **Choice card**: wrap a whole `tec-field` (with a `tec-field-content` and a checkbox, switch or
 * radio item) in a `tec-field-label` to make the card the click target. The card gets a border, a
 * hover background, the focus ring of the control inside, and a primary tint while that control is
 * checked.
 *
 * @summary The label of a form field; also the choice card wrapper.
 *
 * @tag tec-field-label
 *
 * @slot - The label text, or a whole `tec-field` for a choice card.
 *
 * @csspart base - The label box (the bordered card in choice-card mode).
 *
 * @cssstate disabled - The labelled control is disabled.
 * @cssstate field-disabled - The enclosing field is disabled.
 * @cssstate card - The label wraps a `tec-field` (choice card).
 * @cssstate checked - A checkbox, switch or radio inside the label is checked.
 * @cssstate focus-visible - A control inside the label has keyboard focus.
 */
export class TecFieldLabel extends TecLabel {
  static styles = [...TecLabel.styles, fieldLabelStyles]

  #field = new ContextConsumer(this, { context: fieldContext, subscribe: true })

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener("change", this.#onChange, true)
    this.addEventListener("focusin", this.#syncFocus)
    this.addEventListener("focusout", this.#syncFocus)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener("change", this.#onChange, true)
    this.removeEventListener("focusin", this.#syncFocus)
    this.removeEventListener("focusout", this.#syncFocus)
  }

  override refresh(): void {
    super.refresh()
    this.toggleState("card", !!this.querySelector(":scope > tec-field"))
    this.#syncChecked()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("field-disabled", !!this.#field.value?.disabled)
  }

  /** A radio elsewhere in the group may uncheck ours: re-check after any change, once states settled. */
  #onChange = () => requestAnimationFrame(() => this.#syncChecked())

  #syncChecked(): void {
    let checked = false
    for (const el of this.querySelectorAll("*")) {
      try {
        if (el.matches(":checked, :state(checked)")) {
          checked = true
          break
        }
      } catch {
        /* :state() unsupported */
      }
    }
    this.toggleState("checked", checked)
  }

  #syncFocus = (event: FocusEvent) => {
    const active = event.type === "focusin" ? deepActiveElement() : null
    this.toggleState("focus-visible", !!active && containsFlat(this, active) && active.matches(":focus-visible"))
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-field-label": TecFieldLabel
  }
}
