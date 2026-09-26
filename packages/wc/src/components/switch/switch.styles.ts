import { css } from "lit"

/*
 * Track: 34×16px (`sm`: 26×12px), 1px border, fully rounded. Off: transparent with an
 * `outline-foreground` border and thumb. On: `primary-active` fill with a `primary-foreground` thumb
 * that travels 18px (`sm`: 14px) — mirrored in RTL.
 */
export const switchStyles = css`
  :host {
    --_track-w: 34px;
    --_track-h: 1rem;
    --_thumb: 0.625rem;
    --_travel: 18px;

    display: inline-flex;
    vertical-align: middle;
    color: var(--tec-foreground);
    font-family: var(--tec-font-sans);
  }
  :host([size="sm"]) {
    --_track-w: 26px;
    --_track-h: 0.75rem;
    --_thumb: 0.375rem;
    --_travel: 14px;
  }
  :host(:dir(rtl)) {
    --_dir: -1;
  }
  :host([disabled]),
  :host(:disabled) {
    opacity: 0.5;
  }

  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: inherit;
  }

  .track {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    width: var(--_track-w);
    height: var(--_track-h);
    border: 1px solid var(--tec-outline-foreground);
    border-radius: 9999px;
    background-color: transparent;
    outline: none;
  }
  /* Larger hit area (after:-inset-x-3 after:-inset-y-2). */
  .track::after {
    content: "";
    position: absolute;
    inset: -0.5rem -0.75rem;
  }
  :host(:state(checked)) .track {
    border-color: var(--tec-primary-active);
    background-color: var(--tec-primary-active);
  }
  :host(:state(focus-visible)) .track {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .track {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }

  .input {
    appearance: none;
    position: absolute;
    z-index: 1;
    inset: -0.5rem -0.75rem;
    width: auto;
    height: auto;
    margin: 0;
    border: 0;
    opacity: 0;
    cursor: inherit;
  }
  :host([disabled]) .input,
  :host(:disabled) .input {
    cursor: not-allowed;
  }

  .thumb {
    display: block;
    width: var(--_thumb);
    height: var(--_thumb);
    margin-inline-start: 0.125rem;
    border-radius: 9999px;
    background-color: var(--tec-outline-foreground);
    pointer-events: none;
  }
  :host(:state(checked)) .thumb {
    background-color: var(--tec-primary-foreground);
    transform: translateX(calc(var(--_travel) * var(--_dir, 1)));
  }

  .label {
    font-size: var(--tec-text-sm);
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
    -webkit-user-select: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .track {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
    .thumb {
      transition-property: transform, background-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .track {
      border-color: CanvasText;
    }
    .thumb {
      background-color: CanvasText;
    }
    :host(:state(checked)) .track {
      border-color: Highlight;
      background-color: Highlight;
    }
    :host(:state(checked)) .thumb {
      background-color: HighlightText;
    }
    :host(:state(focus-visible)) .track {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`
