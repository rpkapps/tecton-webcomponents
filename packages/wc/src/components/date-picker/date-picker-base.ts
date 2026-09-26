/** Shared implementation of `tec-date-picker` and `tec-date-range-picker`. */
import type { CalendarDate } from "@internationalized/date"
import { html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property, query } from "lit/decorators.js"
import { Calendar as CalendarIcon } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { resolveIdRefs, setAriaElements } from "../../internal/aria.js"
import { FormControlMixin } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupSide } from "../../internal/popup.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { CalendarButtonVariant, CalendarCaptionLayout, CalendarDay } from "../calendar/calendar-base.js"
import { navLabel, resolveLocale, type DateGranularity, type DayOfWeek } from "../calendar/date-utils.js"
import { dateFieldStyles } from "../date-field/date-field.styles.js"
import { focusSibling, hostLabels, segmentToFocus, syncSegmentAria } from "../date-field/field-helpers.js"
import { SegmentedField, type SegmentValue } from "../date-field/segments.js"
import { datePickerStyles } from "./date-picker.styles.js"

/** How the picker shows its value. */
export type DatePickerAppearance = "field" | "button"

/** Why the popover opened or closed. */
export type DatePickerOpenChangeReason = "trigger" | "keyboard" | "select" | PopupCloseReason

/** Detail of `tec-open-change`. */
export interface DatePickerOpenChangeDetail {
  open: boolean
  reason: DatePickerOpenChangeReason
}

export abstract class DatePickerBase extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".content"), dateFieldStyles, datePickerStyles]
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** `field`: segmented date input with a calendar button (type or pick). `button`: an outline button showing the formatted date (pick only). */
  @property({ reflect: true }) appearance: DatePickerAppearance = "field"

  /** Whether the calendar popover is open. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Text of the button appearance while empty. */
  @property() placeholder = "Pick a date"

  /** `Intl` date style of the button appearance. */
  @property({ attribute: "date-style" }) dateStyle: "full" | "long" | "medium" | "short" = "long"

  /** Accessible name of the calendar button of the field appearance. Default: "Calendar" in the picker's locale. */
  @property({ attribute: "button-label" }) buttonLabel = ""

  /** Locale (BCP 47). Default: the `lang` of the closest ancestor, else the browser language. */
  @property() locale = ""

  /** Earliest valid date (`YYYY-MM-DD`). */
  @property() min = ""

  /** Latest valid date (`YYYY-MM-DD`). */
  @property() max = ""

  /** Returns `true` for dates that cannot be chosen (Gregorian `CalendarDate`); they are struck through in the calendar and invalid when typed. */
  @property({ attribute: false }) isDateUnavailable?: (date: CalendarDate) => boolean

  /** Custom day content of the calendar (see `tec-calendar`). */
  @property({ attribute: false }) renderDay?: (day: CalendarDay) => unknown

  /** 12- or 24-hour clock of the time segments. */
  @property({ type: Number, attribute: "hour-cycle" }) hourCycle?: 12 | 24

  /** Always shows two digits for months, days and hours. */
  @property({ type: Boolean, attribute: "leading-zeros" }) leadingZeros = false

  /** The value cannot be changed. */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** Look of the field appearance (`outline`, `filled`, `text`). */
  @property({ reflect: true }) variant: "outline" | "filled" | "text" = "outline"

  /** Value used to fill an empty segment stepped with the arrow keys, and the month the calendar opens on when empty (ISO). */
  @property({ attribute: "placeholder-value" }) placeholderValue = ""

  /** Months shown in the calendar. */
  @property({ type: Number, attribute: "visible-months" }) visibleMonths = 1

  /** Caption of the calendar: `label` or `dropdown` (month/year selects). */
  @property({ attribute: "caption-layout" }) captionLayout: CalendarCaptionLayout = "label"

  /** First day of the week in the calendar. */
  @property({ attribute: "first-day-of-week" }) firstDayOfWeek?: DayOfWeek

  /** Shows week numbers in the calendar. */
  @property({ type: Boolean, attribute: "show-week-number" }) showWeekNumber = false

  /** Six weeks in every month of the calendar. */
  @property({ type: Boolean, attribute: "fixed-weeks" }) fixedWeeks = false

  /** Variant of the calendar's previous/next buttons. */
  @property({ attribute: "button-variant" }) buttonVariant: CalendarButtonVariant = "ghost"

  /** Side of the field the popover opens on. */
  @property() side: PopupSide = "bottom"

  /** Alignment of the popover against the field (not reflected). */
  @property() align: PopupAlign = "start"

  /** Distance between the field and the popover in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  @query(".content") protected panel!: HTMLElement
  @query(".trigger") protected triggerButton!: HTMLButtonElement

  /** The smallest unit edited: `day` (a date), or `hour` / `minute` / `second` to edit a time in the field too (the value becomes `YYYY-MM-DDTHH:mm`). */
  @property() granularity: DateGranularity = "day"

  protected abstract readonly fields: SegmentedField[]
  /** The calendar element in the popover. */
  protected abstract renderCalendar(): TemplateResult
  /** Text of the button appearance, or "" when empty. */
  protected abstract formattedValue(): string
  /** Syncs the calendar (value + month shown) before opening. */
  protected abstract prepareCalendar(): void
  /** Renders the segments of the field appearance. */
  protected abstract renderInput(): TemplateResult

  constructor() {
    super()
    new HasSlotController(this, "start", "end", { states: true })
  }

  #popup = new PopupController(this, {
    popup: () => this.panel,
    trigger: () => this.triggerButton,
    anchor: () => this.renderRoot.querySelector<HTMLElement>(".field, .button"),
    haspopup: "dialog",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset }),
    // Like React Aria: a pointer open focuses the dialog (no focus ring); a keyboard open focuses the day.
    focus: { initial: () => (this.#openedBy === "pointer" ? this.panel : this.renderRoot.querySelector<HTMLElement>(".calendar")), trap: true, restore: true },
    onRequestClose: (reason) => this.requestOpen(false, reason),
  })

  protected newField(onCommit: (value: SegmentValue | null) => void): SegmentedField {
    return new SegmentedField({
      kind: () => "date",
      granularity: () => this.granularity,
      locale: () => this.resolvedLocale,
      hourCycle: () => (this.hourCycle === 12 || this.hourCycle === 24 ? this.hourCycle : undefined),
      placeholderValue: () => null,
      forceLeadingZeros: () => this.leadingZeros,
      requestUpdate: () => this.requestUpdate(),
      onCommit,
      focusSibling: (from, direction) => focusSibling(this.renderRoot, from, direction),
    })
  }

  protected get resolvedLocale(): string {
    return resolveLocale(this, this.locale)
  }

  /** Opens the calendar popover (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the calendar popover (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the calendar popover (no event). */
  toggle(): void {
    this.open = !this.open
  }

  override focus(options?: FocusOptions): void {
    if (this.appearance === "button") this.triggerButton?.focus(options)
    else segmentToFocus(this.renderRoot)?.focus(options)
  }

  protected requestOpen(open: boolean, reason: DatePickerOpenChangeReason): void {
    if (open === this.open) return
    if (open && (this.isDisabled || this.readonly)) return
    if (this.emit<DatePickerOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) this.open = open
  }

  protected fireChange(): void {
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  /** Keeps the inner calendar's own `input`/`change` events inside the picker. */
  protected stopInner = (event: Event) => event.stopPropagation()

  #openedBy: "pointer" | "keyboard" = "keyboard"

  #onTriggerClick = (event: MouseEvent) => {
    this.#openedBy = event.detail > 0 ? "pointer" : "keyboard"
    this.requestOpen(!this.open, "trigger")
  }

  /** Keys pressed while the dialog itself has focus (after a pointer open) move focus into the calendar. */
  #onPanelKeyDown = (event: KeyboardEvent) => {
    if (event.composedPath()[0] !== this.panel) return
    if (/^(Arrow|Page)|^(Home|End|Enter| )$/.test(event.key)) {
      event.preventDefault()
      this.renderRoot.querySelector<HTMLElement>(".calendar")?.focus()
    }
  }

  #onFieldKeyDown = (event: KeyboardEvent) => {
    if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      event.stopPropagation()
      this.#openedBy = "keyboard"
      this.requestOpen(true, "keyboard")
    }
  }

  #onFieldPointerDown = (event: PointerEvent) => {
    const interactive = event
      .composedPath()
      .some((n) => n instanceof HTMLElement && (n.classList.contains("segment") || n.matches("button, a, input, select, tec-button")))
    if (interactive || this.isDisabled || event.button !== 0) return
    event.preventDefault()
    this.focus()
  }

  #onFieldFocusIn = (event: FocusEvent) => {
    if ((event.composedPath()[0] as HTMLElement).classList?.contains("field")) this.focus()
  }

  #onFieldFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next && this.renderRoot.contains(next)) return
    for (const field of this.fields) field.confirm()
  }

  protected override get formControl(): HTMLElement | null {
    return this.appearance === "field" ? (this.renderRoot?.querySelector<HTMLElement>(".field") ?? null) : null
  }

  override syncFormState(): void {
    super.syncFormState()
    if (!this.renderRoot) return
    const labels = hostLabels(this, this.formLabels())
    const trigger = this.triggerButton
    if (this.appearance === "field") {
      syncSegmentAria(this.renderRoot, labels, this.showInvalid, resolveIdRefs(this, this.getAttribute("aria-describedby")))
      if (trigger) setAriaElements(trigger, "ariaLabelledByElements", labels.length ? [trigger, ...labels] : null)
    } else if (trigger) {
      const value = this.renderRoot.querySelector(".value")
      setAriaElements(trigger, "ariaLabelledByElements", labels.length && value ? [...labels, value] : null)
      setAriaElements(trigger, "ariaDescribedByElements", resolveIdRefs(this, this.getAttribute("aria-describedby")))
      if (this.showInvalid) trigger.setAttribute("aria-invalid", "true")
      else trigger.removeAttribute("aria-invalid")
    }
    if (this.panel) setAriaElements(this.panel, "ariaLabelledByElements", labels.length ? labels : trigger ? [trigger] : null)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("open")) {
      if (this.open) this.prepareCalendar()
      void this.#popup.setOpen(this.open)
    }
  }

  /** Attributes forwarded to the popover calendar. */
  protected calendarOptions() {
    return {
      locale: this.locale,
      min: this.min,
      max: this.max,
      visibleMonths: this.visibleMonths,
      captionLayout: this.captionLayout,
      firstDayOfWeek: this.firstDayOfWeek,
      showWeekNumber: this.showWeekNumber,
      fixedWeeks: this.fixedWeeks,
      buttonVariant: this.buttonVariant,
    }
  }

  protected renderSegments(field: SegmentedField, name: string, label?: string): TemplateResult {
    return field.render({
      disabled: this.isDisabled,
      readonly: this.readonly,
      required: this.required,
      invalid: false,
      label: [this.getAttribute("aria-label"), label].filter(Boolean).join(", ") || null,
      field: name,
    })
  }

  protected override render() {
    const expanded = this.open ? "true" : "false"
    const trigger =
      this.appearance === "button"
        ? html`<button
            class="button trigger"
            part="base trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded=${expanded}
            aria-label=${this.getAttribute("aria-label") ? `${this.getAttribute("aria-label")}, ${this.formattedValue() || this.placeholder}` : nothing}
            ?disabled=${this.isDisabled || this.readonly}
            @click=${this.#onTriggerClick}
          >
            <slot name="start"></slot>
            <span class="value" part="value" ?data-placeholder=${!this.formattedValue()}>${this.formattedValue() || this.placeholder}</span>
            <slot name="end"></slot>
          </button>`
        : html`<div
            class="field"
            part="base"
            role="group"
            tabindex="-1"
            @keydown=${this.#onFieldKeyDown}
            @pointerdown=${this.#onFieldPointerDown}
            @focusin=${this.#onFieldFocusIn}
            @focusout=${this.#onFieldFocusOut}
          >
            <slot name="start"></slot>
            <div class="input" part="input">${this.renderInput()}</div>
            <slot name="end"></slot>
            <button
              class="icon-trigger trigger"
              part="trigger"
              type="button"
              aria-label=${this.buttonLabel || navLabel(this.resolvedLocale, "calendar")}
              aria-haspopup="dialog"
              aria-expanded=${expanded}
              ?disabled=${this.isDisabled || this.readonly}
              @click=${this.#onTriggerClick}
            >
              ${icon(CalendarIcon, { size: 16 })}
            </button>
          </div>`
    return html`${trigger}
      <div class="content" part="content" popover="manual" role="dialog" tabindex="-1" @keydown=${this.#onPanelKeyDown}>
        ${this.renderCalendar()}
        <slot name="footer"></slot>
      </div>`
  }
}
