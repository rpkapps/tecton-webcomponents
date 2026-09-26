import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecMessageScrollerButton, TecMessageScrollerContent, TecMessageScrollerViewport } from "./message-scroller-parts.js"
import { messageScrollerStyles } from "./message-scroller.styles.js"

export type { MessageScrollerDirection } from "./message-scroller-parts.js"

/** Where a transcript opens. */
export type MessageScrollerDefaultScrollPosition = "start" | "end" | "last-anchor"
/** Where a row lands in the viewport after `scrollToMessage()`. */
export type MessageScrollerScrollAlign = "start" | "center" | "end" | "nearest"

/** Options of the scroll methods. */
export interface MessageScrollerScrollOptions {
  /** Where the row lands (`scrollToMessage` only). Default `start`. */
  align?: MessageScrollerScrollAlign
  /** Default `auto` (instant). */
  behavior?: ScrollBehavior
  /** Extra distance from the viewport edge in px (`scrollToMessage` only). Defaults to `scroll-margin`. */
  scrollMargin?: number
}

/** Which edges the viewport can still scroll toward. */
export interface MessageScrollerScrollable {
  start: boolean
  end: boolean
}

/** The reader's position (with `track-visibility`). */
export interface MessageScrollerVisibility {
  /** The last anchored turn whose top reached the top of the viewport (stays set after it scrolls above). */
  currentAnchorId: string | null
  /** The `message-id`s of the rows on screen, in document order. */
  visibleMessageIds: string[]
}

type Mode = "following-bottom" | "free-scrolling" | "anchored-to-message" | "settling-jump"

const EPSILON = 0.5
const AUTOSCROLL_SETTLE_MS = 180
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "])
const NO_SCROLL: MessageScrollerScrollable = { start: false, end: false }
const NO_VISIBILITY: MessageScrollerVisibility = { currentAnchorId: null, visibleMessageIds: [] }

const messageIdOf = (el: Element) => el.getAttribute("message-id") || (el as HTMLElement).dataset?.messageId || ""
const isAnchor = (el: Element) => el.hasAttribute("scroll-anchor") && el.getAttribute("scroll-anchor") !== "false"
const px = (value: string | undefined) => {
  const n = Number.parseFloat(value ?? "")
  return Number.isFinite(n) ? n : 0
}

/**
 * The scroller never moves the reader against their intent:
 *
 * - **Opening position** — `default-scroll-position="end"` (default), `"start"`, or `"last-anchor"`
 *   (the last row marked `scroll-anchor`, with the reply below it; falls back to `end` when that turn
 *   already fits). The viewport stays hidden until the position is applied, so there is no jump.
 * - **New turns** — when a `scroll-anchor` row is appended, it is moved near the top of the viewport
 *   with `scroll-previous-item-peek` px of the previous row still visible, and the reply streams in
 *   below it (room is added under the transcript so the turn can reach the top).
 * - **Following** — with `auto-scroll`, the view follows content growing at the live edge while the
 *   reader is there; wheel, touch, keyboard scrolling or a jump releases it. `scrollToEnd()` (or the
 *   button) re-engages it.
 * - **History** — rows prepended above keep the visible row in place.
 *
 * It does not own messages, transport or AI state; your code appends `tec-message-scroller-item`s.
 *
 * @summary A chat transcript scroller: opens saved threads at the last turn, anchors new turns,
 * follows streamed replies, keeps the reader's place when history loads, and jumps to any message.
 *
 * @tag tec-message-scroller
 *
 * @slot - A `tec-message-scroller-viewport` (with a `tec-message-scroller-content`) and optionally `tec-message-scroller-button`s.
 *
 * @fires tec-scrollable-change - The edges the viewport can scroll toward changed. `detail: { start, end }` (while following the live edge, `end` is `false`).
 * @fires tec-visibility-change - With `track-visibility`: the visible rows or the current anchored turn changed. `detail: { currentAnchorId, visibleMessageIds }`.
 *
 * @cssstate scrollable-start - There is content above the view.
 * @cssstate scrollable-end - There is content below the view (and the view is not following the live edge).
 * @cssstate autoscrolling - A programmatic scroll to the latest message is running.
 * @cssstate pending-scroll - The opening position is not applied yet (the viewport is hidden).
 */
export class TecMessageScroller extends TectonElement {
  static styles = [hostStyles, messageScrollerStyles]

  /** Follow content growing at the live edge while the reader is there. Off by default: never move a reader who did not ask for it. */
  @property({ type: Boolean, attribute: "auto-scroll", reflect: true }) autoScroll = false

  /** Where the transcript opens. */
  @property({ attribute: "default-scroll-position" }) defaultScrollPosition: MessageScrollerDefaultScrollPosition = "end"

  /** Distance in px from an edge within which the viewport counts as being at that edge. */
  @property({ type: Number, attribute: "scroll-edge-threshold" }) scrollEdgeThreshold = 8

  /** How much of the previous row (px) stays visible above a newly anchored turn. */
  @property({ type: Number, attribute: "scroll-previous-item-peek" }) scrollPreviousItemPeek = 64

  /** Default distance in px between the viewport top and a row scrolled to. */
  @property({ type: Number, attribute: "scroll-margin" }) scrollMargin = 0

  /** Track which rows are visible and fire `tec-visibility-change` (pay for what you use). */
  @property({ type: Boolean, attribute: "track-visibility" }) trackVisibility = false

  // ------------------------------------------------------------------ state
  #mode: Mode = "free-scrolling"
  #autoscrolling = false
  #autoscrollTimer = 0
  #itemCount = 0
  #firstItem: Element | null = null
  #lastScrollTop = 0
  #streamingTurn: Element | null = null
  #spacerHeight = 0
  #prependRestore: { element: Element; viewportTop: number } | null = null
  #pendingScrollToMessage: { messageId: string; options?: MessageScrollerScrollOptions } | null = null
  #defaultApplied = false
  #pendingDefault = true
  #handledAnchors = new WeakSet<Element>()
  #scrollable: MessageScrollerScrollable = NO_SCROLL
  #visibility: MessageScrollerVisibility = NO_VISIBILITY
  #visibleIds = new Set<string>()
  #stateFrame = 0
  #visibilityFrame = 0
  #pendingFrame = 0
  #resizeFrame = 0
  #intersection: IntersectionObserver | null = null
  #ready = false
  #attachToken = 0

  #viewport: HTMLElement | null = null
  #content: HTMLElement | null = null
  #contentObserver = new MutationObserver(() => this.#handleContentChange())
  #treeObserver = new MutationObserver(() => this.#attach())
  #resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(this.#resizeFrame)
    this.#resizeFrame = requestAnimationFrame(() => this.#handleResize())
  })

  // ------------------------------------------------------------------ public API

  /** Which edges the viewport can still scroll toward ("at the end" is `!scrollable.end`). */
  get scrollable(): MessageScrollerScrollable {
    return this.#scrollable
  }

  /** The reader's position (updated only with `track-visibility`). */
  get visibility(): MessageScrollerVisibility {
    return this.#visibility
  }

  /** The scroll element. */
  get viewport(): HTMLElement | null {
    return this.#viewport
  }

  /**
   * Scrolls to the end of the transcript and, with `auto-scroll`, resumes following the live edge.
   * Returns `false` when there is no viewport.
   */
  scrollToEnd(options: MessageScrollerScrollOptions = {}): boolean {
    const viewport = this.#viewport
    if (!viewport) return false
    this.#setSpacer(0)
    this.#streamingTurn = null
    this.#mode = this.autoScroll ? "following-bottom" : "free-scrolling"
    this.#scrollTo(Math.max(0, viewport.scrollHeight - viewport.clientHeight), { behavior: options.behavior ?? "auto", autoscrolling: true })
    this.#scheduleVisibility()
    return true
  }

  /** Scrolls to the start of the transcript. Returns `false` when there is no viewport. */
  scrollToStart(options: MessageScrollerScrollOptions = {}): boolean {
    if (!this.#viewport) return false
    this.#setSpacer(0)
    this.#streamingTurn = null
    this.#mode = "free-scrolling"
    this.#scrollTo(0, { behavior: options.behavior ?? "auto" })
    this.#scheduleVisibility()
    return true
  }

  /**
   * Scrolls the row with this `message-id` into view (`align: "start"` by default). Before any row
   * exists the jump is queued (a permalink resolved while the transcript loads); afterwards a missing
   * id returns `false`. `true` means the scroll ran or was queued.
   */
  scrollToMessage(messageId: string, options: MessageScrollerScrollOptions = {}): boolean {
    const element = this.#findItem(messageId)
    if (element) {
      this.#markDefaultApplied()
      if (this.#scrollToElement(element, options)) this.#pendingScrollToMessage = null
      else this.#pendingScrollToMessage = { messageId, options }
      return true
    }
    if (this.#itemCount === 0) {
      this.#pendingScrollToMessage = { messageId, options }
      this.#markDefaultApplied()
      return true
    }
    return false
  }

  /** Re-sends the scroll state to the buttons (they call it when they connect). @internal */
  requestButtonSync(): void {
    this.#syncButtons()
  }

  // ------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback()
    this.#mode = this.autoScroll ? "following-bottom" : "free-scrolling"
    this.#treeObserver.observe(this, { childList: true, subtree: true })
    this.#attach()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#treeObserver.disconnect()
    this.#detach()
    for (const frame of [this.#stateFrame, this.#visibilityFrame, this.#pendingFrame, this.#resizeFrame]) cancelAnimationFrame(frame)
    this.#stateFrame = this.#visibilityFrame = this.#pendingFrame = this.#resizeFrame = 0
    clearTimeout(this.#autoscrollTimer)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("defaultScrollPosition") && changed.get("defaultScrollPosition") !== undefined) {
      this.#defaultApplied = false
    }
    if (!this.hasUpdated) {
      this.#pendingDefault = this.defaultScrollPosition === "end" || this.defaultScrollPosition === "last-anchor"
    }
    this.#syncStates()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (!this.#ready) return
    if (changed.has("defaultScrollPosition") && changed.get("defaultScrollPosition") !== undefined) {
      if (!this.#applyDefault() && this.#itemCount === 0) this.#clearPendingDefault()
    }
    if (changed.has("autoScroll") && changed.get("autoScroll") !== undefined) {
      if (this.autoScroll && this.#mode === "following-bottom" && this.#itemCount > 0) this.scrollToEnd()
      else this.#commitScrollState()
    }
    if (changed.has("trackVisibility")) {
      if (this.trackVisibility) this.#observeVisibility()
      else this.#unobserveVisibility()
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }

  // ------------------------------------------------------------------ wiring

  /** Finds the viewport and content (they may be parsed or upgraded after the scroller). */
  #attach(): void {
    const viewport = [...this.querySelectorAll<HTMLElement>("tec-message-scroller-viewport")].find((v) => v.closest("tec-message-scroller") === this) ?? null
    const content = viewport?.querySelector<HTMLElement>("tec-message-scroller-content") ?? null
    if (viewport === this.#viewport && content === this.#content) return
    this.#detach()
    this.#viewport = viewport
    this.#content = content
    if (!viewport || !content) return
    viewport.addEventListener("scroll", this.#onScroll, { passive: true })
    viewport.addEventListener("wheel", this.#onUserScrollIntent, { passive: true })
    viewport.addEventListener("touchmove", this.#onUserScrollIntent, { passive: true })
    viewport.addEventListener("keydown", this.#onKeyDown)
    this.#resizeObserver.observe(viewport)
    this.#resizeObserver.observe(content)
    this.#contentObserver.observe(content, { childList: true })
    const token = ++this.#attachToken
    // Measure only once the rows rendered (custom elements upgraded and updated), so the opening
    // position is computed from the final layout.
    void this.#settle(content).then(() => {
      if (token !== this.#attachToken || !this.isConnected) return
      this.#ready = true
      this.#itemCount = 0
      this.#firstItem = null
      this.#handleContentChange()
      if (this.trackVisibility) this.#observeVisibility()
    })
  }

  #detach(): void {
    const viewport = this.#viewport
    if (viewport) {
      viewport.removeEventListener("scroll", this.#onScroll)
      viewport.removeEventListener("wheel", this.#onUserScrollIntent)
      viewport.removeEventListener("touchmove", this.#onUserScrollIntent)
      viewport.removeEventListener("keydown", this.#onKeyDown)
    }
    this.#resizeObserver.disconnect()
    this.#contentObserver.disconnect()
    this.#unobserveVisibility()
    this.#viewport = null
    this.#content = null
    this.#ready = false
    this.#attachToken++
  }

  async #settle(root: Element): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      const pending: Promise<unknown>[] = []
      const walk = (node: ParentNode) => {
        for (const el of node.querySelectorAll("*")) {
          if (el.localName.includes("-")) {
            if (!customElements.get(el.localName)) continue
            const update = (el as Partial<{ updateComplete: Promise<unknown> }>).updateComplete
            if (update) pending.push(update)
          }
          if (el.shadowRoot) walk(el.shadowRoot)
        }
      }
      walk(root)
      if (!pending.length) break
      await Promise.all(pending)
    }
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }

  #onScroll = () => {
    this.#commitScrollState()
    this.#scheduleVisibility()
    this.#capturePrependRestore()
  }

  #onUserScrollIntent = () => {
    if (this.#mode !== "free-scrolling") {
      this.#streamingTurn = null
      this.#mode = "free-scrolling"
    }
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) this.#onUserScrollIntent()
  }

  // ------------------------------------------------------------------ geometry

  get #items(): HTMLElement[] {
    return this.#content ? ([...this.#content.children].filter((c) => c instanceof HTMLElement) as HTMLElement[]) : []
  }

  #findItem(messageId: string): HTMLElement | null {
    return this.#items.find((el) => messageIdOf(el) === messageId) ?? null
  }

  #contentPadding(): { start: number; end: number } {
    if (!this.#content) return { start: 0, end: 0 }
    const style = getComputedStyle(this.#content)
    return { start: px(style.paddingBlockStart || style.paddingTop), end: px(style.paddingBlockEnd || style.paddingBottom) }
  }

  /** The scroll extent of the rows (without the spacer). */
  #contentExtent(): number {
    const viewport = this.#viewport!
    const padding = this.#contentPadding()
    const top = viewport.getBoundingClientRect().top
    let extent = padding.start + padding.end
    for (const item of this.#items) extent = Math.max(extent, item.getBoundingClientRect().bottom - top + viewport.scrollTop + padding.end)
    return extent
  }

  #offsetTop(element: Element): number {
    const viewport = this.#viewport!
    return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
  }

  #viewportTop(element: Element): number {
    return element.getBoundingClientRect().top - this.#viewport!.getBoundingClientRect().top
  }

  #computeScrollable(): MessageScrollerScrollable {
    const viewport = this.#viewport
    if (!viewport || !this.#content) return NO_SCROLL
    const extent = this.#contentExtent()
    return {
      start: viewport.scrollTop > this.scrollEdgeThreshold,
      end: extent - viewport.scrollTop - viewport.clientHeight > this.scrollEdgeThreshold,
    }
  }

  #targetScrollTop(element: Element, align: MessageScrollerScrollAlign, margin: number): number {
    const viewport = this.#viewport!
    const top = this.#offsetTop(element)
    const height = element.getBoundingClientRect().height
    const padding = this.#contentPadding()
    if (align === "center") {
      const available = Math.max(0, viewport.clientHeight - padding.start - padding.end)
      return top - padding.start - (available - height) / 2 - margin
    }
    if (align === "end") return top - viewport.clientHeight + height + padding.end + margin
    if (align === "nearest") {
      const bottom = top + height
      const visibleTop = viewport.scrollTop + padding.start
      const visibleBottom = viewport.scrollTop + viewport.clientHeight - padding.end
      if (top >= visibleTop && bottom <= visibleBottom) return viewport.scrollTop
      return top < visibleTop ? top - padding.start - margin : bottom - viewport.clientHeight + padding.end + margin
    }
    return top - padding.start - margin
  }

  // ------------------------------------------------------------------ scrolling

  #setSpacer(height: number): void {
    const spacer = (this.#content as TecMessageScrollerContent | null)?.spacer
    const value = Math.max(0, Math.ceil(height))
    if (!spacer) {
      this.#spacerHeight = 0
      return
    }
    if (this.#spacerHeight === value) return
    this.#spacerHeight = value
    const gap = this.#content ? px(getComputedStyle(this.#content).rowGap) : 0
    spacer.hidden = value === 0
    spacer.style.height = `${value}px`
    spacer.style.marginTop = value > 0 ? `${-gap}px` : ""
  }

  #setAutoscrolling(on: boolean): void {
    clearTimeout(this.#autoscrollTimer)
    this.#autoscrollTimer = 0
    if (this.#autoscrolling !== on) {
      this.#autoscrolling = on
      this.#commitScrollState()
    }
    if (on) {
      this.#autoscrollTimer = window.setTimeout(() => {
        this.#autoscrollTimer = 0
        this.#autoscrolling = false
        this.#commitScrollState()
      }, AUTOSCROLL_SETTLE_MS)
    }
  }

  #scrollTo(top: number, { behavior = "auto", autoscrolling = false }: { behavior?: ScrollBehavior; autoscrolling?: boolean } = {}): void {
    const viewport = this.#viewport
    if (!viewport) return
    const target = Math.max(0, top)
    if (Math.abs(viewport.scrollTop - target) <= EPSILON) {
      viewport.scrollTop = target
      this.#commitScrollState()
      return
    }
    if (autoscrolling) this.#setAutoscrolling(true)
    viewport.scrollTo({ top: target, behavior })
    this.#scheduleStateCommit()
  }

  #scrollToElement(element: Element, options: MessageScrollerScrollOptions = {}, keepPreviousPeek = false): boolean {
    const viewport = this.#viewport
    const content = this.#content
    if (!viewport || !content || !content.contains(element)) return false
    const margin = options.scrollMargin ?? this.scrollMargin
    const top = this.#targetScrollTop(element, options.align ?? "start", keepPreviousPeek ? margin + this.scrollPreviousItemPeek : margin)
    this.#setSpacer(top + viewport.clientHeight - this.#contentExtent())
    this.#prependRestore = { element, viewportTop: this.#viewportTop(element) }
    this.#mode = keepPreviousPeek ? "anchored-to-message" : "settling-jump"
    this.#streamingTurn = keepPreviousPeek ? element : null
    this.#scrollTo(top, { behavior: options.behavior ?? "auto" })
    this.#scheduleVisibility()
    return true
  }

  #reanchor(): boolean {
    const turn = this.#streamingTurn
    if (!turn || !turn.isConnected || this.#mode !== "anchored-to-message") return false
    return this.#scrollToElement(turn, { align: "start" }, true)
  }

  #flushPendingScrollToMessage(): boolean {
    const pending = this.#pendingScrollToMessage
    if (!pending) return false
    const element = this.#findItem(pending.messageId)
    if (!element || !this.#scrollToElement(element, pending.options)) return false
    this.#pendingScrollToMessage = null
    this.#markDefaultApplied()
    return true
  }

  #markDefaultApplied(): void {
    this.#defaultApplied = true
    this.#clearPendingDefault()
  }

  #clearPendingDefault(): void {
    if (this.#pendingDefault) {
      this.#pendingDefault = false
      this.#syncStates()
    }
  }

  #applyDefault(): boolean {
    const position = this.defaultScrollPosition
    if (!position || this.#defaultApplied || this.#itemCount === 0 || !this.#viewport) return false
    let done: boolean
    if (position === "last-anchor") {
      const anchor = [...this.#items].reverse().find(isAnchor)
      if (!anchor) done = this.scrollToEnd()
      else done = this.#contentExtent() - this.#offsetTop(anchor) <= this.#viewport.clientHeight ? this.scrollToEnd() : this.#scrollToElement(anchor, { align: "start" }, true)
    } else done = position === "end" ? this.scrollToEnd() : this.scrollToStart()
    if (done) this.#markDefaultApplied()
    return done
  }

  #restorePrepend(): boolean {
    const restore = this.#prependRestore
    const viewport = this.#viewport
    if (!restore || !viewport || !restore.element.isConnected) return false
    const delta = this.#viewportTop(restore.element) - restore.viewportTop
    if (Math.abs(delta) <= EPSILON) return false
    viewport.scrollTop += delta
    restore.viewportTop = this.#viewportTop(restore.element)
    this.#scheduleStateCommit()
    this.#scheduleVisibility()
    return true
  }

  /** Remembers the first visible row with an id, to keep it in place when rows are prepended. */
  #capturePrependRestore(): void {
    const viewport = this.#viewport
    if (!viewport || !this.#content) {
      this.#prependRestore = null
      return
    }
    const rect = viewport.getBoundingClientRect()
    const first = this.#items.find((el) => {
      if (!messageIdOf(el)) return false
      const r = el.getBoundingClientRect()
      return r.bottom > rect.top && r.top < rect.bottom
    })
    this.#prependRestore = first ? { element: first, viewportTop: this.#viewportTop(first) } : null
  }

  // ------------------------------------------------------------------ reactions

  #handleContentChange(): void {
    if (!this.#ready || !this.#content) return
    const items = this.#items
    const previousCount = this.#itemCount
    const previousFirst = this.#firstItem
    this.#itemCount = items.length
    this.#firstItem = items[0] ?? null
    this.#react(items, previousCount, previousFirst)
    this.#capturePrependRestore()
    if (this.#intersection) for (const item of items) if (messageIdOf(item)) this.#intersection.observe(item)
  }

  #react(items: HTMLElement[], previousCount: number, previousFirst: Element | null): void {
    if (this.#flushPendingScrollToMessage()) return
    if (previousCount === 0) {
      // Rows present at load are part of the saved thread, not new turns.
      for (const item of items) if (isAnchor(item)) this.#handledAnchors.add(item)
      if (this.#applyDefault() || (items.length > 0 && this.autoScroll && this.scrollToEnd())) return
      if (items.length === 0) this.#clearPendingDefault()
      this.#commitScrollState()
      this.#scheduleVisibility()
      return
    }
    const firstIndex = previousFirst ? items.indexOf(previousFirst as HTMLElement) : -1
    const viewport = this.#viewport as TecMessageScrollerViewport | null
    if (!viewport?.hasAttribute("prepend-shift") && firstIndex > 0) {
      this.#restorePrepend()
      return
    }
    if (items.length > previousCount) {
      const added = items.slice(previousCount)
      const anchor = added.find(isAnchor)
      if (anchor) {
        if (this.autoScroll && this.#mode === "following-bottom" && added.filter(isAnchor).length > 1) {
          this.scrollToEnd()
          return
        }
        this.#scrollToElement(anchor, { align: "start" }, true)
        this.#handledAnchors.add(anchor)
        return
      }
    }
    if (items.length === previousCount) {
      const anchor = items.find((el) => isAnchor(el) && !this.#handledAnchors.has(el))
      if (anchor) {
        this.#scrollToElement(anchor, { align: "start" }, true)
        this.#handledAnchors.add(anchor)
        return
      }
    }
    if (this.#mode === "following-bottom" && this.autoScroll) this.scrollToEnd()
    else {
      this.#commitScrollState()
      this.#scheduleVisibility()
    }
  }

  #handleResize(): void {
    if (!this.#ready) return
    if (this.#mode === "following-bottom" && this.autoScroll) {
      this.scrollToEnd()
      return
    }
    const previousSpacer = this.#spacerHeight
    if (this.#reanchor()) {
      // The streamed reply filled the room below the turn: continue following the live edge.
      if (this.autoScroll && previousSpacer > 0 && this.#spacerHeight === 0) this.scrollToEnd()
      return
    }
    this.#scheduleStateCommit()
    this.#scheduleVisibility()
  }

  // ------------------------------------------------------------------ state

  #updateMode(scrollable: MessageScrollerScrollable): void {
    const top = this.#viewport?.scrollTop ?? 0
    const scrolledUp = top < this.#lastScrollTop - EPSILON
    this.#lastScrollTop = top
    if (this.autoScroll && !scrollable.end && this.#mode !== "settling-jump" && this.#mode !== "anchored-to-message") {
      this.#mode = "following-bottom"
    } else if (this.#mode === "following-bottom" && scrollable.end && scrolledUp && !this.#autoscrolling) {
      this.#mode = "free-scrolling"
    }
  }

  #commitScrollState(): void {
    const raw = this.#computeScrollable()
    this.#updateMode(raw)
    const next = this.#mode === "following-bottom" ? { ...raw, end: false } : raw
    const changed = next.start !== this.#scrollable.start || next.end !== this.#scrollable.end
    this.#scrollable = next
    this.#syncStates()
    if (changed) {
      this.#syncButtons()
      this.emit<MessageScrollerScrollable>("tec-scrollable-change", { detail: { ...next } })
    }
  }

  #scheduleStateCommit(): void {
    if (this.#stateFrame) return
    this.#stateFrame = requestAnimationFrame(() => {
      this.#stateFrame = 0
      this.#commitScrollState()
    })
  }

  #syncStates(): void {
    this.toggleState("scrollable-start", this.#scrollable.start)
    this.toggleState("scrollable-end", this.#scrollable.end)
    this.toggleState("autoscrolling", this.#autoscrolling)
    this.toggleState("pending-scroll", this.#pendingDefault)
  }

  #syncButtons(): void {
    for (const button of this.querySelectorAll<TecMessageScrollerButton>("tec-message-scroller-button")) {
      if (button.closest("tec-message-scroller") !== this) continue
      const direction = button.getAttribute("direction") === "start" ? "start" : "end"
      button.active = direction === "start" ? this.#scrollable.start : this.#scrollable.end
    }
  }

  // ------------------------------------------------------------------ visibility

  #observeVisibility(): void {
    const viewport = this.#viewport
    if (!viewport || !this.trackVisibility || this.#intersection) return
    this.#intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = messageIdOf(entry.target)
          if (!id) continue
          if (entry.isIntersecting) this.#visibleIds.add(id)
          else this.#visibleIds.delete(id)
        }
        this.#scheduleVisibility()
      },
      { root: viewport, rootMargin: `${-(this.scrollMargin + this.scrollPreviousItemPeek)}px 0px 0px 0px`, threshold: [0, 0.01, 0.5, 1] }
    )
    for (const item of this.#items) if (messageIdOf(item)) this.#intersection.observe(item)
    this.#scheduleVisibility()
  }

  #unobserveVisibility(): void {
    cancelAnimationFrame(this.#visibilityFrame)
    this.#visibilityFrame = 0
    this.#intersection?.disconnect()
    this.#intersection = null
    this.#visibleIds.clear()
    this.#visibility = NO_VISIBILITY
  }

  #scheduleVisibility(): void {
    if (!this.#intersection || this.#visibilityFrame) return
    this.#visibilityFrame = requestAnimationFrame(() => {
      this.#visibilityFrame = 0
      if (!this.#intersection) return
      const next = this.#computeVisibility()
      const prev = this.#visibility
      const same =
        next.currentAnchorId === prev.currentAnchorId &&
        next.visibleMessageIds.length === prev.visibleMessageIds.length &&
        next.visibleMessageIds.every((id, i) => id === prev.visibleMessageIds[i])
      if (same) return
      this.#visibility = next
      this.emit<MessageScrollerVisibility>("tec-visibility-change", { detail: { ...next, visibleMessageIds: [...next.visibleMessageIds] } })
    })
  }

  #computeVisibility(): MessageScrollerVisibility {
    const viewport = this.#viewport
    if (!viewport || !this.#content) return NO_VISIBILITY
    const limit = viewport.getBoundingClientRect().top + this.scrollMargin + this.scrollPreviousItemPeek
    const visibleMessageIds: string[] = []
    let currentAnchorId: string | null = null
    for (const item of this.#items) {
      const id = messageIdOf(item)
      if (!id) continue
      if (this.#visibleIds.has(id)) visibleMessageIds.push(id)
      if (isAnchor(item) && item.getBoundingClientRect().top <= limit + EPSILON) currentAnchorId = id
    }
    return visibleMessageIds.length === 0 && currentAnchorId === null ? NO_VISIBILITY : { currentAnchorId, visibleMessageIds }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-message-scroller": TecMessageScroller
  }
}
