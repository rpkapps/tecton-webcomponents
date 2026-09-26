import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { FormControlMixin, type FormValue } from "../../internal/form-control.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { inputStyles, textFieldStyles } from "./input.styles.js"

export type InputVariant = "outline" | "filled" | "text"
export type InputType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "datetime-local"
  | "time"
  | "month"
  | "week"
  | "color"
  | "file"

/**
 * A native `<input>` in the shadow root, with the native attributes (`type`, `placeholder`, `min`,
 * `max`, `step`, `minlength`, `maxlength`, `pattern`, `autocomplete`, `inputmode`, `readonly`,
 * `multiple`, `accept` …) and methods (`select()`, `setSelectionRange()`, `setRangeText()`,
 * `stepUp()`, `stepDown()`, `showPicker()`, `valueAsNumber` …).
 *
 * Form-associated: submits `name=value` (the selected files with `type="file"`), mirrors the native
 * constraint validation of the inner input (`required`, `pattern`, `type="email"` …), resets to the
 * `value` attribute. Label it with `<tec-label>`, `<tec-field-label>`, `<label for>`, the `label`
 * attribute or `aria-label`; `aria-describedby` on the element reaches the inner input.
 *
 * @summary Displays a form input field.
 *
 * @tag tec-input
 *
 * @csspart base - The native `<input>` (border, padding, background, focus ring).
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, a failed constraint after the user changed the value or a submit attempt, or an invalid `tec-field`).
 *
 * @fires input - The value changed by user input (the native, composed event).
 * @fires change - The user committed a value (on blur or Enter; for `file`, when files are picked).
 */
export class TecInput extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, textFieldStyles, inputStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The kind of value, like the native `type` attribute. */
  @property({ reflect: true }) type: InputType = "text"

  /** The surface style: `outline` (bordered), `filled` (muted background, bottom border) or `text` (underline only). */
  @property({ reflect: true }) variant: InputVariant = "outline"

  /** Hint shown while the input is empty. Never a substitute for a label. */
  @property() placeholder = ""

  /** Accessible name when no visible label is associated (applied like `aria-label`). */
  @property() label = ""

  /** The value is not editable (it is still focusable and submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** Minimum length (in UTF-16 code units) of a user-entered value. */
  @property({ type: Number, attribute: "minlength" }) minLength?: number

  /** Maximum length (in UTF-16 code units); typing stops there. */
  @property({ type: Number, attribute: "maxlength" }) maxLength?: number

  /** Minimum value (number, date and time types). */
  @property() min?: string

  /** Maximum value (number, date and time types). */
  @property() max?: string

  /** Granularity of the value (number, date and time types), or `"any"`. */
  @property() step?: string

  /** A regular expression the whole value must match (text, search, tel, url, email, password). */
  @property() pattern?: string

  /** Autofill hint, like the native `autocomplete` attribute (`"email"`, `"one-time-code"`, `"off"` …). */
  @property() autocomplete?: string

  /** Virtual keyboard hint (`"numeric"`, `"decimal"`, `"email"`, `"search"` …). */
  @property({ attribute: "inputmode" }) override inputMode = ""

  /** Label of the virtual keyboard's enter key (`"search"`, `"send"`, `"next"` …). */
  @property({ attribute: "enterkeyhint" }) override enterKeyHint = ""

  /** Allows several values (`email`) or files (`file`). */
  @property({ type: Boolean }) multiple = false

  /** Accepted file types for `type="file"` (`"image/*,.pdf"`). */
  @property() accept?: string

  /** The native `<input>` inside the shadow root. */
  @query(".base") readonly input!: HTMLInputElement

  constructor() {
    super()
    // `<label for>` clicks and `host.click()` land on the host: focus the input (and open the file picker).
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] !== this || this.isDisabled || !this.input) return
      this.input.focus()
      if (this.type === "file") this.input.click()
    })
  }

  protected override get formControl(): HTMLElement | null {
    return this.input ?? null
  }

  protected override formValue(): FormValue {
    if (this.type !== "file") return this.value
    const files = this.input?.files
    if (!files?.length || !this.name) return null
    const data = new FormData()
    for (const file of files) data.append(this.name, file)
    return data
  }

  protected override formState(): FormValue {
    return this.type === "file" ? null : this.value
  }

  protected override formResetValue(): void {
    super.formResetValue()
    if (this.type === "file" && this.input) this.input.value = ""
  }

  // ---------------------------------------------------------------- native API
  /** Selects all the text. */
  select(): void {
    this.input?.select()
  }
  /** Selects a range of the text, like `HTMLInputElement.setSelectionRange()`. */
  setSelectionRange(start: number | null, end: number | null, direction?: "forward" | "backward" | "none"): void {
    this.input?.setSelectionRange(start, end, direction)
  }
  /** Replaces a range of the text, like `HTMLInputElement.setRangeText()` (fires no event). */
  setRangeText(replacement: string, start?: number, end?: number, selectionMode?: SelectionMode): void {
    if (!this.input) return
    if (start === undefined || end === undefined) this.input.setRangeText(replacement)
    else this.input.setRangeText(replacement, start, end, selectionMode)
    this.value = this.input.value
  }
  /** Start of the selection (`null` for types without selection). */
  get selectionStart(): number | null {
    return this.input?.selectionStart ?? null
  }
  set selectionStart(value: number | null) {
    if (this.input) this.input.selectionStart = value
  }
  /** End of the selection. */
  get selectionEnd(): number | null {
    return this.input?.selectionEnd ?? null
  }
  set selectionEnd(value: number | null) {
    if (this.input) this.input.selectionEnd = value
  }
  /** Direction of the selection. */
  get selectionDirection(): "forward" | "backward" | "none" | null {
    return this.input?.selectionDirection ?? null
  }
  set selectionDirection(value: "forward" | "backward" | "none" | null) {
    if (this.input) this.input.selectionDirection = value
  }
  /** Increments a numeric/date value by `step` × `n` (fires no event). */
  stepUp(n = 1): void {
    if (!this.input) return
    this.input.stepUp(n)
    this.value = this.input.value
  }
  /** Decrements a numeric/date value by `step` × `n` (fires no event). */
  stepDown(n = 1): void {
    if (!this.input) return
    this.input.stepDown(n)
    this.value = this.input.value
  }
  /** Opens the browser picker (date, time, color, file …). */
  showPicker(): void {
    this.input?.showPicker()
  }
  /** The value as a number (`NaN` when not numeric). */
  get valueAsNumber(): number {
    return this.input ? this.input.valueAsNumber : Number.NaN
  }
  set valueAsNumber(value: number) {
    if (!this.input) return
    this.input.valueAsNumber = value
    this.value = this.input.value
  }
  /** The value as a `Date` (date and time types), or `null`. */
  get valueAsDate(): Date | null {
    return this.input?.valueAsDate ?? null
  }
  set valueAsDate(value: Date | null) {
    if (!this.input) return
    this.input.valueAsDate = value
    this.value = this.input.value
  }
  /** The selected files (`type="file"`). */
  get files(): FileList | null {
    return this.input?.files ?? null
  }

  // ---------------------------------------------------------------- rendering
  #onInput() {
    this.value = this.input.value
  }

  protected override updated(changed: PropertyValues): void {
    // Push the value into the native input before the mixin mirrors its validity.
    const input = this.input
    if (input && this.type !== "file" && input.value !== this.value) input.value = this.value
    super.updated(changed)
  }

  protected override render() {
    return html`<input
      class="base"
      part="base"
      type=${this.type}
      placeholder=${ifDefined(this.placeholder || undefined)}
      aria-label=${ifDefined(this.label || undefined)}
      ?disabled=${this.isDisabled}
      ?required=${this.required}
      ?readonly=${this.readonly}
      ?multiple=${this.multiple}
      minlength=${ifDefined(this.minLength)}
      maxlength=${ifDefined(this.maxLength)}
      min=${ifDefined(this.min)}
      max=${ifDefined(this.max)}
      step=${ifDefined(this.step)}
      pattern=${ifDefined(this.pattern)}
      accept=${ifDefined(this.accept)}
      autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
      inputmode=${ifDefined(this.inputMode || undefined)}
      enterkeyhint=${ifDefined(this.enterKeyHint || undefined)}
      @input=${this.#onInput}
      @change=${this.#onChange}
    />`
  }

  #onChange(event: Event) {
    if (this.type === "file") this.value = this.input.value
    this.redispatchChange(event)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-input": TecInput
  }
}
