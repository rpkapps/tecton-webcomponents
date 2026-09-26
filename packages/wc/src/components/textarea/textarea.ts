import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { FormControlMixin } from "../../internal/form-control.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { textFieldStyles } from "../input/input.styles.js"
import type { InputVariant } from "../input/input.js"
import { textareaStyles } from "./textarea.styles.js"

export type TextareaResize = "none" | "vertical" | "horizontal" | "both"

/**
 * A native `<textarea>` in the shadow root that grows with its content (`field-sizing: content`,
 * at least 4rem tall). Height utilities on the element (`class="min-h-40"`) resize the box.
 *
 * Form-associated: submits `name=value`, mirrors the textarea's constraint validation (`required`,
 * `minlength`, `maxlength`), resets to the initial text: the `value` attribute or, like a native
 * `<textarea>`, the element's text content.
 *
 * @summary Displays a form textarea.
 *
 * @tag tec-textarea
 *
 * @csspart base - The native `<textarea>` (border, padding, background, focus ring).
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, a failed constraint after the user changed the value or a submit attempt, or an invalid `tec-field`).
 *
 * @fires input - The value changed by user input (the native, composed event).
 * @fires change - The user committed a value (on blur).
 */
export class TecTextarea extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, textFieldStyles, textareaStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The surface style: `outline` (bordered), `filled` (muted background, bottom border) or `text` (underline only). */
  @property({ reflect: true }) variant: InputVariant = "outline"

  /** Hint shown while the textarea is empty. Never a substitute for a label. */
  @property() placeholder = ""

  /** Accessible name when no visible label is associated (applied like `aria-label`). */
  @property() label = ""

  /** The value is not editable (it is still focusable and submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** Which way the user can resize the box. */
  @property({ reflect: true }) resize: TextareaResize = "vertical"

  /** Visible rows (the box still grows with the content). */
  @property({ type: Number }) rows?: number

  /** Minimum length of a user-entered value. */
  @property({ type: Number, attribute: "minlength" }) minLength?: number

  /** Maximum length; typing stops there. */
  @property({ type: Number, attribute: "maxlength" }) maxLength?: number

  /** Autofill hint, like the native `autocomplete` attribute. */
  @property() autocomplete?: string

  /** Line wrapping of the submitted value, like the native `wrap` attribute. */
  @property() wrap?: "soft" | "hard" | "off"

  /** Virtual keyboard hint. */
  @property({ attribute: "inputmode" }) override inputMode = ""

  /** Label of the virtual keyboard's enter key. */
  @property({ attribute: "enterkeyhint" }) override enterKeyHint = ""

  /** The native `<textarea>` inside the shadow root. */
  @query(".base") readonly textarea!: HTMLTextAreaElement

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] === this && !this.isDisabled) this.textarea?.focus()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    // Like a native <textarea>, text content is the default value when there is no value attribute.
    if (!this.hasAttribute("value") && this.textContent) this.defaultValue = this.textContent.replace(/^\n/, "")
  }

  protected override get formControl(): HTMLElement | null {
    return this.textarea ?? null
  }

  /** Selects all the text. */
  select(): void {
    this.textarea?.select()
  }
  /** Selects a range of the text. */
  setSelectionRange(start: number | null, end: number | null, direction?: "forward" | "backward" | "none"): void {
    this.textarea?.setSelectionRange(start, end, direction)
  }
  /** Replaces a range of the text (fires no event). */
  setRangeText(replacement: string, start?: number, end?: number, selectionMode?: SelectionMode): void {
    if (!this.textarea) return
    if (start === undefined || end === undefined) this.textarea.setRangeText(replacement)
    else this.textarea.setRangeText(replacement, start, end, selectionMode)
    this.value = this.textarea.value
  }
  /** Start of the selection. */
  get selectionStart(): number {
    return this.textarea?.selectionStart ?? 0
  }
  set selectionStart(value: number) {
    if (this.textarea) this.textarea.selectionStart = value
  }
  /** End of the selection. */
  get selectionEnd(): number {
    return this.textarea?.selectionEnd ?? 0
  }
  set selectionEnd(value: number) {
    if (this.textarea) this.textarea.selectionEnd = value
  }
  /** Length of the current value. */
  get textLength(): number {
    return this.value.length
  }

  protected override updated(changed: PropertyValues): void {
    const textarea = this.textarea
    if (textarea && textarea.value !== this.value) textarea.value = this.value
    super.updated(changed)
  }

  protected override render() {
    return html`<textarea
      class="base"
      part="base"
      placeholder=${ifDefined(this.placeholder || undefined)}
      aria-label=${ifDefined(this.label || undefined)}
      ?disabled=${this.isDisabled}
      ?required=${this.required}
      ?readonly=${this.readonly}
      rows=${ifDefined(this.rows)}
      minlength=${ifDefined(this.minLength)}
      maxlength=${ifDefined(this.maxLength)}
      autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
      wrap=${ifDefined(this.wrap)}
      inputmode=${ifDefined(this.inputMode || undefined)}
      enterkeyhint=${ifDefined(this.enterKeyHint || undefined)}
      @input=${() => (this.value = this.textarea.value)}
      @change=${this.redispatchChange}
    ></textarea>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-textarea": TecTextarea
  }
}
