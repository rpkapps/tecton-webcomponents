import { css } from "lit"

/*
 * The Tecton text-field surface for segmented inputs: `.field` is the box (it takes the focus ring
 * while a segment has focus), `.segment`s are the editable parts. Shared with the date pickers.
 * `variant="outline" | "filled" | "text"` like `tec-input`.
 */
export const dateFieldStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    min-width: 0;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    color: var(--tec-foreground);
    --tec-icon-size: 1rem;
  }
  @media (min-width: 48rem) {
    :host {
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
    }
  }

  .field {
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-width: 0;
    height: 2rem;
    padding-block: 0.25rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    cursor: text;
    outline: none;
    white-space: nowrap;
  }
  .field:hover {
    border-color: var(--tec-input-hover);
  }
  .field:focus-within {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .field {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host(:disabled),
  :host([disabled]) {
    cursor: not-allowed;
  }
  :host(:disabled) .field,
  :host([disabled]) .field {
    opacity: 0.5;
    pointer-events: none;
  }

  .input {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    min-width: 0;
    overflow: hidden;
  }
  .segment {
    box-sizing: border-box;
    padding-inline: 0.125rem;
    border-radius: var(--tec-radius-sm);
    caret-color: transparent;
    font-variant-numeric: tabular-nums;
    text-align: end;
    outline: none;
    white-space: pre;
  }
  .segment[data-placeholder] {
    color: var(--tec-muted-foreground);
  }
  .segment:focus {
    background-color: var(--tec-primary);
    color: var(--tec-primary-foreground);
  }
  :host(:dir(rtl)) .segment:not([data-type="dayPeriod"]) {
    unicode-bidi: embed;
    direction: ltr;
  }
  .literal {
    white-space: pre;
  }
  .literal[data-placeholder-literal] {
    color: var(--tec-muted-foreground);
  }

  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    color: var(--tec-muted-foreground);
    pointer-events: none;
  }

  /* ---------------------------------------------------------------- variant="filled" */
  :host([variant="filled"]) .field {
    border-width: 0 0 1px;
    border-bottom-color: var(--tec-border);
    border-radius: var(--tec-radius-md) var(--tec-radius-md) 0 0;
    background-color: var(--tec-muted);
  }
  :host([variant="filled"]) .field:hover {
    border-bottom-color: var(--tec-input-hover);
    background-color: color-mix(in oklch, var(--tec-muted), var(--tec-foreground) 4%);
  }
  :host([variant="filled"]) .field:focus-within {
    border-color: var(--tec-ring);
  }
  :host([variant="filled"]:state(user-invalid)) .field {
    border-color: var(--tec-destructive);
    background-color: color-mix(in oklab, var(--tec-destructive) 20%, transparent);
    box-shadow: none;
  }

  /* ---------------------------------------------------------------- variant="text" */
  :host([variant="text"]) .field {
    border-width: 0 0 1px;
    border-bottom-color: var(--tec-border);
    border-radius: 0;
    padding-inline: 0;
  }
  :host([variant="text"]) .field:hover {
    border-bottom-color: color-mix(in oklab, var(--tec-foreground) 60%, transparent);
  }
  :host([variant="text"]:state(user-invalid)) .field {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .field {
      transition-property: color, box-shadow, border-color, background-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .field {
      border-color: CanvasText;
    }
    .field:focus-within {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    .segment:focus {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
    }
  }
`
