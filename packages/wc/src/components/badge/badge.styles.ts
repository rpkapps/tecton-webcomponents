import { css } from "lit"

/*
 * Badge styles, shared with every element that looks like a badge (`tec-chip` includes
 * `badgeStyles` and renders the same `.base` part).
 *
 * Contract for reuse:
 * - the host reflects `variant`, `appearance` and `size`;
 * - the shadow root renders one `.base` element (the box) containing the slots;
 * - hover colours apply to an `<a class="base">` or to a `.base` carrying `data-interactive`;
 * - the custom states `has-start` / `has-end` trim the padding next to an icon.
 *
 * Each variant sets private custom properties only; the rules at the end read them.
 */
export const badgeStyles = css`
  :host {
    --_bg: var(--tec-primary);
    --_fg: var(--tec-primary-foreground);
    --_border: transparent;
    --_bg-hover: color-mix(in oklch, var(--tec-primary), var(--tec-foreground) 12%);
    --_fg-hover: var(--_fg);
    --_ring: var(--tec-ring);
    --_ring-shadow: var(--tec-focus-ring);
    --_pad: 0.5rem;
    --_pad-icon: 0.375rem;
    --tec-icon-size: 0.75rem;

    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
    width: fit-content;
    max-width: 100%;
    height: 1.25rem;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
  }

  .base {
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-width: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding-block: 0;
    padding-inline: var(--_pad);
    border: 1px solid var(--_border);
    border-radius: var(--tec-badge-radius, var(--tec-radius-4xl));
    background-color: var(--_bg);
    color: var(--_fg);
    font: inherit;
    text-decoration: none;
    text-underline-offset: var(--_underline-offset, auto);
    outline: none;
  }
  :host(:state(has-start)) .base {
    padding-inline-start: var(--_pad-icon);
  }
  :host(:state(has-end)) .base {
    padding-inline-end: var(--_pad-icon);
  }

  ::slotted(svg),
  ::slotted(tec-icon),
  ::slotted(tec-spinner) {
    width: var(--tec-icon-size) !important;
    height: var(--tec-icon-size) !important;
    flex-shrink: 0;
    pointer-events: none;
  }

  /* ---------------------------------------------------------------- sizes */
  :host([size="md"]) {
    height: 1.5rem;
    --tec-icon-size: 0.875rem;
  }
  :host([size="lg"]) {
    height: 1.75rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    --_pad: 0.625rem;
    --_pad-icon: 0.5rem;
    --tec-icon-size: 1rem;
  }

  /* ---------------------------------------------------------------- variants */
  :host([appearance="outline"]) {
    --_border: var(--tec-primary);
    --_bg: transparent;
    --_fg: var(--tec-foreground);
    --_bg-hover: color-mix(in oklab, var(--tec-primary) 15%, transparent);
  }
  :host([variant="secondary"]) {
    --_bg: var(--tec-secondary);
    --_fg: var(--tec-secondary-foreground);
    --_bg-hover: color-mix(in oklch, var(--tec-secondary), var(--tec-foreground) 8%);
  }
  :host([variant="secondary"][appearance="outline"]) {
    --_border: var(--tec-border);
    --_bg: transparent;
    --_fg: var(--tec-foreground);
    --_bg-hover: var(--tec-accent);
  }
  :host([variant="outline"]) {
    --_border: var(--tec-border);
    --_bg: transparent;
    --_fg: var(--tec-foreground);
    --_bg-hover: var(--tec-accent);
    --_fg-hover: var(--tec-accent-foreground);
  }
  :host([variant="ghost"]) {
    --_border: transparent;
    --_bg: transparent;
    --_fg: var(--tec-foreground);
    --_bg-hover: var(--tec-accent);
    --_fg-hover: var(--tec-accent-foreground);
  }
  :host([variant="link"]) {
    --_border: transparent;
    --_bg: transparent;
    --_fg: var(--tec-primary);
    --_bg-hover: transparent;
    --_underline-offset: 4px;
  }
  :host([variant="destructive"]) {
    --_bg: var(--tec-destructive-surface);
    --_fg: var(--tec-destructive-surface-foreground);
    --_bg-hover: color-mix(in oklab, var(--tec-destructive-surface) 80%, transparent);
    --_ring-shadow: 0 0 0 2px color-mix(in oklab, var(--tec-destructive) 40%, transparent);
  }
  :host([variant="success"]) {
    --_bg: var(--tec-success-surface);
    --_fg: var(--tec-success-surface-foreground);
    --_bg-hover: color-mix(in oklab, var(--tec-success-surface) 80%, transparent);
  }
  :host([variant="warning"]) {
    --_bg: var(--tec-warning-surface);
    --_fg: var(--tec-warning-surface-foreground);
    --_bg-hover: color-mix(in oklab, var(--tec-warning-surface) 80%, transparent);
  }
  :host([variant="info"]) {
    --_bg: var(--tec-info-surface);
    --_fg: var(--tec-info-surface-foreground);
    --_bg-hover: color-mix(in oklab, var(--tec-info-surface) 80%, transparent);
  }
  :host([variant="destructive"][appearance="outline"]) {
    --_border: var(--tec-destructive);
    --_bg: transparent;
    --_fg: var(--tec-destructive);
    --_bg-hover: color-mix(in oklab, var(--tec-destructive) 10%, transparent);
  }
  :host([variant="success"][appearance="outline"]) {
    --_border: var(--tec-success);
    --_bg: transparent;
    --_fg: var(--tec-success);
    --_bg-hover: color-mix(in oklab, var(--tec-success) 10%, transparent);
  }
  :host([variant="warning"][appearance="outline"]) {
    --_border: var(--tec-warning);
    --_bg: transparent;
    --_fg: var(--tec-warning);
    --_bg-hover: color-mix(in oklab, var(--tec-warning) 10%, transparent);
  }
  :host([variant="info"][appearance="outline"]) {
    --_border: var(--tec-info);
    --_bg: transparent;
    --_fg: var(--tec-info);
    --_bg-hover: color-mix(in oklab, var(--tec-info) 10%, transparent);
  }

  /* ---------------------------------------------------------------- states */
  a.base:hover,
  .base[data-interactive]:hover,
  :host([variant="ghost"]) .base:hover {
    background-color: var(--_bg-hover);
    color: var(--_fg-hover);
  }
  :host([variant="link"]) .base:hover {
    text-decoration-line: underline;
  }
  .base:focus-visible,
  :host(:state(focus-visible)) .base {
    border-color: var(--_ring);
    box-shadow: var(--_ring-shadow);
  }
  :host([aria-invalid="true"]) .base {
    border-color: var(--tec-destructive);
    box-shadow: 0 0 0 2px light-dark(
        color-mix(in oklab, var(--tec-destructive) 20%, transparent),
        color-mix(in oklab, var(--tec-destructive) 40%, transparent)
      );
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, text-decoration-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    a.base {
      border-color: LinkText;
      color: LinkText;
    }
    .base:focus-visible,
    :host(:state(focus-visible)) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
