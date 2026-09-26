import { css } from "lit"

export const nativeSelectStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
    width: fit-content;
    min-width: 0;
    height: 2rem;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host(:disabled),
  :host([disabled]) {
    opacity: 0.5;
  }
  .base {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .select {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-width: 0;
    margin: 0;
    padding-block: 0.25rem;
    padding-inline: 0.625rem 2rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    color: inherit;
    font: inherit;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .select:hover {
    border-color: var(--tec-input-hover);
  }
  .select:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .select {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: var(--tec-focus-ring-invalid);
  }
  .select:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }
  option,
  optgroup {
    background-color: Canvas;
    color: CanvasText;
  }
  .icon {
    position: absolute;
    top: 50%;
    inset-inline-end: 0.625rem;
    width: 1rem;
    height: 1rem;
    translate: 0 -50%;
    color: var(--tec-muted-foreground);
    pointer-events: none;
    user-select: none;
  }
  .icon svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  @media (prefers-reduced-motion: no-preference) {
    .select {
      transition-property: color, box-shadow, border-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .select {
      border-color: CanvasText;
    }
    .select:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    .icon {
      color: CanvasText;
    }
  }
`
