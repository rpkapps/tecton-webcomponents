import { css } from "lit"

export const linkStyles = css`
  :host {
    --_fg: var(--tec-foreground);
    --_fg-hover: var(--_fg);
    --_fg-pressed: var(--_fg-hover);
    --_decoration: none;
    --_decoration-hover: underline;
    --_decoration-color: currentColor;
    --_decoration-color-hover: currentColor;
    display: inline-flex;
    max-width: 100%;
    vertical-align: baseline;
  }
  :host([variant="primary"]) {
    --_fg: var(--tec-link-foreground);
    --_fg-hover: var(--tec-link-hover-foreground);
    --_fg-pressed: var(--tec-link-pressed-foreground);
  }
  :host([variant="muted"]) {
    --_fg: var(--tec-muted-foreground);
    --_fg-hover: var(--tec-foreground);
  }
  :host([variant="subtle"]) {
    --_decoration: underline;
    --_decoration-color: var(--tec-border);
  }
  :host([size="sm"]) {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host([size="md"]) {
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="lg"]) {
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
  }

  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    border-radius: 0.125rem;
    color: var(--_fg);
    font: inherit;
    text-decoration-line: var(--_decoration);
    text-decoration-color: var(--_decoration-color);
    text-underline-offset: 4px;
    outline: none;
    cursor: pointer;
  }
  .base:hover {
    color: var(--_fg-hover);
    text-decoration-line: var(--_decoration-hover);
    text-decoration-color: var(--_decoration-color-hover);
  }
  .base:active {
    color: var(--_fg-pressed);
  }
  .base:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--tec-ring) 60%, transparent);
  }
  :host([disabled]) {
    pointer-events: none;
    opacity: 0.5;
  }
  :host([disabled]) .base {
    cursor: default;
  }
  .external,
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 0.85em;
    height: 0.85em;
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: color var(--tec-duration) var(--tec-ease), text-decoration-color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      color: LinkText;
      text-decoration-line: underline;
    }
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    :host([disabled]) .base {
      color: GrayText;
    }
  }
`
