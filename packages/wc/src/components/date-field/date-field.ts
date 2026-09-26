import { toCalendarDate, toCalendarDateTime, type CalendarDate } from "@internationalized/date"
import { property } from "lit/decorators.js"
import {
  formatIsoTime,
  formatIsoValue,
  parseIsoDateTime,
  parseIsoTime,
  resolveLocale,
  toGregorian,
  validateDate,
  validationMessages,
  type DateGranularity,
  type DateLike,
  type TimeGranularity,
} from "../calendar/date-utils.js"
import { DateFieldBase } from "./date-field-base.js"
import type { SegmentValue } from "./segments.js"

export type { DateFieldVariant } from "./date-field-base.js"

/**
 * A segmented date input (the React Aria DateField): each part — month, day, year, and with a time
 * `granularity` hour, minute, second, AM/PM — is a `spinbutton` in the locale's order. Type digits
 * (focus moves on when a part is complete), step with <kbd>↑</kbd>/<kbd>↓</kbd>
 * (<kbd>Page Up</kbd>/<kbd>Page Down</kbd> in bigger steps, <kbd>Home</kbd>/<kbd>End</kbd> to the
 * limits), clear with <kbd>Backspace</kbd>, move with <kbd>←</kbd>/<kbd>→</kbd>. Form-associated:
 * the value is ISO (`2026-09-26`, or `2026-09-26T10:30` with a time granularity); `required`,
 * `min`, `max` and `isDateUnavailable` are validated, and a partly entered date is `badInput`.
 *
 * @summary A segmented input for a date (and optionally a time).
 *
 * @tag tec-date-field
 *
 * @slot start - Leading adornment (an icon).
 * @slot end - Trailing adornment (an icon or a button).
 *
 * @csspart base - The field box (`role="group"`).
 * @csspart input - The row of segments.
 * @csspart segment - An editable segment (`role="spinbutton"`).
 * @csspart literal - A separator between segments.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (after interaction or a submit attempt, or `invalid`).
 *
 * @fires input - The user changed the value (a complete date, or `""` when emptied or incomplete).
 * @fires change - The user changed the value.
 */
export class TecDateField extends DateFieldBase {
  /** The smallest unit edited: `day` (a date), or `hour` / `minute` / `second` (a date and time). */
  @property() granularity: DateGranularity = "day"

  /** Returns `true` for dates that are not valid choices (Gregorian `CalendarDate`). */
  @property({ attribute: false }) isDateUnavailable?: (date: CalendarDate) => boolean

  protected get kind() {
    return "date" as const
  }

  protected get fieldGranularity(): DateGranularity {
    return this.granularity
  }

  protected get incompleteMessage(): string {
    return validationMessages.incomplete
  }

  protected parse(value: string): SegmentValue | null {
    const v = parseIsoDateTime(value)
    if (!v) return null
    if (this.granularity === "day") return toCalendarDate(v)
    return "hour" in v ? v : toCalendarDateTime(v)
  }

  protected format(value: SegmentValue): string {
    return formatIsoValue(toGregorian(value as DateLike), this.granularity)
  }

  protected validateValue(value: SegmentValue): { flags: ValidityStateFlags; message: string } | null {
    return validateDate(value as DateLike, parseIsoDateTime(this.min), parseIsoDateTime(this.max), this.isDateUnavailable, resolveLocale(this, this.locale), this.granularity)
  }
}

/**
 * A segmented time input (the React Aria TimeField): hour, minute, optionally second and AM/PM
 * (per locale or `hour-cycle`) as `spinbutton`s. The value is `HH:mm` (or `HH:mm:ss` with
 * `granularity="second"`), form-associated and validated against `required`, `min` and `max`.
 *
 * @summary A segmented input for a time of day.
 *
 * @tag tec-time-field
 *
 * @slot start - Leading adornment (an icon).
 * @slot end - Trailing adornment (an icon).
 *
 * @csspart base - The field box (`role="group"`).
 * @csspart input - The row of segments.
 * @csspart segment - An editable segment (`role="spinbutton"`).
 * @csspart literal - A separator between segments.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed.
 *
 * @fires input - The user changed the value (a complete time, or `""`).
 * @fires change - The user changed the value.
 */
export class TecTimeField extends DateFieldBase {
  /** The smallest unit edited. */
  @property() granularity: TimeGranularity = "minute"

  protected get kind() {
    return "time" as const
  }

  protected get fieldGranularity(): DateGranularity {
    return this.granularity
  }

  protected get incompleteMessage(): string {
    return "Please enter a complete time."
  }

  protected parse(value: string): SegmentValue | null {
    return parseIsoTime(value)
  }

  protected format(value: SegmentValue): string {
    return formatIsoTime(value as { hour: number; minute: number; second: number }, this.granularity)
  }

  protected validateValue(value: SegmentValue): { flags: ValidityStateFlags; message: string } | null {
    const min = parseIsoTime(this.min)
    const max = parseIsoTime(this.max)
    const t = value as ReturnType<typeof parseIsoTime> & object
    const fmt = (v: typeof t) => formatIsoTime(v, this.granularity)
    if (min && t.compare(min) < 0) return { flags: { rangeUnderflow: true }, message: validationMessages.rangeUnderflow(fmt(min)) }
    if (max && t.compare(max) > 0) return { flags: { rangeOverflow: true }, message: validationMessages.rangeOverflow(fmt(max)) }
    return null
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-date-field": TecDateField
    "tec-time-field": TecTimeField
  }
}
