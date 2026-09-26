/**
 * @module segments
 * The editing model of a segmented date/time input (the React Aria DateField model): the value is
 * split into locale-ordered segments (`mm/dd/yyyy`, `dd.mm.yyyy`, `–– : –– AM`), each an ARIA
 * `spinbutton` the user types into or steps with the arrow keys. `SegmentedField` holds the partly
 * entered value, renders the segments into its owner's shadow root and reports committed values.
 * A field is committed when every segment has a value and the date exists; otherwise its value is
 * empty and the owner reports `badInput`.
 */
import { CalendarDate, CalendarDateTime, Time, toCalendar, toCalendarDate, type Calendar } from "@internationalized/date"
import { html, nothing, type TemplateResult } from "lit"
import { dateFormatter, fieldName, localeCalendar, segmentPlaceholder, type DateGranularity } from "../calendar/date-utils.js"

/** Kind of value a field edits. */
export type SegmentFieldKind = "date" | "time"

/** A value a segmented field holds (display calendar for dates). */
export type SegmentValue = CalendarDate | CalendarDateTime | Time

type EditableField = "year" | "month" | "day" | "hour" | "dayPeriod" | "minute" | "second"
type HourCycle = "h11" | "h12" | "h23" | "h24"

/** One rendered segment. */
export interface DateSegment {
  type: EditableField | "literal"
  text: string
  value: number | null
  minValue: number
  maxValue: number
  isPlaceholder: boolean
  placeholder: string
  isEditable: boolean
}

const PAGE_STEP: Partial<Record<EditableField, number>> = { year: 5, month: 2, day: 7, hour: 2, minute: 15, second: 15 }
const EDITABLE = new Set<string>(["year", "month", "day", "hour", "dayPeriod", "minute", "second"])

function toHourCycle(hour: number, cycle: HourCycle): [number, number] {
  const dayPeriod = hour >= 12 ? 1 : 0
  if (cycle === "h11") return [dayPeriod, hour % 12]
  if (cycle === "h12") return [dayPeriod, hour % 12 || 12]
  return [dayPeriod, hour]
}

function fromHourCycle(hour: number, dayPeriod: number, cycle: HourCycle): number {
  if (cycle === "h11") return dayPeriod ? hour + 12 : hour
  if (cycle === "h12") return hour === 12 ? (dayPeriod ? 12 : 0) : dayPeriod ? hour + 12 : hour
  return hour
}

function cycleValue(value: number, amount: number, min: number, max: number, round = false): number {
  if (round) {
    value += Math.sign(amount)
    if (value < min) value = max
    const div = Math.abs(amount)
    value = amount > 0 ? Math.ceil(value / div) * div : Math.floor(value / div) * div
    if (value > max) value = min
    return value
  }
  value += amount
  if (value < min) value = max - (min - value - 1)
  else if (value > max) value = min + (value - max - 1)
  return value
}

/** A partly entered date/time (each field may be null). */
class IncompleteDate {
  year: number | null = null
  month: number | null = null
  day: number | null = null
  hour: number | null = null
  dayPeriod: number | null = null
  minute: number | null = null
  second: number | null = null

  constructor(
    readonly calendar: Calendar,
    readonly hourCycle: HourCycle,
    value?: SegmentValue | null
  ) {
    if (!value) return
    if ("year" in value) {
      this.year = value.year
      this.month = value.month
      this.day = value.day
    }
    if ("hour" in value) {
      const [period, hour] = toHourCycle(value.hour, hourCycle)
      this.hour = hour
      this.dayPeriod = period
      this.minute = value.minute
      this.second = value.second
    }
  }

  copy(): IncompleteDate {
    const res = new IncompleteDate(this.calendar, this.hourCycle)
    Object.assign(res, { year: this.year, month: this.month, day: this.day, hour: this.hour, dayPeriod: this.dayPeriod, minute: this.minute, second: this.second })
    return res
  }

  isComplete(fields: EditableField[]): boolean {
    return fields.every((f) => this[f] != null)
  }

  isCleared(fields: EditableField[]): boolean {
    return fields.every((f) => this[f] == null)
  }

  /** Whether `dt` matches this value in `fields` (false for Feb 30 constrained to Feb 28). */
  validate(dt: CalendarDateTime, fields: EditableField[]): boolean {
    return fields.every((f) => {
      if (f === "hour" || f === "dayPeriod") {
        const [period, hour] = toHourCycle(dt.hour, this.hourCycle)
        return (f === "hour" ? hour : period) === this[f] || (f === "dayPeriod" && !this.is12h)
      }
      return this[f] === (dt as unknown as Record<string, number>)[f]
    })
  }

  get is12h(): boolean {
    return this.hourCycle === "h11" || this.hourCycle === "h12"
  }

  set(field: EditableField, value: number, placeholder: CalendarDateTime): IncompleteDate {
    const res = this.copy()
    res[field] = value
    if (field === "hour" && res.dayPeriod == null) res.dayPeriod = toHourCycle(placeholder.hour, this.hourCycle)[0]
    return res
  }

  clear(field: EditableField): IncompleteDate {
    const res = this.copy()
    res[field] = null
    return res
  }

  cycle(field: EditableField, amount: number, placeholder: CalendarDateTime): IncompleteDate {
    const res = this.copy()
    if (res[field] == null && field !== "dayPeriod") {
      if (field === "hour") {
        const [period, hour] = toHourCycle(placeholder.hour, this.hourCycle)
        res.dayPeriod ??= period
        res.hour = hour
      } else res[field] = (placeholder as unknown as Record<string, number>)[field]!
      return res
    }
    const limits = this.limits(field)
    switch (field) {
      case "year":
      case "month":
      case "day":
      case "hour":
        res[field] = cycleValue(res[field] ?? limits.minValue, amount, limits.minValue, limits.maxValue)
        if (field === "hour" && res.dayPeriod == null) res.dayPeriod = toHourCycle(placeholder.hour, this.hourCycle)[0]
        break
      case "dayPeriod":
        res.dayPeriod = cycleValue(res.dayPeriod ?? 0, amount, 0, 1)
        break
      case "minute":
      case "second":
        res[field] = cycleValue(res[field] ?? 0, amount, 0, 59, true)
        break
    }
    return res
  }

  /** The value, completed with `placeholder` for the fields that are not set (days are constrained to the month). */
  toValue(placeholder: CalendarDateTime): CalendarDateTime {
    let hour = this.hour
    if (hour != null) hour = fromHourCycle(hour, this.dayPeriod ?? 0, this.hourCycle)
    else if (this.is12h) hour = this.dayPeriod === 1 ? 12 : 0
    return placeholder.set({
      year: this.year ?? placeholder.year,
      month: this.month ?? placeholder.month,
      day: this.day ?? placeholder.day,
      hour: hour ?? placeholder.hour,
      minute: this.minute ?? placeholder.minute,
      second: this.second ?? placeholder.second,
    })
  }

  limits(field: EditableField): { minValue: number; maxValue: number } {
    switch (field) {
      case "year":
        return { minValue: 1, maxValue: 9999 }
      case "month":
        return { minValue: 1, maxValue: this.calendar.getMaximumMonthsInYear() }
      case "day":
        return { minValue: 1, maxValue: this.calendar.getMaximumDaysInMonth() }
      case "dayPeriod":
        return { minValue: 0, maxValue: 1 }
      case "hour":
        return this.hourCycle === "h12" ? { minValue: 1, maxValue: 12 } : this.hourCycle === "h11" ? { minValue: 0, maxValue: 11 } : { minValue: 0, maxValue: 23 }
      default:
        return { minValue: 0, maxValue: 59 }
    }
  }
}

/** Options of {@link SegmentedField}. */
export interface SegmentedFieldOptions {
  kind: () => SegmentFieldKind
  granularity: () => DateGranularity
  locale: () => string
  /** 12 or 24; default: the locale's. */
  hourCycle: () => 12 | 24 | undefined
  /** Value whose fields fill empty segments when stepped with the arrow keys (default: today, midnight). */
  placeholderValue: () => SegmentValue | null
  forceLeadingZeros: () => boolean
  /** The owner re-renders. */
  requestUpdate: () => void
  /** The user committed a value (or emptied / broke the field: `null`). */
  onCommit: (value: SegmentValue | null) => void
  /** Move focus to the next / previous segment of the owner (typing auto-advances). */
  focusSibling: (from: HTMLElement, direction: 1 | -1) => void
}

/** Rendering state passed by the owner. */
export interface SegmentRenderOptions {
  disabled: boolean
  readonly: boolean
  required: boolean
  invalid: boolean
  /** Appended to each segment's name (`month, Birthday`) — the host's `aria-label`. */
  label?: string | null
  /** `data-field` of the segments (identifies the field when an owner renders several). */
  field?: string
}

/** See the module documentation. */
export class SegmentedField {
  readonly #o: SegmentedFieldOptions
  #display: IncompleteDate | null = null
  #value: SegmentValue | null = null
  #entered = ""
  #key = ""

  constructor(options: SegmentedFieldOptions) {
    this.#o = options
  }

  // ------------------------------------------------------------------ configuration

  get calendar(): Calendar {
    return this.#o.kind() === "time" ? localeCalendar("en-US") : localeCalendar(this.#o.locale())
  }

  get hourCycle(): HourCycle {
    const hc = this.#o.hourCycle()
    const f = dateFormatter(this.#o.locale(), { hour: "numeric", ...(hc ? { hour12: hc === 12 } : {}), timeZone: "UTC" })
    const resolved = (f.resolvedOptions().hourCycle ?? "h23") as HourCycle
    return resolved === "h24" ? "h23" : resolved
  }

  /** Editable fields in display order-independent form. */
  get fields(): EditableField[] {
    const granularity = this.#o.granularity()
    const twelve = this.hourCycle === "h11" || this.hourCycle === "h12"
    const all: EditableField[] = ["year", "month", "day", "hour", ...(twelve ? (["dayPeriod"] as const) : []), "minute", "second"]
    const from = this.#o.kind() === "time" ? all.indexOf("hour") : 0
    const last = granularity === "hour" && twelve ? "dayPeriod" : granularity
    return all.slice(from, all.indexOf(last) + 1)
  }

  #formatOptions(): Intl.DateTimeFormatOptions {
    const lead = this.#o.forceLeadingZeros()
    const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC", calendar: this.calendar.identifier }
    const fields = this.fields
    if (fields.includes("year")) opts.year = "numeric"
    if (fields.includes("month")) opts.month = lead ? "2-digit" : "numeric"
    if (fields.includes("day")) opts.day = lead ? "2-digit" : "numeric"
    if (fields.includes("hour")) opts.hour = lead ? "2-digit" : "numeric"
    if (fields.includes("minute")) opts.minute = "2-digit"
    if (fields.includes("second")) opts.second = "2-digit"
    const hc = this.#o.hourCycle()
    if (hc && opts.hour) opts.hour12 = hc === 12
    return opts
  }

  get #placeholder(): CalendarDateTime {
    const cal = this.calendar
    const p = this.#o.placeholderValue()
    if (p && "year" in p) {
      const dt = "hour" in p ? p : new CalendarDateTime(p.year, p.month, p.day)
      return toCalendar(dt as CalendarDateTime, cal)
    }
    const now = new Date()
    const time = p && "hour" in p ? p : { hour: 0, minute: 0, second: 0 }
    return toCalendar(new CalendarDateTime(now.getFullYear(), now.getMonth() + 1, now.getDate(), time.hour, time.minute, time.second), cal)
  }

  get #d(): IncompleteDate {
    if (!this.#display || this.#display.calendar.identifier !== this.calendar.identifier || this.#display.hourCycle !== this.hourCycle) {
      const v = this.#value && "year" in this.#value ? toCalendar(this.#value, this.calendar) : this.#value
      this.#display = new IncompleteDate(this.calendar, this.hourCycle, v)
    }
    return this.#display
  }

  // ------------------------------------------------------------------ value

  /** The committed value, or `null`. */
  get value(): SegmentValue | null {
    return this.#value
  }

  /** Sets the value from outside (no commit callback), replacing any partial entry. */
  setValue(value: SegmentValue | null): void {
    this.#value = value
    this.#display = null
    this.#entered = ""
  }

  /** Nothing entered. */
  get isEmpty(): boolean {
    return this.#d.isCleared(this.fields)
  }

  /** Some segments entered but no valid value (incomplete, or a day that does not exist). */
  get isPartial(): boolean {
    return !this.#value && !this.isEmpty
  }

  /** Clears the field (commits `null`). */
  clear(): void {
    this.#apply(new IncompleteDate(this.calendar, this.hourCycle))
  }

  #finish(dt: CalendarDateTime): SegmentValue {
    const kind = this.#o.kind()
    if (kind === "time") return new Time(dt.hour, dt.minute, this.fields.includes("second") ? dt.second : 0)
    if (this.#o.granularity() === "day") return toCalendarDate(dt)
    return this.fields.includes("second") ? dt : dt.set({ second: 0 })
  }

  #sameValue(a: SegmentValue | null, b: SegmentValue | null): boolean {
    if (!a || !b) return a === b
    return a.toString() === b.toString()
  }

  #commit(value: SegmentValue | null): void {
    if (this.#sameValue(value, this.#value)) return
    this.#value = value
    this.#o.onCommit(value)
  }

  #apply(next: IncompleteDate): void {
    const fields = this.fields
    if (next.isCleared(fields)) {
      this.#display = next
      this.#commit(null)
    } else if (next.isComplete(fields)) {
      const dt = next.toValue(this.#placeholder)
      if (next.validate(dt, fields)) {
        this.#display = new IncompleteDate(this.calendar, this.hourCycle, dt)
        this.#commit(this.#finish(dt))
      } else {
        this.#display = next
        this.#commit(null)
      }
    } else {
      this.#display = next
      this.#commit(null)
    }
    this.#o.requestUpdate()
  }

  /** On blur: a complete but impossible date (Feb 30) is constrained and committed. */
  confirm(): void {
    const d = this.#d
    if (this.#value || !d.isComplete(this.fields)) return
    const dt = d.toValue(this.#placeholder)
    this.#display = new IncompleteDate(this.calendar, this.hourCycle, dt)
    this.#commit(this.#finish(dt))
    this.#o.requestUpdate()
  }

  // ------------------------------------------------------------------ segments

  /** The segments in locale order. */
  segments(): DateSegment[] {
    const locale = this.#o.locale()
    const d = this.#d
    const opts = this.#formatOptions()
    const formatter = dateFormatter(locale, opts)
    const resolved = formatter.resolvedOptions()
    const date = d.toValue(this.#placeholder).toDate("UTC")
    const num = new Intl.NumberFormat(locale, { useGrouping: false })
    const two = new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2 })
    const fields = this.fields
    const out: DateSegment[] = []
    for (const part of formatter.formatToParts(date)) {
      const raw = part.type as string
      let type = raw === "dayperiod" ? "dayPeriod" : raw === "relatedYear" ? "year" : raw
      if (!EDITABLE.has(type) || !fields.includes(type as EditableField)) type = "literal"
      let text = part.value
      if (type === "year" || type === "month" || type === "day" || type === "hour") {
        const v = d[type] ?? 0
        text = resolved[type] === "2-digit" ? two.format(v) : num.format(v)
      }
      if (type === "literal") {
        const isTime = ["hour", "minute", "second"].includes(part.type)
        out.push({ type: "literal", text: isTime ? part.value : text, value: null, minValue: 0, maxValue: 0, isPlaceholder: false, placeholder: "", isEditable: false })
        continue
      }
      const field = type as EditableField
      const isPlaceholder = d[field] == null
      const placeholder = field === "dayPeriod" ? part.value : segmentPlaceholder(field, locale)
      const limits = d.limits(field)
      if (field === "hour") out.push({ type: "literal", text: "⁦", value: null, minValue: 0, maxValue: 0, isPlaceholder: false, placeholder: "", isEditable: false })
      out.push({ type: field, text: isPlaceholder ? placeholder : text, value: d[field], ...limits, isPlaceholder, placeholder, isEditable: true })
      const lastTime = fields.filter((f) => f === "hour" || f === "minute" || f === "second").at(-1)
      if (field === lastTime) out.push({ type: "literal", text: "⁩", value: null, minValue: 0, maxValue: 0, isPlaceholder: false, placeholder: "", isEditable: false })
    }
    return out
  }

  /** `aria-valuetext` of a segment. */
  #valueText(segment: DateSegment): string {
    if (segment.isPlaceholder) return "Empty"
    const locale = this.#o.locale()
    const date = this.#d.toValue(this.#placeholder).toDate("UTC")
    if (segment.type === "month") {
      const name = dateFormatter(locale, { month: "long", timeZone: "UTC", calendar: this.calendar.identifier }).format(date)
      return name !== segment.text ? `${segment.text} – ${name}` : name
    }
    if (segment.type === "hour") {
      const hc = this.#o.hourCycle()
      return dateFormatter(locale, { hour: "numeric", ...(hc ? { hour12: hc === 12 } : {}), timeZone: "UTC" }).format(date)
    }
    return segment.text
  }

  /** Renders the segments. */
  render(options: SegmentRenderOptions): TemplateResult {
    const locale = this.#o.locale()
    const editable = !options.disabled && !options.readonly
    return html`${this.segments().map((s) => {
      if (s.type === "literal") return html`<span class="literal" part="literal" aria-hidden="true">${s.text}</span>`
      const name = fieldName(locale, s.type)
      return html`<span
        class="segment"
        part="segment"
        role="spinbutton"
        data-type=${s.type}
        data-field=${options.field ?? nothing}
        ?data-placeholder=${s.isPlaceholder}
        tabindex=${options.disabled ? nothing : 0}
        contenteditable=${editable ? "true" : "false"}
        spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        enterkeyhint=${editable ? "next" : nothing}
        inputmode=${editable && s.type !== "dayPeriod" ? "numeric" : nothing}
        aria-label=${options.label ? `${name}, ${options.label}` : name}
        aria-valuenow=${s.value ?? nothing}
        aria-valuemin=${s.minValue}
        aria-valuemax=${s.maxValue}
        aria-valuetext=${this.#valueText(s)}
        aria-disabled=${options.disabled ? "true" : nothing}
        aria-readonly=${options.readonly ? "true" : nothing}
        aria-required=${options.required ? "true" : nothing}
        aria-invalid=${options.invalid ? "true" : nothing}
        @keydown=${(e: KeyboardEvent) => this.#onKeyDown(e, s, options)}
        @beforeinput=${(e: InputEvent) => this.#onBeforeInput(e, s, options)}
        @focus=${() => this.#onFocus(s)}
        >${s.text}</span
      >`
    })}`
  }

  // ------------------------------------------------------------------ interaction

  #segment(type: DateSegment["type"]): DateSegment | undefined {
    return this.segments().find((s) => s.type === type)
  }

  #onFocus(segment: DateSegment): void {
    if (this.#key !== segment.type) {
      this.#key = segment.type
      this.#entered = ""
    }
  }

  #step(field: EditableField, amount: number): void {
    this.#entered = ""
    this.#apply(this.#d.cycle(field, amount, this.#placeholder))
  }

  #setSegment(field: EditableField, value: number): void {
    this.#apply(this.#d.set(field, value, this.#placeholder))
  }

  #digits(): Map<string, string> {
    const map = new Map<string, string>()
    const f = new Intl.NumberFormat(this.#o.locale(), { useGrouping: false })
    for (let i = 0; i <= 9; i++) {
      map.set(String(i), String(i))
      map.set(f.format(i), String(i))
    }
    return map
  }

  #onKeyDown(event: KeyboardEvent, segment: DateSegment, options: SegmentRenderOptions): void {
    const el = event.currentTarget as HTMLElement
    const field = segment.type as EditableField
    const editable = !options.disabled && !options.readonly
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const rtl = el.matches(":dir(rtl)")
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    switch (event.key) {
      case "ArrowLeft":
        handled()
        this.#o.focusSibling(el, rtl ? 1 : -1)
        return
      case "ArrowRight":
        handled()
        this.#o.focusSibling(el, rtl ? -1 : 1)
        return
      case "ArrowUp":
      case "ArrowDown":
      case "PageUp":
      case "PageDown":
        handled()
        if (!editable) return
        {
          const sign = event.key === "ArrowUp" || event.key === "PageUp" ? 1 : -1
          const size = event.key.startsWith("Page") ? (PAGE_STEP[field] ?? 1) : 1
          this.#step(field, sign * size)
        }
        return
      case "Home":
      case "End":
        handled()
        if (!editable) return
        this.#entered = ""
        {
          const twelve = field === "hour" && this.hourCycle === "h12"
          const limits = this.#d.limits(field)
          const v = event.key === "Home" ? (twelve ? 12 : limits.minValue) : twelve ? 11 : limits.maxValue
          this.#setSegment(field, v)
        }
        return
      case "Backspace":
      case "Delete":
        handled()
        if (editable) this.#backspace(el, segment)
        return
      case "Enter":
      case "Tab":
      case "Escape":
        return
    }
    if (event.key.length === 1) {
      handled()
      if (editable) this.#input(el, segment, event.key)
    }
  }

  #onBeforeInput(event: InputEvent, segment: DateSegment, options: SegmentRenderOptions): void {
    // Typing is handled on keydown; this catches virtual keyboards (key "Unidentified") and IMEs.
    if (event.inputType === "insertCompositionText") return
    event.preventDefault()
    if (options.disabled || options.readonly) return
    const el = event.currentTarget as HTMLElement
    if (event.inputType.startsWith("delete")) this.#backspace(el, segment)
    else if (event.data) for (const ch of event.data) this.#input(el, this.#segment(segment.type) ?? segment, ch)
  }

  #backspace(el: HTMLElement, segment: DateSegment): void {
    const current = this.#segment(segment.type) ?? segment
    if (current.isPlaceholder) {
      this.#o.focusSibling(el, -1)
      return
    }
    const field = current.type as EditableField
    if (field === "dayPeriod") {
      this.#apply(this.#d.clear(field))
      return
    }
    const digits = String(current.value ?? "")
    const next = digits.slice(0, -1)
    const parsed = Number(next)
    if (!next || parsed === 0) this.#apply(this.#d.clear(field))
    else this.#setSegment(field, parsed)
    this.#entered = next && parsed !== 0 ? next : ""
  }

  #input(el: HTMLElement, segment: DateSegment, key: string): void {
    const field = segment.type as EditableField
    if (field === "dayPeriod") {
      const locale = this.#o.locale()
      const f = dateFormatter(locale, { hour: "numeric", hour12: true, timeZone: "UTC" })
      const period = (h: number) => f.formatToParts(new Date(Date.UTC(2000, 0, 1, h))).find((p) => p.type === "dayPeriod")?.value ?? ""
      const k = key.toLocaleLowerCase(locale)
      if (period(0).toLocaleLowerCase(locale).startsWith(k)) this.#setSegment("dayPeriod", 0)
      else if (period(12).toLocaleLowerCase(locale).startsWith(k)) this.#setSegment("dayPeriod", 1)
      else return
      this.#o.focusSibling(el, 1)
      return
    }
    const digit = this.#digits().get(key)
    if (digit === undefined) {
      // Typing the separator that follows the segment moves on (`/`, `.`, `:`).
      const segments = this.segments()
      const i = segments.findIndex((s) => s.type === field)
      const literal = segments[i + 1]
      if (literal?.type === "literal" && literal.text.includes(key) && key.trim()) this.#o.focusSibling(el, 1)
      return
    }
    if (this.#key !== field) {
      this.#key = field
      this.#entered = ""
    }
    const entered = this.#entered + digit
    const number = Number(entered)
    let value = number
    if (number > segment.maxValue) value = Number(digit)
    if (Number.isNaN(value)) return
    const allowsZero = segment.minValue === 0
    if (value !== 0 || allowsZero) this.#setSegment(field, value)
    if (Number(`${number}0`) > segment.maxValue || entered.length >= String(segment.maxValue).length) {
      this.#entered = ""
      if (value !== 0 || allowsZero) this.#o.focusSibling(el, 1)
    } else {
      this.#entered = entered
    }
  }
}

export { CalendarDate, CalendarDateTime, Time }
