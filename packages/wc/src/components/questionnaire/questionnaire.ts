import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { horizontalStep } from "../../internal/direction.js"
import { containsFlat, deepActiveElement } from "../../internal/focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { QuestionnaireShortcutMode, TecQuestionnaireItem } from "./questionnaire-item.js"
import type { QuestionnaireNavState } from "./questionnaire-nav.js"
import { questionnaireStyles } from "./questionnaire.styles.js"

export type { QuestionnaireItemStatus, QuestionnaireShortcutMode } from "./questionnaire-item.js"
export type { QuestionnaireInputType } from "./questionnaire-choice.js"
export type { QuestionnaireNavState } from "./questionnaire-nav.js"

const NAV_TAGS = "tec-questionnaire-previous, tec-questionnaire-skip, tec-questionnaire-next, tec-questionnaire-submit"

/** Controls where typing goes: the arrow and shortcut keys never act while one of these has focus. */
function isTextEditing(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !["button", "checkbox", "radio", "reset", "submit"].includes(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}

const isRadio = (el: Element | null) => el instanceof HTMLInputElement && el.type === "radio"

/**
 * Shows one `tec-questionnaire-item` at a time and owns the flow: the active item, answer state and
 * status (unanswered / answered / skipped), validation, progress, navigation and submission. The
 * page around it (a card, a dialog) owns cancellation, persistence and transport.
 *
 * **Submitting** — the Submit button (or Enter / Ctrl+Enter on the last question, or Skip on the last
 * question) validates every enabled item; the first invalid one becomes active with its error shown.
 * When all are valid the questionnaire fires `tec-submit` with the answers as `FormData`. Inside a
 * `<form>` it then submits that form too (the items are form-associated), and a submit attempt
 * from elsewhere in the form is validated the same way.
 *
 * **Keyboard** (focus inside the questionnaire, never while typing in a text field): Arrow Up/Down
 * move between the answers (selecting radio answers), Arrow Left goes back, Arrow Right goes forward
 * once the question is answered or skipped, Enter on a selected answer (or Ctrl/⌘+Enter anywhere)
 * continues, and with `shortcuts` the letter or number keys pick answers.
 *
 * @summary A multi-step questionnaire with single-choice, multiple-choice, freeform and skippable questions.
 *
 * @tag tec-questionnaire
 *
 * @slot - `tec-questionnaire-progress`, one `tec-questionnaire-item` per question, and `tec-questionnaire-actions`.
 *
 * @fires tec-item-change - The user moved to another question (navigation, validation failure, reset). Cancelable: `preventDefault()` stays on the current one. `detail: { item }` (the item name).
 * @fires tec-submit - Every question is valid and the user submitted. Cancelable (inside a `<form>`, `preventDefault()` stops the form submission). `detail: { formData }`.
 * @fires tec-reset - The answers were reset (`reset()` or a reset of the surrounding form).
 */
export class TecQuestionnaire extends TectonElement {
  static styles = [hostStyles, questionnaireStyles]

  /** The initially active item (its `name`); defaults to the first enabled item. `reset()` returns to it. */
  @property({ attribute: "item" }) defaultItem = ""

  /** Assigns a key to each choice of the active question: `letters` (A, B, C…) or `numbers` (1–9). */
  @property({ reflect: true }) shortcuts: QuestionnaireShortcutMode | "" = ""

  #item: string | undefined
  #pendingFocus: "item" | "invalid" | null = null
  #lastActive: TecQuestionnaireItem | null = null
  #form: HTMLFormElement | null = null
  #submitting = false
  #observer = new MutationObserver(() => this.requestUpdate())

  /** The active item's name. Setting it moves to that question (the element does not fire `tec-item-change` then). */
  @property({ attribute: false })
  get item(): string {
    return this.#item ?? this.defaultItem
  }
  set item(value: string) {
    const old = this.item
    this.#item = value
    this.requestUpdate("item", old)
  }

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("change", () => this.requestUpdate())
    this.addEventListener("input", () => this.requestUpdate())
    this.addEventListener("tec-status-change", () => this.requestUpdate())
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["name", "disabled", "required", "multiple", "invalid"],
    })
    this.#form = this.closest("form")
    this.#form?.addEventListener("submit", this.#onFormSubmit, true)
    this.#form?.addEventListener("reset", this.#onFormReset)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
    this.#form?.removeEventListener("submit", this.#onFormSubmit, true)
    this.#form?.removeEventListener("reset", this.#onFormReset)
    this.#form = null
  }

  // ------------------------------------------------------------------ collection

  /** The enabled items in document order. */
  get items(): TecQuestionnaireItem[] {
    return [...this.querySelectorAll<TecQuestionnaireItem>("tec-questionnaire-item")].filter(
      (i) => i.closest("tec-questionnaire") === this && !i.disabled
    )
  }

  /** The active item element. */
  get activeItem(): TecQuestionnaireItem | null {
    const items = this.items
    return items.find((i) => i.name === this.item) ?? items[0] ?? null
  }

  /** Progress and navigation state. */
  get navState(): QuestionnaireNavState {
    const items = this.items
    const active = this.activeItem
    const index = active ? items.indexOf(active) : -1
    return {
      current: index + 1,
      total: items.length,
      first: items.length > 0 && index === 0,
      last: items.length > 0 && index === items.length - 1,
      status: active?.status ?? null,
      required: active ? active.required : null,
    }
  }

  /** The answers of every enabled, non-skipped item. */
  get formData(): FormData {
    const data = new FormData()
    for (const item of this.items) for (const [name, value] of item.entries) data.append(name, value)
    return data
  }

  // ------------------------------------------------------------------ navigation

  /** Moves to `name` as a user navigation (fires the cancelable `tec-item-change`). */
  #navigate(name: string, focus: "item" | "invalid" = "item"): boolean {
    if (name === this.activeItem?.name) {
      if (focus === "invalid") this.activeItem?.focusInvalid()
      return true
    }
    if (!this.emit<{ item: string }>("tec-item-change", { detail: { item: name }, cancelable: true })) return false
    this.#pendingFocus = focus
    this.item = name
    return true
  }

  /** Goes to the previous question. */
  goPrevious(): void {
    const items = this.items
    const index = this.activeItem ? items.indexOf(this.activeItem) : -1
    if (index > 0) this.#navigate(items[index - 1].name)
  }

  /** Validates the active question and goes to the next one (its error shows when invalid). */
  goNext(): void {
    const items = this.items
    const active = this.activeItem
    if (!active) return
    const index = items.indexOf(active)
    if (index >= items.length - 1) return
    if (!active.validate()) {
      active.focusInvalid()
      return
    }
    this.#navigate(items[index + 1].name)
  }

  /** Enter / Ctrl+Enter: next, or submit on the last question. */
  #advance(): void {
    const items = this.items
    const active = this.activeItem
    if (!active) return
    if (!active.validate()) {
      active.focusInvalid()
      return
    }
    const index = items.indexOf(active)
    if (index === items.length - 1) this.requestSubmit()
    else this.#navigate(items[index + 1].name)
  }

  /** Skips the active question when it is optional, then moves on (or submits on the last one). */
  skipCurrent(): void {
    const items = this.items
    const active = this.activeItem
    if (!active || active.required) return
    active.skip()
    const index = items.indexOf(active)
    if (index < items.length - 1) this.#navigate(items[index + 1].name)
    else queueMicrotask(() => this.requestSubmit())
  }

  /**
   * Validates every enabled item (moving to the first invalid one) and, when all are valid, fires
   * `tec-submit` — then submits the surrounding `<form>`, if any. Returns whether it submitted.
   */
  requestSubmit(): boolean {
    const invalid = this.#firstInvalid()
    if (invalid) return false
    const proceed = this.emit<{ formData: FormData }>("tec-submit", { detail: { formData: this.formData }, cancelable: true })
    if (proceed && this.#form) {
      this.#submitting = true
      try {
        this.#form.requestSubmit()
      } finally {
        this.#submitting = false
      }
    }
    return proceed
  }

  /** Validates in order; shows and returns the first invalid item. */
  #firstInvalid(): TecQuestionnaireItem | null {
    const invalid = this.items.find((i) => !i.validate()) ?? null
    if (invalid) this.#navigate(invalid.name, "invalid")
    return invalid
  }

  /** Resets every answer to its initial state and returns to the initial item. */
  reset(): void {
    for (const item of this.querySelectorAll<TecQuestionnaireItem>("tec-questionnaire-item")) {
      if (item.closest("tec-questionnaire") === this) item.reset?.()
    }
    this.#resetNavigation()
  }

  #resetNavigation(): void {
    const items = this.items
    const target = items.find((i) => i.name === this.defaultItem) ?? items[0]
    if (target) this.#navigate(target.name)
    this.requestUpdate()
    this.emit("tec-reset")
  }

  #onFormSubmit = (event: SubmitEvent) => {
    if (this.#submitting) return
    if (this.#firstInvalid()) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  #onFormReset = () => {
    // The items reset themselves (form-associated); move back to the initial question.
    queueMicrotask(() => this.#resetNavigation())
  }

  // ------------------------------------------------------------------ keyboard

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    const active = this.activeItem
    const target = event.composedPath()[0]
    if (!active || !(target instanceof Element)) return
    const inActive = active.contains(target) || active === target || !!active.answerFor(target)

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault()
      if (!event.repeat) this.#advance()
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const textEditing = isTextEditing(target)

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (inActive && active.moveAnswerFocus(active.answerFor(target) ?? target, event.key === "ArrowDown" ? "next" : "previous", textEditing)) {
        event.preventDefault()
      }
      return
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (textEditing) return
      if (isRadio(target)) {
        // Radio buttons move within their question, like a native radio group.
        const step = horizontalStep(event.key, target)
        if (active.moveAnswerFocus(active.answerFor(target) ?? target, step > 0 ? "next" : "previous", false)) event.preventDefault()
        return
      }
      event.preventDefault()
      if (event.repeat) return
      if (event.key === "ArrowLeft") this.goPrevious()
      else if (active.status !== "unanswered") this.goNext()
      return
    }
    if (event.key === "Enter") {
      const answer = active.answerFor(target)
      if (!answer) return
      event.preventDefault()
      if (!event.repeat && active.isSelected(answer)) this.#advance()
      return
    }
    if (!this.shortcuts || textEditing || !inActive) return
    const answer = active.answerByShortcut(event.key)
    if (!answer) return
    event.preventDefault()
    if (event.repeat) return
    answer.focus()
    const input = (answer as { input?: HTMLInputElement }).input
    if (answer.localName === "tec-questionnaire-choice" && input) input.click()
  }

  // ------------------------------------------------------------------ sync

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const items = this.items
    const active = this.activeItem
    if (active && this.#item !== undefined && this.#item !== active.name) this.#item = active.name
    const all = [...this.querySelectorAll<TecQuestionnaireItem>("tec-questionnaire-item")].filter((i) => i.closest("tec-questionnaire") === this)
    for (const item of all) {
      item.active = item === active
      item.shortcuts = this.shortcuts
    }
    const state = this.navState
    for (const part of this.querySelectorAll<HTMLElement & { state: QuestionnaireNavState }>(`tec-questionnaire-progress, ${NAV_TAGS}`)) {
      if (part.closest("tec-questionnaire") !== this) continue
      const prev = part.state
      if (!prev || prev.current !== state.current || prev.total !== state.total || prev.status !== state.status || prev.required !== state.required) {
        part.state = state
      }
    }

    // Focus management: a user navigation focuses the new question; a programmatic change of `item`
    // does so only when focus is already inside the questionnaire.
    const moved = active !== this.#lastActive
    const hadPrevious = this.#lastActive !== null
    this.#lastActive = active
    if (!active || !items.length) return
    const pending = this.#pendingFocus
    this.#pendingFocus = null
    if (pending || (moved && hadPrevious && this.#focusInside())) {
      void active.updateComplete.then(() => (pending === "invalid" ? active.focusInvalid() : active.focusItem()))
    }
  }

  #focusInside(): boolean {
    return containsFlat(this, deepActiveElement())
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-questionnaire": TecQuestionnaire
  }
}
