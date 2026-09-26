import { css } from "lit"

/*
 * Private custom properties shared down the tree:
 *   --_tec-acc-radius   corner radius of the group (inherited by items / triggers)
 *   --_tec-acc-pad      inline padding of triggers and content
 *   --_tec-acc-rt/-rb   top / bottom radius of the item a trigger belongs to (first / last item)
 */

export const accordionStyles = css`
  :host {
    --_tec-acc-radius: var(--tec-accordion-radius, var(--tec-radius-md));
    --_tec-acc-pad: var(--tec-accordion-padding-inline, 0.5rem);
    display: block;
    width: 100%;
  }
  :host([variant="outline"]) {
    --_tec-acc-radius: var(--tec-accordion-radius, var(--tec-radius-lg));
    --_tec-acc-pad: var(--tec-accordion-padding-inline, 1rem);
  }
  .base {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: var(--_tec-acc-radius);
  }
  :host([variant="outline"]) .base {
    border: 1px solid var(--tec-border);
  }
  @media (forced-colors: active) {
    :host([variant="outline"]) .base {
      border-color: CanvasText;
    }
  }
`

export const accordionItemStyles = css`
  :host {
    --_tec-acc-rt: 0px;
    --_tec-acc-rb: 0px;
    display: block;
  }
  :host(:state(first)) {
    --_tec-acc-rt: var(--_tec-acc-radius, var(--tec-radius-md));
  }
  :host(:state(last)) {
    --_tec-acc-rb: var(--_tec-acc-radius, var(--tec-radius-md));
  }
  .base {
    display: block;
    border-radius: var(--_tec-acc-rt) var(--_tec-acc-rt) var(--_tec-acc-rb) var(--_tec-acc-rb);
  }
  :host(:not(:state(last)):not(:state(plain))) .base {
    border-bottom: 1px solid var(--tec-border);
  }
  @media (forced-colors: active) {
    :host(:not(:state(last)):not(:state(plain))) .base {
      border-bottom-color: CanvasText;
    }
  }
`

export const accordionTriggerStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-normal);
  }
  .row {
    position: relative;
    display: grid;
    /* start icon | label | secondary text | actions | chevron */
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    align-items: start;
  }
  :host(:state(has-secondary)) .row {
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr) auto auto;
  }
  .heading {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    grid-row: 1;
    margin: 0;
    font: inherit;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: start;
    width: 100%;
    padding: 0.375rem var(--_tec-acc-pad, 0.5rem);
    border: 1px solid transparent;
    border-radius: var(--_tec-acc-rt, 0px) var(--_tec-acc-rt, 0px) 0 0;
    font: inherit;
    text-align: start;
    color: var(--tec-ghost-foreground);
    background-color: transparent;
    cursor: default;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:not(:state(expanded))) .base {
    border-end-start-radius: var(--_tec-acc-rb, 0px);
    border-end-end-radius: var(--_tec-acc-rb, 0px);
  }
  .base:hover {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  .base:focus-visible {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(expanded)) .base {
    background-color: var(--tec-ghost-active);
    color: var(--tec-ghost-active-foreground);
  }
  .base:active {
    background-color: var(--tec-ghost-pressed);
    color: var(--tec-ghost-pressed-foreground);
  }
  .base:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .start {
    grid-column: 1;
    display: flex;
    align-items: center;
    min-height: var(--tec-text-sm--line-height);
  }
  :host(:state(has-start)) .start {
    margin-inline-end: 0.5rem;
  }
  .label {
    grid-column: 2;
    min-width: 0;
  }
  .secondary {
    grid-column: 3;
    min-width: 0;
    color: var(--tec-muted-foreground);
  }
  :host(:state(has-secondary)) .secondary {
    padding-inline-start: 0.5rem;
  }
  .icon {
    grid-column: 5;
    display: flex;
    color: var(--tec-link-foreground);
    pointer-events: none;
  }
  .icon svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  .actions {
    grid-column: 4;
    grid-row: 1;
    align-self: center;
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  :host(:state(has-actions)) .actions {
    margin-inline: 0.5rem;
  }
  :host(:state(disabled)) .actions {
    opacity: 0.5;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, opacity;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    :host(:state(expanded)) .base {
      border-color: CanvasText;
    }
  }
`

export const accordionContentStyles = css`
  :host {
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-muted-foreground);
  }
  .base {
    padding: 0.375rem var(--_tec-acc-pad, 0.5rem) 0.75rem;
  }
  ::slotted(a) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground);
  }
  ::slotted(p:not(:last-child)) {
    margin-bottom: 1rem;
  }
`
