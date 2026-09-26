/**
 * The shared implementation of `tec-calendar` and `tec-range-calendar`: visible months, focus
 * management, the APG date-grid keyboard model, rendering and the month/year dropdowns. Subclasses
 * implement the selection model.
 */
import {
  endOfMonth,
  endOfWeek,
  getWeeksInMonth,
  isSameDay,
  isSameYear,
  isSameMonth,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
  toCalendar,
  type CalendarDate,
} from "@internationalized/date"
import { html, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property, state } from "lit/decorators.js"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide"
import { FormControlMixin } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { calendarStyles } from "./calendar.styles.js"
import {
  constrainDate,
  dateFormatter,
  fieldName,
  formatIsoDate,
  localeCalendar,
  localTimeZone,
  parseIsoDate,
  resolveLocale,
  toGregorian,
  todayDate,
  weekNumber,
  type DayOfWeek,
} from "./date-utils.js"

/** What a `renderDay` callback receives for each day cell. */
export interface CalendarDay {
  /** The day (Gregorian calendar). */
  date: CalendarDate
  /** The day as `YYYY-MM-DD`. */
  iso: string
  /** The day number formatted for the locale (the default content). */
  formatted: string
  isToday: boolean
  isSelected: boolean
  isSelectionStart: boolean
  isSelectionEnd: boolean
  /** The day belongs to the previous or next month (dimmed, not selectable). */
  isOutsideMonth: boolean
  isUnavailable: boolean
  isDisabled: boolean
  /** Saturday/Sunday (or the locale's weekend). */
  isWeekend: boolean
}

/** Layout of the month caption. */
export type CalendarCaptionLayout = "label" | "dropdown"

/** Variant of the previous/next buttons. */
export type CalendarButtonVariant = "ghost" | "outline" | "secondary" | "default"

/** Position of a selected day in the selection band (`both`: a one-day range). */
export type CalendarSelection = "single" | "start" | "end" | "both" | "middle" | undefined

export abstract class CalendarBase extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, srOnly, calendarStyles]

  /** Locale (BCP 47) for month and weekday names, the first day of the week and the calendar system. Default: the `lang` of the closest ancestor, else the browser language. */
  @property() locale = ""

  /** Earliest selectable date (`YYYY-MM-DD`). */
  @property() min = ""

  /** Latest selectable date (`YYYY-MM-DD`). */
  @property() max = ""

  /**
   * Returns `true` for days that cannot be selected (booked, holidays). Receives a Gregorian
   * `CalendarDate` from `@internationalized/date` (`date.toString()` is `YYYY-MM-DD`). Unavailable
   * days stay focusable and are struck through.
   */
  @property({ attribute: false }) isDateUnavailable?: (date: CalendarDate) => boolean

  /**
   * Custom content of a day cell, in place of the day number. Return a string, a new DOM node or an
   * array of them; `<span>` children render as a smaller, dimmed second line.
   */
  @property({ attribute: false }) renderDay?: (day: CalendarDay) => unknown

  /** Number of months shown side by side (stacked below 768px). */
  @property({ type: Number, attribute: "visible-months" }) visibleMonths = 1

  /** `label` shows the month and year as text; `dropdown` shows month and year selects. */
  @property({ attribute: "caption-layout" }) captionLayout: CalendarCaptionLayout = "label"

  /** First day of the week (`sun` … `sat`). Default: the locale's. */
  @property({ attribute: "first-day-of-week" }) firstDayOfWeek?: DayOfWeek

  /** Shows the week number at the start of each week (the locale's week numbering). */
  @property({ type: Boolean, attribute: "show-week-number" }) showWeekNumber = false

  /** Always renders six weeks, so the height does not change between months. */
  @property({ type: Boolean, attribute: "fixed-weeks" }) fixedWeeks = false

  /** Style of the weekday names in the header row. */
  @property({ attribute: "weekday-style" }) weekdayStyle: "narrow" | "short" | "long" = "narrow"

  /** Days can be focused but not selected. */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** Variant of the previous / next month buttons. */
  @property({ attribute: "button-variant" }) buttonVariant: CalendarButtonVariant = "ghost"

  /**
   * `Intl.DateTimeFormat` options of the month caption (`{"month":"short"}`). With
   * `caption-layout="dropdown"`, `month` sets the format of the month names.
   */
  @property({ type: Object, attribute: "header-format" }) headerFormat?: Intl.DateTimeFormatOptions

  /** Accessible name of the calendar (the visible month is appended). */
  @property() label = ""

  /** Accessible name of the previous button. */
  @property({ attribute: "previous-label" }) previousLabel = "Previous"

  /** Accessible name of the next button. */
  @property({ attribute: "next-label" }) nextLabel = "Next"

  /** Focused day inside the grid (in the display calendar). */
  @state() protected focused!: CalendarDate
  /** First day of the first visible month (in the display calendar). */
  @state() protected visibleStart!: CalendarDate
  @state() private _focusWithin = false
  @state() private _announcement = ""

  #initialFocus: string | null = null
  #focusAfterUpdate = false
  #calendarId = ""

  // ------------------------------------------------------------------ selection model (subclasses)

  /** Dates to focus / show first (the selected value), Gregorian. */
  protected abstract selectedDates(): CalendarDate[]
  /** Whether `date` (display calendar) is selected. */
  protected abstract isDateSelected(date: CalendarDate): boolean
  /** Position of `date` in the selection band. */
  protected abstract selectionOf(date: CalendarDate): CalendarSelection
  /** The user selects `date` (display calendar) by pointer or keyboard. */
  protected abstract selectDate(date: CalendarDate, source: "pointer" | "keyboard"): void
  /** Screen reader description of the selection ("Selected Date: …"), or "". */
  protected abstract selectionDescription(): string
  /** Whether the value is invalid (drawn on the selected cells). */
  protected valueInvalid(): boolean {
    return false
  }

  // ------------------------------------------------------------------ public API

  /**
   * The focused day (`YYYY-MM-DD`). Setting it shows its month — e.g. to jump to a selected preset.
   * Its initial value is the `focused-date` attribute, else the selected date, else today.
   */
  @property({ attribute: "focused-date" })
  get focusedDate(): string {
    return this.focused ? formatIsoDate(this.focused) : this.#initialFocus ?? ""
  }
  set focusedDate(value: string) {
    const date = parseIsoDate(value)
    if (!this.focused) {
      this.#initialFocus = date ? value : null
      return
    }
    if (date) this.setFocused(this.toDisplay(date), { reveal: "center" })
  }

  /** Focuses the focused day (or the first focusable control when disabled). */
  override focus(options?: FocusOptions): void {
    const cell = this.renderRoot?.querySelector<HTMLElement>(".cell[tabindex='0']")
    if (cell) cell.focus(options)
    else if (!this.hasUpdated) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".cell[tabindex='0']")?.focus(options))
  }

  // ------------------------------------------------------------------ locale & bounds

  /** The resolved locale. */
  protected get resolvedLocale(): string {
    return resolveLocale(this, this.locale)
  }

  protected toDisplay(date: CalendarDate): CalendarDate {
    return toCalendar(date, localeCalendar(this.resolvedLocale))
  }

  /** Earliest selectable date (display calendar), or null. Range calendars narrow it while selecting. */
  protected get minDate(): CalendarDate | null {
    const d = parseIsoDate(this.min)
    return d ? this.toDisplay(d) : null
  }

  /** Latest selectable date (display calendar), or null. */
  protected get maxDate(): CalendarDate | null {
    const d = parseIsoDate(this.max)
    return d ? this.toDisplay(d) : null
  }

  protected get visibleEnd(): CalendarDate {
    return endOfMonth(this.visibleStart.add({ months: Math.max(1, this.visibleMonths) - 1 }))
  }

  protected isUnavailable(date: CalendarDate): boolean {
    return !!this.isDateUnavailable?.(toGregorian(date))
  }

  protected isOutOfBounds(date: CalendarDate): boolean {
    const min = this.minDate
    const max = this.maxDate
    return (!!min && date.compare(min) < 0) || (!!max && date.compare(max) > 0)
  }

  /** Disabled: the whole calendar, out of min/max, or outside the visible months. */
  protected isCellDisabled(date: CalendarDate): boolean {
    return this.isDisabled || this.isOutOfBounds(date) || date.compare(this.visibleStart) < 0 || date.compare(this.visibleEnd) > 0
  }

  // ------------------------------------------------------------------ focus & navigation

  #months(): number {
    return Math.max(1, Math.floor(this.visibleMonths) || 1)
  }

  #alignStart(date: CalendarDate): CalendarDate {
    let start = startOfMonth(date)
    const max = this.maxDate
    // Don't page past max: keep the last visible month on or before it.
    if (max) {
      const lastStart = startOfMonth(max).subtract({ months: this.#months() - 1 })
      if (start.compare(lastStart) > 0) start = lastStart
    }
    const min = this.minDate
    if (min && start.compare(startOfMonth(min)) < 0) start = startOfMonth(min)
    return start
  }

  #alignEnd(date: CalendarDate): CalendarDate {
    return this.#alignStart(startOfMonth(date).subtract({ months: this.#months() - 1 }))
  }

  #alignCenter(date: CalendarDate): CalendarDate {
    const n = this.#months()
    let half = Math.floor(n / 2)
    if (half > 0 && n % 2 === 0) half--
    return this.#alignStart(startOfMonth(date).subtract({ months: half }))
  }

  /** Moves the focused day, scrolling the visible months when it leaves them. */
  protected setFocused(date: CalendarDate, options: { reveal?: "center" | "auto"; focus?: boolean } = {}): void {
    date = constrainDate(date, this.minDate, this.maxDate)
    this.focused = date
    if (options.reveal === "center" && (date.compare(this.visibleStart) < 0 || date.compare(this.visibleEnd) > 0)) {
      this.visibleStart = this.#alignCenter(date)
    } else if (date.compare(this.visibleStart) < 0) {
      this.visibleStart = this.#alignEnd(date)
    } else if (date.compare(this.visibleEnd) > 0) {
      this.visibleStart = this.#alignStart(date)
    }
    this.onFocusedChange(date)
    if (options.focus) this.#focusAfterUpdate = true
  }

  /** Hook: the focused day moved (range calendars highlight it while selecting). */
  protected onFocusedChange(_date: CalendarDate): void {}

  #isPreviousDisabled(): boolean {
    const min = this.minDate
    return this.isDisabled || (!!min && this.visibleStart.subtract({ days: 1 }).compare(min) < 0)
  }

  #isNextDisabled(): boolean {
    const max = this.maxDate
    return this.isDisabled || (!!max && this.visibleEnd.add({ days: 1 }).compare(max) > 0)
  }

  #page(direction: 1 | -1): void {
    const months = this.#months() * direction
    const start = this.visibleStart.add({ months })
    this.focused = constrainDate(this.focused.add({ months }), this.minDate, this.maxDate)
    this.visibleStart = this.#alignStart(start)
    this.onFocusedChange(this.focused)
    this.#announce(this.#visibleRangeDescription())
  }

  #onNavClick(direction: 1 | -1, event: Event) {
    if ((event.currentTarget as HTMLElement & { disabled?: boolean }).disabled) return
    this.#page(direction)
    void this.updateComplete.then(() => {
      // A button that just became disabled can't keep focus: move it into the grid (like React Aria).
      const button = event.currentTarget as HTMLElement & { disabled?: boolean }
      if (button.disabled) this.focus()
    })
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const cell = (event.target as HTMLElement).closest?.(".cell")
    if (!cell || event.altKey || event.ctrlKey || event.metaKey) return
    const rtl = this.matches(":dir(rtl)")
    const locale = this.resolvedLocale
    const f = this.focused
    let next: CalendarDate | null = null
    switch (event.key) {
      case "ArrowLeft":
        next = f.add({ days: rtl ? 1 : -1 })
        break
      case "ArrowRight":
        next = f.add({ days: rtl ? -1 : 1 })
        break
      case "ArrowUp":
        next = f.subtract({ weeks: 1 })
        break
      case "ArrowDown":
        next = f.add({ weeks: 1 })
        break
      case "PageUp":
        next = f.subtract(event.shiftKey ? { years: 1 } : { months: 1 })
        break
      case "PageDown":
        next = f.add(event.shiftKey ? { years: 1 } : { months: 1 })
        break
      case "Home":
        next = startOfWeek(f, locale, this.firstDayOfWeek)
        break
      case "End":
        next = endOfWeek(f, locale, this.firstDayOfWeek)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        if (!event.repeat) this.#trySelect(f, "keyboard")
        return
      case "Escape":
        this.onEscape(event)
        return
      default:
        return
    }
    event.preventDefault()
    this.setFocused(next, { focus: true })
  }

  /** Hook: Escape in the grid (range calendars cancel the pending selection). */
  protected onEscape(_event: KeyboardEvent): void {}

  #trySelect(date: CalendarDate, source: "pointer" | "keyboard"): void {
    if (this.readonly || this.isDisabled || this.isCellDisabled(date) || this.isUnavailable(date)) return
    const before = this.selectionDescription()
    this.selectDate(date, source)
    const after = this.selectionDescription()
    if (after && after !== before) this.#announce(after)
  }

  #announce(text: string): void {
    // Re-set so an identical message is announced again.
    this._announcement = ""
    void this.updateComplete.then(() => (this._announcement = text))
  }

  /** Fires `input` and `change` (user selection). */
  protected fireChange(): void {
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  // ------------------------------------------------------------------ pointer (overridable)

  protected onCellPointerDown(_date: CalendarDate, _event: PointerEvent): void {}
  protected onCellPointerUp(_date: CalendarDate, _event: PointerEvent): void {}
  protected onCellPointerEnter(_date: CalendarDate, _event: PointerEvent): void {}
  /** Whether a click (mouse up on the same cell, or a virtual click) selects the day. */
  protected selectsOnClick(_event: MouseEvent): boolean {
    return true
  }

  #cellDate(el: Element | null): CalendarDate | null {
    const iso = el?.closest?.(".cell")?.getAttribute("data-date")
    const date = iso ? parseIsoDate(iso) : null
    return date ? this.toDisplay(date) : null
  }

  #onClick = (event: MouseEvent) => {
    const date = this.#cellDate(event.target as Element)
    if (!date || !this.selectsOnClick(event)) return
    if (this.isCellDisabled(date)) return
    this.#trySelect(date, "pointer")
    this.setFocused(date, { focus: true })
  }

  #onPointerDown = (event: PointerEvent) => {
    const date = this.#cellDate(event.target as Element)
    if (!date || event.button !== 0 || this.isCellDisabled(date)) return
    if (!this.readonly && !this.isUnavailable(date)) this.onCellPointerDown(date, event)
  }

  #onPointerUp = (event: PointerEvent) => {
    const date = this.#cellDate(event.target as Element)
    if (!date || event.button !== 0 || this.isCellDisabled(date)) return
    if (!this.readonly && !this.isUnavailable(date)) this.onCellPointerUp(date, event)
  }

  #onPointerOver = (event: PointerEvent) => {
    const date = this.#cellDate(event.target as Element)
    if (!date || this.isCellDisabled(date) || this.isUnavailable(date)) return
    this.onCellPointerEnter(date, event)
  }

  #onFocusIn = (event: FocusEvent) => {
    this._focusWithin = true
    const target = event.composedPath()[0] as HTMLElement
    if (target.classList?.contains("base")) {
      // The container itself (focused by reportValidity or a label): forward to the focused day.
      this.focus()
      return
    }
    const date = this.#cellDate(target)
    if (date && !this.isCellDisabled(date) && !isSameDay(date, this.focused)) {
      this.focused = date
      this.onFocusedChange(date)
    }
  }

  #onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (!next || !this.renderRoot.contains(next)) this._focusWithin = false
  }

  // ------------------------------------------------------------------ dropdown captions

  #onMonthSelect(column: number, event: Event) {
    const month = Number((event.target as HTMLSelectElement).value)
    const current = this.visibleStart.add({ months: column })
    this.#shiftBy(current.set({ month }), current)
  }

  #onYearSelect(column: number, event: Event) {
    const years = Number((event.target as HTMLSelectElement).value)
    const current = this.visibleStart.add({ months: column })
    this.#shiftBy(current.add({ years }), current)
  }

  #shiftBy(target: CalendarDate, current: CalendarDate) {
    const diff = { years: target.year - current.year, months: target.month - current.month }
    const months = diff.years * current.calendar.getMonthsInYear(current) + diff.months
    const moved = constrainDate(this.focused.add({ months }), this.minDate, this.maxDate)
    this.focused = moved
    this.visibleStart = this.#alignStart(startOfMonth(this.visibleStart.add({ months })))
    if (moved.compare(this.visibleStart) < 0 || moved.compare(this.visibleEnd) > 0) this.visibleStart = this.#alignCenter(moved)
    this.onFocusedChange(moved)
  }

  // ------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback()
    this.#calendarId ||= `tec-calendar-${Math.random().toString(36).slice(2, 9)}`
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const calendar = localeCalendar(this.resolvedLocale)
    if (!this.focused) {
      const initial = parseIsoDate(this.#initialFocus) ?? this.selectedDates()[0] ?? todayDate()
      const date = constrainDate(this.toDisplay(initial), this.minDate, this.maxDate)
      this.focused = date
      this.visibleStart = this.#alignCenter(date)
    } else if (this.focused.calendar.identifier !== calendar.identifier) {
      this.focused = toCalendar(this.focused, calendar)
      this.visibleStart = this.#alignStart(toCalendar(this.visibleStart, calendar))
    } else if (changed.has("visibleMonths") || changed.has("min") || changed.has("max")) {
      const focused = constrainDate(this.focused, this.minDate, this.maxDate)
      this.focused = focused
      if (focused.compare(this.visibleStart) < 0 || focused.compare(this.visibleEnd) > 0) this.visibleStart = this.#alignCenter(focused)
      else this.visibleStart = this.#alignStart(this.visibleStart)
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("focus-within", this._focusWithin)
    if (this.#focusAfterUpdate) {
      this.#focusAfterUpdate = false
      this.renderRoot.querySelector<HTMLElement>(".cell[tabindex='0']")?.focus()
    }
  }

  protected override get formControl(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(".base") ?? null
  }

  // ------------------------------------------------------------------ rendering

  #visibleRangeDescription(): string {
    const locale = this.resolvedLocale
    const tz = localTimeZone()
    const f = dateFormatter(locale, { month: "long", year: "numeric", calendar: this.visibleStart.calendar.identifier, timeZone: tz })
    const start = this.visibleStart
    const end = startOfMonth(this.visibleEnd)
    if (isSameMonth(start, end)) return f.format(start.toDate(tz))
    return f.formatRange(start.toDate(tz), end.toDate(tz))
  }

  #weekdays(): string[] {
    const locale = this.resolvedLocale
    const tz = localTimeZone()
    const f = dateFormatter(locale, { weekday: this.weekdayStyle, timeZone: tz })
    const start = startOfWeek(todayDate(), locale, this.firstDayOfWeek)
    return Array.from({ length: 7 }, (_, i) => f.format(start.add({ days: i }).toDate(tz)))
  }

  #renderCaption(month: CalendarDate, column: number): TemplateResult {
    const locale = this.resolvedLocale
    const tz = localTimeZone()
    if (this.captionLayout === "dropdown") {
      const monthFormat = dateFormatter(locale, { month: this.headerFormat?.month ?? "short", calendar: month.calendar.identifier, timeZone: tz })
      const yearFormat = dateFormatter(locale, { year: this.headerFormat?.year ?? "numeric", calendar: month.calendar.identifier, timeZone: tz })
      const monthCount = month.calendar.getMonthsInYear(month)
      const min = this.minDate
      const max = this.maxDate
      const months = Array.from({ length: monthCount }, (_, i) => month.set({ month: i + 1 }))
      // Twenty years around the shown year, shifted to stay within min/max (like React Aria).
      let first = month.subtract({ years: 10 })
      let last = month.add({ years: 9 })
      if (max && last.compare(max) > 0) {
        last = max
        first = last.subtract({ years: 19 })
      }
      if (min && first.compare(min) < 0) {
        first = min
        last = first.add({ years: 19 })
        if (max && last.compare(max) > 0) last = max
      }
      const years: CalendarDate[] = []
      for (let d = startOfMonth(first); d.compare(last) <= 0 || isSameYear(d, last); d = d.add({ years: 1 })) {
        years.push(d)
        if (years.length > 200) break
      }
      const monthOutOfRange = (m: CalendarDate) => (!!min && endOfMonth(m).compare(min) < 0) || (!!max && startOfMonth(m).compare(max) > 0)
      return html`<span class="select">
          <select part="month-select" aria-label=${fieldName(locale, "month")} ?disabled=${this.isDisabled} @change=${(e: Event) => this.#onMonthSelect(column, e)}>
            ${months.map((m) => html`<option value=${m.month} ?selected=${m.month === month.month} ?disabled=${monthOutOfRange(m)}>${monthFormat.format(m.toDate(tz))}</option>`)}
          </select>
          ${icon(ChevronDown, { size: 16 })}
        </span>
        <span class="select">
          <select part="year-select" aria-label=${fieldName(locale, "year")} ?disabled=${this.isDisabled} @change=${(e: Event) => this.#onYearSelect(column, e)}>
            ${years.map((y) => html`<option value=${y.year - month.year} ?selected=${y.year === month.year}>${yearFormat.format(y.toDate(tz))}</option>`)}
          </select>
          ${icon(ChevronDown, { size: 16 })}
        </span>`
    }
    const format = dateFormatter(locale, {
      month: "long",
      year: "numeric",
      ...this.headerFormat,
      calendar: month.calendar.identifier,
      timeZone: tz,
    })
    return html`<span class="heading" part="heading" aria-hidden="true">${format.format(month.toDate(tz))}</span>`
  }

  #renderMonth(column: number, weekdays: string[]): TemplateResult {
    const locale = this.resolvedLocale
    const tz = localTimeZone()
    const month = this.visibleStart.add({ months: column })
    const weeks = this.fixedWeeks ? 6 : getWeeksInMonth(month, locale, this.firstDayOfWeek)
    const gridStart = startOfWeek(month, locale, this.firstDayOfWeek)
    const dayFormat = dateFormatter(locale, { day: "numeric", calendar: month.calendar.identifier, timeZone: tz })
    const labelFormat = dateFormatter(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", calendar: month.calendar.identifier, timeZone: tz })
    const monthFormat = dateFormatter(locale, { month: "long", year: "numeric", calendar: month.calendar.identifier, timeZone: tz })
    const gridLabel = [this.label || this.getAttribute("aria-label"), monthFormat.format(month.toDate(tz))].filter(Boolean).join(", ")
    const rows: TemplateResult[] = []
    const invalid = this.valueInvalid()
    const min = this.minDate
    const max = this.maxDate
    const selectionPrompt = this.rangeSelectionPrompt()
    for (let w = 0; w < weeks; w++) {
      const weekStart = gridStart.add({ weeks: w })
      const cells = Array.from({ length: 7 }, (_, i) => {
        const date = weekStart.add({ days: i })
        const outside = !isSameMonth(date, month)
        const disabled = outside || this.isCellDisabled(date)
        const unavailable = !disabled && this.isUnavailable(date)
        const selectable = !disabled && !unavailable
        // An invalid value (unavailable or out of range) is still drawn, in the destructive colour.
        const selected = (selectable || (!disabled && invalid)) && this.isDateSelected(date)
        const selection = selected ? this.selectionOf(date) : undefined
        const isStart = selection === "start" || selection === "both"
        const isEnd = selection === "end" || selection === "both"
        const today = isToday(date, tz)
        const focusedHere = !disabled && isSameDay(date, this.focused)
        const native = date.toDate(tz)
        const formatted = dayFormat.formatToParts(native).find((p) => p.type === "day")?.value ?? String(date.day)
        let label = labelFormat.format(native)
        if (isStart || isEnd) {
          const description = this.selectionDescription()
          if (description) label = `${description}, ${label}`
        }
        if (today) label = selected ? `Today, ${label} selected` : `Today, ${label}`
        else if (selected) label = `${label} selected`
        if (min && isSameDay(date, min)) label += ", First available date"
        else if (max && isSameDay(date, max)) label += ", Last available date"
        const gregorian = toGregorian(date)
        const iso = formatIsoDate(gregorian)
        const content = this.renderDay
          ? this.renderDay({
              date: gregorian,
              iso,
              formatted,
              isToday: today,
              isSelected: selected,
              isSelectionStart: isStart,
              isSelectionEnd: isEnd,
              isOutsideMonth: outside,
              isUnavailable: unavailable,
              isDisabled: disabled,
              isWeekend: isWeekend(date, locale),
            })
          : formatted
        const parts = [
          "day",
          selected && "day-selected",
          isStart && "day-range-start",
          isEnd && "day-range-end",
          selection === "middle" && "day-range-middle",
          today && "day-today",
          outside && "day-outside",
          unavailable && "day-unavailable",
          disabled && !outside && "day-disabled",
        ]
          .filter(Boolean)
          .join(" ")
        return html`<td role="gridcell" aria-selected=${selected ? "true" : nothing} aria-disabled=${selectable ? nothing : "true"} aria-invalid=${selected && invalid ? "true" : nothing}>
          <div
            class="cell"
            part="cell"
            role="button"
            tabindex=${disabled ? nothing : focusedHere ? 0 : -1}
            aria-label=${label}
            aria-disabled=${selectable ? nothing : "true"}
            aria-invalid=${selected && invalid ? "true" : nothing}
            aria-describedby=${focusedHere && selectable && selectionPrompt ? `${this.#calendarId}-prompt` : nothing}
            data-date=${iso}
            data-selection=${selection ?? nothing}
            ?data-selected=${selected}
            ?data-selection-start=${isStart}
            ?data-selection-end=${isEnd}
            ?data-today=${today}
            ?data-outside-month=${outside}
            ?data-disabled=${disabled}
            ?data-unavailable=${unavailable}
            ?data-invalid=${selected && invalid}
          ><span class="day" part=${parts}>${content}</span></div>
        </td>`
      })
      rows.push(
        html`<tr>
          ${this.showWeekNumber
            ? html`<th class="week-number" part="week-number" scope="row" aria-label=${`${fieldName(locale, "weekOfYear")} ${weekNumber(toGregorian(weekStart), locale)}`}>${weekNumber(toGregorian(weekStart), locale)}</th>`
            : nothing}
          ${cells}
        </tr>`
      )
    }
    return html`<div class="month" part="month">
      <div class="caption" part="caption">${this.#renderCaption(month, column)}</div>
      <table role="grid" part="grid" aria-label=${gridLabel} aria-readonly=${this.readonly ? "true" : nothing} aria-disabled=${this.isDisabled ? "true" : nothing} aria-multiselectable=${this.multiselectable ? "true" : nothing}>
        <thead aria-hidden="true">
          <tr>
            ${this.showWeekNumber ? html`<th class="weekday"></th>` : nothing}
            ${weekdays.map((d) => html`<th class="weekday" part="weekday">${d}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`
  }

  /** `aria-multiselectable` of the grids. */
  protected get multiselectable(): boolean {
    return false
  }

  /** Description of the focused cell while choosing a range ("Click to finish selecting date range"), or "". */
  protected rangeSelectionPrompt(): string {
    return ""
  }

  protected override render() {
    const weekdays = this.#weekdays()
    const range = this.#visibleRangeDescription()
    const name = this.label || this.getAttribute("aria-label") || ""
    const label = [name, range].filter(Boolean).join(", ")
    const prompt = this.rangeSelectionPrompt()
    return html`<div
      class="base"
      part="base"
      role="application"
      tabindex="-1"
      aria-label=${this.getAttribute("aria-label") ?? label}
      @keydown=${this.#onKeyDown}
      @click=${this.#onClick}
      @pointerdown=${this.#onPointerDown}
      @pointerup=${this.#onPointerUp}
      @pointerover=${this.#onPointerOver}
      @focusin=${this.#onFocusIn}
      @focusout=${this.#onFocusOut}
    >
      <h2 class="sr-only">${label}</h2>
      <div class="months">
        <div class="nav" part="nav">
          <tec-button
            class="previous"
            part="previous"
            exportparts="base: previous-base"
            variant=${this.buttonVariant}
            size="icon"
            aria-label=${this.previousLabel}
            ?disabled=${this.#isPreviousDisabled()}
            @click=${(e: Event) => this.#onNavClick(-1, e)}
            >${icon(ChevronLeft, { size: 16 })}</tec-button
          >
          <tec-button
            class="next"
            part="next"
            exportparts="base: next-base"
            variant=${this.buttonVariant}
            size="icon"
            aria-label=${this.nextLabel}
            ?disabled=${this.#isNextDisabled()}
            @click=${(e: Event) => this.#onNavClick(1, e)}
            >${icon(ChevronRight, { size: 16 })}</tec-button
          >
        </div>
        ${Array.from({ length: this.#months() }, (_, i) => this.#renderMonth(i, weekdays))}
      </div>
      <span class="sr-only" id=${`${this.#calendarId}-prompt`}>${prompt}</span>
      <div class="sr-only" aria-live="polite" aria-atomic="true">${this._announcement}</div>
    </div>`
  }
}
