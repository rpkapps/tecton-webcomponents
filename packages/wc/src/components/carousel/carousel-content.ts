import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { carouselContext } from "./carousel-context.js"
import { carouselContentStyles } from "./carousel.styles.js"
import type { TecCarouselItem } from "./carousel-item.js"

/**
 * The scroll viewport holding the `tec-carousel-item`s. Slides scroll natively (touch swipe,
 * trackpad, Shift + wheel) with CSS scroll snapping; with a mouse they can also be dragged. For a
 * vertical carousel give it a height (`class="h-[270px]"`).
 *
 * @summary The viewport of a `tec-carousel`.
 *
 * @tag tec-carousel-content
 *
 * @slot - The `tec-carousel-item`s.
 *
 * @csspart viewport - The scroll container (scroll-snap, hidden scrollbar).
 * @csspart track - The flex row (column when vertical) of slides; pulled back by the slide spacing.
 *
 * @cssstate vertical - The carousel is vertical.
 * @cssstate dragging - The slides are being dragged with a mouse.
 */
export class TecCarouselContent extends TectonElement {
  static styles = [hostStyles, carouselContentStyles]

  #carousel = new ContextConsumer(this, { context: carouselContext, subscribe: true })
  #registered = false
  #drag: { id: number; start: number; scroll: number; moved: boolean } | null = null
  #suppressClick = false

  /** The scroll container. @internal */
  get viewport(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".viewport")
  }

  /** The slides, in order. */
  get items(): TecCarouselItem[] {
    return [...this.querySelectorAll<TecCarouselItem>(":scope > tec-carousel-item")]
  }

  get #vertical(): boolean {
    return this.#carousel.value?.orientation === "vertical"
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener("click", this.#onClickCapture, true)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.removeEventListener("click", this.#onClickCapture, true)
    this.#carousel.value?.register(this, false)
    this.#registered = false
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("vertical", this.#vertical)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (!this.#registered && this.#carousel.value) {
      this.#registered = true
      this.#carousel.value.register(this, true)
    }
  }

  #onSlotChange(): void {
    this.#carousel.value?.register(this, true)
  }

  /* ---------------------------------------------------------- mouse drag */

  #pos(event: PointerEvent): number {
    return this.#vertical ? event.clientY : event.clientX
  }

  #scrollPos(viewport: HTMLElement): number {
    return this.#vertical ? viewport.scrollTop : viewport.scrollLeft
  }

  #onPointerDown(event: PointerEvent): void {
    const viewport = this.viewport
    if (event.pointerType !== "mouse" || event.button !== 0 || !viewport) return
    const target = event.composedPath()[0] as Element
    if (target.closest?.("input, textarea, select, [contenteditable]")) return
    this.#drag = { id: event.pointerId, start: this.#pos(event), scroll: this.#scrollPos(viewport), moved: false }
  }

  #onPointerMove(event: PointerEvent): void {
    const drag = this.#drag
    const viewport = this.viewport
    if (!drag || event.pointerId !== drag.id || !viewport) return
    const delta = this.#pos(event) - drag.start
    if (!drag.moved) {
      if (Math.abs(delta) < 4) return
      drag.moved = true
      viewport.setPointerCapture(event.pointerId)
      this.toggleState("dragging", true)
    }
    event.preventDefault()
    if (this.#vertical) viewport.scrollTop = drag.scroll - delta
    else viewport.scrollLeft = drag.scroll - delta
  }

  #onPointerUp(event: PointerEvent): void {
    const drag = this.#drag
    const viewport = this.viewport
    if (!drag || event.pointerId !== drag.id) return
    this.#drag = null
    if (!drag.moved || !viewport) return
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    this.#suppressClick = true
    setTimeout(() => (this.#suppressClick = false), 0)
    // Travel in scroll coordinates (negative in RTL for horizontal carousels, like `scrollLeft`).
    const travel = this.#scrollPos(viewport) - drag.scroll
    this.#carousel.value?.dragEnd(travel)
    // Keep snapping off until the settle scroll ends, or the browser would re-snap mid-animation.
    let done = false
    const finish = () => {
      if (done) return
      done = true
      viewport.removeEventListener("scrollend", finish)
      this.toggleState("dragging", false)
    }
    viewport.addEventListener("scrollend", finish)
    setTimeout(finish, 800)
  }

  /** A click that ends a drag must not activate the slide content under the pointer. */
  #onClickCapture = (event: MouseEvent) => {
    if (!this.#suppressClick) return
    this.#suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  protected override render() {
    return html`<div
      class="viewport"
      part="viewport"
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerUp}
      @pointercancel=${this.#onPointerUp}
      @dragstart=${(e: DragEvent) => e.preventDefault()}
    >
      <div class="track" part="track"><slot @slotchange=${this.#onSlotChange}></slot></div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-carousel-content": TecCarouselContent
  }
}
