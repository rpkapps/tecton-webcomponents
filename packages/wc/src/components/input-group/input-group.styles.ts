import { css } from "lit"

export const inputGroupStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    min-width: 0;
    height: 2rem;
  }
  :host(:state(block)),
  :host(:state(has-textarea)) {
    height: auto;
  }
  .base {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-input-group-radius, var(--tec-radius-md));
    outline: none;
  }
  /* The corner properties a button group sets on the group must not reach the slotted addons' buttons. */
  slot {
    --tec-button-radius: initial;
    --tec-input-radius: initial;
    --tec-textarea-radius: initial;
    --tec-input-group-radius: initial;
    --tec-select-radius: initial;
  }
  :host(:state(block)) .base {
    flex-direction: column;
  }
  :host(:hover) .base {
    border-color: var(--tec-input-hover);
  }
  :host(:state(focused)) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(invalid)) .base {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host([disabled]) ::slotted(tec-input-group-addon) {
    opacity: 0.5;
  }

  /* Padding of the input next to the addons (read by tec-input-group-input). */
  :host(:state(has-inline-start)) ::slotted(tec-input-group-input) {
    --_tec-igi-pis: 0.375rem;
  }
  :host(:state(has-inline-end)) ::slotted(tec-input-group-input) {
    --_tec-igi-pie: 0.375rem;
  }
  :host(:state(has-block-end)) ::slotted(tec-input-group-input) {
    --_tec-igi-pbs: 0.75rem;
  }
  :host(:state(has-block-start)) ::slotted(tec-input-group-input) {
    --_tec-igi-pbe: 0.75rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, box-shadow, border-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:state(focused)) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const inputGroupAddonStyles = css`
  :host {
    display: flex;
    order: -9999;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-muted-foreground);
    cursor: text;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(inline-end)),
  :host(:state(block-end)) {
    order: 9999;
  }
  :host(:state(block-start)),
  :host(:state(block-end)) {
    width: 100%;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: auto;
    padding-block: 0.375rem;
  }
  :host(:state(inline-start)) .base {
    padding-inline-start: 0.5rem;
  }
  :host(:state(inline-start):state(has-button)) .base {
    padding-inline-start: 0.25rem;
  }
  :host(:state(inline-start):state(has-kbd)) .base {
    padding-inline-start: 0.35rem;
  }
  :host(:state(inline-end)) .base {
    padding-inline-end: 0.5rem;
  }
  :host(:state(inline-end):state(has-button)) .base {
    padding-inline-end: 0.25rem;
  }
  :host(:state(inline-end):state(has-kbd)) .base {
    padding-inline-end: 0.35rem;
  }
  :host(:state(block-start)) .base,
  :host(:state(block-end)) .base {
    justify-content: flex-start;
    padding-inline: 0.625rem;
  }
  :host(:state(block-start)) .base {
    padding-top: 0.5rem;
  }
  :host(:state(block-start).border-b) .base {
    padding-bottom: 0.5rem;
  }
  :host(:state(block-end)) .base {
    padding-bottom: 0.5rem;
  }
  :host(:state(block-end).border-t) .base {
    padding-top: 0.5rem;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  ::slotted(kbd) {
    border-radius: var(--tec-radius-sm);
  }
`

export const inputGroupTextStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-muted-foreground);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    pointer-events: none;
  }
`

export const inputGroupControlStyles = css`
  :host {
    flex: 1 1 0%;
  }
  .base,
  .base:hover,
  .base:focus-visible,
  :host(:state(user-invalid)) .base {
    border: 0;
    border-radius: 0;
    background-color: transparent;
    box-shadow: none;
  }
`

export const inputGroupInputStyles = css`
  .base {
    padding-block: var(--_tec-igi-pbs, 0.25rem) var(--_tec-igi-pbe, 0.25rem);
    padding-inline: var(--_tec-igi-pis, 0.5rem) var(--_tec-igi-pie, 0.5rem);
  }
`

export const inputGroupTextareaStyles = css`
  :host {
    width: 100%;
  }
  .base {
    padding-block: 0.5rem;
    resize: none;
  }
`

/*
 * The input group button is the default-size button with its own size axis (the button's own xs/sm
 * sizes do not apply): xs = 1.5rem, sm = 2rem, icon-xs = 1.5rem square, icon-sm = 2rem square.
 */
export const inputGroupButtonStyles = css`
  :host,
  :host([size]) {
    height: 2rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    --_gap: 0.5rem;
    --_pad: 0.5rem;
    --_pad-icon: 0.375rem;
    --_radius: var(--tec-radius-md);
    --tec-icon-size: 1rem;
  }
  :host([size="xs"]) {
    height: 1.5rem;
    --_gap: 0.25rem;
    --_radius: var(--tec-radius-sm);
    --_pad: 0.375rem;
    --tec-icon-size: 0.875rem;
  }
  :host([size="icon-xs"]),
  :host([size="icon-sm"]) {
    --_pad: 0;
    --_pad-icon: 0;
  }
  :host([size="icon-xs"]) {
    width: 1.5rem;
    height: 1.5rem;
    --_radius: var(--tec-radius-sm);
  }
  :host([size="icon-sm"]) {
    width: 2rem;
    height: 2rem;
  }
`
