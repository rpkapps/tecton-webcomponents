import { ContextConsumer, ContextProvider, createContext } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  messageAvatarStyles,
  messageContentStyles,
  messageFooterStyles,
  messageGroupStyles,
  messageMetaStyles,
  messageStyles,
} from "./message.styles.js"

/** The side of the conversation a message belongs to. */
export type MessageAlign = "start" | "end"

/** What `tec-message` shares with its parts. A new object on every change. */
export interface MessageContextValue {
  align: MessageAlign
  /** The message contains a `tec-message-footer` (the avatar lifts itself above it). */
  hasFooter: boolean
  /** The message contains a ghost bubble (header and footer drop their inline padding). */
  hasGhost: boolean
}

export const messageContext = createContext<MessageContextValue | undefined>(Symbol("tec-message"))

/**
 * @summary Stacks consecutive messages from the same sender.
 * @tag tec-message-group
 * @slot - `tec-message` elements.
 */
export class TecMessageGroup extends TectonElement {
  static styles = [hostStyles, messageGroupStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * `tec-message` is a layout wrapper with no role of its own: the conversation semantics come from
 * the transcript around it (`tec-message-scroller-content` is a `role="log"`) and from the content
 * placed inside it. Give each turn a visible sender (`tec-message-header`) or an avatar with `alt`
 * text, and label icon-only actions in the footer.
 *
 * @summary Lays out one message in a conversation: the avatar, the header, the message surface and
 * the footer, on the start or end side.
 *
 * @tag tec-message
 *
 * @slot - A `tec-message-avatar` and a `tec-message-content`.
 *
 * @cssstate end - The message is aligned to the end (`align="end"`); the row is reversed.
 */
export class TecMessage extends TectonElement {
  static styles = [hostStyles, messageStyles]

  /**
   * The side of the conversation: `start` (other participants, the assistant) or `end` (the current
   * user). The row reverses and the content, footer and bubbles align to the end. (Not reflected: an
   * `align` attribute is a legacy presentational hint for text-align, which the element neutralises.)
   */
  @property() align: MessageAlign = "start"

  #hasFooter = false
  #hasGhost = false
  #provider = new ContextProvider(this, { context: messageContext, initialValue: undefined })
  #observer = new MutationObserver(() => this.#scan())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["variant"] })
    this.#scan()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** Re-reads which parts the message contains (footer, ghost bubble). */
  #scan(): void {
    const own = (el: Element) => el.closest("tec-message") === this
    const hasFooter = [...this.querySelectorAll("tec-message-footer")].some(own)
    const hasGhost = [...this.querySelectorAll('tec-bubble[variant="ghost"]')].some(own)
    if (hasFooter !== this.#hasFooter || hasGhost !== this.#hasGhost) {
      this.#hasFooter = hasFooter
      this.#hasGhost = hasGhost
      this.requestUpdate()
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const align: MessageAlign = this.align === "end" ? "end" : "start"
    this.#provider.setValue({ align, hasFooter: this.#hasFooter, hasGhost: this.#hasGhost }, true)
    this.toggleState("end", align === "end")
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/** Base of the parts that read the surrounding message. */
class MessagePart extends TectonElement {
  protected message = new ContextConsumer(this, { context: messageContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const ctx = this.message.value
    this.toggleState("end", ctx?.align === "end")
    this.toggleState("footer", !!ctx?.hasFooter)
    this.toggleState("ghost", !!ctx?.hasGhost)
  }
}

/**
 * Anchored to the bottom of the message; when the message has a `tec-message-footer` it lifts
 * itself to stay level with the message surface. An empty avatar keeps earlier messages of a group
 * aligned with the last one.
 *
 * @summary The avatar slot of a message.
 * @tag tec-message-avatar
 * @slot - A `tec-avatar` (or nothing, to reserve the space).
 * @csspart base - The round frame.
 * @cssstate footer - The message has a footer (the avatar is lifted by 2rem).
 */
export class TecMessageAvatar extends MessagePart {
  static styles = [hostStyles, messageAvatarStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Wraps the header, the message surface (`tec-bubble`, `tec-attachment` …) and the footer.
 * @tag tec-message-content
 * @slot - `tec-message-header`, one or more `tec-bubble` / `tec-bubble-group` / `tec-attachment`, `tec-message-footer`.
 * @cssstate end - The message is end-aligned: every child aligns to the end.
 */
export class TecMessageContent extends MessagePart {
  static styles = [hostStyles, messageContentStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary Content above the message surface, such as the sender's name.
 * @tag tec-message-header
 * @slot - The header text.
 * @csspart base - The padded row.
 * @cssstate ghost - The message has a ghost bubble: no inline padding, so the text lines up with it.
 */
export class TecMessageHeader extends MessagePart {
  static styles = [hostStyles, messageMetaStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Content below the message surface: a delivery status or message actions. Follows the message side.
 * @tag tec-message-footer
 * @slot - Status text and/or actions (`tec-button variant="ghost"` with an `aria-label`).
 * @csspart base - The padded row.
 * @cssstate end - The message is end-aligned: the footer content aligns to the end.
 * @cssstate ghost - The message has a ghost bubble: no inline padding.
 */
export class TecMessageFooter extends MessagePart {
  static styles = [hostStyles, messageMetaStyles, messageFooterStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-message-group": TecMessageGroup
    "tec-message": TecMessage
    "tec-message-avatar": TecMessageAvatar
    "tec-message-content": TecMessageContent
    "tec-message-header": TecMessageHeader
    "tec-message-footer": TecMessageFooter
  }
}
