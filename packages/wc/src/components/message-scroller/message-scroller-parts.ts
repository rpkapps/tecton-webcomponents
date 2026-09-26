import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { ArrowDown } from "lucide"
import { icon } from "../../internal/icons.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { ScrollFadeController } from "../../internal/scroll-fade.js"
import { TecButton, type ButtonSize, type ButtonVariant } from "../button/button.js"
import {
  messageScrollerButtonStyles,
  messageScrollerContentStyles,
  messageScrollerItemStyles,
  messageScrollerViewportStyles,
} from "./message-scroller.styles.js"
import type { TecMessageScroller } from "./message-scroller.js"

export type MessageScrollerDirection = "start" | "end"

/**
 * A labelled, keyboard-focusable scroll region (`role="region"`, named "Messages" unless it has an
 * `aria-label`): keyboard users can focus the transcript and scroll it with the arrow, Page and
 * Home/End keys. The bottom edge fades while there is more to scroll.
 *
 * @summary The scrollable element of a message scroller.
 * @tag tec-message-scroller-viewport
 * @slot - A `tec-message-scroller-content`.
 */
export class TecMessageScrollerViewport extends TectonElement {
  static styles = [hostStyles, messageScrollerViewportStyles]

  /**
   * Let rows prepended above the view push it down. By default the visible row keeps its place when
   * older messages load above it.
   */
  @property({ type: Boolean, attribute: "prepend-shift", reflect: true }) prependShift = false

  #fade = new ScrollFadeController(this, { axis: "y", edges: "end", content: () => this.querySelector("tec-message-scroller-content") })

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "region"
    this.internals.ariaLabel = "Messages"
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.requestUpdate()}></slot>`
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#fade.schedule()
  }
}

/**
 * A live region (`role="log"`, `aria-relevant="additions"`): rows added to the transcript are
 * announced politely, while text streamed into an existing row is not announced token by token.
 * Set `aria-busy="true"` on it while a reply streams if announcements should wait for the completed
 * row. Pad it with a class (`class="p-4"`).
 *
 * @summary The transcript inside the viewport. Holds one `tec-message-scroller-item` per row.
 * @tag tec-message-scroller-content
 * @slot - `tec-message-scroller-item` elements.
 * @csspart spacer - Room added below the rows so a newly anchored turn can scroll to the top.
 */
export class TecMessageScrollerContent extends TectonElement {
  static styles = [hostStyles, messageScrollerContentStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "log"
    this.internals.ariaRelevant = "additions"
  }

  /** The spacer below the rows (managed by the scroller). @internal */
  get spacer(): HTMLElement | null {
    return this.renderRoot?.querySelector?.(".spacer") ?? null
  }

  protected override render() {
    return html`<slot></slot><div class="spacer" part="spacer" aria-hidden="true" hidden></div>`
  }
}

/**
 * Wrap every row of the transcript (a message, a marker, a typing indicator, a "load earlier" row)
 * so the scroller can measure, anchor, preserve and jump to it. Rows far outside the viewport skip
 * rendering work (`content-visibility: auto`) but stay in the DOM for find-in-page, selection and
 * assistive technology.
 *
 * @summary One row of a message scroller transcript.
 * @tag tec-message-scroller-item
 * @slot - The row content.
 * @csspart base - The padded row.
 */
export class TecMessageScrollerItem extends TectonElement {
  static styles = [hostStyles, messageScrollerItemStyles]

  /** A stable id: needed for `scrollToMessage()`, visibility tracking and keeping the place on prepend. */
  @property({ attribute: "message-id", reflect: true }) messageId = ""

  /** The row starts a turn: when appended, the view moves it near the top (keeping a peek of the previous row). */
  @property({ type: Boolean, attribute: "scroll-anchor", reflect: true }) scrollAnchor = false

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * A `tec-button` (`variant="secondary"`, `size="icon-sm"`, round, centred over the viewport edge)
 * that is inert, out of the tab order and faded out until there is content in its direction.
 * Pressing it scrolls smoothly to that edge (and re-engages following the live edge with
 * `auto-scroll`). Its default content is an arrow and the visually hidden `label`.
 *
 * @summary Scrolls the transcript to its start or end ("jump to latest").
 * @tag tec-message-scroller-button
 * @slot - Custom content (an icon and a hidden label). Defaults to an arrow and `label`.
 * @cssstate inactive - Nothing to scroll to in `direction` (the button is hidden and inert).
 * @hideInherited href, target, rel, download - it always renders a `<button>`.
 */
export class TecMessageScrollerButton extends TecButton {
  static styles = [...TecButton.styles, srOnly, messageScrollerButtonStyles]

  /** The edge the button scrolls to. */
  @property({ reflect: true }) direction: MessageScrollerDirection = "end"

  /** Visually hidden label of the default content. Defaults to "Scroll to end" / "Scroll to start". */
  @property() label = ""

  /** Scroll behaviour of the jump. */
  @property() behavior: ScrollBehavior = "smooth"

  /** Whether there is content to scroll to (set by the scroller). @internal */
  @property({ type: Boolean, attribute: false }) active = false

  constructor() {
    super()
    this.variant = "secondary" satisfies ButtonVariant
    this.size = "icon-sm" satisfies ButtonSize
    this.addEventListener("click", this.#onActivate)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    // Pick up the scroller's current state (buttons added after the scroller).
    queueMicrotask(() => this.#scroller?.requestButtonSync())
  }

  get #scroller(): TecMessageScroller | null {
    return this.closest("tec-message-scroller") as TecMessageScroller | null
  }

  #onActivate = (event: MouseEvent) => {
    if (!this.active || event.defaultPrevented) return
    this.control?.blur()
    const scroller = this.#scroller
    if (!scroller?.scrollToEnd) return
    if (this.direction === "start") scroller.scrollToStart({ behavior: this.behavior })
    else scroller.scrollToEnd({ behavior: this.behavior })
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("inactive", !this.active)
    const control = this.control
    if (control) {
      control.inert = !this.active
      control.tabIndex = this.active ? 0 : -1
    }
  }

  protected override render() {
    const label = this.label || (this.direction === "start" ? "Scroll to start" : "Scroll to end")
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled}>
      <slot name="start"></slot><slot
        >${icon(ArrowDown, { size: 16, class: "arrow" })}<span class="sr-only">${label}</span></slot
      ><slot name="end"></slot>
    </button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-message-scroller-viewport": TecMessageScrollerViewport
    "tec-message-scroller-content": TecMessageScrollerContent
    "tec-message-scroller-item": TecMessageScrollerItem
    "tec-message-scroller-button": TecMessageScrollerButton
  }
}
