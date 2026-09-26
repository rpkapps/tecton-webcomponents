import { ContextConsumer, ContextProvider } from "@lit/context"
import { html, LitElement, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { Minus } from "lucide"
import { FormControlMixin } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { inputOtpContext, type InputOtpContextValue } from "./input-otp-context.js"
import { inputOtpGroupStyles, inputOtpSeparatorStyles, inputOtpSlotStyles, inputOtpStyles } from "./input-otp.styles.js"

/** Keywords of the `pattern` attribute. */
const PATTERNS: Record<string, string> = {
  digits: "[0-9]*",
  letters: "[a-zA-Z]*",
  alphanumeric: "[a-zA-Z0-9]*",
}

/**
 * One real `<input>` (transparent, laid over the slots) holds the code, so typing, deleting, the
 * arrow keys, paste, the virtual keyboard and one-time-code autofill (`autocomplete="one-time-code"`,
 * the default) work as in any text field; the `tec-input-otp-slot` children only display it.
 *
 * - Focusing or clicking puts the caret in the next empty slot (or selects the last character of a
 *   full code); typing fills the code, <kbd>Backspace</kbd> deletes backwards, <kbd>←</kbd>/<kbd>→</kbd>
 *   select the previous/next character (typing then replaces it).
 * - `pattern` restricts the characters: `digits` (also opens the numeric keypad), `letters`,
 *   `alphanumeric`, or a regular expression the whole value must match (like the native attribute).
 *   Every partial value must match too, so write patterns such as `[0-9A-F]*`. Input that does not
 *   match is rejected; a pasted code is cleaned of spaces first.
 * - Screen readers see one text field (named like any Tecton control: `tec-field-label`,
 *   `<label for>`, `label`, `aria-label`) with the whole code as its value; the slots are hidden
 *   from them.
 *
 * Form-associated: submits `name=value`, `required` fails while empty, reset returns to the `value`
 * attribute.
 *
 * @summary Accessible one-time password input with copy-paste support.
 *
 * @tag tec-input-otp
 *
 * @slot - `tec-input-otp-group` elements (holding `tec-input-otp-slot`s) and `tec-input-otp-separator`s.
 *
 * @csspart base - The row of groups (flex, gap 0.5rem) the input covers.
 * @csspart input - The transparent native `<input>`.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (slots turn destructive).
 * @cssstate complete - Every slot is filled.
 *
 * @fires input - The code changed by user input.
 * @fires change - The user committed the code (on blur).
 * @fires tec-complete - Every slot is filled by user input. `detail: { value }`.
 */
export class TecInputOtp extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, inputOtpStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Number of characters. Defaults to the number of `tec-input-otp-slot` elements. */
  @property({ type: Number, attribute: "maxlength" }) maxLength?: number

  /**
   * Allowed characters: `"digits"`, `"letters"`, `"alphanumeric"`, or a regular expression (native
   * `pattern` syntax) the whole value must match. Empty: any character.
   */
  @property() pattern = ""

  /** Autofill hint. `one-time-code` lets browsers offer codes received by SMS or email. */
  @property() autocomplete = "one-time-code"

  /** Virtual keyboard hint. Defaults to `numeric` with `pattern="digits"`, else `text`. */
  @property({ attribute: "inputmode" }) override inputMode = ""

  /** Accessible name when no visible label is associated (applied like `aria-label`). */
  @property() label = ""

  /** The code is not editable (still focusable and submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** The native `<input>` inside the shadow root. */
  @query(".input") readonly input!: HTMLInputElement

  @state() private _selection: [number, number] | null = null
  @state() private _slots: Element[] = []

  #provider = new ContextProvider(this, { context: inputOtpContext, initialValue: undefined })
  #previousValue = ""
  #previousSelection: [number, number] | null = null
  #observer = new MutationObserver(() => this.#collectSlots())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true })
    this.#collectSlots()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  protected override get formControl(): HTMLElement | null {
    return this.input ?? null
  }

  /** The effective number of characters. */
  get length(): number {
    return this.maxLength ?? (this._slots.length || 6)
  }

  #collectSlots(): void {
    this._slots = [...this.querySelectorAll("tec-input-otp-slot")]
  }

  #regex(): RegExp | null {
    const source = PATTERNS[this.pattern] ?? this.pattern
    if (!source) return null
    try {
      return new RegExp(`^(?:${source})$`, "v")
    } catch {
      return null
    }
  }

  #accepts(value: string): boolean {
    const regex = this.#regex()
    return value.length <= this.length && (!value || !regex || regex.test(value))
  }

  /** Selects all the characters. */
  select(): void {
    this.input?.select()
  }

  // ---------------------------------------------------------------- input handling
  #onInput(event: Event) {
    const input = this.input
    if (!this.#accepts(input.value)) {
      // Reject: restore the previous value and swallow the event.
      event.stopImmediatePropagation()
      input.value = this.#previousValue
      const [start, end] = this.#previousSelection ?? [input.value.length, input.value.length]
      input.setSelectionRange(start, end)
      return
    }
    this.#commit(input.value)
  }

  #commit(value: string) {
    this.value = value
    this.#previousValue = value
    queueMicrotask(() => this.#syncSelection())
    if (value.length === this.length) this.emit("tec-complete", { detail: { value } })
  }

  #onPaste(event: ClipboardEvent) {
    event.preventDefault()
    if (this.readonly || this.isDisabled) return
    const input = this.input
    const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, "")
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const next = (input.value.slice(0, start) + text + input.value.slice(start === end ? start : end)).slice(0, this.length)
    if (!this.#accepts(next)) return
    input.value = next
    input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertFromPaste", data: text }))
    const caret = Math.min(next.length, this.length - 1)
    input.setSelectionRange(caret, next.length)
  }

  /**
   * Focus and every click put the caret at the end of the code, like the input-otp library: the
   * next empty slot, or the last character of a full code (selected, so typing replaces it).
   * Clicking a slot never jumps into the middle; the arrow keys do.
   */
  #toEnd = () => {
    const input = this.input
    if (!input) return
    const length = input.value.length
    const start = Math.min(length, this.length - 1)
    input.setSelectionRange(start, length)
    this.#previousSelection = null
    this.#syncSelection()
  }

  /** A mouse up after a pointer press would move the native caret: re-apply the end position. */
  #onPointerUp = () => requestAnimationFrame(this.#toEnd)

  /** Selects the character at `index` (or places the caret there when it is the next empty slot). */
  #setSelection(index: number) {
    const input = this.input
    const length = input.value.length
    if (index >= length) input.setSelectionRange(length, length)
    else input.setSelectionRange(index, index + 1)
    this.#previousSelection = null
    this.#syncSelection()
  }

  /**
   * Keeps one character selected while the caret is inside the code (so typing replaces it), like
   * the input-otp library: arrows move by one slot.
   */
  #syncSelection = () => {
    const input = this.input
    if (!input || this.shadowRoot?.activeElement !== input) {
      this._selection = null
      this.#previousSelection = null
      return
    }
    const max = this.length
    const length = input.value.length
    let start = input.selectionStart ?? length
    let end = input.selectionEnd ?? length
    const insertMode = start === length && length < max
    if (start === end && !insertMode) {
      if (start === 0) end = 1
      else if (start >= max) {
        start = max - 1
        end = max
      } else {
        const previous = this.#previousSelection
        let offset = 0
        if (previous) {
          const backward = start < previous[1]
          const wasInserting = previous[0] === previous[1] && previous[0] < max
          if (backward && !wasInserting) offset = -1
        }
        start = Math.max(0, start + offset)
        end = start + 1
      }
      input.setSelectionRange(start, end)
    }
    this.#previousSelection = [start, end]
    this._selection = [start, end]
  }

  #onKeyDown(event: KeyboardEvent) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      this.#setSelection(event.key === "Home" ? 0 : this.input.value.length)
      return
    }
    requestAnimationFrame(this.#syncSelection)
  }

  // ---------------------------------------------------------------- rendering
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const value: InputOtpContextValue = {
      value: this.value,
      maxLength: this.length,
      selection: this._selection,
      invalid: this.showInvalid,
      disabled: this.isDisabled,
      slots: this._slots,
    }
    this.#provider.setValue(value, true)
  }

  protected override updated(changed: PropertyValues): void {
    const input = this.input
    if (input && input.value !== this.value) {
      input.value = this.value.slice(0, this.length)
      this.#previousValue = input.value
    }
    super.updated(changed)
    this.toggleState("complete", this.value.length >= this.length)
    // Validity is computed after rendering: re-provide when the displayed state changed.
    if (this.#provider.value && this.#provider.value.invalid !== this.showInvalid) this.requestUpdate()
  }

  protected override render() {
    const inputMode = this.inputMode || (this.pattern === "digits" ? "numeric" : "text")
    return html`<div class="base" part="base">
      <slot></slot>
      <input
        class="input"
        part="input"
        spellcheck="false"
        autocapitalize="off"
        maxlength=${this.length}
        autocomplete=${this.autocomplete as AutoFill}
        inputmode=${inputMode}
        aria-label=${ifDefined(this.label || undefined)}
        ?disabled=${this.isDisabled}
        ?required=${this.required}
        ?readonly=${this.readonly}
        @input=${this.#onInput}
        @change=${this.redispatchChange}
        @paste=${this.#onPaste}
        @click=${this.#toEnd}
        @mouseup=${this.#onPointerUp}
        @keydown=${this.#onKeyDown}
        @focus=${this.#toEnd}
        @blur=${this.#syncSelection}
        @select=${this.#syncSelection}
        @selectionchange=${this.#syncSelection}
      />
    </div>`
  }
}

/**
 * @summary A row of joined slots in an OTP input.
 *
 * @tag tec-input-otp-group
 *
 * @slot - `tec-input-otp-slot` elements.
 *
 * @csspart base - The row (rounded; ringed while the code displays invalidity).
 *
 * @cssstate invalid - The OTP input displays invalidity.
 */
export class TecInputOtpGroup extends TectonElement {
  static styles = [hostStyles, inputOtpGroupStyles]
  #otp = new ContextConsumer(this, { context: inputOtpContext, subscribe: true })
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("invalid", !!this.#otp.value?.invalid)
  }
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Displays one character of the code (and a blinking caret in the active empty slot). Size the
 * slots with the `--tec-input-otp-slot-width` / `-height` / `-font-size` custom properties (set them
 * on the slot, its group or the OTP input).
 *
 * @summary One character box of an OTP input.
 *
 * @tag tec-input-otp-slot
 *
 * @csspart base - The character box.
 * @csspart caret - The fake caret.
 *
 * @cssprop --tec-input-otp-slot-width - Slot width (default 2rem).
 * @cssprop --tec-input-otp-slot-height - Slot height (default 2rem).
 * @cssprop --tec-input-otp-slot-font-size - Character size (default `--tec-text-sm`).
 *
 * @cssstate active - The slot is selected (or holds the caret) while the input has focus.
 * @cssstate filled - The slot holds a character.
 * @cssstate invalid - The OTP input displays invalidity.
 */
export class TecInputOtpSlot extends TectonElement {
  static styles = [hostStyles, inputOtpSlotStyles]

  /** Position of the character this slot shows (0-based, across every group). Defaults to the slot's position among the slots. */
  @property({ type: Number }) index?: number

  #otp = new ContextConsumer(this, { context: inputOtpContext, subscribe: true })

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
  }

  #position(): number {
    const otp = this.#otp.value
    return this.index ?? (otp ? otp.slots.indexOf(this) : -1)
  }

  #isActive(): boolean {
    const otp = this.#otp.value
    const selection = otp?.selection
    if (!otp || !selection) return false
    const index = this.#position()
    const [start, end] = selection
    return start === end ? index === start : index >= start && index < end
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const otp = this.#otp.value
    this.toggleState("active", this.#isActive())
    this.toggleState("filled", !!otp?.value[this.#position()])
    this.toggleState("invalid", !!otp?.invalid)
  }

  protected override render() {
    const otp = this.#otp.value
    const char = otp?.value[this.#position()] ?? ""
    const caret = this.#isActive() && !char
    return html`<div class="base" part="base">${char}${caret ? html`<div class="caret" part="caret"></div>` : null}</div>`
  }
}

/**
 * @summary A separator (a dash) between OTP groups.
 *
 * @tag tec-input-otp-separator
 *
 * @slot - A custom separator glyph (default: a minus icon).
 */
export class TecInputOtpSeparator extends TectonElement {
  static styles = [hostStyles, inputOtpSeparatorStyles]
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
  }
  protected override render() {
    return html`<slot>${icon(Minus, { size: 24 })}</slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-input-otp": TecInputOtp
    "tec-input-otp-group": TecInputOtpGroup
    "tec-input-otp-slot": TecInputOtpSlot
    "tec-input-otp-separator": TecInputOtpSeparator
  }
}
