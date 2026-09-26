import { toCalendarDate, toCalendarDateTime } from "@internationalized/date"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { nativeValueMissingMessage, type FormValue, type Validator } from "../../internal/form-control.js"
import type { TecRangeCalendar } from "../calendar/range-calendar.js"
import {
  dateFormatter,
  formatIsoDate,
  formatIsoValue,
  parseIsoDate,
  parseIsoDateTime,
  parseIsoRange,
  toGregorian,
  todayDate,
  validateDate,
  validationMessages,
  type DateLike,
} from "../calendar/date-utils.js"
import type { SegmentValue } from "../date-field/segments.js"
import { DatePickerBase } from "./date-picker-base.js"

/**
 * A date range input with a two-month-capable range calendar popover (the React Aria
 * DateRangePicker): start and end segmented fields with a calendar button, or
 * `appearance="button"` showing the formatted range. The value is an ISO 8601 interval
 * (`2026-01-20/2026-02-09`), submitted as one entry named `name` or as two entries with `start-name`
 * / `end-name`; a reversed or incomplete range is `badInput`.
 *
 * @summary A date range field or button with a range calendar popover.
 *
 * @tag tec-date-range-picker
 *
 * @slot start - Leading icon (field or button).
 * @slot end - Trailing icon.
 * @slot footer - Content under the calendar in the popover (presets).
 *
 * @csspart base - The field box, or the button of `appearance="button"`.
 * @csspart input - The row of segments (field appearance).
 * @csspart segment - An editable segment (`role="spinbutton"`).
 * @csspart literal - A separator between segments.
 * @csspart trigger - The button that opens the calendar.
 * @csspart value - The formatted range or placeholder (button appearance).
 * @csspart content - The popover panel (`role="dialog"`).
 * @csspart calendar - The `tec-range-calendar` in the popover.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 *
 * @fires input - The user changed the range.
 * @fires change - The user changed the range.
 * @fires tec-open-change - The user opened or closed the calendar. Cancelable. `detail: { open, reason }`.
 */
export class TecDateRangePicker extends DatePickerBase {
  /** Name of the form entry of the start date (with `end-name`, two entries are submitted instead of `name`). */
  @property({ attribute: "start-name" }) startName = ""

  /** Name of the form entry of the end date. */
  @property({ attribute: "end-name" }) endName = ""

  /** Allows a range to include unavailable days. */
  @property({ type: Boolean, attribute: "allows-non-contiguous-ranges" }) allowsNonContiguousRanges = false

  /** Accessible name of the start date segments. */
  @property({ attribute: "start-label" }) startLabel = "Start date"

  /** Accessible name of the end date segments. */
  @property({ attribute: "end-label" }) endLabel = "End date"

  #lastSynced: string | null = null
  #start = this.newField(() => this.#fromFields())
  #end = this.newField(() => this.#fromFields())
  protected readonly fields = [this.#start, this.#end]

  #parseOne(value: string | undefined): DateLike | null {
    const v = parseIsoDateTime(value)
    if (!v) return null
    if (this.granularity === "day") return toCalendarDate(v)
    return "hour" in v ? v : toCalendarDateTime(v)
  }

  #parts(): [DateLike | null, DateLike | null] {
    const [a, b] = (this.value || "").split("/")
    return [this.#parseOne(a), this.#parseOne(b)]
  }

  #format(v: SegmentValue): string {
    return formatIsoValue(toGregorian(v as DateLike), this.granularity)
  }

  #fromFields(): void {
    const s = this.#start.value
    const e = this.#end.value
    this.#commit(s && e ? `${this.#format(s)}/${this.#format(e)}` : "")
  }

  #commit(value: string): void {
    this.#lastSynced = value
    if (value === this.value) return
    this.value = value
    this.fireChange()
  }

  /** The start date (ISO), or `""`. */
  get start(): string {
    return this.value.split("/")[0] ?? ""
  }

  /** The end date (ISO), or `""`. */
  get end(): string {
    return this.value.split("/")[1] ?? ""
  }

  /** Whether the fields hold an incomplete range. */
  get isPartial(): boolean {
    return !this.value && (!this.#start.isEmpty || !this.#end.isEmpty)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (this.value !== this.#lastSynced) {
      this.#lastSynced = this.value
      const [s, e] = this.#parts()
      this.#start.setValue(s as SegmentValue | null)
      this.#end.setValue(e as SegmentValue | null)
    }
  }

  protected formattedValue(): string {
    const [s, e] = this.#parts()
    if (!s || !e) return ""
    const withTime = this.granularity !== "day"
    const f = dateFormatter(this.resolvedLocale, { dateStyle: this.dateStyle, ...(withTime ? { timeStyle: "short" } : {}), timeZone: "UTC" })
    return s.compare(e) <= 0 ? f.formatRange(s.toDate("UTC"), e.toDate("UTC")) : `${f.format(s.toDate("UTC"))} – ${f.format(e.toDate("UTC"))}`
  }

  get #calendar(): TecRangeCalendar | null {
    return this.renderRoot?.querySelector<TecRangeCalendar>("tec-range-calendar") ?? null
  }

  #calendarValue(): string {
    const [s, e] = this.#parts()
    return s && e && s.compare(e) <= 0 ? `${formatIsoDate(s)}/${formatIsoDate(e)}` : ""
  }

  protected prepareCalendar(): void {
    const calendar = this.#calendar
    if (!calendar) return
    const [s] = this.#parts()
    calendar.value = this.#calendarValue()
    calendar.focusedDate = s ? formatIsoDate(s) : formatIsoDate(parseIsoDate(this.placeholderValue) ?? todayDate())
  }

  #onCalendarChange = (event: Event) => {
    event.stopPropagation()
    const range = parseIsoRange((event.target as TecRangeCalendar).value)
    if (!range) return
    const [cs, ce] = this.#parts()
    const withTime = (d: typeof range.start, current: DateLike | null) =>
      this.granularity === "day" ? d : toCalendarDateTime(d, current && "hour" in current ? current : undefined)
    const s = withTime(range.start, cs)
    const e = withTime(range.end, ce)
    this.#start.setValue(s as SegmentValue)
    this.#end.setValue(e as SegmentValue)
    this.#commit(`${formatIsoValue(s, this.granularity)}/${formatIsoValue(e, this.granularity)}`)
    this.markInteracted()
    this.requestOpen(false, "select")
  }

  protected override get validators(): Validator<TecDateRangePicker>[] {
    return [
      (el) => (el.isPartial ? { flags: { badInput: true }, message: validationMessages.incomplete } : null),
      (el) => (el.required && !el.value ? { flags: { valueMissing: true }, message: nativeValueMissingMessage() } : null),
      (el) => {
        const [s, e] = el.#parts()
        if (s && e && s.compare(e) > 0) return { flags: { badInput: true }, message: validationMessages.rangeReversed }
        const min = el.#parseOne(el.min)
        const max = el.#parseOne(el.max)
        return validateDate(s, min, max, el.isDateUnavailable, el.resolvedLocale, el.granularity) ?? validateDate(e, min, max, el.isDateUnavailable, el.resolvedLocale, el.granularity)
      },
    ]
  }

  protected override formValue(): FormValue {
    if (this.startName || this.endName) {
      const data = new FormData()
      if (this.startName) data.append(this.startName, this.start)
      if (this.endName) data.append(this.endName, this.end)
      return data
    }
    return this.value
  }

  protected override formRestoreState(state: FormValue): void {
    if (typeof state === "string") this.value = state
    else if (state instanceof FormData) {
      const s = state.get(this.startName)
      const e = state.get(this.endName)
      if (s && e) this.value = `${s}/${e}`
    }
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#lastSynced = null
  }

  protected renderInput() {
    return html`${this.renderSegments(this.#start, "start", this.startLabel)}<span class="separator" part="literal" aria-hidden="true">–</span>${this.renderSegments(
        this.#end,
        "end",
        this.endLabel
      )}`
  }

  protected renderCalendar() {
    const o = this.calendarOptions()
    return html`<tec-range-calendar
      class="calendar"
      part="calendar"
      .value=${this.#calendarValue()}
      .locale=${o.locale}
      .min=${o.min}
      .max=${o.max}
      .visibleMonths=${o.visibleMonths}
      .captionLayout=${o.captionLayout}
      .firstDayOfWeek=${o.firstDayOfWeek}
      .showWeekNumber=${o.showWeekNumber}
      .fixedWeeks=${o.fixedWeeks}
      .buttonVariant=${o.buttonVariant}
      .allowsNonContiguousRanges=${this.allowsNonContiguousRanges}
      .isDateUnavailable=${this.isDateUnavailable}
      .renderDay=${this.renderDay}
      .disabled=${this.isDisabled}
      .readonly=${this.readonly}
      @input=${this.stopInner}
      @change=${this.#onCalendarChange}
    ></tec-range-calendar>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-date-range-picker": TecDateRangePicker
  }
}
