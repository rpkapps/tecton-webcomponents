import { css } from "lit"

export const toasterStyles = css`
  :host {
    display: contents;
  }
  .region {
    /* A manual popover: in the top layer, above dialogs; the lists are fixed to the viewport. */
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    overflow: visible;
    color: inherit;
    pointer-events: none;
  }
  .region:not(:popover-open) {
    display: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }

  ol {
    --normal-bg: var(--tec-popover);
    --normal-text: var(--tec-popover-foreground);
    --normal-border: var(--tec-border);
    --border-radius: var(--tec-radius);
    --success-bg: var(--tec-popover);
    --success-text: var(--tec-success);
    --success-border: var(--tec-success);
    --info-bg: var(--tec-popover);
    --info-text: var(--tec-info);
    --info-border: var(--tec-info);
    --warning-bg: var(--tec-popover);
    --warning-text: var(--tec-warning);
    --warning-border: var(--tec-warning);
    --error-bg: var(--tec-popover);
    --error-text: var(--tec-destructive);
    --error-border: var(--tec-destructive);
    position: fixed;
    width: var(--width);
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    list-style: none;
    outline: none;
    pointer-events: auto;
    font-family: var(--tec-font-sans);
  }
  ol[data-x-position="right"] {
    right: var(--offset-right);
  }
  ol[data-x-position="left"] {
    left: var(--offset-left);
  }
  ol[data-x-position="center"] {
    left: 50%;
    transform: translateX(-50%);
  }
  ol[data-y-position="top"] {
    top: var(--offset-top);
  }
  ol[data-y-position="bottom"] {
    bottom: var(--offset-bottom);
  }

  li {
    --y: translateY(100%);
    --lift-amount: calc(var(--lift) * var(--gap));
    z-index: var(--z-index);
    position: absolute;
    opacity: 0;
    transform: var(--y);
    touch-action: none;
    box-sizing: border-box;
    outline: none;
    overflow-wrap: anywhere;
    padding: 16px;
    background: var(--normal-bg);
    border: 1px solid var(--normal-border);
    color: var(--normal-text);
    border-radius: var(--border-radius);
    box-shadow: var(--tec-shadow-lg);
    width: var(--width);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  li:focus-visible {
    box-shadow: var(--tec-shadow-lg), var(--tec-focus-ring);
  }
  li[data-y-position="top"] {
    top: 0;
    --y: translateY(-100%);
    --lift: 1;
    --lift-amount: calc(1 * var(--gap));
  }
  li[data-y-position="bottom"] {
    bottom: 0;
    --y: translateY(100%);
    --lift: -1;
    --lift-amount: calc(var(--lift) * var(--gap));
  }
  li[data-x-position="right"] {
    right: 0;
  }
  li[data-x-position="left"] {
    left: 0;
  }

  [data-description] {
    font-weight: 400;
    line-height: 1.4;
    color: inherit;
  }
  [data-title] {
    font-weight: 500;
    line-height: 1.5;
    color: inherit;
  }
  [data-icon] {
    display: flex;
    position: relative;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    justify-content: flex-start;
    align-items: center;
    margin-inline-start: -3px;
    margin-inline-end: 4px;
  }
  [data-icon] svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  [data-content] {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  [data-button] {
    all: unset;
    box-sizing: border-box;
    border-radius: 4px;
    padding-inline: 8px;
    height: 24px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    color: var(--normal-bg);
    background: var(--normal-text);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  [data-button]:first-of-type {
    margin-inline-start: auto;
  }
  [data-button]:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  [data-cancel] {
    color: var(--normal-text);
    background: light-dark(
      color-mix(in oklab, var(--tec-popover-foreground) 8%, transparent),
      color-mix(in oklab, var(--tec-popover-foreground) 30%, transparent)
    );
  }
  [data-close-button] {
    all: unset;
    box-sizing: border-box;
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    color: var(--normal-text);
    background: var(--normal-bg);
    border: 1px solid var(--normal-border);
    transform: translate(-35%, -35%);
    border-radius: 50%;
    cursor: pointer;
    z-index: 1;
  }
  ol[dir="rtl"] [data-close-button] {
    transform: translate(35%, -35%);
  }
  [data-close-button]:hover {
    background: color-mix(in oklab, var(--normal-bg) 92%, var(--normal-text));
  }
  [data-close-button]:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  [data-close-button] svg {
    width: 12px;
    height: 12px;
  }

  /* Tecton outlined status colours. */
  li[data-type="success"],
  li[data-type="success"] [data-close-button] {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success-text);
  }
  li[data-type="info"],
  li[data-type="info"] [data-close-button] {
    background: var(--info-bg);
    border-color: var(--info-border);
    color: var(--info-text);
  }
  li[data-type="warning"],
  li[data-type="warning"] [data-close-button] {
    background: var(--warning-bg);
    border-color: var(--warning-border);
    color: var(--warning-text);
  }
  li[data-type="error"],
  li[data-type="error"] [data-close-button] {
    background: var(--error-bg);
    border-color: var(--error-border);
    color: var(--error-text);
  }

  /* Swipe hit area. */
  li[data-swiping="true"]::before {
    content: "";
    position: absolute;
    left: -100%;
    right: -100%;
    height: 100%;
    z-index: -1;
  }
  li[data-y-position="top"][data-swiping="true"]::before {
    bottom: 50%;
    transform: scaleY(3) translateY(50%);
  }
  li[data-y-position="bottom"][data-swiping="true"]::before {
    top: 50%;
    transform: scaleY(3) translateY(-50%);
  }
  li[data-swiping="false"][data-removed="true"]::before {
    content: "";
    position: absolute;
    inset: 0;
    transform: scaleY(2);
  }
  /* Bridges the gap between expanded toasts so hovering it keeps them expanded. */
  li[data-expanded="true"]::after {
    content: "";
    position: absolute;
    left: 0;
    height: calc(var(--gap) + 1px);
    bottom: 100%;
    width: 100%;
  }

  /* Stacking. */
  li[data-mounted="true"] {
    --y: translateY(0);
    opacity: 1;
  }
  li[data-expanded="false"][data-front="false"] {
    --scale: var(--toasts-before) * 0.05 + 1;
    --y: translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));
    height: var(--front-toast-height);
  }
  li[data-expanded="false"][data-front="false"] > * {
    opacity: 0;
  }
  li[data-visible="false"] {
    opacity: 0;
    pointer-events: none;
  }
  li[data-mounted="true"][data-expanded="true"] {
    --y: translateY(calc(var(--lift) * var(--offset)));
    height: var(--initial-height);
  }
  li[data-removed="true"][data-front="true"][data-swipe-out="false"] {
    --y: translateY(calc(var(--lift) * -100%));
    opacity: 0;
  }
  li[data-removed="true"][data-front="false"][data-swipe-out="false"][data-expanded="true"] {
    --y: translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));
    opacity: 0;
  }
  li[data-removed="true"][data-front="false"][data-swipe-out="false"][data-expanded="false"] {
    --y: translateY(40%);
    opacity: 0;
  }
  li[data-removed="true"][data-front="false"]::before {
    height: calc(var(--initial-height) + 20%);
  }
  li[data-swiping="true"] {
    transform: var(--y) translateY(var(--swipe-amount-y, 0px)) translateX(var(--swipe-amount-x, 0px));
  }
  li[data-swiped="true"] {
    user-select: none;
    -webkit-user-select: none;
  }
  li[data-swipe-out="true"][data-swipe-direction] {
    opacity: 0;
  }

  /* Loader. */
  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    transform: translate(-50%, -50%);
    transform-origin: center;
  }
  .loader[data-visible="false"] {
    opacity: 0;
    transform: scale(0.8) translate(-50%, -50%);
  }

  @media (prefers-reduced-motion: no-preference) {
    ol {
      transition: transform 400ms ease;
    }
    li {
      transition:
        transform 400ms,
        opacity 400ms,
        height 400ms,
        box-shadow 200ms;
    }
    li > * {
      transition: opacity 400ms;
    }
    li[data-removed="true"][data-front="false"][data-swipe-out="false"][data-expanded="false"] {
      transition:
        transform 500ms,
        opacity 200ms;
    }
    li[data-swiping="true"] {
      transition: none;
    }
    li[data-swipe-out="true"] {
      animation: 200ms ease-out forwards;
    }
    li[data-swipe-out="true"][data-swipe-direction="left"] {
      animation-name: swipe-out-left;
    }
    li[data-swipe-out="true"][data-swipe-direction="right"] {
      animation-name: swipe-out-right;
    }
    li[data-swipe-out="true"][data-swipe-direction="up"] {
      animation-name: swipe-out-up;
    }
    li[data-swipe-out="true"][data-swipe-direction="down"] {
      animation-name: swipe-out-down;
    }
    li[data-promise="true"] [data-icon] > svg {
      opacity: 0;
      transform: scale(0.8);
      animation: toast-fade-in 300ms ease forwards;
    }
    .loader {
      transition:
        opacity 200ms,
        transform 200ms;
    }
    .spin {
      animation: toast-spin 1s linear infinite;
    }
    [data-button],
    [data-close-button] {
      transition:
        opacity 400ms,
        box-shadow 200ms,
        background 200ms;
    }
  }
  @keyframes swipe-out-left {
    from {
      transform: var(--y) translateX(var(--swipe-amount-x));
      opacity: 1;
    }
    to {
      transform: var(--y) translateX(calc(var(--swipe-amount-x) - 100%));
      opacity: 0;
    }
  }
  @keyframes swipe-out-right {
    from {
      transform: var(--y) translateX(var(--swipe-amount-x));
      opacity: 1;
    }
    to {
      transform: var(--y) translateX(calc(var(--swipe-amount-x) + 100%));
      opacity: 0;
    }
  }
  @keyframes swipe-out-up {
    from {
      transform: var(--y) translateY(var(--swipe-amount-y));
      opacity: 1;
    }
    to {
      transform: var(--y) translateY(calc(var(--swipe-amount-y) - 100%));
      opacity: 0;
    }
  }
  @keyframes swipe-out-down {
    from {
      transform: var(--y) translateY(var(--swipe-amount-y));
      opacity: 1;
    }
    to {
      transform: var(--y) translateY(calc(var(--swipe-amount-y) + 100%));
      opacity: 0;
    }
  }
  @keyframes toast-fade-in {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes toast-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 600px) {
    ol {
      right: var(--mobile-offset-right);
      left: var(--mobile-offset-left);
      width: 100%;
    }
    ol[dir="rtl"] {
      left: calc(var(--mobile-offset-left) * -1);
    }
    ol li {
      left: 0;
      right: 0;
      width: calc(100% - var(--mobile-offset-left) * 2);
    }
    ol[data-x-position="left"] {
      left: var(--mobile-offset-left);
    }
    ol[data-y-position="bottom"] {
      bottom: var(--mobile-offset-bottom);
    }
    ol[data-y-position="top"] {
      top: var(--mobile-offset-top);
    }
    ol[data-x-position="center"] {
      left: var(--mobile-offset-left);
      right: var(--mobile-offset-right);
      transform: none;
    }
  }

  @media (forced-colors: active) {
    li {
      border-color: CanvasText;
    }
    li:focus-visible,
    [data-button]:focus-visible,
    [data-close-button]:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
