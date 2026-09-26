import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { isRtl } from "../../internal/direction.js"
import { getTabbables } from "../../internal/focus.js"
import { hostStyles, prefersReducedMotion } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { carouselContext, type CarouselContextValue, type CarouselOrientation } from "./carousel-context.js"
import type { TecCarouselContent } from "./carousel-content.js"
import type { TecCarouselItem } from "./carousel-item.js"
import { carouselStyles } from "./carousel.styles.js"

export type { CarouselOrientation } from "./carousel-context.js"
export type CarouselSnapAlign = "start" | "center" | "end"

/** Detail of `tec-slide-change`. */
export interface CarouselSlideChangeDetail {
  /** The selected snap position (0-based). */
  index: number
  /** The previously selected snap position. */
  previousIndex: number
}

/** A snap position: where the viewport scrolls to, and the slides aligned there. */
interface Snap {
  /** Distance from the scroll start, in px (positive in both directions). */
  position: number
  items: TecCarouselItem[]
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))

/** Elements that use the arrow keys themselves: the carousel leaves their keys alone. */
const OWNS_ARROWS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="menu"], [role="menubar"], [role="listbox"], [role="slider"], [role="tablist"], [role="radiogroup"], [role="grid"], [role="tree"], [role="toolbar"], [role="combobox"]'

/**
 * The slides scroll natively — touch swipe, trackpad, a mouse drag — and snap with CSS scroll
 * snapping; `tec-carousel-previous` / `tec-carousel-next` and the arrow keys (while focus is inside)
 * move one snap position. Follows the WAI-ARIA APG carousel pattern: the element is a region with
 * `aria-roledescription="carousel"` (name it with `aria-label`), every slide a group with
 * `aria-roledescription="slide"` named "n of m", and a slide change caused by the buttons or keys is
 * announced through a polite live region.
 *
 * `autoplay` advances the slides on a timer (WCAG 2.2.2): it pauses while the pointer is over the
 * carousel or focus is inside it, stops for good when the user navigates, never starts when the user
 * prefers reduced motion, and `tec-carousel-autoplay-toggle` gives a visible pause / play control.
 *
 * @summary A carousel of slides with previous / next controls, swipe and scroll snapping.
 *
 * @tag tec-carousel
 *
 * @slot - `tec-carousel-content` (the slides), `tec-carousel-previous`, `tec-carousel-next` and optionally `tec-carousel-autoplay-toggle`.
 *
 * @cssprop --tec-carousel-spacing - Space between slides (default 1rem).
 *
 * @cssstate playing - Autoplay is running (it may be paused by hover or focus).
 * @cssstate can-scroll-prev - There is a previous snap position (or `loop`).
 * @cssstate can-scroll-next - There is a next snap position (or `loop`).
 *
 * @fires tec-slide-change - The selected snap position changed (by the user, autoplay or `goTo()`). `detail: { index, previousIndex }`.
 */
export class TecCarousel extends TectonElement {
  static styles = [hostStyles, carouselStyles]

  /** Scroll axis. Vertical carousels need a height on `tec-carousel-content`. */
  @property({ reflect: true }) orientation: CarouselOrientation = "horizontal"

  /** Where a slide aligns in the viewport when snapped (matters for slides narrower than the viewport). */
  @property({ attribute: "snap-align", reflect: true }) snapAlign: CarouselSnapAlign = "center"

  /** Previous from the first slide goes to the last one and next from the last to the first. */
  @property({ type: Boolean, reflect: true }) loop = false

  /** Advances the slides automatically every `autoplay-delay` ms (see the notes on accessibility). */
  @property({ type: Boolean, reflect: true }) autoplay = false

  /** Autoplay interval in milliseconds. */
  @property({ type: Number, attribute: "autoplay-delay" }) autoplayDelay = 4000

  /** Accessible name of each slide; `{index}` and `{count}` are replaced (numbers are localised). */
  @property({ attribute: "slide-label" }) slideLabel = "{index} of {count}"

  /** Announcement after the user moves to another slide; `{index}` and `{count}` are replaced. */
  @property({ attribute: "announcement-label" }) announcementLabel = "Slide {index} of {count}"

  @state() private _index = 0
  @state() private _snaps: Snap[] = []
  @state() private _playing = false
  @state() private _announcement = ""

  #content: TecCarouselContent | null = null
  #provider = new ContextProvider(this, { context: carouselContext, initialValue: undefined })
  #resize = new ResizeObserver(() => this.#measure())
  #frame = 0
  #timer = 0
  #hovered = false
  #focusWithin = false
  #stopped = false
  #announcePending = false

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown, true)
    this.addEventListener("pointerenter", () => this.#setHovered(true))
    this.addEventListener("pointerleave", () => this.#setHovered(false))
    this.addEventListener("focusin", () => {
      this.#focusWithin = true
      this.#schedule()
    })
    this.addEventListener("focusout", (event) => {
      if (event.relatedTarget && this.contains(event.relatedTarget as Node)) return
      this.#focusWithin = false
      this.#schedule()
    })
  }

  /** The selected snap position (0-based). */
  get selectedIndex(): number {
    return this._index
  }

  /** The number of snap positions (slides that fit side by side share the end position). */
  get snapCount(): number {
    return this._snaps.length
  }

  /** The slides. */
  get items(): TecCarouselItem[] {
    return this.#content?.items ?? []
  }

  /** Whether `scrollPrev()` would move (always, with `loop` and more than one position). */
  get canScrollPrev(): boolean {
    return this._snaps.length > 1 && (this.loop || this._index > 0)
  }

  /** Whether `scrollNext()` would move. */
  get canScrollNext(): boolean {
    return this._snaps.length > 1 && (this.loop || this._index < this._snaps.length - 1)
  }

  /** Whether autoplay is running (it may be temporarily paused by hover or focus). */
  get playing(): boolean {
    return this._playing
  }

  /** Scrolls to the previous snap position (to the last one with `loop`). */
  scrollPrev(): void {
    const count = this._snaps.length
    if (!count) return
    if (this._index > 0) this.goTo(this._index - 1)
    else if (this.loop) this.goTo(count - 1)
  }

  /** Scrolls to the next snap position (to the first one with `loop`). */
  scrollNext(): void {
    const count = this._snaps.length
    if (!count) return
    if (this._index < count - 1) this.goTo(this._index + 1)
    else if (this.loop) this.goTo(0)
  }

  /** Scrolls to snap position `index` (smoothly unless the user prefers reduced motion or `instant`). */
  goTo(index: number, options: { instant?: boolean } = {}): void {
    const snap = this._snaps[Math.max(0, Math.min(index, this._snaps.length - 1))]
    const viewport = this.#content?.viewport
    if (!snap || !viewport) return
    const behavior: ScrollBehavior = options.instant || prefersReducedMotion() ? "instant" : "smooth"
    if (this.orientation === "vertical") viewport.scrollTo({ top: snap.position, behavior })
    else viewport.scrollTo({ left: isRtl(viewport) ? -snap.position : snap.position, behavior })
  }

  /** Starts autoplay (also after the user stopped it). */
  play(): void {
    this.#stopped = false
    this._playing = true
    this.#schedule()
  }

  /** Stops autoplay until `play()` or the autoplay toggle. */
  pause(): void {
    this.#stopped = true
    this._playing = false
    this.#schedule()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "region"
    this.internals.ariaRoleDescription = "carousel"
    if (this.autoplay && !this.#stopped && !prefersReducedMotion()) this._playing = true
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resize.disconnect()
    this.#detach()
    cancelAnimationFrame(this.#frame)
    clearTimeout(this.#timer)
  }

  /* ------------------------------------------------------------ measuring */

  #register = (content: TecCarouselContent, connected: boolean) => {
    if (!connected) {
      if (this.#content === content) {
        this.#detach()
        this.#content = null
        this._snaps = []
      }
      return
    }
    if (this.#content !== content) {
      this.#detach()
      this.#content = content
      const viewport = content.viewport
      viewport?.addEventListener("scroll", this.#onScroll, { passive: true })
      viewport?.addEventListener("scrollend", this.#onScrollEnd)
      viewport?.addEventListener("wheel", this.#onUserScroll, { passive: true })
      viewport?.addEventListener("touchstart", this.#onUserScroll, { passive: true })
    }
    this.#resize.disconnect()
    if (content.viewport) this.#resize.observe(content.viewport)
    for (const item of content.items) this.#resize.observe(item)
    this.#syncFocusability()
    this.#measure()
  }

  #detach(): void {
    const viewport = this.#content?.viewport
    viewport?.removeEventListener("scroll", this.#onScroll)
    viewport?.removeEventListener("scrollend", this.#onScrollEnd)
    viewport?.removeEventListener("wheel", this.#onUserScroll)
    viewport?.removeEventListener("touchstart", this.#onUserScroll)
  }

  /**
   * Like Chrome's keyboard-focusable scrollers: when no slide holds anything focusable, the viewport
   * itself is a tab stop so keyboard users can reach the slides (and the arrow keys work).
   */
  #syncFocusability(): void {
    const viewport = this.#content?.viewport
    if (!viewport) return
    if (this.items.some((item) => getTabbables(item).length)) viewport.removeAttribute("tabindex")
    else viewport.tabIndex = 0
  }

  /** Current distance from the scroll start (positive in RTL too). */
  #scrollPosition(viewport: HTMLElement): number {
    if (this.orientation === "vertical") return viewport.scrollTop
    return isRtl(viewport) ? -viewport.scrollLeft : viewport.scrollLeft
  }

  /** Computes the snap positions from the slides' content boxes (deduplicated at the scroll ends). */
  #measure(): void {
    const viewport = this.#content?.viewport
    const items = this.items
    if (!viewport || !items.length) {
      this._snaps = []
      this.#syncLabels()
      return
    }
    const vertical = this.orientation === "vertical"
    const rtl = !vertical && isRtl(viewport)
    const vp = viewport.getBoundingClientRect()
    const size = vertical ? viewport.clientHeight : viewport.clientWidth
    const max = Math.max(0, vertical ? viewport.scrollHeight - viewport.clientHeight : viewport.scrollWidth - viewport.clientWidth)
    const current = this.#scrollPosition(viewport)
    const snaps: Snap[] = []
    for (const item of items) {
      const r = item.snapTarget.getBoundingClientRect()
      const start = vertical ? r.top - vp.top : rtl ? vp.right - r.right : r.left - vp.left
      const length = vertical ? r.height : r.width
      let position = current + start
      if (this.snapAlign === "center") position -= (size - length) / 2
      else if (this.snapAlign === "end") position -= size - length
      position = Math.round(Math.max(0, Math.min(max, position)))
      const last = snaps[snaps.length - 1]
      if (last && Math.abs(last.position - position) <= 1) last.items.push(item)
      else snaps.push({ position, items: [item] })
    }
    this._snaps = snaps
    this.#syncLabels()
    this.#updateIndex()
  }

  #syncLabels(): void {
    const items = this.items
    const format = new Intl.NumberFormat(this.closest("[lang]")?.getAttribute("lang") || undefined)
    items.forEach((item, i) => item.setSlideLabel(fill(this.slideLabel, { index: format.format(i + 1), count: format.format(items.length) })))
  }

  #onScroll = () => {
    if (this.#frame) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      this.#updateIndex()
    })
  }

  #onScrollEnd = () => {
    this.#updateIndex()
    if (this.#announcePending) {
      this.#announcePending = false
      this.#announce()
    }
  }

  /** Swipes and wheel scrolls are user navigation: they stop autoplay. */
  #onUserScroll = () => {
    if (this._playing) this.pause()
  }

  #updateIndex(): void {
    const viewport = this.#content?.viewport
    if (!viewport || !this._snaps.length) return
    const position = this.#scrollPosition(viewport)
    let index = 0
    let best = Infinity
    this._snaps.forEach((snap, i) => {
      const distance = Math.abs(snap.position - position)
      if (distance < best) {
        best = distance
        index = i
      }
    })
    if (index === this._index) return
    const previousIndex = this._index
    this._index = index
    this.emit<CarouselSlideChangeDetail>("tec-slide-change", { detail: { index, previousIndex } })
  }

  #announce(): void {
    const format = new Intl.NumberFormat(this.closest("[lang]")?.getAttribute("lang") || undefined)
    const text = fill(this.announcementLabel, { index: format.format(this._index + 1), count: format.format(this._snaps.length) })
    // Re-set even when unchanged so repeated announcements are spoken.
    this._announcement = ""
    requestAnimationFrame(() => (this._announcement = text))
  }

  /* ---------------------------------------------------------- user input */

  #userNavigate(direction: -1 | 1): void {
    if (this._playing) this.pause()
    if (!(direction < 0 ? this.canScrollPrev : this.canScrollNext)) return
    this.#announcePending = true
    if (direction < 0) this.scrollPrev()
    else this.scrollNext()
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    for (const node of event.composedPath()) {
      if (node === this) break
      if (node instanceof Element && node.matches(OWNS_ARROWS)) return
    }
    const vertical = this.orientation === "vertical"
    let direction: -1 | 0 | 1 = 0
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      direction = event.key === "ArrowRight" ? 1 : -1
      if (!vertical && isRtl(this)) direction = direction === 1 ? -1 : 1
    } else if (vertical && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      direction = event.key === "ArrowDown" ? 1 : -1
    }
    if (!direction) return
    event.preventDefault()
    this.#userNavigate(direction)
  }

  #dragEnd = (travel: number) => {
    if (this._playing) this.pause()
    const viewport = this.#content?.viewport
    if (!viewport || !this._snaps.length) return
    const position = this.#scrollPosition(viewport)
    // The travel is in scroll coordinates; flip for RTL so positive always means "towards the end".
    const forward = (this.orientation !== "vertical" && isRtl(viewport) ? -travel : travel) > 0
    let target = forward ? this._snaps.findIndex((s) => s.position >= position - 1) : this._snaps.findLastIndex((s) => s.position <= position + 1)
    if (target < 0) target = forward ? this._snaps.length - 1 : 0
    this.goTo(target)
  }

  /* ------------------------------------------------------------ autoplay */

  #setHovered(hovered: boolean): void {
    this.#hovered = hovered
    this.#schedule()
  }

  #schedule(): void {
    clearTimeout(this.#timer)
    this.#timer = 0
    this.toggleState("playing", this._playing)
    if (!this._playing || this.#hovered || this.#focusWithin || !this.isConnected) return
    this.#timer = window.setTimeout(() => {
      this.#timer = 0
      if (this._index < this._snaps.length - 1) this.goTo(this._index + 1)
      else this.goTo(0)
      this.#schedule()
    }, Math.max(500, this.autoplayDelay))
  }

  #togglePlaying = () => {
    if (this._playing) this.pause()
    else this.play()
  }

  /* ------------------------------------------------------------ lifecycle */

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("autoplay") && this.hasUpdated) {
      if (this.autoplay && !this.#stopped && !prefersReducedMotion()) this._playing = true
      else if (!this.autoplay) this._playing = false
    }
    const value: CarouselContextValue = {
      orientation: this.orientation,
      canScrollPrev: this.canScrollPrev,
      canScrollNext: this.canScrollNext,
      playing: this._playing,
      autoplay: this.autoplay,
      scrollPrev: () => this.#userNavigate(-1),
      scrollNext: () => this.#userNavigate(1),
      dragEnd: this.#dragEnd,
      togglePlaying: this.#togglePlaying,
      register: this.#register,
    }
    this.#provider.setValue(value, true)
    this.toggleState("can-scroll-prev", this.canScrollPrev)
    this.toggleState("can-scroll-next", this.canScrollNext)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("orientation") || changed.has("snapAlign")) {
      // Wait for the parts to re-render with the new axis before measuring.
      requestAnimationFrame(() => this.#measure())
    }
    if (changed.has("slideLabel")) this.#syncLabels()
    if (changed.has("_playing") || changed.has("autoplay") || changed.has("autoplayDelay")) this.#schedule()
  }

  protected override render() {
    return html`<slot></slot><div class="sr-only" aria-live="polite" aria-atomic="true">${this._announcement}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-carousel": TecCarousel
  }
}
