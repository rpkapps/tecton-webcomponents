import { css } from "lit"

/*
 * Spacing between slides mirrors the shadcn/Embla gutter: the track is pulled back by the spacing
 * (`-ml-4`) and every slide starts with that much padding (`pl-4`, inside the slide's shadow root —
 * no box styles on hosts). The snap point is the slide's content box, so the gutter of the first
 * visible slide stays out of view. `tec-carousel` passes the axis to the slides as private custom
 * properties (they inherit through the light DOM).
 */
export const carouselStyles = css`
  :host {
    --_spacing: var(--tec-carousel-spacing, 1rem);
    --_pad-inline: var(--_spacing);
    --_pad-block: 0px;
    --_snap-align: center;
    display: block;
    position: relative;
  }
  :host([orientation="vertical"]) {
    --_pad-inline: 0px;
    --_pad-block: var(--_spacing);
  }
  :host([snap-align="start"]) {
    --_snap-align: start;
  }
  :host([snap-align="end"]) {
    --_snap-align: end;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

export const carouselContentStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .viewport {
    height: 100%;
    overflow: auto hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    outline: none;
  }
  .viewport:focus-visible {
    outline: 2px solid var(--tec-ring);
    outline-offset: -2px;
    border-radius: var(--tec-radius-md);
  }
  .viewport::-webkit-scrollbar {
    display: none;
  }
  .track {
    display: flex;
    margin-inline-start: calc(-1 * var(--_spacing, 1rem));
  }
  :host(:state(vertical)) .viewport {
    overflow: hidden auto;
    overscroll-behavior-x: auto;
    overscroll-behavior-y: contain;
    scroll-snap-type: y mandatory;
  }
  :host(:state(vertical)) .track {
    flex-direction: column;
    margin-inline-start: 0;
    margin-block-start: calc(-1 * var(--_spacing, 1rem));
    height: calc(100% + var(--_spacing, 1rem));
  }
  :host(:state(dragging)) .viewport {
    scroll-snap-type: none;
    cursor: grabbing;
    user-select: none;
    -webkit-user-select: none;
  }
`

export const carouselItemStyles = css`
  :host {
    display: block;
    flex: 0 0 100%;
    min-width: 0;
  }
  .base {
    height: 100%;
    padding-inline-start: var(--_pad-inline, 1rem);
    padding-block-start: var(--_pad-block, 0px);
  }
  .content {
    height: 100%;
    scroll-snap-align: var(--_snap-align, center);
    scroll-snap-stop: normal;
  }
`

/* Previous / next / autoplay controls (they extend tec-button). */
export const carouselControlStyles = css`
  :host {
    --tec-button-radius: 9999px;
    touch-action: manipulation;
  }
  .base > svg {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

export const carouselNavStyles = css`
  :host {
    position: absolute;
  }
  :host(:state(horizontal)) {
    top: 50%;
    translate: 0 -50%;
  }
  :host(:state(horizontal):state(previous)) {
    inset-inline-start: -3rem;
  }
  :host(:state(horizontal):state(next)) {
    inset-inline-end: -3rem;
  }
  :host(:state(horizontal):dir(rtl)) .base > svg {
    scale: -1 1;
  }
  :host(:state(vertical)) {
    left: 50%;
    translate: -50% 0;
    rotate: 90deg;
  }
  :host(:state(vertical):state(previous)) {
    top: -3rem;
  }
  :host(:state(vertical):state(next)) {
    bottom: -3rem;
  }
`
