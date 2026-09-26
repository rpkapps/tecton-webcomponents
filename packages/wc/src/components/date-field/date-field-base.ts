/** Shared implementation of `tec-date-field` and `tec-time-field`. */
import { html, LitElement, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { resolveIdRefs } from "../../internal/aria.js"
import { FormControlMixin, nativeValueMissingMessage, type Validator } from "../../internal/form-control.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { resolveLocale, type DateGranularity } from "../calendar/date-utils.js"
import { dateFieldStyles } from "./date-field.styles.js"
import { focusSibling, hostLabels, segmentToFocus, syncSegmentAria } from "./field-helpers.js"
import { SegmentedField, type SegmentFieldKind, type SegmentValue } from "./segments.js"

/** Look of the field box. */
export type DateFieldVariant = "outline" | "filled" | "text"

export abstract class DateFieldBase extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, dateFieldStyles]
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Locale (BCP 47) for the segment order, separators, placeholders and the hour cycle. Default: the `lang` of the closest ancestor, else the browser language. */
  @property() locale = ""

  /** 12- or 24-hour clock. Default: the locale's. */
  @property({ type: Number, attribute: "hour-cycle" }) hourCycle?: 12 | 24

  /** Always shows two digits for months, days and hours. */
  @property({ type: Boolean, attribute: "leading-zeros" }) leadingZeros = false

  /** The value cannot be edited (it can still be focused and is submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** Look of the field: `outline` (default), `filled` or `text` (underline only), like `tec-input`. */
  @property({ reflect: true }) variant: DateFieldVariant = "outline"

  /** Earliest valid value (ISO). */
  @property() min = ""

  /** Latest valid value (ISO). */
  @property() max = ""

  /** Value used to fill a segment stepped with the arrow keys while empty (ISO). Default: today at midnight. */
  @property({ attribute: "placeholder-value" }) placeholderValue = ""

  #lastSynced: string | null = null

  protected abstract get kind(): SegmentFieldKind
  protected abstract get fieldGranularity(): DateGranularity
  protected abstract parse(value: string): SegmentValue | null
  protected abstract format(value: SegmentValue): string
  /** Validation of a complete value (min/max/unavailable), or null. */
  protected abstract validateValue(value: SegmentValue): { flags: ValidityStateFlags; message: string } | null
  protected abstract get incompleteMessage(): string

  protected readonly field = new SegmentedField({
    kind: () => this.kind,
    granularity: () => this.fieldGranularity,
    locale: () => resolveLocale(this, this.locale),
    hourCycle: () => (this.hourCycle === 12 || this.hourCycle === 24 ? this.hourCycle : undefined),
    placeholderValue: () => this.parse(this.placeholderValue),
    forceLeadingZeros: () => this.leadingZeros,
    requestUpdate: () => this.requestUpdate(),
    onCommit: (value) => {
      const next = value ? this.format(value) : ""
      this.#lastSynced = next
      this.value = next
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
    },
    focusSibling: (from, direction) => focusSibling(this.renderRoot, from, direction),
  })

  /** Whether some segments are filled but the value is incomplete or does not exist. */
  get isPartial(): boolean {
    return this.field.isPartial
  }

  /** Empties the field (no event). */
  clear(): void {
    this.value = ""
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (this.value !== this.#lastSynced) {
      this.#lastSynced = this.value
      this.field.setValue(this.parse(this.value))
    }
  }

  protected override get formControl(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(".field") ?? null
  }

  protected override get validators(): Validator<DateFieldBase>[] {
    return [
      (el) => (el.field.isPartial ? { flags: { badInput: true }, message: el.incompleteMessage } : null),
      (el) => (el.required && !el.value ? { flags: { valueMissing: true }, message: nativeValueMissingMessage() } : null),
      (el) => {
        const v = el.parse(el.value)
        return v ? el.validateValue(v) : null
      },
    ]
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#lastSynced = null
  }

  override syncFormState(): void {
    super.syncFormState()
    if (!this.renderRoot) return
    const described = resolveIdRefs(this, this.getAttribute("aria-describedby"))
    syncSegmentAria(this.renderRoot, hostLabels(this, this.formLabels()), this.showInvalid, described)
  }

  override focus(options?: FocusOptions): void {
    segmentToFocus(this.renderRoot)?.focus(options)
  }

  #onFieldPointerDown = (event: PointerEvent) => {
    const interactive = event
      .composedPath()
      .some((n) => n instanceof HTMLElement && (n.classList.contains("segment") || n.matches("button, a, input, select, tec-button")))
    if (interactive || this.isDisabled || event.button !== 0) return
    event.preventDefault()
    this.focus()
  }

  #onFocusIn = (event: FocusEvent) => {
    if ((event.composedPath()[0] as HTMLElement).classList?.contains("field")) this.focus()
  }

  #onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next && this.renderRoot.contains(next)) return
    this.field.confirm()
  }

  protected renderSegments() {
    return this.field.render({
      disabled: this.isDisabled,
      readonly: this.readonly,
      required: this.required,
      invalid: false,
      label: this.getAttribute("aria-label"),
    })
  }

  protected override render() {
    return html`<div
      class="field"
      part="base"
      role="group"
      tabindex="-1"
      @pointerdown=${this.#onFieldPointerDown}
      @focusin=${this.#onFocusIn}
      @focusout=${this.#onFocusOut}
    >
      <slot name="start"></slot>
      <div class="input" part="input">${this.renderSegments()}</div>
      <slot name="end"></slot>
    </div>`
  }
}
