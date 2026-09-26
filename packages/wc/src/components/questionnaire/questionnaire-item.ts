import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { setAriaElements } from "../../internal/aria.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecQuestionnaireChoice, TecQuestionnaireInput } from "./questionnaire-choice.js"
import {
  questionnaireChoicesStyles,
  questionnaireDescriptionStyles,
  questionnaireErrorStyles,
  questionnaireItemStyles,
  questionnaireTitleStyles,
} from "./questionnaire.styles.js"

/** Whether an item has an answer, was explicitly skipped, or neither. */
export type QuestionnaireItemStatus = "unanswered" | "answered" | "skipped"
/** Which keys select answers. */
export type QuestionnaireShortcutMode = "letters" | "numbers"

export type QuestionnaireAnswer = TecQuestionnaireChoice | TecQuestionnaireInput

const shortcutKeys = (mode: QuestionnaireShortcutMode | "" | null | undefined): string[] =>
  mode === "letters"
    ? Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
    : mode === "numbers"
      ? Array.from({ length: 9 }, (_, i) => String(i + 1))
      : []

const isChoice = (el: Element): el is TecQuestionnaireChoice => el.localName === "tec-questionnaire-choice"

/**
 * One question of a `tec-questionnaire`, exposed as a group (the fieldset of the question) named by
 * its `tec-questionnaire-title` and described by its descriptions — and by its error while the error
 * shows. Only the active item is rendered; the others are hidden and inert.
 *
 * It is form-associated: inside a `<form>` it submits its answers under `name` (repeated entries for a
 * `multiple` item; nothing when skipped or disabled).
 *
 * Validation: moving on (Next, Enter, submit) needs an answer — or, for an optional item, an explicit
 * Skip. `invalid` marks the item invalid from outside (e.g. a schema check).
 *
 * @summary One question of a questionnaire.
 *
 * @tag tec-questionnaire-item
 *
 * @slot - `tec-questionnaire-title`, `tec-questionnaire-description`, `tec-questionnaire-choices` (choices and/or a `tec-questionnaire-input`, or the input alone) and `tec-questionnaire-error`.
 *
 * @cssstate active - The item is the current question.
 * @cssstate invalid - The item shows its error.
 * @cssstate answered - The item has an answer.
 * @cssstate skipped - The item was skipped.
 * @cssstate unanswered - The item has no answer.
 *
 * @fires tec-status-change - The status changed (`unanswered`, `answered`, `skipped`). `detail: { status }`.
 */
export class TecQuestionnaireItem extends TectonElement {
  static styles = [hostStyles, questionnaireItemStyles]
  static formAssociated = true

  /** The answer name: identifies the item for navigation (`item` on the questionnaire) and names the submitted answers. */
  @property({ reflect: true }) name = ""

  /** An answer is needed: the item cannot be skipped. */
  @property({ type: Boolean, reflect: true }) required = false

  /** Several choices can be selected (checkboxes instead of radio buttons). */
  @property({ type: Boolean, reflect: true }) multiple = false

  /** Leaves the item out of the questionnaire (a conditional question that does not apply). */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Marks the item invalid from outside (the error shows until cleared). */
  @property({ type: Boolean, reflect: true }) invalid = false

  /** Whether the item is the current question (set by the questionnaire). @internal */
  @property({ type: Boolean, attribute: false }) active = false

  /** The questionnaire's shortcut mode (set by the questionnaire). @internal */
  @property({ attribute: false }) shortcuts: QuestionnaireShortcutMode | "" = ""

  #skipped = false
  #attempted = false
  #lastStatus: QuestionnaireItemStatus | null = null

  constructor() {
    super()
    this.addEventListener("change", this.#onAnswer)
    this.addEventListener("input", this.#onAnswer)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1
  }

  // ------------------------------------------------------------------ answers

  #owns = (el: Element) => el.closest("tec-questionnaire-item") === this

  /** The item's answer controls (choices and freeform inputs) in document order, enabled ones only. */
  get answers(): QuestionnaireAnswer[] {
    return [...this.querySelectorAll<QuestionnaireAnswer>("tec-questionnaire-choice, tec-questionnaire-input")].filter(
      (a) => this.#owns(a) && !a.disabled
    )
  }

  get #allAnswers(): QuestionnaireAnswer[] {
    return [...this.querySelectorAll<QuestionnaireAnswer>("tec-questionnaire-choice, tec-questionnaire-input")].filter(this.#owns)
  }

  /** Whether an answer control counts as (part of) the answer. */
  isSelected(answer: QuestionnaireAnswer): boolean {
    return isChoice(answer) ? answer.checked : answer.filled && answer.selected
  }

  /** The item's status. */
  get status(): QuestionnaireItemStatus {
    if (this.#skipped) return "skipped"
    return this.answers.some((a) => this.isSelected(a)) ? "answered" : "unanswered"
  }

  get #skippedOptional(): boolean {
    return this.status === "skipped" && !this.required
  }

  /** Whether moving on is allowed: answered (and not `invalid`), skipped when optional, or disabled. */
  get valid(): boolean {
    return this.disabled || this.#skippedOptional || (!this.invalid && this.status === "answered")
  }

  /** Whether the error is shown. */
  get showInvalid(): boolean {
    return !this.disabled && !this.#skippedOptional && (this.invalid || (this.#attempted && !this.valid))
  }

  /** The submitted answers as `[name, value]` pairs. */
  get entries(): [string, string][] {
    if (this.disabled || this.#skipped || !this.name) return []
    return this.answers.filter((a) => this.isSelected(a)).map((a) => [this.name, a.value])
  }

  /** Marks the item as attempted (errors show) and returns whether it is valid. @internal */
  validate(): boolean {
    this.#attempted = true
    this.requestUpdate()
    return this.valid
  }

  /** Clears the answers and marks the item skipped (optional items only). @internal */
  skip(): void {
    if (this.required) return
    for (const a of this.#allAnswers) {
      if (isChoice(a)) a.checked = false
      else a.selected = false
    }
    this.#skipped = true
    this.requestUpdate()
  }

  /** Back to the initial answers (the `checked` / `value` attributes). @internal */
  reset(): void {
    this.#attempted = false
    this.#skipped = false
    let kept = false
    for (const a of this.#allAnswers) {
      if (isChoice(a)) {
        a.resetChecked()
        // A single-answer item keeps only the first default.
        if (!this.multiple && a.checked) {
          if (kept) a.checked = false
          kept = true
        }
      } else a.resetValue()
    }
    this.requestUpdate()
  }

  /** The answer control that holds `target` (a node inside its shadow root, or the element). */
  answerFor(target: EventTarget | null): QuestionnaireAnswer | null {
    if (!(target instanceof Node)) return null
    return this.answers.find((a) => a === target || a.shadowRoot?.contains(target)) ?? null
  }

  /** The shortcut key of each enabled choice. */
  get shortcutMap(): Map<QuestionnaireAnswer, string> {
    const keys = shortcutKeys(this.shortcuts)
    const map = new Map<QuestionnaireAnswer, string>()
    this.answers.filter(isChoice).forEach((c, i) => {
      if (keys[i]) map.set(c, keys[i])
    })
    return map
  }

  /** The choice assigned to `key` (case-insensitive letters). */
  answerByShortcut(key: string): QuestionnaireAnswer | null {
    const k = this.shortcuts === "letters" ? key.toUpperCase() : key
    for (const [answer, shortcut] of this.shortcutMap) if (shortcut === k) return answer
    return null
  }

  /** Focuses the item itself. */
  focusItem(): void {
    this.focus({ preventScroll: false })
  }

  /** Focuses where the user can fix the answer: the selected text input, else the first answer control. @internal */
  focusInvalid(): void {
    const answers = this.answers
    const filled = answers.find((a) => !isChoice(a) && a.filled && a.selected)
    const target = filled ?? answers[0]
    if (target) target.focus()
    else this.focus()
  }

  /** Moves focus to the next/previous answer control (Arrow keys). Returns whether it handled the key. @internal */
  moveAnswerFocus(from: Element, direction: "next" | "previous", textEditing: boolean): boolean {
    const answers = this.answers
    if (!answers.length) return false
    const current = this.answerFor(from)
    const index = current ? answers.indexOf(current) : -1
    // Leave the caret keys to a text input that has text.
    if (textEditing && !(current && !isChoice(current) && !current.filled)) return false
    if (index < 0 && from !== this) return false
    const next =
      index < 0
        ? (answers.find((a) => this.isSelected(a)) ?? (direction === "next" ? answers[0] : answers[answers.length - 1]))
        : answers[(index + (direction === "next" ? 1 : -1) + answers.length) % answers.length]
    if (!next || next === current) return false
    next.focus()
    // Like native radio buttons: moving onto a radio selects it.
    if (isChoice(next) && !this.multiple && !next.checked) next.input?.click()
    return true
  }

  // ------------------------------------------------------------------ interaction

  #onAnswer = (event: Event) => {
    const source = event.composedPath().find(
      (n): n is QuestionnaireAnswer => n instanceof Element && (n.localName === "tec-questionnaire-choice" || n.localName === "tec-questionnaire-input")
    )
    if (!source || !this.#owns(source)) return
    if (isChoice(source)) {
      if (event.type !== "change") return
      if (source.checked) {
        this.#skipped = false
        if (!this.multiple) {
          for (const a of this.#allAnswers) {
            if (a === source) continue
            if (isChoice(a)) a.checked = false
            else a.selected = false
          }
        }
      }
    } else if (event.type === "input") {
      if (source.filled) {
        this.#skipped = false
        if (!this.multiple) for (const a of this.#allAnswers) if (isChoice(a)) a.checked = false
      }
    }
    this.requestUpdate()
  }

  // ------------------------------------------------------------------ rendering

  /** @internal */
  formResetCallback(): void {
    this.reset()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const status = this.status
    const invalid = this.showInvalid
    this.toggleState("active", this.active && !this.disabled)
    this.toggleState("invalid", invalid)
    for (const s of ["answered", "skipped", "unanswered"] as const) this.toggleState(s, status === s)

    // Semantics: named by the titles, described by the descriptions (and the error while shown).
    const own = <T extends Element>(selector: string) => [...this.querySelectorAll<T>(selector)].filter(this.#owns)
    const errors = own<TecQuestionnaireError>("tec-questionnaire-error")
    setAriaElements(this.internals as unknown as Element, "ariaLabelledByElements", own("tec-questionnaire-title"))
    setAriaElements(this.internals as unknown as Element, "ariaDescribedByElements", [
      ...own("tec-questionnaire-description"),
      ...(invalid ? errors : []),
    ])
    this.internals.ariaInvalid = invalid ? "true" : null
    this.internals.ariaDisabled = this.disabled ? "true" : null
    const active = this.active && !this.disabled
    const keys = active
      ? ["Meta+Enter Control+Enter", this.answers.length ? "ArrowUp ArrowDown" : "", "ArrowLeft", status !== "unanswered" ? "ArrowRight" : ""]
      : []
    this.internals.ariaKeyShortcuts = keys.filter(Boolean).join(" ") || null

    // Answer controls.
    const answers = this.#allAnswers
    const enabled = this.answers
    const shortcutMap = active ? this.shortcutMap : new Map<QuestionnaireAnswer, string>()
    const choices = enabled.filter(isChoice)
    const tabStop = this.multiple ? null : (choices.find((c) => c.checked) ?? choices[0] ?? null)
    for (const a of answers) {
      a.invalid = invalid
      a.itemDisabled = this.disabled
      if (isChoice(a)) {
        a.kind = this.multiple ? "checkbox" : "radio"
        a.shortcut = shortcutMap.get(a) ?? null
        a.tabbable = this.multiple || a === tabStop
        a.position = choices.includes(a) ? [choices.indexOf(a) + 1, choices.length] : null
      }
    }
    for (const error of errors) {
      error.invalid = invalid
      error.required = this.required
    }

    // Form participation.
    const entries = this.entries
    if (entries.length) {
      const data = new FormData()
      for (const [n, v] of entries) data.append(n, v)
      this.internals.setFormValue(data)
    } else this.internals.setFormValue(null)

    if (this.#lastStatus !== null && this.#lastStatus !== status) {
      this.emit<{ status: QuestionnaireItemStatus }>("tec-status-change", { detail: { status } })
    }
    this.#lastStatus = status
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.requestUpdate()}></slot>`
  }
}

/**
 * The question text: it names the item (like the `legend` of a fieldset). Put it first in the item;
 * it may sit inside a card or dialog header.
 *
 * @summary The question of a questionnaire item.
 * @tag tec-questionnaire-title
 * @slot - The question text.
 * @csspart base - The text block.
 * @cssstate alone - No description follows the title (it keeps a larger gap to the answers).
 */
export class TecQuestionnaireTitle extends TectonElement {
  static styles = [hostStyles, questionnaireTitleStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.#sync()
  }

  #sync(): void {
    let next = this.nextElementSibling
    let described = false
    while (next) {
      if (next.localName === "tec-questionnaire-description") described = true
      next = next.nextElementSibling
    }
    this.toggleState("alone", !described)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#sync()
  }

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

/**
 * @summary Supporting text of a questionnaire item. It describes the item.
 * @tag tec-questionnaire-description
 * @slot - The description text.
 */
export class TecQuestionnaireDescription extends TectonElement {
  static styles = [hostStyles, questionnaireDescriptionStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The answers of a questionnaire item.
 * @tag tec-questionnaire-choices
 * @slot - `tec-questionnaire-choice` elements and optionally a `tec-questionnaire-input`.
 */
export class TecQuestionnaireChoices extends TectonElement {
  static styles = [hostStyles, questionnaireChoicesStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Shown (as an alert) only while the item is invalid, and then describes the item. Its text defaults
 * to "Choose an answer to continue." for a required item and "Choose an answer or skip this question."
 * for an optional one; put your own message inside (e.g. from a schema check).
 *
 * @summary The validation message of a questionnaire item.
 * @tag tec-questionnaire-error
 * @slot - A custom message (the default message shows when empty).
 * @cssstate invalid - The item is invalid (the message is shown).
 */
export class TecQuestionnaireError extends TectonElement {
  static styles = [hostStyles, questionnaireErrorStyles]

  /** Default message of a required item. */
  @property({ attribute: "required-message" }) requiredMessage = "Choose an answer to continue."

  /** Default message of an optional item. */
  @property({ attribute: "optional-message" }) optionalMessage = "Choose an answer or skip this question."

  /** @internal */ @property({ attribute: false }) invalid = false
  /** @internal */ @property({ attribute: false }) required = false

  #slots = new HasSlotController(this, "[default]")

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("invalid", this.invalid)
    this.internals.role = this.invalid ? "alert" : null
  }

  protected override render() {
    const fallback = this.required ? this.requiredMessage : this.optionalMessage
    return this.#slots.test("[default]") ? html`<slot></slot>` : html`<slot></slot>${fallback}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-questionnaire-item": TecQuestionnaireItem
    "tec-questionnaire-title": TecQuestionnaireTitle
    "tec-questionnaire-description": TecQuestionnaireDescription
    "tec-questionnaire-choices": TecQuestionnaireChoices
    "tec-questionnaire-error": TecQuestionnaireError
  }
}
