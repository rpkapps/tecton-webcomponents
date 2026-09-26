import { ContextConsumer } from "@lit/context"
import { html, type CSSResult, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide"
import { icon } from "../../internal/icons.js"
import { TecButton, type ButtonSize, type ButtonVariant } from "../button/button.js"
import { carouselContext } from "./carousel-context.js"
import { carouselControlStyles, carouselNavStyles } from "./carousel.styles.js"

/**
 * Shared base of the carousel buttons: a `tec-button` (outline, `icon-sm`, round) wired to the carousel.
 * @hideInherited href, target, rel, download - it always renders a `<button>`.
 */
abstract class CarouselControl extends TecButton {
  static override styles = [...(TecButton.styles as CSSResult[]), carouselControlStyles]

  protected carousel = new ContextConsumer(this, { context: carouselContext, subscribe: true })

  constructor() {
    super()
    this.variant = "outline" as ButtonVariant
    this.size = "icon-sm" as ButtonSize
    this.addEventListener("click", (event) => {
      if (this.disabled || event.defaultPrevented) return
      this.activate()
    })
  }

  protected abstract activate(): void
  protected abstract accessibleLabel(): string
  protected abstract glyph(): unknown

  protected override render() {
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled}>
      ${this.glyph()}<span class="sr-only">${this.accessibleLabel()}</span><slot></slot>
    </button>`
  }
}

abstract class CarouselNav extends CarouselControl {
  static override styles = [...(CarouselControl.styles as CSSResult[]), carouselNavStyles]

  protected abstract readonly direction: "previous" | "next"

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const ctx = this.carousel.value
    if (ctx) this.disabled = this.direction === "previous" ? !ctx.canScrollPrev : !ctx.canScrollNext
    const vertical = ctx?.orientation === "vertical"
    this.toggleState("vertical", vertical)
    this.toggleState("horizontal", !vertical)
    this.toggleState(this.direction, true)
  }
}

/**
 * Positioned outside the start edge of the carousel (above it when vertical) and disabled on the
 * first slide (unless `loop`). Put it inside `tec-carousel`, after `tec-carousel-content`. It is a
 * `tec-button` (`variant`, `size` and `::part(base)` work); a `class` with `static` or other insets
 * places it elsewhere. The chevron mirrors in right-to-left layouts.
 *
 * @summary The previous-slide button of a `tec-carousel`.
 *
 * @tag tec-carousel-previous
 *
 * @slot - Extra content after the chevron (rarely needed).
 *
 * @csspart base - The native `<button>`.
 */
export class TecCarouselPrevious extends CarouselNav {
  protected readonly direction = "previous"

  /** Accessible name (visually hidden). */
  @property() label = "Previous slide"

  protected override activate(): void {
    this.carousel.value?.scrollPrev()
  }
  protected override accessibleLabel(): string {
    return this.label
  }
  protected override glyph() {
    return icon(ChevronLeft)
  }
}

/**
 * Positioned outside the end edge of the carousel (below it when vertical) and disabled on the last
 * slide (unless `loop`).
 *
 * @summary The next-slide button of a `tec-carousel`.
 *
 * @tag tec-carousel-next
 *
 * @slot - Extra content after the chevron (rarely needed).
 *
 * @csspart base - The native `<button>`.
 */
export class TecCarouselNext extends CarouselNav {
  protected readonly direction = "next"

  /** Accessible name (visually hidden). */
  @property() label = "Next slide"

  protected override activate(): void {
    this.carousel.value?.scrollNext()
  }
  protected override accessibleLabel(): string {
    return this.label
  }
  protected override glyph() {
    return icon(ChevronRight)
  }
}

/**
 * The visible pause / play control that WCAG 2.2.2 requires for an auto-advancing carousel. It
 * shows a pause icon while autoplay runs and a play icon when it is stopped; its accessible name
 * follows (`pause-label` / `play-label`). Place it anywhere inside `tec-carousel` (it is not
 * positioned); it is hidden when the carousel has no `autoplay`.
 *
 * @summary Pauses and resumes a carousel's autoplay.
 *
 * @tag tec-carousel-autoplay-toggle
 *
 * @csspart base - The native `<button>`.
 */
export class TecCarouselAutoplayToggle extends CarouselControl {
  /** Accessible name while autoplay runs. */
  @property({ attribute: "pause-label" }) pauseLabel = "Stop automatic slide show"

  /** Accessible name while autoplay is stopped. */
  @property({ attribute: "play-label" }) playLabel = "Start automatic slide show"

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.hidden = !this.carousel.value?.autoplay
  }

  protected override activate(): void {
    this.carousel.value?.togglePlaying()
  }
  protected override accessibleLabel(): string {
    return this.carousel.value?.playing ? this.pauseLabel : this.playLabel
  }
  protected override glyph() {
    return icon(this.carousel.value?.playing ? Pause : Play)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-carousel-previous": TecCarouselPrevious
    "tec-carousel-next": TecCarouselNext
    "tec-carousel-autoplay-toggle": TecCarouselAutoplayToggle
  }
}
