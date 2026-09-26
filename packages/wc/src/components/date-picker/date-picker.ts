import { CalendarDateTime, toCalendarDate, toCalendarDateTime } from "@internationalized/date"
import { html, type PropertyValues } from "lit"
import { nativeValueMissingMessage, type Validator } from "../../internal/form-control.js"
import type { TecCalendar } from "../calendar/calendar.js"
import {
  dateFormatter,
  formatIsoDate,
  formatIsoValue,
  parseIsoDate,
  parseIsoDateTime,
  toGregorian,
  todayDate,
  validateDate,
  validationMessages,
  type DateLike,
} from "../calendar/date-utils.js"
import type { SegmentValue } from "../date-field/segments.js"
import { DatePickerBase } from "./date-picker-base.js"

export type { DatePickerAppearance, DatePickerOpenChangeDetail, DatePickerOpenChangeReason } from "./date-picker-base.js"

/**
 * A date input with a calendar popover (the React Aria DatePicker). The default `field` appearance
 * is a segmented date field (type the date) with a calendar button; <kbd>Alt</kbd>+<kbd>↓</kbd> opens
 * the calendar too. `appearance="button"` is the Tecton button-style picker: an outline button that
 * shows the formatted date and opens the calendar. Choosing a day closes the popover and returns
 * focus. Form-associated: the value is an ISO date (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with a time
 * `granularity`), validated against `required`, `min`, `max` and `isDateUnavailable`.
 *
 * @summary A date field or button with a calendar popover.
 *
 * @tag tec-date-picker
 *
 * @slot start - Leading icon (field or button).
 * @slot end - Trailing icon (e.g. a chevron in the button appearance).
 * @slot footer - Content under the calendar in the popover (presets, a time field).
 *
 * @csspart base - The field box, or the button of `appearance="button"`.
 * @csspart input - The row of segments (field appearance).
 * @csspart segment - An editable segment (`role="spinbutton"`).
 * @csspart literal - A separator between segments.
 * @csspart trigger - The button that opens the calendar.
 * @csspart value - The formatted value or placeholder (button appearance).
 * @csspart content - The popover panel (`role="dialog"`).
 * @csspart calendar - The `tec-calendar` in the popover.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 *
 * @fires input - The user changed the date (typed, stepped or picked).
 * @fires change - The user changed the date.
 * @fires tec-open-change - The user opened or closed the calendar. Cancelable. `detail: { open, reason }`.
 */
export class TecDatePicker extends DatePickerBase {
  #lastSynced: string | null = null

  #field = this.newField((v) => this.#commit(v ? formatIsoValue(toGregorian(v as DateLike), this.granularity) : ""))
  protected readonly fields = [this.#field]

  #parse(value: string): DateLike | null {
    const v = parseIsoDateTime(value)
    if (!v) return null
    if (this.granularity === "day") return toCalendarDate(v)
    return "hour" in v ? v : toCalendarDateTime(v)
  }

  #commit(value: string): void {
    this.#lastSynced = value
    if (value === this.value) return
    this.value = value
    this.fireChange()
  }

  /** Whether some segments are filled but the date is incomplete or does not exist. */
  get isPartial(): boolean {
    return this.#field.isPartial
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (this.value !== this.#lastSynced) {
      this.#lastSynced = this.value
      this.#field.setValue(this.#parse(this.value))
    }
  }

  protected formattedValue(): string {
    const v = this.#parse(this.value)
    if (!v) return ""
    const withTime = this.granularity !== "day" && "hour" in v
    return dateFormatter(this.resolvedLocale, { dateStyle: this.dateStyle, ...(withTime ? { timeStyle: "short" } : {}), timeZone: "UTC" }).format(v.toDate("UTC"))
  }

  get #calendar(): TecCalendar | null {
    return this.renderRoot?.querySelector<TecCalendar>("tec-calendar") ?? null
  }

  protected prepareCalendar(): void {
    const calendar = this.#calendar
    if (!calendar) return
    const v = this.#parse(this.value)
    calendar.value = v ? formatIsoDate(v) : ""
    calendar.focusedDate = v ? formatIsoDate(v) : formatIsoDate(parseIsoDate(this.placeholderValue) ?? todayDate())
  }

  #onCalendarChange = (event: Event) => {
    event.stopPropagation()
    const date = parseIsoDate((event.target as TecCalendar).value)
    if (!date) return
    let next: DateLike = date
    if (this.granularity !== "day") {
      const current = this.#parse(this.value)
      const time = current && "hour" in current ? current : { hour: 0, minute: 0, second: 0 }
      next = new CalendarDateTime(date.year, date.month, date.day, time.hour, time.minute, time.second)
    }
    const iso = formatIsoValue(next, this.granularity)
    this.#field.setValue(next as SegmentValue)
    this.#commit(iso)
    this.markInteracted()
    this.requestOpen(false, "select")
  }

  protected override get validators(): Validator<TecDatePicker>[] {
    return [
      (el) => (el.isPartial ? { flags: { badInput: true }, message: validationMessages.incomplete } : null),
      (el) => (el.required && !el.value ? { flags: { valueMissing: true }, message: nativeValueMissingMessage() } : null),
      (el) => validateDate(el.#parse(el.value), el.#parse(el.min), el.#parse(el.max), el.isDateUnavailable, el.resolvedLocale, el.granularity),
    ]
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#lastSynced = null
  }

  protected renderInput() {
    return this.renderSegments(this.#field, "date")
  }

  protected renderCalendar() {
    const o = this.calendarOptions()
    const v = this.#parse(this.value)
    return html`<tec-calendar
      class="calendar"
      part="calendar"
      .value=${v ? formatIsoDate(v) : ""}
      .locale=${o.locale}
      .min=${o.min}
      .max=${o.max}
      .visibleMonths=${o.visibleMonths}
      .captionLayout=${o.captionLayout}
      .firstDayOfWeek=${o.firstDayOfWeek}
      .showWeekNumber=${o.showWeekNumber}
      .fixedWeeks=${o.fixedWeeks}
      .buttonVariant=${o.buttonVariant}
      .isDateUnavailable=${this.isDateUnavailable}
      .renderDay=${this.renderDay}
      .disabled=${this.isDisabled}
      .readonly=${this.readonly}
      @input=${this.stopInner}
      @change=${this.#onCalendarChange}
    ></tec-calendar>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-date-picker": TecDatePicker
  }
}
