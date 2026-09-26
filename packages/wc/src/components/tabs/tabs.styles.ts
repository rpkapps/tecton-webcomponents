import { css } from "lit"

export const tabsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  :host([orientation="vertical"]) {
    flex-direction: row;
  }
`

export const tabsListStyles = css`
  :host {
    display: inline-flex;
    width: fit-content;
    vertical-align: middle;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    height: 2.75rem;
    padding: 0.375rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-card);
    color: var(--tec-muted-foreground);
  }
  :host(:state(vertical)) .base {
    flex-direction: column;
    height: fit-content;
  }
  :host([variant="line"]) .base {
    gap: 0.25rem;
    padding: 0;
    border-radius: 0;
    background-color: transparent;
  }
  :host([variant="line"]:not(:state(vertical))) .base {
    height: 2rem;
  }
  @media (forced-colors: active) {
    .base {
      border: 1px solid CanvasText;
    }
  }
`

export const tabsTriggerStyles = css`
  :host {
    --tec-icon-size: 1rem;
    position: relative;
    display: inline-flex;
    flex: 1 1 0%;
    height: calc(100% - 1px);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  :host(:state(vertical)) {
    width: 100%;
  }
  .base {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid transparent;
    border-radius: var(--tec-radius-md);
    color: var(--tec-link-foreground);
  }
  :host(:hover) .base {
    color: var(--tec-link-hover-foreground);
  }
  :host(:state(selected)) .base {
    color: var(--tec-link-active-foreground);
  }
  :host(:state(selected):not(:state(line))) .base {
    background-color: var(--tec-secondary-active);
    color: var(--tec-secondary-active-foreground);
  }
  :host(:state(vertical)) .base {
    justify-content: flex-start;
  }
  :host(:focus-visible) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host([disabled]) {
    pointer-events: none;
    opacity: 0.5;
  }
  :host(:state(has-start)) .base {
    padding-inline-start: 0.375rem;
  }
  :host(:state(has-end)) .base {
    padding-inline-end: 0.375rem;
  }

  /* Line indicator. */
  .base::after {
    content: "";
    position: absolute;
    opacity: 0;
    background-color: var(--tec-outline-active-border);
    inset-inline: 0;
    bottom: -5px;
    height: 2px;
  }
  :host(:state(vertical)) .base::after {
    inset-inline: auto -0.25rem;
    inset-block: 0;
    width: 2px;
    height: auto;
  }
  :host(:state(line):state(selected)) .base::after {
    opacity: 1;
  }

  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
    .base::after {
      transition: opacity var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host(:state(selected)) .base {
      border-color: Highlight;
    }
    :host(:state(line):state(selected)) .base::after {
      background-color: Highlight;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const tabsContentStyles = css`
  :host {
    display: block;
    flex: 1 1 0%;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    border-radius: var(--tec-radius-md);
    outline: none;
  }
  :host(:not(:state(selected))) {
    display: none;
  }
  :host(:focus-visible) {
    box-shadow: var(--tec-focus-ring);
  }
  @media (forced-colors: active) {
    :host(:focus-visible) {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
