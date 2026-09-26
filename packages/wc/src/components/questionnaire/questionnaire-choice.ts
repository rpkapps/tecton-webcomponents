import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { Check } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { questionnaireChoiceDescriptionStyles, questionnaireChoiceStyles, questionnaireInputStyles } from "./questionnaire.styles.js"

/** Input types a freeform answer accepts. */
export type QuestionnaireInputType = "date" | "datetime-local" | "email" | "month" | "number" | "password" | "search" | "tel" | "text" | "time" | "url" | "week"

/**
 * A fixed answer of a `tec-questionnaire-item`: a card with a native radio button (or a checkbox in a
 * `multiple` item) covering it, named by its content. Its value is submitted under the item's `name`.
 *
 * @summary One fixed answer of a questionnaire question.
 *
 * @tag tec-questionnaire-choice
 *
 * @slot - The answer label; add a `tec-questionnaire-choice-description` for a second line.
 *
 * @csspart base - The card (`<label>`).
 * @csspart input - The native radio / checkbox covering the card (transparent).
 * @csspart indicator - The radio dot / check box.
 * @csspart label - The content column.
 * @csspart shortcut - The shortcut key chip (with `shortcuts` on the questionnaire).
 *
 * @cssstate checked - The answer is selected.
 * @cssstate radio - Single-answer item.
 * @cssstate checkbox - Multiple-answer item.
 * @cssstate invalid - The question shows an error.
 * @cssstate disabled - The answer (or its item) is disabled.
 * @cssstate has-shortcut - A shortcut key is assigned.
 *
 * @fires change - The user selected or cleared the answer.
 */
export class TecQuestionnaireChoice extends TectonElement {
  static styles = [hostStyles, questionnaireChoiceStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The value submitted under the item's name when the answer is selected. */
  @property({ reflect: true }) value = ""

  /** Initially selected (the `checked` attribute); a reset of the questionnaire returns to it. */
  @property({ type: Boolean, attribute: "checked" }) defaultChecked = false

  /** Disables this answer. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #checked: boolean | undefined

  /** Whether the answer is selected. Until set (or toggled by the user) it follows the `checked` attribute. */
  @property({ type: Boolean, attribute: false })
  get checked(): boolean {
    return this.#checked ?? this.defaultChecked
  }
  set checked(value: boolean) {
    const old = this.checked
    this.#checked = !!value
    this.requestUpdate("checked", old)
  }

  // Set by the item ------------------------------------------------------------------------
  /** @internal */ @property({ attribute: false }) kind: "radio" | "checkbox" = "radio"
  /** @internal */ @property({ attribute: false }) invalid = false
  /** @internal */ @property({ attribute: false }) itemDisabled = false
  /** @internal */ @property({ attribute: false }) shortcut: string | null = null
  /** @internal */ @property({ attribute: false }) tabbable = true
  /** @internal */ @property({ attribute: false }) position: [number, number] | null = null

  @query(".input") readonly input!: HTMLInputElement

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] === this && !this.isDisabled) this.input?.click()
    })
  }

  /** `disabled`, or its item is disabled. */
  get isDisabled(): boolean {
    return this.disabled || this.itemDisabled
  }

  /** Forgets the user's selection (back to the `checked` attribute). @internal */
  resetChecked(): void {
    this.#checked = undefined
    this.requestUpdate("checked")
  }

  #onChange(event: Event) {
    this.checked = this.input.checked
    event.stopPropagation()
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("checked", this.checked)
    this.toggleState("radio", this.kind === "radio")
    this.toggleState("checkbox", this.kind === "checkbox")
    this.toggleState("invalid", this.invalid)
    this.toggleState("disabled", this.isDisabled)
    this.toggleState("has-shortcut", !!this.shortcut)
    this.toggleState("has-description", !!this.querySelector("tec-questionnaire-choice-description"))
    const input = this.input
    if (!input) return
    input.tabIndex = this.tabbable ? 0 : -1
    const keys = [this.shortcut, this.checked && !this.isDisabled ? "Enter" : null].filter(Boolean).join(" ")
    if (keys) input.setAttribute("aria-keyshortcuts", keys)
    else input.removeAttribute("aria-keyshortcuts")
    if (this.invalid) input.setAttribute("aria-invalid", "true")
    else input.removeAttribute("aria-invalid")
    if (this.position && this.kind === "radio") {
      input.setAttribute("aria-posinset", String(this.position[0]))
      input.setAttribute("aria-setsize", String(this.position[1]))
    } else {
      input.removeAttribute("aria-posinset")
      input.removeAttribute("aria-setsize")
    }
  }

  protected override render() {
    return html`<label class="base" part="base">
      <input
        class="input"
        part="input"
        type=${this.kind}
        .value=${this.value}
        .checked=${live(this.checked)}
        ?disabled=${this.isDisabled}
        @change=${this.#onChange}
      />
      <span class="indicator" part="indicator" aria-hidden="true"
        ><span class="dot"></span>${icon(Check, { size: 14, strokeWidth: 3, class: "check" })}</span
      >
      <span class="label" part="label"><slot @slotchange=${() => this.requestUpdate()}></slot></span>
      <span class="shortcut" part="shortcut" aria-hidden="true">${this.shortcut ?? ""}</span>
    </label>`
  }
}

/**
 * @summary A second, muted line under a questionnaire choice's label.
 * @tag tec-questionnaire-choice-description
 * @slot - The description text.
 */
export class TecQuestionnaireChoiceDescription extends TectonElement {
  static styles = [hostStyles, questionnaireChoiceDescriptionStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A freeform answer next to (or instead of) fixed choices. In a single-answer item, typing selects
 * the text as the answer and clears the selected choice (selecting a choice again drops the text from
 * the submission). Always give it an accessible name (`aria-label`, `aria-labelledby`); a
 * placeholder is not a label.
 *
 * @summary A freeform text answer of a questionnaire question.
 *
 * @tag tec-questionnaire-input
 *
 * @csspart input - The native `<input>`.
 *
 * @cssstate filled - The input has text.
 * @cssstate selected - The text is (part of) the item's answer.
 *
 * @fires input - The user typed.
 * @fires change - The user committed a change.
 */
export class TecQuestionnaireInput extends TectonElement {
  static styles = [hostStyles, questionnaireInputStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The input type. */
  @property({ reflect: true }) type: QuestionnaireInputType = "text"

  /** Placeholder text (not a label). */
  @property() placeholder = ""

  /** The initial text (the `value` attribute); a reset of the questionnaire returns to it. */
  @property({ attribute: "value" }) defaultValue = ""

  /** Disables the input. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #value: string | undefined
  #selected: boolean | undefined

  /** The current text. */
  @property({ attribute: false })
  get value(): string {
    return this.#value ?? this.defaultValue
  }
  set value(value: string) {
    const old = this.value
    this.#value = value == null ? "" : String(value)
    this.requestUpdate("value", old)
  }

  /** Whether the text counts as the answer (set by typing; cleared when a choice is selected in a single-answer item). @internal */
  @property({ attribute: false })
  get selected(): boolean {
    return this.#selected ?? this.filled
  }
  set selected(value: boolean) {
    const old = this.selected
    this.#selected = value
    this.requestUpdate("selected", old)
  }

  /** @internal */ @property({ attribute: false }) invalid = false
  /** @internal */ @property({ attribute: false }) itemDisabled = false

  @query(".input") readonly input!: HTMLInputElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.input, exclude: ["aria-invalid", "aria-keyshortcuts"] })
  }

  /** Whether there is (non-blank) text. */
  get filled(): boolean {
    return this.value.trim().length > 0
  }

  get isDisabled(): boolean {
    return this.disabled || this.itemDisabled
  }

  /** Back to the `value` attribute. @internal */
  resetValue(): void {
    this.#value = undefined
    this.#selected = undefined
    this.requestUpdate()
  }

  #onInput() {
    this.value = this.input.value
    this.#selected = this.filled
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("filled", this.filled)
    this.toggleState("selected", this.selected)
    const input = this.input
    if (!input) return
    if (this.invalid) input.setAttribute("aria-invalid", "true")
    else input.removeAttribute("aria-invalid")
    if (!this.isDisabled && this.filled && this.selected) input.setAttribute("aria-keyshortcuts", "Enter")
    else input.removeAttribute("aria-keyshortcuts")
  }

  protected override render() {
    return html`<input
      class="input"
      part="input"
      type=${this.type}
      placeholder=${this.placeholder || ""}
      .value=${live(this.value)}
      ?disabled=${this.isDisabled}
      @input=${this.#onInput}
      @change=${() => this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))}
    />`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-questionnaire-choice": TecQuestionnaireChoice
    "tec-questionnaire-choice-description": TecQuestionnaireChoiceDescription
    "tec-questionnaire-input": TecQuestionnaireInput
  }
}
