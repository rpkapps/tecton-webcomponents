import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecButton, type ButtonVariant } from "../button/button.js"
import type { QuestionnaireItemStatus } from "./questionnaire-item.js"
import { questionnaireActionsStyles, questionnaireNavStyles, questionnaireProgressStyles } from "./questionnaire.styles.js"
import type { TecQuestionnaire } from "./questionnaire.js"

/** What the questionnaire tells its progress and navigation parts. */
export interface QuestionnaireNavState {
  /** 1-based position of the active item among the enabled items (0 when there is none). */
  current: number
  total: number
  first: boolean
  last: boolean
  /** Status of the active item. */
  status: QuestionnaireItemStatus | null
  /** Whether the active item is required. */
  required: boolean | null
}

const EMPTY: QuestionnaireNavState = { current: 0, total: 0, first: false, last: false, status: null, required: null }

const format = (template: string, s: QuestionnaireNavState) =>
  template.replace(/\{current\}/g, String(s.current)).replace(/\{total\}/g, String(s.total))

/**
 * Exposed as a progress bar ("Questionnaire progress", 1 to the number of enabled items) whose value
 * text is announced politely when the question changes.
 *
 * @summary The position in a questionnaire ("Question 2 of 3").
 * @tag tec-questionnaire-progress
 * @csspart text - The progress text.
 * @csspart segments - The segment bar (with `segments`).
 * @csspart segment - One segment; `done` segments are filled.
 */
export class TecQuestionnaireProgress extends TectonElement {
  static styles = [hostStyles, questionnaireProgressStyles]

  /** The visible text; `{current}` and `{total}` are replaced. */
  @property() format = "Question {current} of {total}"

  /** The value text announced by assistive technology; `{current}` and `{total}` are replaced. */
  @property({ attribute: "value-text" }) valueText = "Question {current} of {total}"

  /** The accessible name of the progress bar. */
  @property() label = "Questionnaire progress"

  /** Shows a bar with one segment per question above the text. */
  @property({ type: Boolean, reflect: true }) segments = false

  /** @internal */ @property({ attribute: false }) state: QuestionnaireNavState = EMPTY

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "progressbar"
    this.internals.ariaLive = "polite"
    queueMicrotask(() => (this.closest("tec-questionnaire") as TecQuestionnaire | null)?.requestUpdate?.())
  }

  /** 1-based position of the active question. */
  get current(): number {
    return this.state.current
  }

  /** Number of (enabled) questions. */
  get total(): number {
    return this.state.total
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const s = this.state
    const i = this.internals
    i.ariaLabel = this.label
    i.ariaValueMin = s.total ? "1" : null
    i.ariaValueMax = s.total ? String(s.total) : null
    i.ariaValueNow = s.total ? String(s.current) : null
    i.ariaValueText = s.total ? format(this.valueText, s) : null
  }

  protected override render() {
    const s = this.state
    return html`${this.segments
        ? html`<div class="segments" part="segments" aria-hidden="true">
            ${Array.from({ length: s.total }, (_, i) => html`<span class="segment ${i < s.current ? "done" : ""}" part="segment"></span>`)}
          </div>`
        : null}<span class="text" part="text">${s.total ? format(this.format, s) : ""}</span>`
  }
}

/**
 * @summary The navigation row of a questionnaire: Previous at the start, Skip and Next / Submit at the end.
 * @tag tec-questionnaire-actions
 * @slot - `tec-questionnaire-previous`, `-skip`, `-next`, `-submit` (and e.g. a reset `tec-button`).
 */
export class TecQuestionnaireActions extends TectonElement {
  static styles = [hostStyles, questionnaireActionsStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

type NavKind = "previous" | "skip" | "next" | "submit"

const column = (n: number, justify: string) => css`
  :host {
    grid-column-start: ${n};
    justify-self: ${justify === "start" ? css`start` : css`end`};
  }
`

/**
 * Shared behaviour of the four navigation buttons.
 * @hideInherited href, target, rel, download - it always renders a `<button>`.
 */
class QuestionnaireNavButton extends TecButton {
  protected navKind: NavKind = "next"
  protected defaultLabel = "Next"

  /** @internal */ @property({ attribute: false }) state: QuestionnaireNavState = EMPTY

  constructor() {
    super()
    this.addEventListener("click", this.#onActivate)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    queueMicrotask(() => this.#questionnaire?.requestUpdate?.())
  }

  get #questionnaire(): TecQuestionnaire | null {
    return this.closest("tec-questionnaire") as TecQuestionnaire | null
  }

  /** Whether the button applies to the active question. */
  get visible(): boolean {
    const s = this.state
    switch (this.navKind) {
      case "previous":
        return s.total > 1 && !s.first
      case "skip":
        return s.required === false
      case "next":
        return s.total > 1 && !s.last
      case "submit":
        return s.total > 0 && s.last
    }
  }

  #onActivate = (event: MouseEvent) => {
    if (event.defaultPrevented || this.disabled || !this.visible) return
    // Let listeners on the element veto the navigation (like the native activation behaviour).
    setTimeout(() => {
      if (event.defaultPrevented) return
      const q = this.#questionnaire
      if (!q?.goNext) return
      if (this.navKind === "previous") q.goPrevious()
      else if (this.navKind === "skip") q.skipCurrent()
      else if (this.navKind === "next") q.goNext()
      else q.requestSubmit()
    }, 0)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const visible = this.visible
    this.toggleState("hidden", !visible)
    for (const s of ["answered", "skipped", "unanswered"] as const) this.toggleState(s, this.state.status === s)
    const control = this.control
    if (control) {
      const shortcut = visible && !this.disabled && (this.navKind === "next" || this.navKind === "submit")
      if (shortcut && !this.hasAttribute("aria-keyshortcuts")) control.setAttribute("aria-keyshortcuts", "Enter")
      else if (!this.hasAttribute("aria-keyshortcuts")) control.removeAttribute("aria-keyshortcuts")
      control.tabIndex = visible ? 0 : -1
    }
  }

  protected override render() {
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled}>
      <slot name="start"></slot><slot>${this.defaultLabel}</slot><slot name="end"></slot>
    </button>`
  }
}

/**
 * @summary Goes back to the previous question. Hidden on the first question.
 * @tag tec-questionnaire-previous
 * @slot - The label (default "Previous").
 * @cssstate hidden - Not applicable to the active question.
 * @cssstate answered - The active question is answered (also `skipped`, `unanswered`).
 */
export class TecQuestionnairePrevious extends QuestionnaireNavButton {
  static styles = [...TecButton.styles, questionnaireNavStyles, column(1, "start")]
  constructor() {
    super()
    this.navKind = "previous"
    this.defaultLabel = "Previous"
    this.variant = "outline" satisfies ButtonVariant
  }
}

/**
 * @summary Skips an optional question (the answer is cleared and nothing is submitted for it). Hidden on required questions.
 * @tag tec-questionnaire-skip
 * @slot - The label (default "Skip").
 * @cssstate hidden - Not applicable to the active question.
 * @cssstate answered - The active question is answered (also `skipped`, `unanswered`).
 */
export class TecQuestionnaireSkip extends QuestionnaireNavButton {
  static styles = [...TecButton.styles, questionnaireNavStyles, column(2, "end")]
  constructor() {
    super()
    this.navKind = "skip"
    this.defaultLabel = "Skip"
    this.variant = "outline" satisfies ButtonVariant
  }
}

/**
 * @summary Validates the active question and goes to the next one. Hidden on the last question.
 * @tag tec-questionnaire-next
 * @slot - The label (default "Next").
 * @cssstate hidden - Not applicable to the active question.
 * @cssstate answered - The active question is answered (also `skipped`, `unanswered`).
 */
export class TecQuestionnaireNext extends QuestionnaireNavButton {
  static styles = [...TecButton.styles, questionnaireNavStyles, column(3, "end")]
  constructor() {
    super()
    this.navKind = "next"
    this.defaultLabel = "Next"
  }
}

/**
 * @summary Validates every question and submits the questionnaire. Shown on the last question only.
 * @tag tec-questionnaire-submit
 * @slot - The label (default "Submit").
 * @cssstate hidden - Not applicable to the active question.
 * @cssstate answered - The active question is answered (also `skipped`, `unanswered`).
 */
export class TecQuestionnaireSubmit extends QuestionnaireNavButton {
  static styles = [...TecButton.styles, questionnaireNavStyles, column(3, "end")]
  constructor() {
    super()
    this.navKind = "submit"
    this.defaultLabel = "Submit"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-questionnaire-progress": TecQuestionnaireProgress
    "tec-questionnaire-actions": TecQuestionnaireActions
    "tec-questionnaire-previous": TecQuestionnairePrevious
    "tec-questionnaire-skip": TecQuestionnaireSkip
    "tec-questionnaire-next": TecQuestionnaireNext
    "tec-questionnaire-submit": TecQuestionnaireSubmit
  }
}
