import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { Check, Minus } from "lucide"
import { FormControlMixin, type FormValue } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { checkboxStyles } from "./checkbox.styles.js"

/**
 * @summary A control that allows the user to toggle between checked and not checked.
 *
 * @tag tec-checkbox
 *
 * @slot - Optional label text, rendered next to the box (clicking it toggles). Alternatively label the
 *   checkbox with `<label for="id">` or `aria-label`.
 *
 * @csspart base - The `<label>` wrapping the box and the label text.
 * @csspart control - The 16px box.
 * @csspart input - The native checkbox (styled as the box).
 * @csspart indicator - The check / dash glyph container.
 * @csspart label - The label text container.
 *
 * @cssstate checked - The checkbox is checked.
 * @cssstate indeterminate - The checkbox is indeterminate.
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, or a failed constraint after interaction/submit).
 *
 * @fires input - The checked state changed by user interaction.
 * @fires change - The checked state changed by user interaction.
 *
 * Form-associated: submits `name=value` (value defaults to `"on"`) when checked; `required` blocks
 * submission while unchecked; reset restores the `checked` attribute.
 */
export class TecCheckbox extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, checkboxStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The initial checked state (the `checked` attribute); form reset returns to it. */
  @property({ type: Boolean, attribute: "checked" }) defaultChecked = false

  #checked: boolean | undefined

  /** The current checked state. Until set (or toggled by the user) it follows the `checked` attribute. */
  @property({ type: Boolean, attribute: false })
  get checked(): boolean {
    return this.#checked ?? this.defaultChecked
  }
  set checked(value: boolean) {
    this.#checked = !!value
  }

  /** Shows the mixed state (a dash). Cleared when the user toggles the checkbox. */
  @property({ type: Boolean, reflect: true }) indeterminate = false

  /** The user cannot change the checked state (it is still focusable and submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** The native checkbox inside the shadow root. */
  @query(".input") readonly input!: HTMLInputElement
  @query(".label") private labelPart!: HTMLElement

  #slots = new HasSlotController(this, "[default]")

  constructor() {
    super()
    this.defaultValue = "on"
    this.addEventListener("click", this.#onHostClick)
  }

  protected override get formControl(): HTMLElement | null {
    return this.input ?? null
  }

  protected override formValue(): FormValue {
    return this.checked ? this.value : null
  }

  protected override formState(): FormValue {
    return String(this.checked)
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#checked = undefined
    this.requestUpdate("checked")
  }

  protected override formRestoreState(state: FormValue): void {
    this.checked = state === "true"
  }

  protected override formLabels(): Element[] {
    const labels = super.formLabels()
    const ownText = this.#slots.test("[default]") && this.labelPart
    const wrapped = labels.some((l) => l.contains(this))
    return labels.length && ownText && !wrapped ? [...labels, this.labelPart] : labels
  }

  /** Toggles the checkbox as if clicked (fires `input` and `change`). */
  toggle(): void {
    this.input?.click()
  }

  /** Clicks from `<label for>` or `host.click()` land on the host; forward them to the native input. */
  #onHostClick = (event: MouseEvent) => {
    if (event.composedPath()[0] !== this || this.isDisabled) return
    this.input?.click()
  }

  #onInputClick(event: MouseEvent) {
    if (this.readonly) event.preventDefault()
  }

  #onInput() {
    this.checked = this.input.checked
    this.indeterminate = false
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("checked", this.checked)
    this.toggleState("indeterminate", this.indeterminate)
  }

  protected override render() {
    const glyph = this.indeterminate ? icon(Minus, { size: 14, strokeWidth: 2 }) : this.checked ? icon(Check, { size: 14, strokeWidth: 2 }) : nothing
    const hasLabel = this.#slots.test("[default]")
    return html`<label class="base" part="base">
      <span class="control" part="control">
        <input
          class="input"
          part="input"
          type="checkbox"
          .checked=${live(this.checked)}
          .indeterminate=${this.indeterminate}
          ?disabled=${this.isDisabled}
          ?required=${this.required}
          @click=${this.#onInputClick}
          @input=${this.#onInput}
          @change=${this.redispatchChange}
        />
        <span class="indicator" part="indicator">${glyph}</span>
      </span>
      <span class="label" part="label" ?hidden=${!hasLabel}><slot></slot></span>
    </label>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-checkbox": TecCheckbox
  }
}
