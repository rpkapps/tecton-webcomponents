import { css } from "lit"

/*
 * tec-attachment: the host is the layout box (width, flex item behaviour); the card (border,
 * radius, padding, background) is the inner base, which is also the containing block of the
 * full-card trigger and of the vertical actions. Size / orientation / state are host attributes;
 * the parts read them through context and expose them as custom states.
 */
export const attachmentStyles = css`
  :host {
    display: flex;
    position: relative;
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    flex-shrink: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-card-foreground);
    gap: 0.5rem;
  }
  :host([orientation="horizontal"]),
  :host(:not([orientation])) {
    min-width: 10rem;
  }
  :host([orientation="vertical"]) {
    width: 6rem;
  }
  :host([orientation="vertical"]:state(has-content)) {
    width: 7.5rem;
  }
  :host([size="sm"]) {
    gap: 0.625rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host([size="xs"]) {
    gap: 0.375rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }

  .base {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: inherit;
    min-width: 0;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-xl);
    background-color: var(--tec-card);
    background-clip: padding-box;
  }
  :host([orientation="vertical"]) .base {
    flex-direction: column;
    align-items: stretch;
  }
  :host([size="xs"]) .base {
    border-radius: var(--tec-radius-lg);
  }
  :host([state="idle"]) .base {
    border-style: dashed;
  }
  :host([state="error"]) .base {
    border-color: color-mix(in oklab, var(--tec-destructive) 30%, transparent);
  }
  :host(:state(has-trigger):hover) .base {
    background-color: color-mix(in oklab, var(--tec-muted) 50%, var(--tec-card));
  }
  :host(:focus-within) .base {
    box-shadow: 0 0 0 1px var(--tec-ring);
  }

  /* padding: content only → px-2.5 py-2; with media → p-2 (the media rule wins) */
  :host(:state(has-content)) .base {
    padding: 0.5rem 0.625rem;
  }
  :host(:state(has-media)) .base {
    padding: 0.5rem;
  }
  :host([size="sm"]:state(has-content)) .base {
    padding: 0.375rem 0.5rem;
  }
  :host([size="sm"]:state(has-media)) .base {
    padding: 0.375rem;
  }
  :host([size="xs"]:state(has-content)) .base {
    padding: 0.25rem 0.375rem;
  }
  :host([size="xs"]:state(has-media)) .base {
    padding: 0.25rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: background-color var(--tec-duration) var(--tec-ease), box-shadow var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:focus-within) .base {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }
`

export const attachmentMediaStyles = css`
  :host {
    --tec-icon-size: 1rem;
    display: flex;
    position: relative;
    flex-shrink: 0;
    width: 2.5rem;
    aspect-ratio: 1;
    color: var(--tec-foreground);
  }
  :host(:state(vertical)) {
    width: 100%;
    --tec-icon-size: 1.5rem;
  }
  :host(:state(size-sm)) {
    width: 2rem;
  }
  :host(:state(size-xs)) {
    width: 1.75rem;
    --tec-icon-size: 0.875rem;
  }
  :host(:state(error)) {
    color: var(--tec-destructive);
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-muted);
  }
  :host(:state(size-xs)) .base {
    border-radius: var(--tec-radius-md);
  }
  :host(:state(error)) .base {
    background-color: color-mix(in oklab, var(--tec-destructive) 10%, transparent);
  }
  :host([variant="image"]) .base {
    opacity: 0.6;
  }
  :host([variant="image"]:is(:state(done), :state(idle))) .base {
    opacity: 1;
  }
  ::slotted(svg),
  ::slotted(tec-icon),
  ::slotted(tec-spinner) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  ::slotted(img) {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }
`

export const attachmentContentStyles = css`
  :host {
    display: block;
    flex: 1 1 0%;
    min-width: 0;
    max-width: 100%;
    line-height: 1.25;
  }
  :host(:state(vertical)) {
    flex: none;
  }
  :host(:state(vertical)) .base {
    padding-inline: 0.25rem;
  }
  .base {
    display: block;
    min-width: 0;
  }
`

export const attachmentTitleStyles = css`
  @keyframes tec-shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: 0 0;
    }
  }
  :host {
    display: block;
    min-width: 0;
    max-width: 100%;
    font-weight: var(--tec-font-weight-medium);
  }
  .base {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: no-preference) {
    :host(:state(busy)) .base {
      --_spread: calc(3ch + 40px);
      --_base: currentColor;
      --_highlight: light-dark(
        oklch(from currentColor l c h / calc(alpha * 0.2)),
        oklch(from currentColor max(0.8, calc(l + 0.4)) c h / calc(alpha + 0.4))
      );
      background-image: linear-gradient(
        110deg,
        var(--_base) calc(50% - var(--_spread)),
        color-mix(in oklch, var(--_highlight), var(--_base) 50%) calc(50% - var(--_spread) * 0.5),
        var(--_highlight) 50%,
        color-mix(in oklch, var(--_highlight), var(--_base) 50%) calc(50% + var(--_spread) * 0.5),
        var(--_base) calc(50% + var(--_spread))
      );
      background-repeat: no-repeat;
      background-size: calc(200% + var(--_spread) * 2) 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: tec-shimmer 2s linear infinite;
    }
    :host(:state(busy):dir(rtl)) .base {
      animation-direction: reverse;
    }
  }
`

export const attachmentDescriptionStyles = css`
  :host {
    display: block;
    min-width: 0;
    max-width: 100%;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
  :host(:state(error)) {
    color: color-mix(in oklab, var(--tec-destructive) 80%, transparent);
  }
  .base {
    display: block;
    margin-block-start: 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const attachmentActionsStyles = css`
  :host {
    display: flex;
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    align-items: center;
  }
  :host(:state(vertical)) {
    position: absolute;
    top: 0.75rem;
    inset-inline-end: 0.75rem;
    gap: 0.25rem;
  }
`

export const attachmentTriggerStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 10;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    cursor: pointer;
    outline: none;
  }
`

export const attachmentGroupStyles = css`
  :host {
    --_fade-start: 0px;
    --_fade-end: 0px;
    display: block;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 0.25rem;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 var(--_fade-start),
      #000 calc(100% - var(--_fade-end)),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 var(--_fade-start),
      #000 calc(100% - var(--_fade-end)),
      transparent 100%
    );
  }
  :host(:dir(rtl)) {
    -webkit-mask-image: linear-gradient(
      to left,
      transparent 0,
      #000 var(--_fade-start),
      #000 calc(100% - var(--_fade-end)),
      transparent 100%
    );
    mask-image: linear-gradient(
      to left,
      transparent 0,
      #000 var(--_fade-start),
      #000 calc(100% - var(--_fade-end)),
      transparent 100%
    );
  }
  :host(:focus-visible) {
    outline: 2px solid var(--tec-ring);
    outline-offset: -2px;
  }
  .base {
    display: flex;
    gap: 0.75rem;
    padding-block: 0.25rem;
    min-width: 0;
  }
  ::slotted(tec-attachment) {
    flex: none;
    scroll-snap-align: start;
  }
`
