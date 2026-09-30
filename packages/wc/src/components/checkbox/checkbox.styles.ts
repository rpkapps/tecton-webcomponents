import { css } from "lit"

export const checkboxStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    color: var(--tec-foreground);
    font-family: var(--tec-font-sans);
  }
  :host([disabled]),
  :host(:disabled) {
    opacity: 0.5;
  }

  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    cursor: inherit;
  }

  .control {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }
  /* Larger hit area (after:-inset-x-3 after:-inset-y-2). */
  .control::after {
    content: "";
    position: absolute;
    inset: -0.5rem -0.75rem;
  }

  .input {
    appearance: none;
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    border: 1px solid var(--tec-ghost-foreground);
    border-radius: 2px;
    background: transparent;
    outline: none;
    cursor: inherit;
  }
  .input:hover {
    border-color: var(--tec-ghost-hover-foreground);
  }
  :host(:state(checked)) .input {
    border-color: var(--tec-filled-active);
    background-color: var(--tec-filled-active);
  }
  :host(:state(checked)) .input:hover {
    border-color: var(--tec-filled-hover);
    background-color: var(--tec-filled-hover);
  }
  :host(:state(checked)) .input:active {
    border-color: var(--tec-filled-pressed);
    background-color: var(--tec-filled-pressed);
  }
  .input:focus-visible,
  :host(:state(checked)) .input:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .input[aria-invalid="true"],
  :host(:state(checked)) .input[aria-invalid="true"] {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host([disabled]) .input,
  :host(:disabled) .input {
    cursor: not-allowed;
  }

  .indicator {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    z-index: 2;
    color: var(--tec-ghost-foreground);
    pointer-events: none;
  }
  :host(:state(checked)) .indicator {
    color: var(--tec-background);
  }
  .indicator svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .label {
    font-size: var(--tec-text-sm);
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
    -webkit-user-select: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .input {
      transition-property: color, box-shadow, border-color, background-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .input {
      border-color: CanvasText;
    }
    :host(:state(checked)) .input,
    :host(:state(checked)) .input:hover,
    :host(:state(checked)) .input:active {
      background-color: Highlight;
      border-color: Highlight;
    }
    :host(:state(checked)) .indicator {
      color: HighlightText;
    }
    .input:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
