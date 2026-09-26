import { ContextConsumer } from "@lit/context"
import { ArrowUp, LoaderCircle, Square } from "lucide"
import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerSubmitStyles } from "./composer.styles.js"

/**
 * Send, or Stop while a reply is arriving: two buttons with names of their own that swap, rather than
 * one whose name changes under the user. Focus follows the swap (to Stop, and back to the textarea).
 * Send is `aria-disabled` rather than disabled while the box is empty, so it keeps its place in the tab
 * order and its name. While the chat is `submitted` the Stop button shows a spinner.
 *
 * @summary The composer's send button, which turns into a stop button while a reply arrives.
 *
 * @tag tec-composer-submit
 *
 * @csspart base - The native `<button>` (Send or Stop).
 * @csspart send - The Send button.
 * @csspart stop - The Stop button.
 *
 * @cssprop --tec-composer-submit-radius - Corner radius of the buttons (default fully round).
 *
 * @cssstate stop - The Stop button is shown.
 * @cssstate focus-visible - A button has keyboard focus.
 */
export class TecComposerSubmit extends TectonElement {
  static styles = [hostStyles, composerSubmitStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The Send button's accessible name. */
  @property({ attribute: "send-label" }) sendLabel = "Send message"

  /** The Stop button's accessible name. */
  @property({ attribute: "stop-label" }) stopLabel = "Stop generating"

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #focusedBefore: "send" | "stop" | null = null

  constructor() {
    super()
    new FocusVisibleController(this)
  }

  /** Clicks the button shown. */
  override click(): void {
    this.shadowRoot?.querySelector("button")?.click()
  }

  get #showStop(): boolean {
    return this.#composer.value?.canStop ?? false
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    // A button removed while focused leaves focus on the body: remember it, and hand focus to the
    // button (or the textarea) that follows.
    const active = this.shadowRoot?.activeElement as HTMLElement | null | undefined
    this.#focusedBefore = active ? ((active.dataset.action as "send" | "stop" | undefined) ?? null) : null
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const stop = this.#showStop
    this.toggleState("stop", stop)
    const gone = stop ? "send" : "stop"
    if (this.#focusedBefore !== gone) return
    this.#focusedBefore = null
    if (stop) this.shadowRoot?.querySelector<HTMLButtonElement>("[data-action=stop]")?.focus()
    else this.#composer.value?.composer.focus()
  }

  #send = (event: MouseEvent) => {
    const context = this.#composer.value
    if (!context || !context.canSubmit) {
      event.preventDefault()
      return
    }
    context.composer.submit()
  }

  #stop = () => {
    this.#composer.value?.composer.stop()
  }

  protected override render() {
    const context = this.#composer.value
    if (this.#showStop) {
      // A different template from Send's, so Lit renders a new button rather than renaming this one.
      return html`<button
        class="base stop"
        part="base stop"
        type="button"
        data-action="stop"
        aria-label=${this.stopLabel}
        @click=${this.#stop}
      >
        ${context?.status === "submitted" ? icon(LoaderCircle, { size: 16, class: "spinner" }) : icon(Square, { size: 16, class: "square" })}
      </button>`
    }
    const unavailable = !(context?.canSubmit ?? false)
    return html`<button
      class="base send"
      part="base send"
      type="button"
      data-action="send"
      aria-label=${this.sendLabel}
      aria-disabled=${unavailable ? "true" : nothing}
      ?disabled=${context?.disabled ?? false}
      @click=${this.#send}
    >
      ${icon(ArrowUp, { size: 16 })}
    </button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-submit": TecComposerSubmit
  }
}
