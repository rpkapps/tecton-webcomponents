/**
 * @module date-utils
 * Date helpers shared by the calendar, date field and date picker families: locale resolution,
 * ISO parsing/formatting of `@internationalized/date` values, validation messages and the
 * localized segment placeholders.
 *
 * Values cross the element boundary as ISO 8601 strings (`2026-09-26`, `2026-09-26T10:30`, `10:30`,
 * `2026-09-01/2026-09-14`), always in the Gregorian calendar. Inside, dates are
 * `@internationalized/date` values converted to the locale's calendar system for display.
 */
import {
  CalendarDate,
  CalendarDateTime,
  DateFormatter,
  GregorianCalendar,
  Time,
  createCalendar,
  getLocalTimeZone,
  parseDate,
  parseDateTime,
  parseTime,
  toCalendar,
  toCalendarDate,
  type Calendar,
  type CalendarIdentifier,
  type DayOfWeek,
} from "@internationalized/date"

export type { DayOfWeek }

/** Smallest unit a date field edits. */
export type DateGranularity = "day" | "hour" | "minute" | "second"
/** Smallest unit a time field edits. */
export type TimeGranularity = "hour" | "minute" | "second"

/** A date value with or without time. */
export type DateLike = CalendarDate | CalendarDateTime

/**
 * The locale of `el`: `explicit` when given, else the `lang` of the closest ancestor (crossing shadow
 * roots), else the browser language.
 */
export function resolveLocale(el: Element, explicit?: string | null): string {
  if (explicit) return explicit
  let node: Node | null = el
  while (node) {
    if (node instanceof Element) {
      const lang = node.getAttribute("lang")
      if (lang) return lang
    }
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
  }
  return (typeof navigator !== "undefined" && navigator.language) || "en-US"
}

const calendarCache = new Map<string, Calendar>()

/** The calendar system the locale uses by default (e.g. `islamic-umalqura` for `ar-SA`). */
export function localeCalendar(locale: string): Calendar {
  let calendar = calendarCache.get(locale)
  if (!calendar) {
    let id: string
    try {
      id = new DateFormatter(locale).resolvedOptions().calendar
    } catch {
      id = "gregory"
    }
    try {
      calendar = createCalendar(id as CalendarIdentifier)
    } catch {
      calendar = new GregorianCalendar()
    }
    calendarCache.set(locale, calendar)
  }
  return calendar
}

/** The local time zone. */
export const localTimeZone = (): string => getLocalTimeZone()

/** Parses an ISO date (`2026-09-26`, or the date part of a date-time). Returns `null` when invalid or empty. */
export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null
  try {
    return value.includes("T") ? toCalendarDate(parseDateTime(value)) : parseDate(value.trim())
  } catch {
    return null
  }
}

/** Parses an ISO date or date-time. Returns `null` when invalid or empty. */
export function parseIsoDateTime(value: string | null | undefined): DateLike | null {
  if (!value) return null
  try {
    return value.includes("T") ? parseDateTime(value.trim()) : parseDate(value.trim())
  } catch {
    return null
  }
}

/** Parses an ISO time (`10:30`, `10:30:15`). Returns `null` when invalid or empty. */
export function parseIsoTime(value: string | null | undefined): Time | null {
  if (!value) return null
  try {
    return parseTime(value.trim())
  } catch {
    return null
  }
}

/** Parses an ISO 8601 interval `start/end` of dates. */
export function parseIsoRange(value: string | null | undefined): { start: CalendarDate; end: CalendarDate } | null {
  if (!value) return null
  const [a, b] = value.split("/")
  const start = parseIsoDate(a)
  const end = parseIsoDate(b)
  if (!start || !end) return null
  return start.compare(end) <= 0 ? { start, end } : { start: end, end: start }
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** `YYYY-MM-DD` of a date (any calendar — converted to Gregorian). */
export function formatIsoDate(date: { calendar: Calendar } & Parameters<typeof toCalendarDate>[0]): string {
  const g = toCalendar(toCalendarDate(date), new GregorianCalendar())
  const year = g.era === "BC" ? -(g.year - 1) : g.year
  return `${year < 0 ? "-" : ""}${pad(Math.abs(year), 4)}-${pad(g.month)}-${pad(g.day)}`
}

/** `HH:mm` or `HH:mm:ss` (for `second` granularity). */
export function formatIsoTime(time: { hour: number; minute: number; second: number }, granularity: DateGranularity = "minute"): string {
  const base = `${pad(time.hour)}:${pad(time.minute)}`
  return granularity === "second" ? `${base}:${pad(time.second)}` : base
}

/** ISO string of a date or date-time value for a granularity (`2026-09-26`, `2026-09-26T10:30`). */
export function formatIsoValue(value: DateLike, granularity: DateGranularity): string {
  const date = formatIsoDate(value)
  if (granularity === "day" || !("hour" in value)) return date
  const g = toCalendar(value, new GregorianCalendar())
  return `${date}T${formatIsoTime(g, granularity)}`
}

/** Converts a value to the Gregorian calendar (the calendar of submitted values). */
export function toGregorian<T extends DateLike>(value: T): T {
  return toCalendar(value, new GregorianCalendar()) as T
}

/** Clamps `date` between `min` and `max` (either may be null). */
export function constrainDate<T extends CalendarDate>(date: T, min: CalendarDate | null, max: CalendarDate | null): T {
  if (min && date.compare(min) < 0) return toCalendar(min, date.calendar) as T
  if (max && date.compare(max) > 0) return toCalendar(max, date.calendar) as T
  return date
}

/** `DateFormatter` cache keyed by locale + options. */
const formatterCache = new Map<string, DateFormatter>()
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): DateFormatter {
  const key = locale + JSON.stringify(options)
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new DateFormatter(locale, options)
    formatterCache.set(key, formatter)
  }
  return formatter
}

/** Localized name of a date/time field (`"month"`, `"Monat"`) via `Intl.DisplayNames`. */
export function fieldName(locale: string, field: string): string {
  if (field === "dayPeriod") {
    try {
      return new Intl.DisplayNames(locale, { type: "dateTimeField" }).of("dayPeriod") ?? "AM/PM"
    } catch {
      return "AM/PM"
    }
  }
  try {
    return new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(field) ?? field
  } catch {
    return field
  }
}

/*
 * Localized placeholders of the year / month / day segments (the same strings React Aria uses,
 * Apache-2.0), keyed by language (or language-region).
 */
const PLACEHOLDERS: Record<string, string> = {"ach":"mwaka dwe nino","af":"jjjj mm dd","am":"ዓዓዓዓ ሚሜ ቀቀ","an":"aaaa mm dd","ar":"سنة شهر يوم","ast":"aaaa mm dd","az":"iiii aa gg","be":"гггг мм дд","bg":"гггг мм дд","bn":"yyyy মিমি dd","br":"bbbb mm dd","bs":"gggg mm dd","ca":"aaaa mm dd","cak":"jjjj ii q'q'","ckb":"ساڵ مانگ ڕۆژ","cs":"rrrr mm dd","cy":"bbbb mm dd","da":"åååå mm dd","de":"jjjj mm tt","dsb":"llll mm źź","el":"εεεε μμ ηη","en":"yyyy mm dd","eo":"jjjj mm tt","es":"aaaa mm dd","et":"aaaa kk pp","eu":"uuuu hh ee","fa":"سال ماه روز","ff":"hhhh ll ññ","fi":"vvvv kk pp","fr":"aaaa mm jj","fy":"jjjj mm dd","ga":"bbbb mm ll","gd":"bbbb mm ll","gl":"aaaa mm dd","he":"שנה חודש יום","hr":"gggg mm dd","hsb":"llll mm dd","hu":"éééé hh nn","ia":"aaaa mm dd","id":"tttt bb hh","is":"áááá mm dd","it":"aaaa mm gg","ja":"年 月 日","ka":"წწწწ თთ რრ","kk":"жжжж аа кк","kn":"ವವವವ ಮಿಮೀ ದಿದಿ","ko":"연도 월 일","lb":"jjjj mm dd","lo":"ປປປປ ດດ ວວ","lt":"mmmm mm dd","lv":"gggg mm dd","meh":"aaaa mm dd","ml":"വർഷം മാസം തീയതി","ms":"tttt mm hh","nb":"åååå mm dd","nl":"jjjj mm dd","nn":"åååå mm dd","no":"åååå mm dd","oc":"aaaa mm jj","pl":"rrrr mm dd","pt":"aaaa mm dd","rm":"oooo mm dd","ro":"aaaa ll zz","ru":"гггг мм дд","sc":"aaaa mm dd","scn":"aaaa mm jj","sk":"rrrr mm dd","sl":"llll mm dd","sr":"гггг мм дд","sr-Latn":"gggg mm dd","sv":"åååå mm dd","szl":"rrrr mm dd","tg":"сссс мм рр","th":"ปปปป ดด วว","tr":"yyyy aa gg","uk":"рррр мм дд","zh-CN":"年 月 日","zh-TW":"年 月 日"}

/** Placeholder text of an empty segment: localized `yyyy` / `mm` / `dd`, `––` for time fields. */
export function segmentPlaceholder(type: string, locale: string): string {
  if (type !== "year" && type !== "month" && type !== "day") return "––"
  let entry: string | undefined
  try {
    const l = new Intl.Locale(locale)
    entry =
      PLACEHOLDERS[`${l.language}-${l.script ?? ""}`] ??
      PLACEHOLDERS[`${l.language}-${l.region ?? ""}`] ??
      PLACEHOLDERS[l.language] ??
      (l.language === "zh" ? PLACEHOLDERS["zh-CN"] : undefined)
  } catch {
    entry = undefined
  }
  const [year, month, day] = (entry ?? PLACEHOLDERS.en!).split(" ")
  return (type === "year" ? year : type === "month" ? month : day)!
}

/** Messages of the built-in date validation (English defaults, the date formatted for the locale). */
export const validationMessages = {
  rangeUnderflow: (date: string) => `Value must be ${date} or later.`,
  rangeOverflow: (date: string) => `Value must be ${date} or earlier.`,
  unavailable: "Selected date unavailable.",
  incomplete: "Please enter a complete date.",
  rangeReversed: "The start date must be on or before the end date.",
}

/**
 * Built-in validation of a date value against `min` / `max` / unavailable dates — the result as
 * `ValidityStateFlags` and a message, or `null` when valid.
 */
export function validateDate(
  value: DateLike | null,
  min: DateLike | null,
  max: DateLike | null,
  isUnavailable: ((date: CalendarDate) => boolean) | undefined,
  locale: string,
  granularity: DateGranularity = "day"
): { flags: ValidityStateFlags; message: string } | null {
  if (!value) return null
  const format = (d: DateLike) =>
    dateFormatter(locale, {
      dateStyle: "short",
      ...(granularity !== "day" && "hour" in d ? { timeStyle: granularity === "second" ? "medium" : "short" } : {}),
      timeZone: "UTC",
    }).format(d.toDate("UTC"))
  if (min && value.compare(min) < 0) return { flags: { rangeUnderflow: true }, message: validationMessages.rangeUnderflow(format(min)) }
  if (max && value.compare(max) > 0) return { flags: { rangeOverflow: true }, message: validationMessages.rangeOverflow(format(max)) }
  if (isUnavailable?.(toGregorian(toCalendarDate(value)))) return { flags: { badInput: true }, message: validationMessages.unavailable }
  return null
}

/** Today in the local time zone (Gregorian). */
export function todayDate(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * Week number of the week that starts at `weekStart` (Gregorian), using the locale's week rules
 * (`Intl.Locale#getWeekInfo`: first day and minimal days in the first week), ISO 8601 when unknown.
 */
export function weekNumber(weekStart: CalendarDate, locale: string): number {
  let minimalDays = 4
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { minimalDays: number }; weekInfo?: { minimalDays: number } }
    const info = l.getWeekInfo?.() ?? l.weekInfo
    if (info?.minimalDays) minimalDays = info.minimalDays
  } catch {
    /* ISO */
  }
  // The week belongs to the year that holds at least `minimalDays` of its days.
  const g = toGregorian(weekStart)
  const thursdayLike = g.add({ days: 7 - minimalDays })
  const year = thursdayLike.year
  // Week 1 is the week that contains January `minimalDays` (Jan 4 in ISO 8601, Jan 1 in the US).
  const anchor = new CalendarDate(year, 1, minimalDays)
  const weekday = (d: CalendarDate) => (d.toDate("UTC").getUTCDay() + 7) % 7
  const offset = (weekday(anchor) - weekday(g) + 7) % 7
  const week1Start = anchor.subtract({ days: offset })
  const days = Math.round((g.toDate("UTC").getTime() - week1Start.toDate("UTC").getTime()) / 86_400_000)
  return Math.floor(days / 7) + 1
}

export { CalendarDate, CalendarDateTime, Time, toCalendar, toCalendarDate }
