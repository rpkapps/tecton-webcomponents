/**
 * @module scroll-fade
 * `ScrollFadeController` — scroll-position-aware edge fades for an element that is itself a scroll container (the
 * `scroll-fade` utility behaviour, for shadow roots).
 *
 * The utility eases each fade in with a scroll-driven animation of registered custom properties;
 * `@property` rules are ignored inside shadow roots, so here the fade depths are computed on scroll
 * and resize and written to a per-instance constructed stylesheet adopted by the host's shadow root:
 *
 * ```css
 * :host { --_fade-start: 0px; --_fade-end: 0px; mask-image: linear-gradient(… var(--_fade-start) … var(--_fade-end) …) }
 * ```
 *
 * Each fade grows to `min(12%, 2.5rem)` over the first 6rem of scroll away from its edge.
 * Used by the attachment and message-scroller families.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"

type Host = ReactiveControllerHost & HTMLElement

export interface ScrollFadeOptions {
  /** `x` fades the inline edges (following the reading direction), `y` the block edges. */
  axis: "x" | "y"
  /** Which edges fade. Default both. */
  edges?: "both" | "start" | "end"
  /** An element whose size changes change the scroll extent (e.g. the shadow wrapper of the content). */
  content?: () => Element | null | undefined
}

export class ScrollFadeController implements ReactiveController {
  readonly #host: Host
  readonly #options: ScrollFadeOptions
  #sheet: CSSStyleSheet | null = null
  #frame = 0
  #resize = new ResizeObserver(() => this.schedule())
  #last = ""
  #observed: Element | null = null

  constructor(host: Host, options: ScrollFadeOptions) {
    this.#host = host
    this.#options = options
    host.addController(this)
  }

  hostConnected(): void {
    this.#host.addEventListener("scroll", this.schedule, { passive: true })
    this.#resize.observe(this.#host)
    this.schedule()
  }

  hostUpdated(): void {
    const content = this.#options.content?.() ?? null
    if (content && content !== this.#observed) {
      if (this.#observed) this.#resize.unobserve(this.#observed)
      this.#resize.observe(content)
      this.#observed = content
    }
    const root = this.#host.shadowRoot
    if (root && !this.#sheet) {
      this.#sheet = new CSSStyleSheet()
      this.#sheet.replaceSync(":host{}")
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.#sheet]
      this.#last = ""
      this.#apply()
    }
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("scroll", this.schedule)
    this.#resize.disconnect()
    this.#observed = null
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  /** Recomputes the fades on the next frame (call it after the content changed size). */
  schedule = (): void => {
    if (this.#frame) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      this.#apply()
    })
  }

  #apply(): void {
    const sheet = this.#sheet
    if (!sheet) return
    const el = this.#host
    const x = this.#options.axis === "x"
    const client = x ? el.clientWidth : el.clientHeight
    const scroll = x ? el.scrollWidth : el.scrollHeight
    const pos = Math.abs(x ? el.scrollLeft : el.scrollTop)
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const size = Math.min(client * 0.12, 2.5 * rem)
    const reveal = 6 * rem
    const remaining = Math.max(0, scroll - client - pos)
    const edges = this.#options.edges ?? "both"
    const start = edges === "end" ? 0 : size * Math.min(1, pos / reveal)
    const end = edges === "start" ? 0 : size * Math.min(1, remaining / reveal)
    const text = `--_fade-start:${start.toFixed(2)}px;--_fade-end:${end.toFixed(2)}px`
    if (text === this.#last) return
    this.#last = text
    const rule = sheet.cssRules[0] as CSSStyleRule
    rule.style.setProperty("--_fade-start", `${start.toFixed(2)}px`)
    rule.style.setProperty("--_fade-end", `${end.toFixed(2)}px`)
  }
}
