import { css } from "lit"

export const radioGroupStyles = css`
  :host {
    display: block;
    width: 100%;
  }
  .base {
    display: grid;
    gap: var(--tec-radio-group-gap, 0.75rem);
  }
  :host([orientation="horizontal"]) .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--tec-radio-group-gap, 1.5rem);
  }
`

/*
 * The circle: 16px, 1px `link-foreground` border; hover `link-hover-foreground`; checked
 * `link-active-foreground` border and 8px dot; keyboard focus: `ring` border + 2px ring; invalid:
 * destructive border + destructive/20 ring; disabled: 50% opacity.
 */
export const radioGroupItemStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    position: relative;
    flex-shrink: 0;
    width: fit-content;
    color: var(--tec-foreground);
    font-family: var(--tec-font-sans);
    outline: none;
    cursor: default;
  }
  :host(:state(disabled)) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
  }

  .control {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--tec-link-foreground);
    border-radius: 9999px;
    color: var(--tec-link-foreground);
  }
  /* Larger hit area (after:-inset-x-3 after:-inset-y-2). */
  .control::after {
    content: "";
    position: absolute;
    inset: -0.5rem -0.75rem;
  }
  :host(:state(checked)) .control {
    border-color: var(--tec-link-active-foreground);
    color: var(--tec-link-active-foreground);
  }
  /* As in the spec, the hover border wins over the checked one. */
  :host(:hover) .control {
    border-color: var(--tec-link-hover-foreground);
  }
  :host(:focus-visible) .control {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .control {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }

  .indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background-color: currentColor;
    transform: translate(-50%, -50%);
    visibility: hidden;
  }
  :host(:state(checked)) .indicator {
    visibility: visible;
  }

  .label {
    font-size: var(--tec-text-sm);
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
    -webkit-user-select: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .control {
      transition-property: color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .control {
      border-color: CanvasText;
      color: CanvasText;
    }
    :host(:state(checked)) .control {
      border-color: Highlight;
      color: Highlight;
    }
    :host(:focus-visible) .control {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    :host(:state(disabled)) .control {
      border-color: GrayText;
      color: GrayText;
    }
  }
`
