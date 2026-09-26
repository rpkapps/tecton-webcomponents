import { isSameDay, type CalendarDate } from "@internationalized/date"
import { property, state } from "lit/decorators.js"
import { requiredValidator, type FormValue, type Validator } from "../../internal/form-control.js"
import { CalendarBase, type CalendarSelection } from "./calendar-base.js"
import { dateFormatter, formatIsoDate, localTimeZone, parseIsoRange, validateDate, validationMessages } from "./date-utils.js"

/** A selected range of days (Gregorian `CalendarDate`s). */
export interface CalendarDateRange {
  start: CalendarDate
  end: CalendarDate
}

/**
 * The range variant of `tec-calendar`: the first selected day anchors the range, hovering or moving
 * focus previews it, the second selection completes it (dragging works too). By default a range
 * cannot span an unavailable day. The value is an ISO 8601 interval, `start/end`
 * (`2026-01-12/2026-02-11`), submitted as one entry named `name`, or as two entries with
 * `start-name` / `end-name`.
 *
 * @summary A calendar that lets the user select a range of dates.
 *
 * @tag tec-range-calendar
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
 * @cssstate selecting - The first day is chosen and the range is being completed.
 *
 * @fires input - The user completed a range.
 * @fires change - The user completed a range.
 */
export class TecRangeCalendar extends CalendarBase {
  /** Name of the form entry of the start date (with `end-name`, submits two entries instead of `name`). */
  @property({ attribute: "start-name" }) startName = ""

  /** Name of the form entry of the end date. */
  @property({ attribute: "end-name" }) endName = ""

  /** Allows a range to include unavailable days (they stay unselectable themselves). */
  @property({ type: Boolean, attribute: "allows-non-contiguous-ranges" }) allowsNonContiguousRanges = false

  @state() private _anchor: CalendarDate | null = null
  @state() private _highlight: CalendarDate | null = null
  #pressedIso: string | null = null

  /** The start date (`YYYY-MM-DD`), or `""`. */
  get start(): string {
    const range = parseIsoRange(this.value)
    return range ? formatIsoDate(range.start) : ""
  }

  /** The end date (`YYYY-MM-DD`), or `""`. */
  get end(): string {
    const range = parseIsoRange(this.value)
    return range ? formatIsoDate(range.end) : ""
  }

  /** The value as `@internationalized/date` values, or `null`. */
  get range(): CalendarDateRange | null {
    return parseIsoRange(this.value)
  }

  /** Whether the user has chosen the first day and not yet the second. */
  get selecting(): boolean {
    return !!this._anchor
  }

  #highlighted(): { start: CalendarDate; end: CalendarDate } | null {
    if (this._anchor) {
      let other = this._highlight ?? this._anchor
      const min = this.minDate
      const max = this.maxDate
      if (min && other.compare(min) < 0) other = min
      if (max && other.compare(max) > 0) other = max
      return this._anchor.compare(other) <= 0 ? { start: this._anchor, end: other } : { start: other, end: this._anchor }
    }
    const range = parseIsoRange(this.value)
    return range ? { start: this.toDisplay(range.start), end: this.toDisplay(range.end) } : null
  }

  /** While choosing the end, a range can't cross an unavailable day: min/max shrink to the available span. */
  #available(): { start: CalendarDate | null; end: CalendarDate | null } | null {
    const anchor = this._anchor
    if (!anchor || this.allowsNonContiguousRanges || !this.isDateUnavailable) return null
    const scan = (dir: 1 | -1): CalendarDate | null => {
      const limit = dir < 0 ? this.visibleStart : this.visibleEnd
      let d = anchor.add({ days: dir })
      while (dir < 0 ? d.compare(limit) >= 0 : d.compare(limit) <= 0) {
        if (this.isUnavailable(d)) return d.add({ days: -dir })
        d = d.add({ days: dir })
      }
      return null
    }
    return { start: scan(-1), end: scan(1) }
  }

  protected override get minDate(): CalendarDate | null {
    const base = super.minDate
    const available = this.#available()?.start
    if (!available) return base
    return !base || available.compare(base) > 0 ? available : base
  }

  protected override get maxDate(): CalendarDate | null {
    const base = super.maxDate
    const available = this.#available()?.end
    if (!available) return base
    return !base || available.compare(base) < 0 ? available : base
  }

  protected selectedDates(): CalendarDate[] {
    const range = parseIsoRange(this.value)
    return range ? [range.start, range.end] : []
  }

  protected isDateSelected(date: CalendarDate): boolean {
    const range = this.#highlighted()
    return !!range && date.compare(range.start) >= 0 && date.compare(range.end) <= 0
  }

  protected selectionOf(date: CalendarDate): CalendarSelection {
    const range = this.#highlighted()
    if (!range) return undefined
    const start = isSameDay(date, range.start)
    const end = isSameDay(date, range.end)
    return start && end ? "both" : start ? "start" : end ? "end" : "middle"
  }

  protected selectDate(date: CalendarDate, source: "pointer" | "keyboard"): void {
    if (!this._anchor) {
      this._anchor = date
      this._highlight = date
      if (source === "keyboard") {
        // Advance focus by a day so the range being built is visible (like React Aria).
        const next = date.add({ days: 1 })
        if (!this.isCellDisabled(next) && !this.isUnavailable(next)) this.setFocused(next, { focus: true })
      }
      return
    }
    const anchor = this._anchor
    const [start, end] = anchor.compare(date) <= 0 ? [anchor, date] : [date, anchor]
    this._anchor = null
    this._highlight = null
    this.value = `${formatIsoDate(start)}/${formatIsoDate(end)}`
    this.fireChange()
  }

  protected override onFocusedChange(date: CalendarDate): void {
    if (this._anchor) this._highlight = date
  }

  protected override onEscape(): void {
    this._anchor = null
    this._highlight = null
  }

  protected override selectsOnClick(event: MouseEvent): boolean {
    // Pointer presses are handled on pointerdown/up (to allow dragging); only virtual clicks select here.
    return event.detail === 0
  }

  protected override onCellPointerDown(date: CalendarDate): void {
    if (!this._anchor) {
      this.selectDate(date, "pointer")
      this.#pressedIso = formatIsoDate(date)
    } else {
      this.#pressedIso = null
    }
  }

  protected override onCellPointerUp(date: CalendarDate): void {
    const iso = formatIsoDate(date)
    if (this._anchor && this.#pressedIso !== iso) this.selectDate(date, "pointer")
    this.#pressedIso = null
  }

  protected override onCellPointerEnter(date: CalendarDate, event: PointerEvent): void {
    if (this._anchor && (event.pointerType !== "touch" || this.#pressedIso)) this._highlight = date
  }

  protected override rangeSelectionPrompt(): string {
    if (this.readonly || this.isDisabled) return ""
    return this._anchor ? "Click to finish selecting date range" : "Click to start selecting date range"
  }

  protected override get multiselectable(): boolean {
    return true
  }

  protected selectionDescription(): string {
    if (this._anchor) return ""
    const range = parseIsoRange(this.value)
    if (!range) return ""
    const tz = localTimeZone()
    const f = dateFormatter(this.resolvedLocale, { weekday: "long", month: "long", year: "numeric", day: "numeric", timeZone: tz })
    if (isSameDay(range.start, range.end)) return `Selected Date: ${f.format(range.start.toDate(tz))}`
    return `Selected Range: ${f.format(range.start.toDate(tz))} to ${f.format(range.end.toDate(tz))}`
  }

  #validation() {
    if (this.value && !parseIsoRange(this.value)) return { flags: { badInput: true }, message: validationMessages.incomplete }
    for (const date of this.selectedDates()) {
      const result = validateDate(date, this.#bound(this.min), this.#bound(this.max), this.isDateUnavailable, this.resolvedLocale)
      if (result) return result
    }
    return null
  }

  #bound(value: string): CalendarDate | null {
    return value ? (parseIsoRange(`${value}/${value}`)?.start ?? null) : null
  }

  protected override valueInvalid(): boolean {
    return !this._anchor && !!this.#validation()
  }

  protected override get validators(): Validator<TecRangeCalendar>[] {
    return [requiredValidator<TecRangeCalendar>((el) => !parseIsoRange(el.value)), () => this.#validation()]
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
      const start = state.get(this.startName)
      const end = state.get(this.endName)
      if (start && end) this.value = `${start}/${end}`
    }
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed)
    this.toggleState("selecting", !!this._anchor)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-range-calendar": TecRangeCalendar
  }
}
