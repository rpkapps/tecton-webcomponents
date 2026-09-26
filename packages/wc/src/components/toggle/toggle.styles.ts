import { css } from "lit"

/*
 * Shared by `tec-toggle` (a native <button> in the shadow root) and `tec-toggle-group-item` (the
 * host is the semantic node). Both render `.base` (part="base") as the box and drive these rules
 * with custom states only — `outline`, `sm`, `lg`, `pressed`, `disabled` — because a group item's
 * effective variant/size come from its group, not from its own attributes.
 *
 * Look (Tecton): link-coloured text, `ghost-hover` background on hover, `ghost-active` when pressed,
 * `outline` adds a `border-subtle` border. Sizes: sm h-7, default h-8, lg h-9 (square minimum width).
 */
export const toggleStyles = css`
  :host {
    --_h: 2rem;
    --_pad: 0.5rem;
    --_pad-icon: 0.375rem;
    --_border-w: 0px;
    --tec-icon-size: 1rem;

    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
    position: relative;
    height: var(--_h);
    min-width: var(--_h);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(sm)) {
    --_h: 1.75rem;
  }
  :host(:state(lg)) {
    --_h: 2.25rem;
    --_pad: 0.625rem;
    --_pad-icon: 0.5rem;
  }
  :host(:state(outline)) {
    --_border-w: 1px;
  }
  :host(:state(disabled)) {
    opacity: 0.5;
    pointer-events: none;
  }

  .base {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-width: 0;
    width: 100%;
    height: 100%;
    padding-inline: var(--_pad);
    border: var(--_border-w) solid var(--tec-border-subtle);
    border-radius: var(--tec-toggle-radius, var(--tec-radius-md));
    background-color: transparent;
    color: var(--tec-link-foreground);
    font: inherit;
    cursor: inherit;
    outline: none;
  }
  :host(:state(has-start)) .base {
    padding-inline-start: var(--_pad-icon);
  }
  :host(:state(has-end)) .base {
    padding-inline-end: var(--_pad-icon);
  }

  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }

  :host(:state(pressed)) .base {
    background-color: var(--tec-ghost-active);
    color: var(--tec-ghost-active-foreground);
  }
  /* As in the spec, hover wins over the pressed colours. */
  :host(:hover) .base {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  :host(:state(focus-visible)) .base,
  :host(:focus-visible) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:focus-visible) {
    outline: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host(:state(outline)) .base {
      border-color: ButtonText;
    }
    :host(:state(pressed)) .base {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    :host(:state(focus-visible)) .base,
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
