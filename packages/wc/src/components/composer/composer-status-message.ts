import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { keyed } from "lit/directives/keyed.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext, type ComposerStatus } from "./composer-context.js"
import { composerStatusStyles } from "./composer.styles.js"

const isBusy = (status: ComposerStatus | undefined) => status === "submitted" || status === "streaming"

/**
 * A polite status region for the composer's own changes: sent, stopped, failed. The reply itself is
 * the transcript's to announce, once it is complete (`aria-busy` on the transcript while it streams).
 * Each change renders a new node, so the same message twice is announced twice. Visually hidden.
 *
 * @summary Announces that a message was sent, a reply stopped or failed.
 *
 * @tag tec-composer-status-message
 */
export class TecComposerStatusMessage extends TectonElement {
  static styles = [hostStyles, composerStatusStyles]

  /** Announced when a message is sent (the chat turns busy). */
  @property({ attribute: "submitted-message" }) submittedMessage = "Message sent."

  /** Announced when the user stops a reply. */
  @property({ attribute: "stopped-message" }) stoppedMessage = "Stopped."

  /** Announced when the chat's status turns to `error`. */
  @property({ attribute: "error-message" }) errorMessage = "The reply failed."

  @state() private announcement = { text: "", key: 0 }

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #previous?: { status: ComposerStatus; stopCount: number }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const context = this.#composer.value
    if (!context) return
    const before = this.#previous
    this.#previous = { status: context.status, stopCount: context.stopCount }
    if (!before) return
    let next: string | undefined
    if (context.stopCount !== before.stopCount) next = this.stoppedMessage
    // From ready or error to busy, whichever busy state a chat goes to first.
    else if (isBusy(context.status) && !isBusy(before.status)) next = this.submittedMessage
    else if (context.status !== before.status && context.status === "error") next = this.errorMessage
    if (next !== undefined) this.announcement = { text: next, key: this.announcement.key + 1 }
  }

  protected override render() {
    return html`<div role="status" class="region">${keyed(this.announcement.key, html`<span>${this.announcement.text}</span>`)}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-status-message": TecComposerStatusMessage
  }
}
