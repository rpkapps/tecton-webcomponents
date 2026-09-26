import { css } from "lit"

/*
 * A chip looks exactly like a badge with the same `variant` / `appearance` / `size` (the badge
 * variants are duplicated here so the chip family has no dependency on the badge family), plus the
 * interactive states: hover brightening, the focus ring and the selected foreground ring.
 *
 * The host is the grid row (it takes focus); the box is `part="base"` (the grid cell).
 */
export const chipStyles = css`
  :host {
    --_bg: var(--tec-secondary);
    --_fg: var(--tec-secondary-foreground);
    --_border: transparent;
    --_pad: 0.5rem;
    --_pad-icon: 0.375rem;
    --tec-icon-size: 0.75rem;

    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
    width: fit-content;
    height: 1.25rem;
    outline: none;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  .base {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding-block: 0.125rem;
    padding-inline: var(--_pad);
    border: 1px solid var(--_border);
    border-radius: var(--tec-chip-radius, var(--tec-radius-4xl));
    background-color: var(--_bg);
    background-clip: padding-box;
    color: var(--_fg);
    text-decoration: inherit;
    text-underline-offset: var(--_underline-offset, auto);
  }
  :host(:state(has-start)) .base {
    padding-inline-start: var(--_pad-icon);
  }
  :host(:state(has-end)) .base,
  :host(:state(removable)) .base {
    padding-inline-end: var(--_pad-icon);
  }

  ::slotted(svg),
  ::slotted(tec-icon),
  ::slotted([slot="start"]),
  ::slotted([slot="end"]) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
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
    --_pad: 0.625rem;
    --_pad-icon: 0.5rem;
    --tec-icon-size: 1rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }

  /* ---------------------------------------------------------------- variants */
  :host([variant="default"]) {
    --_bg: var(--tec-primary);
    --_fg: var(--tec-primary-foreground);
  }
  :host([variant="default"][appearance="outline"]) {
    --_border: var(--tec-primary);
    --_fg: var(--tec-foreground);
  }
  :host([variant="secondary"][appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-border);
    --_fg: var(--tec-foreground);
  }
  :host([variant="destructive"]) {
    --_bg: var(--tec-destructive-surface);
    --_fg: var(--tec-destructive-surface-foreground);
  }
  :host([variant="success"]) {
    --_bg: var(--tec-success-surface);
    --_fg: var(--tec-success-surface-foreground);
  }
  :host([variant="warning"]) {
    --_bg: var(--tec-warning-surface);
    --_fg: var(--tec-warning-surface-foreground);
  }
  :host([variant="info"]) {
    --_bg: var(--tec-info-surface);
    --_fg: var(--tec-info-surface-foreground);
  }
  :host([variant="destructive"][appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-destructive);
    --_fg: var(--tec-destructive);
  }
  :host([variant="success"][appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-success);
    --_fg: var(--tec-success);
  }
  :host([variant="warning"][appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-warning);
    --_fg: var(--tec-warning);
  }
  :host([variant="info"][appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-info);
    --_fg: var(--tec-info);
  }
  :host([variant="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-border);
    --_fg: var(--tec-foreground);
  }
  :host([variant="ghost"]) {
    --_bg: transparent;
    --_fg: var(--tec-foreground);
  }
  :host([variant="ghost"]:hover) {
    --_bg: var(--tec-accent);
    --_fg: var(--tec-accent-foreground);
  }
  :host([variant="link"]) {
    --_bg: transparent;
    --_fg: var(--tec-primary);
    --_underline-offset: 4px;
  }
  :host([variant="link"]:hover) .base {
    text-decoration-line: underline;
  }

  /* ---------------------------------------------------------------- states */
  :host(:state(interactive):hover) .base {
    filter: brightness(1.1);
  }
  :host(:state(selected)) .base {
    border-color: var(--tec-foreground);
    box-shadow: 0 0 0 1px var(--tec-foreground);
  }
  :host(:focus-visible) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host([disabled]) {
    pointer-events: none;
    opacity: 0.5;
  }

  /* ---------------------------------------------------------------- remove button */
  .remove {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    margin-inline-start: 0.125rem;
    margin-inline-end: -0.25rem;
    border-radius: 9999px;
    opacity: 0.7;
    cursor: pointer;
  }
  .remove:hover {
    opacity: 1;
  }
  .remove:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  .remove svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, filter;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:state(selected)) .base {
      border-color: Highlight;
      outline: 1px solid Highlight;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const chipGroupStyles = css`
  :host {
    display: block;
  }
  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .empty {
    display: contents;
  }
  :host(:state(has-chips)) .empty {
    display: none;
  }
  ::slotted([slot="empty"]) {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
`
