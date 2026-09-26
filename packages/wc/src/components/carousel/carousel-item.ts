import { html } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { carouselItemStyles } from "./carousel.styles.js"

/**
 * A slide: `role="group"` with `aria-roledescription="slide"`, named "1 of 5" (the carousel's
 * `slide-label`) unless you give it an `aria-label`. Set its size with `flex-basis` on the element
 * (`class="basis-1/2 lg:basis-1/3"`; the default is the full width of the carousel).
 *
 * @summary One slide of a `tec-carousel`.
 *
 * @tag tec-carousel-item
 *
 * @slot - The slide content.
 *
 * @csspart base - The slide box; its leading padding is the spacing between slides (`--tec-carousel-spacing`).
 * @csspart content - The content box (the snap target).
 */
export class TecCarouselItem extends TectonElement {
  static styles = [hostStyles, carouselItemStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    this.internals.ariaRoleDescription = "slide"
  }

  /** The element whose box is aligned when the carousel snaps to this slide. @internal */
  get snapTarget(): HTMLElement {
    return this.renderRoot.querySelector<HTMLElement>(".content") ?? this
  }

  /** Sets the default accessible name ("2 of 5"); an `aria-label` on the element wins. @internal */
  setSlideLabel(label: string): void {
    this.internals.ariaLabel = label
  }

  protected override render() {
    return html`<div class="base" part="base"><div class="content" part="content"><slot></slot></div></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-carousel-item": TecCarouselItem
  }
}
