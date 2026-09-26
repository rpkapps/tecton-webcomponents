import { css } from "lit"

export const messageScrollerStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  :host(:state(pending-scroll)) ::slotted(tec-message-scroller-viewport) {
    visibility: hidden;
  }
  :host(:state(autoscrolling)) ::slotted(tec-message-scroller-viewport) {
    scrollbar-color: transparent transparent;
  }
`

export const messageScrollerViewportStyles = css`
  :host {
    --_fade-start: 0px;
    --_fade-end: 0px;
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    contain: content;
    scrollbar-width: thin;
    scrollbar-gutter: stable;
    outline: none;
    -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - var(--_fade-end)), transparent 100%);
    mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - var(--_fade-end)), transparent 100%);
  }
  :host(:focus-visible) {
    outline: 2px solid var(--tec-ring);
    outline-offset: -2px;
  }
  @media (forced-colors: active) {
    :host(:focus-visible) {
      outline-color: Highlight;
    }
  }
`

export const messageScrollerContentStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: max-content;
    min-height: 100%;
  }
  .spacer {
    flex: none;
  }
`

export const messageScrollerItemStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
    min-width: 0;
    content-visibility: auto;
    contain-intrinsic-size: auto 10rem;
  }
  .base {
    padding: 0.25rem;
  }
`

export const messageScrollerButtonStyles = css`
  :host([variant]) {
    --_bg: var(--tec-background);
    --_fg: var(--tec-foreground);
    --_border: var(--tec-border);
    --_bg-hover: var(--tec-muted);
    --_fg-hover: var(--tec-foreground);
    --tec-button-radius: 9999px;
  }
  :host {
    position: absolute;
    z-index: 10;
    inset-inline-start: 50%;
    --_x: -50%;
    --_y: 0;
    translate: var(--_x) var(--_y);
    scale: 1;
    opacity: 1;
  }
  :host(:dir(rtl)) {
    --_x: 50%;
  }
  :host([direction="end"]),
  :host(:not([direction])) {
    bottom: 1rem;
  }
  :host([direction="start"]) {
    top: 1rem;
  }
  :host([direction="start"]) .arrow {
    rotate: 180deg;
  }
  :host(:state(inactive)) {
    pointer-events: none;
    scale: 0.95;
    opacity: 0;
  }
  :host(:state(inactive)[direction="end"]),
  :host(:state(inactive):not([direction])) {
    --_y: 100%;
  }
  :host(:state(inactive)[direction="start"]) {
    --_y: -100%;
  }
  @media (prefers-reduced-motion: no-preference) {
    :host {
      transition-property: translate, scale, opacity;
      transition-duration: 200ms;
      transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
    }
    :host(:state(inactive)) {
      transition-duration: 400ms;
      transition-timing-function: cubic-bezier(0.7, 0, 0.84, 0);
    }
  }
`
