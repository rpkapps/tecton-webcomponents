import { css } from "lit"

/** The row (`tec-overflow`, `tec-toolbar` and the rows built on them). The host is the flex line. */
export const overflowStyles = css`
  :host {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--tec-overflow-gap, 0.5rem);
    min-width: 0;
    flex-wrap: wrap;
  }
  :host([last-resort="scroll"]) {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
    align-items: stretch;
    flex-wrap: nowrap;
    min-height: 0;
    overflow-x: visible;
    overflow-y: auto;
  }
  /* Measures the space the row has, independent of what the row currently wraps to. */
  .sizer {
    position: absolute;
    inset-inline: 0;
    top: 0;
    height: 0;
    visibility: hidden;
    pointer-events: none;
  }
  :host([orientation="vertical"]) .sizer {
    inset-inline: 0 auto;
    inset-block: 0;
    width: 0;
    height: auto;
  }
  .menu-wrap {
    display: contents;
  }
  .menu {
    position: relative;
    display: none;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }
  :host(:state(overflowing)) .menu {
    display: flex;
  }
  :host([last-resort="scroll"]:state(overflowing)) .menu {
    position: sticky;
    inset-inline-end: 0;
  }
  .badge {
    position: absolute;
    top: -0.25rem;
    inset-inline-end: -0.25rem;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1rem;
    min-width: 1rem;
    padding-inline: 0.25rem;
    border-radius: 9999px;
    background: var(--tec-primary);
    color: var(--tec-primary-foreground);
    box-shadow: 0 0 0 2px var(--tec-background);
    font-size: 0.625rem;
    line-height: 1;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
`

/** The More menu and its submenu (the Tecton dropdown menu look). */
export const overflowMenuStyles = css`
  .menu-content {
    box-sizing: border-box;
    min-width: 10rem;
    max-height: var(--tec-popup-available-height, 24rem);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0.25rem;
    border-radius: var(--tec-radius-md);
    background: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    outline: none;
  }
  .menu-content:popover-open {
    display: block;
  }
  .submenu {
    min-width: 6rem;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-lg);
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--tec-radius-sm);
    cursor: default;
    user-select: none;
    outline: none;
  }
  .item[data-checkable] {
    padding-inline-end: 2rem;
  }
  .item:focus,
  .item[data-open] {
    background: var(--tec-accent);
    color: var(--tec-accent-foreground);
  }
  .item[data-variant="destructive"] {
    color: var(--tec-destructive);
  }
  .item[data-variant="destructive"]:focus {
    background: light-dark(
      color-mix(in oklab, var(--tec-destructive) 10%, transparent),
      color-mix(in oklab, var(--tec-destructive) 20%, transparent)
    );
    color: var(--tec-destructive);
  }
  .item[aria-disabled="true"] {
    opacity: 0.5;
    pointer-events: none;
  }
  .item > svg,
  .item > tec-icon,
  .item > img,
  .item > [data-icon],
  .item .indicator svg,
  .item .chevron svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    pointer-events: none;
  }
  .item-label {
    flex: 1 1 auto;
    min-width: 0;
  }
  .shortcut {
    margin-inline-start: auto;
    font-size: var(--tec-text-xs);
    letter-spacing: 0.1em;
    color: var(--tec-muted-foreground);
  }
  .item:focus .shortcut {
    color: var(--tec-accent-foreground);
  }
  .indicator {
    position: absolute;
    inset-inline-end: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .chevron {
    display: flex;
    margin-inline-start: auto;
  }
  .chevron:dir(rtl) {
    transform: scaleX(-1);
  }
  .label {
    padding: 0.375rem 0.5rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: 500;
    color: var(--tec-muted-foreground);
  }
  .separator {
    height: 1px;
    margin: 0.25rem -0.25rem;
    background: var(--tec-border);
  }
  @media (forced-colors: active) {
    .menu-content {
      border: 1px solid CanvasText;
    }
    .item:focus {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
`

/** `tec-overflow-item`: layout only; the control is the child. */
export const overflowItemStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
  :host(:state(overflowing)) {
    display: none !important;
  }
  :host(:state(dialog-open)) {
    display: contents !important;
  }
  :host([elastic]) {
    flex: 1 1 0%;
    min-width: var(--tec-overflow-item-min, 12rem);
    max-width: var(--tec-overflow-item-max, 100%);
  }
  :host([elastic]) ::slotted(*) {
    width: 100%;
  }
  .tooltip {
    box-sizing: border-box;
    width: fit-content;
    max-width: 20rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--tec-radius-md);
    background: var(--tec-foreground);
    color: var(--tec-background);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    text-align: start;
    pointer-events: none;
  }
  .tooltip:popover-open {
    display: inline-flex;
    align-items: center;
  }
  .arrow {
    position: absolute;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 2px;
    background: var(--tec-foreground);
    transform: rotate(45deg);
    z-index: -1;
  }
  .tooltip[data-side="top"] .arrow {
    bottom: -0.3125rem;
  }
  .tooltip[data-side="bottom"] .arrow {
    top: -0.3125rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tooltip:popover-open {
      animation: tec-overflow-tip var(--tec-duration-fast, 100ms) var(--tec-ease-out, ease-out);
    }
  }
  @keyframes tec-overflow-tip {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
  }
  @media (forced-colors: active) {
    .tooltip {
      border: 1px solid CanvasText;
    }
  }
  .dialog {
    box-sizing: border-box;
    display: none;
    width: 100%;
    max-width: min(24rem, calc(100% - 2rem));
    margin: auto;
    padding: 1.5rem;
    border: 0;
    border-radius: var(--tec-radius-xl);
    background: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
  }
  .dialog[open] {
    display: grid;
    gap: 1.5rem;
  }
  .dialog::backdrop {
    background: oklch(0% 0 0 / 0.1);
    backdrop-filter: blur(4px);
  }
  .dialog-title {
    margin: 0;
    padding-inline-end: 2rem;
    font-size: var(--tec-text-base);
    line-height: 1;
    font-weight: 500;
  }
  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dialog-body ::slotted(*) {
    width: 100%;
  }
  .dialog-close {
    position: absolute;
    top: 1rem;
    inset-inline-end: 1rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .dialog[open] {
      animation: tec-overflow-tip var(--tec-duration-fast, 100ms) var(--tec-ease-out, ease-out);
    }
  }
  @media (forced-colors: active) {
    .dialog {
      border: 1px solid CanvasText;
    }
  }
`

export const overflowLabelStyles = css`
  :host {
    display: contents;
  }
  :host(:state(compact)) .base {
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
`

export const overflowGroupStyles = css`
  :host {
    display: contents;
  }
`

export const overflowDividerStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-self: center;
  }
  :host(:state(overflowing)) {
    display: none !important;
  }
  .base {
    width: 1px;
    height: 1rem;
    background: var(--tec-border);
  }
  :host(:state(vertical)) .base {
    width: 1rem;
    height: 1px;
  }
  @media (forced-colors: active) {
    .base {
      background: CanvasText;
    }
  }
`

export const overflowSpacerStyles = css`
  :host {
    display: block;
    flex: 1 1 0%;
    min-width: 0;
    min-height: 0;
  }
  :host(:state(overflowing)) {
    display: none !important;
  }
`
