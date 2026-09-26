import { css } from "lit"

/*
 * The row is the inner base (div, a or button). Flex parameters live on the host and are inherited
 * by the base, so layout utilities on the element (`class="flex-col"`, `gap-4`) still apply.
 */
export const markerStyles = css`
  :host {
    --tec-icon-size: 1rem;
    display: block;
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-muted-foreground);
    text-align: start;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: inherit;
    align-items: inherit;
    justify-content: inherit;
    flex-wrap: inherit;
    gap: inherit;
    width: 100%;
    min-height: 1rem;
    font: inherit;
    color: inherit;
    text-align: inherit;
  }
  a.base {
    cursor: pointer;
    text-decoration-line: underline;
    text-underline-offset: 3px;
  }
  button.base {
    cursor: pointer;
  }
  a.base:hover {
    color: var(--tec-foreground);
  }
  :is(a, button).base:focus-visible {
    border-radius: var(--tec-radius-sm);
    box-shadow: var(--tec-focus-ring);
  }
  .line {
    display: none;
  }
  :host([variant="separator"]) .line {
    display: block;
    flex: 1 1 0%;
    min-width: 0;
    height: 1px;
    background-color: var(--tec-border);
  }
  :host([variant="separator"]) .line.start {
    margin-inline-end: 0.25rem;
  }
  :host([variant="separator"]) .line.end {
    margin-inline-start: 0.25rem;
  }
  :host([variant="border"]) .base {
    padding-block-end: 0.5rem;
    border-block-end: 1px solid var(--tec-border);
  }
  ::slotted(svg) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    :is(a, button).base {
      transition: color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host([variant="separator"]) .line {
      background-color: CanvasText;
    }
    :is(a, button).base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const markerIconStyles = css`
  :host {
    --tec-icon-size: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }
  ::slotted(svg),
  ::slotted(tec-icon),
  ::slotted(tec-spinner) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
`

export const markerContentStyles = css`
  :host {
    display: block;
    min-width: 0;
    overflow-wrap: break-word;
  }
  :host(:state(separator)) {
    flex: none;
    text-align: center;
  }
  ::slotted(a) {
    text-decoration-line: underline;
    text-underline-offset: 3px;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground);
  }
`
