import { css } from "lit"

/*
 * The panel transform is computed from private variables the element sets while swiping and
 * stacking: --_d-move (px, towards the closing edge), --_d-snap (px, snap point offset), --_d-nested
 * (open nested drawers in front), --_d-stack-height (px, height of the front-most nested drawer).
 */
export const drawerStyles = css`
  :host {
    --_modal-exit: 450ms;
    --_d-ease: cubic-bezier(0.22, 1, 0.36, 1);
  }
  .dialog:popover-open {
    display: block;
  }

  .overlay {
    opacity: max(var(--_d-overlay-min, 0), calc(1 - var(--_d-progress, 0)));
  }
  .dialog[data-state="closed"] .overlay {
    opacity: 0;
    pointer-events: none;
  }

  .dialog {
    --_d-progress: 0;
    --_d-overlay-min: 0;
  }
  :host([snap-points]) .dialog {
    --_d-overlay-min: var(--tec-drawer-overlay-min-opacity, 0.5);
  }
  .content {
    /* reset: an outer drawer's values would otherwise inherit into a nested one */
    --_d-move: 0px;
    --_d-snap: 0px;
    --_d-nested: 0;
    --_d-stack-height: 0px;
    --_d-exit-duration: 450ms;
    --_d-scale: calc(1 - var(--_d-nested, 0) * 0.05);
    --_d-shrink: calc(var(--_d-nested, 0) * 0.05);
    --_d-peek: calc(var(--_d-nested, 0) * 1rem);
    --_d-inset: var(--tec-drawer-inset, 0px);
    position: fixed;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    margin: var(--_d-inset);
    min-height: 0;
    background-color: var(--tec-card);
    color: var(--tec-card-foreground);
    border: 0 solid var(--tec-border);
    outline: none;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    will-change: transform;
  }
  /* Bleed: fills the gap behind the panel when it is dragged past its open position. */
  .content::after {
    content: "";
    position: absolute;
    pointer-events: none;
    background-color: var(--tec-drawer-bleed-background, var(--tec-card));
  }

  /* Axis y: sizes to its content, capped below the top of the viewport. */
  .content[data-swipe-axis="y"] {
    left: 0;
    right: 0;
    height: var(--tec-drawer-height, auto);
    max-height: var(--tec-drawer-max-height, calc(100dvh - 6rem));
  }
  :host([snap-points]) .content[data-swipe-axis="y"] {
    height: 100dvh;
    max-height: none;
  }
  .content[data-swipe-axis="y"]::after {
    left: 0;
    right: 0;
    height: 3rem;
  }
  :host(:state(nested-open)) .content[data-swipe-axis="y"] {
    height: var(--_d-stack-height, auto);
  }
  /* Axis x: 75% of the viewport, 24rem from sm. */
  .content[data-swipe-axis="x"] {
    top: 0;
    bottom: 0;
    flex-direction: row;
    width: var(--tec-drawer-width, 75%);
  }
  @media (min-width: 40rem) {
    .content[data-swipe-axis="x"] {
      width: var(--tec-drawer-width, 24rem);
    }
  }
  .content[data-swipe-axis="x"]::after {
    top: 0;
    bottom: 0;
    width: 3rem;
  }

  .content[data-swipe-direction="down"] {
    bottom: 0;
    transform-origin: bottom;
    border-top-width: 1px;
    border-start-start-radius: var(--tec-radius-xl);
    border-start-end-radius: var(--tec-radius-xl);
    --_d-closed: translate3d(0, calc(100% + var(--_d-inset) + 2px), 0);
    transform: translate3d(0, calc(var(--_d-snap, 0px) + var(--_d-move, 0px) - var(--_d-peek) - var(--_d-shrink) * var(--_d-stack-height, 0px)), 0)
      scale(var(--_d-scale));
  }
  .content[data-swipe-direction="down"]::after {
    top: 100%;
  }
  .content[data-swipe-direction="up"] {
    top: 0;
    transform-origin: top;
    border-bottom-width: 1px;
    border-end-start-radius: var(--tec-radius-xl);
    border-end-end-radius: var(--tec-radius-xl);
    --_d-closed: translate3d(0, calc(-100% - var(--_d-inset) - 2px), 0);
    transform: translate3d(0, calc(-1 * (var(--_d-snap, 0px) + var(--_d-move, 0px)) + var(--_d-peek) + var(--_d-shrink) * var(--_d-stack-height, 0px)), 0)
      scale(var(--_d-scale));
  }
  .content[data-swipe-direction="up"]::after {
    bottom: 100%;
  }
  .content[data-swipe-direction="right"] {
    right: 0;
    transform-origin: right;
    border-left-width: 1px;
    border-top-left-radius: var(--tec-radius-xl);
    border-bottom-left-radius: var(--tec-radius-xl);
    --_d-closed: translate3d(calc(100% + var(--_d-inset) + 2px), 0, 0);
    transform: translate3d(calc(var(--_d-move, 0px) - var(--_d-peek) - var(--_d-shrink) * 100%), 0, 0) scale(var(--_d-scale));
  }
  .content[data-swipe-direction="right"]::after {
    left: 100%;
  }
  .content[data-swipe-direction="left"] {
    left: 0;
    transform-origin: left;
    border-right-width: 1px;
    border-top-right-radius: var(--tec-radius-xl);
    border-bottom-right-radius: var(--tec-radius-xl);
    --_d-closed: translate3d(calc(-100% - var(--_d-inset) - 2px), 0, 0);
    transform: translate3d(calc(-1 * var(--_d-move, 0px) + var(--_d-peek) + var(--_d-shrink) * 100%), 0, 0) scale(var(--_d-scale));
  }
  .content[data-swipe-direction="left"]::after {
    right: 100%;
  }
  .dialog[data-state="closed"] .content {
    transform: var(--_d-closed);
  }
  :host(:state(nested-open)) .content {
    overflow: hidden;
    filter: brightness(0.95);
  }

  @media (prefers-reduced-motion: no-preference) {
    .overlay {
      transition: opacity 450ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    .content {
      transition-property: transform, height, opacity, filter;
      transition-duration: 450ms;
      transition-timing-function: var(--_d-ease);
      interpolate-size: allow-keywords;
    }
    .dialog[data-state="closed"] .content,
    .dialog[data-state="closed"] .overlay {
      transition-duration: var(--_d-exit-duration, 450ms);
    }
    .content[data-swiping],
    .dialog:has(.content[data-swiping]) .overlay {
      transition-duration: 0ms;
    }
    @starting-style {
      .dialog[data-state="open"] .content {
        transform: var(--_d-closed);
      }
      .dialog[data-state="open"] .overlay {
        opacity: 0;
      }
    }
  }

  /* The swipe handle (a decorative grab bar). */
  .handle {
    position: relative;
    z-index: 10;
    display: flex;
    flex-shrink: 0;
    cursor: grab;
  }
  .handle:active {
    cursor: grabbing;
  }
  .handle::after {
    content: "";
    display: block;
    flex-shrink: 0;
    border-radius: 9999px;
    background-color: var(--tec-muted);
  }
  .content[data-swipe-axis="y"] .handle {
    width: 100%;
    height: 0.75rem;
    justify-content: center;
  }
  .content[data-swipe-axis="y"] .handle::after {
    width: 100px;
    height: 0.375rem;
  }
  .content[data-swipe-axis="x"] .handle {
    height: 100%;
    width: 0.75rem;
    align-items: center;
  }
  .content[data-swipe-axis="x"] .handle::after {
    width: 0.375rem;
    height: 100px;
  }
  .content[data-swipe-direction="down"] .handle {
    align-items: flex-end;
  }
  .content[data-swipe-direction="up"] .handle {
    order: 1;
    align-items: flex-start;
  }
  .content[data-swipe-direction="left"] .handle {
    order: 1;
    justify-content: flex-start;
  }
  .content[data-swipe-direction="right"] .handle {
    justify-content: flex-end;
  }

  .inner {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: contain;
    border-radius: inherit;
    user-select: text;
    -webkit-user-select: text;
  }
  .content[data-swiping] .inner {
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(nested-open)) .inner,
  :host(:state(nested-open)) .handle {
    opacity: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .inner {
      transition: opacity 300ms cubic-bezier(0.45, 1.005, 0, 1.005);
    }
    .handle {
      transition: opacity 200ms;
    }
  }
`

/* flex shrink-0 flex-col gap-0.5 p-4 pb-0; centred on a vertical drawer; md: gap-1.5 (text-start on a side drawer) */
export const drawerHeaderStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex-shrink: 0;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: inherit;
    flex-wrap: inherit;
    gap: inherit;
    align-items: inherit;
    justify-content: inherit;
    padding: 1rem 1rem 0;
  }
  :host(:state(axis-y)) .base {
    text-align: center;
  }
  @media (min-width: 48rem) {
    :host {
      gap: 0.375rem;
    }
  }
`

/* mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0 (see the sheet footer about the !important). */
export const drawerFooterStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-block-start: var(--tec-drawer-footer-margin, auto) !important;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: inherit;
    flex-wrap: inherit;
    gap: inherit;
    align-items: inherit;
    justify-content: inherit;
    padding: var(--tec-drawer-footer-padding, 0 1rem 1rem);
  }
`

export const drawerTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-foreground);
  }
`

export const drawerDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-wrap: balance;
  }
`
