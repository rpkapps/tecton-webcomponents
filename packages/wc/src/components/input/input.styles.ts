import { css } from "lit"

/**
 * The Tecton text-field surface shared by `tec-input` and `tec-textarea` (`.base` is the native
 * control): `variant="outline" | "filled" | "text"`, hover, focus ring, invalid (`:state(user-invalid)`)
 * and disabled. Font size lives on the host (`text-base`, `text-sm` from 48rem), so a `text-*` /
 * `font-*` class on the element restyles the text.
 */
export const textFieldStyles = css`
  :host {
    min-width: 0;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
  }
  @media (min-width: 48rem) {
    :host {
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
    }
  }

  .base {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin: 0;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-input-radius, var(--tec-radius-md));
    background-color: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    outline: none;
  }
  .base::placeholder {
    color: var(--tec-muted-foreground);
    opacity: 1;
  }
  .base:autofill {
    -webkit-background-clip: text;
    -webkit-text-fill-color: var(--tec-foreground);
    transition:
      background-color 0s 600000s,
      color 0s 600000s;
  }
  .base:hover {
    border-color: var(--tec-input-hover);
  }
  .base:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .base {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host(:disabled),
  :host([disabled]) {
    cursor: not-allowed;
  }
  .base:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* ---------------------------------------------------------------- variant="filled" */
  :host([variant="filled"]) .base {
    border-width: 0 0 1px;
    border-bottom-color: var(--tec-border);
    border-radius: var(--tec-radius-md) var(--tec-radius-md) 0 0;
    background-color: var(--tec-muted);
  }
  :host([variant="filled"]) .base:autofill {
    -webkit-background-clip: border-box;
    box-shadow: inset 0 0 0 1000px var(--tec-muted);
  }
  :host([variant="filled"]) .base:hover {
    border-bottom-color: var(--tec-input-hover);
    background-color: color-mix(in oklch, var(--tec-muted), var(--tec-foreground) 4%);
  }
  :host([variant="filled"]) .base:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host([variant="filled"]:state(user-invalid)) .base {
    border-color: var(--tec-destructive);
    background-color: color-mix(in oklab, var(--tec-destructive) 20%, transparent);
    box-shadow: none;
  }

  /* ---------------------------------------------------------------- variant="text" */
  :host([variant="text"]) .base {
    border-width: 0 0 1px;
    border-bottom-color: var(--tec-border);
    border-radius: 0;
    padding-inline: 0;
  }
  :host([variant="text"]) .base:hover {
    border-bottom-color: color-mix(in oklab, var(--tec-foreground) 60%, transparent);
  }
  :host([variant="text"]) .base:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host([variant="text"]:state(user-invalid)) .base {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, box-shadow, border-color, background-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    :host(:state(user-invalid)) .base {
      border-color: Mark;
      border-width: 2px;
    }
  }
`

export const inputStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 2rem;
  }
  .base {
    display: block;
    height: 100%;
    padding: 0.25rem 0.5rem;
  }
  .base::file-selector-button {
    display: inline-flex;
    height: 1.5rem;
    margin: 0;
    margin-inline-end: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--tec-foreground);
    font: inherit;
    font-size: var(--tec-text-sm);
    font-weight: var(--tec-font-weight-medium);
  }
  .base::-webkit-search-cancel-button {
    cursor: pointer;
  }
`
