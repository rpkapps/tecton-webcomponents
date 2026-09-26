import { isSameDay, type CalendarDate } from "@internationalized/date"
import { property } from "lit/decorators.js"
import { requiredValidator, type FormValue, type Validator } from "../../internal/form-control.js"
import { CalendarBase, type CalendarSelection } from "./calendar-base.js"
import { dateFormatter, formatIsoDate, localTimeZone, parseIsoDate, validateDate } from "./date-utils.js"

export type { CalendarButtonVariant, CalendarCaptionLayout, CalendarDay, CalendarSelection } from "./calendar-base.js"

const splitList = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)

/**
 * An inline month grid (the WAI-ARIA date grid React Aria implements): arrow keys move by day and
 * week, <kbd>Page Up</kbd>/<kbd>Page Down</kbd> by month (with <kbd>Shift</kbd>, by year),
 * <kbd>Home</kbd>/<kbd>End</kbd> to the start/end of the week, <kbd>Enter</kbd>/<kbd>Space</kbd>
 * select. Month and weekday names, the first day of the week and the calendar system follow the
 * locale. The value is an ISO date (`YYYY-MM-DD`); with a `name` the calendar submits it with its
 * form and validates `required`, `min`, `max` and unavailable dates.
 *
 * @summary A calendar that lets the user select a date (or several).
 *
 * @tag tec-calendar
 *
 * @csspart base - The calendar box (padding, background; radius inherited from the element).
 * @csspart nav - The previous/next buttons row.
 * @csspart previous - The previous button (`tec-button`).
 * @csspart next - The next button (`tec-button`).
 * @csspart month - One month (caption + grid).
 * @csspart caption - The month caption row.
 * @csspart heading - The month and year text (`caption-layout="label"`).
 * @csspart month-select - The month `<select>` (`caption-layout="dropdown"`).
 * @csspart year-select - The year `<select>` (`caption-layout="dropdown"`).
 * @csspart grid - The `<table role="grid">` of a month.
 * @csspart weekday - A weekday name.
 * @csspart week-number - A week number (`show-week-number`).
 * @csspart cell - The focusable day cell (`role="button"`; carries the range band).
 * @csspart day - The day inside a cell. Also `day-selected`, `day-today`, `day-outside`, `day-unavailable`, `day-disabled`, `day-range-start`, `day-range-middle`, `day-range-end`.
 *
 * @cssprop --tec-calendar-cell-size - Size of a day cell (default `2rem`).
 * @cssprop --tec-calendar-cell-radius - Radius of the day cells and the selection band (default `--tec-radius-md`).
 * @cssprop --tec-calendar-padding - Padding of the calendar box (default `0.75rem`).
 * @cssprop --tec-calendar-background - Background of the calendar box (default `--tec-background`; transparent inside `tec-card` and `tec-popover`).
 *
 * @cssstate invalid - The value fails validation (`required`, `min`/`max`, unavailable).
 * @cssstate user-invalid - Invalidity is displayed.
 * @cssstate focus-within - A day has focus.
 *
 * @fires input - The user selected a day.
 * @fires change - The user selected a day.
 */
export class TecCalendar extends CalendarBase {
  /** Lets the user select several days (toggle each). The selection is `values`; the form receives one entry per day. */
  @property({ type: Boolean, reflect: true }) multiple = false

  #values?: string[]

  /** The selected days (`YYYY-MM-DD`) when `multiple`. Until set, parsed from the `value` attribute (comma or space separated). */
  @property({ attribute: false })
  get values(): string[] {
    if (this.#values) return this.#values
    return this.multiple ? splitList(this.defaultValue) : this.value ? [this.value] : []
  }
  set values(values: string[]) {
    this.#values = [...(values ?? [])]
  }

  protected selectedDates(): CalendarDate[] {
    const list = this.multiple ? this.values : [this.value]
    return list.map((v) => parseIsoDate(v)).filter((d): d is CalendarDate => !!d)
  }

  protected isDateSelected(date: CalendarDate): boolean {
    return this.selectedDates().some((d) => isSameDay(d, date))
  }

  protected selectionOf(_date: CalendarDate): CalendarSelection {
    return "single"
  }

  protected selectDate(date: CalendarDate): void {
    const iso = formatIsoDate(date)
    if (this.multiple) {
      const current = this.values
      const next = current.includes(iso) ? current.filter((v) => v !== iso) : [...current, iso].sort()
      this.values = next
      this.value = next[0] ?? ""
    } else {
      if (this.value === iso) return
      this.value = iso
    }
    this.fireChange()
  }

  protected selectionDescription(): string {
    const dates = this.selectedDates()
    if (!dates.length) return ""
    const tz = localTimeZone()
    const f = dateFormatter(this.resolvedLocale, { weekday: "long", month: "long", year: "numeric", day: "numeric", timeZone: tz })
    const formatted = dates.map((d) => f.format(d.toDate(tz)))
    return `Selected Date: ${new Intl.ListFormat(this.resolvedLocale).format(formatted)}`
  }

  protected override valueInvalid(): boolean {
    return !!this.#validation()
  }

  #validation() {
    for (const date of this.selectedDates()) {
      const result = validateDate(date, parseIsoDate(this.min), parseIsoDate(this.max), this.isDateUnavailable, this.resolvedLocale)
      if (result) return result
    }
    return null
  }

  protected override get validators(): Validator<TecCalendar>[] {
    return [requiredValidator<TecCalendar>((el) => el.selectedDates().length === 0), () => this.#validation()]
  }

  protected override formValue(): FormValue {
    if (!this.multiple) return this.value
    const data = new FormData()
    for (const v of this.values) data.append(this.name, v)
    return data
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#values = undefined
  }

  protected override formRestoreState(state: FormValue): void {
    if (typeof state === "string") this.value = state
    else if (state instanceof FormData) this.values = state.getAll(this.name).map(String)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-calendar": TecCalendar
  }
}
