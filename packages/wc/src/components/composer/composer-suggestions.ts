import { ContextConsumer } from "@lit/context"
import { html, LitElement, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { focusTargetOf } from "../../internal/focus.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerSuggestionStyles, composerSuggestionsStyles } from "./composer.styles.js"

/** `detail` of a suggestion's `tec-select`. */
export interface ComposerSuggestionSelectDetail {
  value: string
}

/**
 * Prompts to start from, as one toolbar: a single tab stop, the arrow keys move between them
 * (mirrored in RTL), Home and End jump.
 *
 * @summary A row of suggested prompts.
 *
 * @tag tec-composer-suggestions
 *
 * @slot - `tec-composer-suggestion` elements.
 *
 * @csspart base - The wrapping row.
 */
export class TecComposerSuggestions extends TectonElement {
  static styles = [hostStyles, composerSuggestionsStyles]

  /** The toolbar's accessible name (an `aria-label` on the element wins). */
  @property() label = "Suggestions"

  #roving = new RovingFocusController<TecComposerSuggestion>(this, {
    items: () => [...this.querySelectorAll<TecComposerSuggestion>(":scope > tec-composer-suggestion")],
    orientation: "horizontal",
    loop: false,
    isDisabled: (item) => item.isDisabled,
    focusTarget: focusTargetOf,
  })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "toolbar"
    this.internals.ariaLabel = this.label
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.#roving.update()}></slot></div>`
  }
}

/**
 * A press fills the box with `value` for the user to edit and send, or sends it straight away with
 * `submit`. Cancel its `tec-select` to handle the press yourself (a suggestion that carries more than
 * its text).
 *
 * @summary One suggested prompt.
 *
 * @tag tec-composer-suggestion
 *
 * @slot - The label. Default: `value`.
 *
 * @csspart base - The `tec-button` (outline, extra small, fully round).
 *
 * @fires tec-select - The suggestion was pressed. `detail: { value }`. Cancelable: `preventDefault()` stops the composer from filling the box or sending.
 */
export class TecComposerSuggestion extends TectonElement {
  static styles = [hostStyles, composerSuggestionStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The prompt. */
  @property() value = ""

  /** Send the prompt at once instead of filling the box. */
  @property({ type: Boolean, reflect: true }) submit = false

  /** Disables the suggestion (it is also disabled while the composer is, and a `submit` one while a reply arrives). */
  @property({ type: Boolean, reflect: true }) disabled = false

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })

  /** Whether the suggestion cannot be pressed now. */
  get isDisabled(): boolean {
    const context = this.#composer.value
    return this.disabled || !!context?.disabled || (this.submit && !!context?.busy)
  }

  /** Presses the suggestion. */
  override click(): void {
    this.shadowRoot?.querySelector("tec-button")?.click()
  }

  #onClick = () => {
    if (this.isDisabled) return
    const context = this.#composer.value
    if (!this.emit<ComposerSuggestionSelectDetail>("tec-select", { detail: { value: this.value }, cancelable: true })) return
    if (!context) return
    if (this.submit) {
      context.composer.send(this.value)
      return
    }
    context.composer.setValue(this.value)
    context.composer.focus()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("disabled", this.isDisabled)
  }

  protected override render() {
    return html`<tec-button class="base" part="base" variant="outline" size="xs" ?disabled=${this.isDisabled} @click=${this.#onClick}
      ><span class="label"><slot>${this.value}</slot></span></tec-button
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-suggestions": TecComposerSuggestions
    "tec-composer-suggestion": TecComposerSuggestion
  }
}
