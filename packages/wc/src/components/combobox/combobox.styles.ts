import { css } from "lit"

export const comboboxStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    position: relative;
    min-width: 0;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-foreground);
    --tec-icon-size: 1rem;
  }

  /* ------------------------------------------------------------------ field (input group) */
  .field {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 2rem;
    align-items: center;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-combobox-radius, var(--tec-radius-md));
    background-color: transparent;
    background-clip: padding-box;
    cursor: text;
  }
  .field:hover {
    border-color: var(--tec-input-hover);
  }
  .field:has(input:focus-visible),
  :host([multiple]) .field:focus-within {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .field {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  @media (prefers-reduced-motion: no-preference) {
    .field {
      transition:
        color var(--tec-duration-fast) var(--tec-ease),
        box-shadow var(--tec-duration-fast) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .field {
      border-color: ButtonText;
    }
    .field:focus-within {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }

  input {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 0%;
    min-width: 0;
    height: 100%;
    padding-inline: 0.5rem;
    font: inherit;
    color: inherit;
    cursor: text;
  }
  input::placeholder {
    color: var(--tec-muted-foreground);
  }
  input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  :host(:state(has-start)) input {
    padding-inline-start: 0.375rem;
  }
  :host(:state(has-end-addon)) input {
    padding-inline-end: 0.375rem;
  }

  .start,
  .end {
    display: flex;
    height: auto;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding-block: 0.375rem;
    color: var(--tec-muted-foreground);
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
    -webkit-user-select: none;
  }
  .start {
    order: -1;
    padding-inline-start: 0.5rem;
  }
  .end {
    padding-inline-end: 0.5rem;
    margin-inline-end: -0.25rem;
  }
  :host(:disabled) .start,
  :host(:disabled) .end {
    opacity: 0.5;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }

  .icon-button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--tec-radius-sm);
    color: var(--tec-ghost-foreground);
    cursor: default;
  }
  .icon-button:hover {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  .icon-button:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .icon-button:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .icon-button svg {
    width: 1rem;
    height: 1rem;
    pointer-events: none;
  }
  .trigger svg {
    color: var(--tec-muted-foreground);
  }
  /* The clear and chip-remove crosses are 12px (icon-xs button), the chevron 16px. */
  .clear svg,
  .chip-remove svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  /* ------------------------------------------------------------------ chips (multiple) */
  :host([multiple]) .field {
    height: auto;
    min-height: 2rem;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
  }
  :host([multiple]:state(has-chips)) .field {
    padding-inline: 0.375rem;
  }
  :host([multiple]) input {
    flex: 1 1 0%;
    min-width: 4rem;
    height: 1.375rem;
    padding: 0;
  }
  :host([multiple]) .end {
    padding-inline-end: 0;
  }
  .chips {
    display: contents;
  }
  .chip {
    display: flex;
    height: 1.375rem;
    width: fit-content;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border-radius: var(--tec-radius-sm);
    background-color: var(--tec-muted);
    padding-inline: 0.375rem;
    color: var(--tec-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    cursor: default;
  }
  .chip:has(.chip-remove) {
    padding-inline-end: 0;
  }
  .chip-remove {
    margin-inline-start: -0.25rem;
    opacity: 0.5;
  }
  .chip-remove:hover,
  .chip-remove:focus-visible {
    opacity: 1;
  }
  :host(:disabled) .chip {
    opacity: 0.5;
  }
  @media (forced-colors: active) {
    .chip {
      border: 1px solid CanvasText;
    }
  }

  /* ------------------------------------------------------------------ popup */
  .content {
    box-sizing: border-box;
    flex-direction: column;
    width: var(--tec-combobox-content-width, var(--tec-popup-anchor-width, auto));
    min-width: 9rem;
    max-height: min(18rem, var(--tec-popup-available-height, 18rem));
    overflow: hidden;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
  }
  .content:popover-open {
    display: flex;
  }
  .list {
    flex: 1 1 auto;
    min-height: 0;
    max-height: inherit;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem;
    scroll-padding-block: 0.25rem;
    scrollbar-width: none;
    outline: none;
  }
  .list::-webkit-scrollbar {
    display: none;
  }
  :host(:state(empty)) .list {
    padding: 0;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }
`
