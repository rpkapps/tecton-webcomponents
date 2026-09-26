import { createContext } from "@lit/context"
import type { TecCarouselContent } from "./carousel-content.js"

export type CarouselOrientation = "horizontal" | "vertical"

/** What `tec-carousel` shares with its parts. A new object on every change. */
export interface CarouselContextValue {
  orientation: CarouselOrientation
  canScrollPrev: boolean
  canScrollNext: boolean
  /** Whether autoplay is on (`autoplay` attribute, not stopped by the user). */
  playing: boolean
  /** Whether the carousel has the `autoplay` attribute (the autoplay toggle hides without it). */
  autoplay: boolean
  /** User navigation (stops autoplay, announces the new slide). */
  scrollPrev(): void
  scrollNext(): void
  /** A mouse drag ended after moving the slides by `travel` px (scroll coordinates). */
  dragEnd(travel: number): void
  /** User toggle of autoplay. */
  togglePlaying(): void
  /** Called by `tec-carousel-content` when it connects, disconnects or its slides change. */
  register(content: TecCarouselContent, connected: boolean): void
}

export const carouselContext = createContext<CarouselContextValue | undefined>(Symbol("tec-carousel"))
