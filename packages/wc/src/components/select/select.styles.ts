import { css } from "lit"

export const selectStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    position: relative;
    width: fit-content;
    height: 2rem;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-foreground);
  }
  :host([size="sm"]) {
    height: 1.75rem;
  }

  /* ------------------------------------------------------------------ trigger */
  .trigger {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    padding-block: 0.25rem;
    padding-inline: 0.5rem 0.375rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-select-radius, var(--tec-radius-md));
    background-color: transparent;
    background-clip: padding-box;
    color: inherit;
    font: inherit;
    white-space: nowrap;
    cursor: default;
    outline: none;
  }
  .trigger:hover {
    border-color: var(--tec-input-hover);
  }
  .trigger:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .trigger[aria-invalid="true"] {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: var(--tec-focus-ring-invalid);
  }
  .trigger[aria-invalid="true"]:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }

  /* filled */
  :host([variant="filled"]) .trigger {
    border-inline-width: 0;
    border-block-start-width: 0;
    border-block-end-color: var(--tec-border);
    border-end-start-radius: 0;
    border-end-end-radius: 0;
    background-color: var(--tec-muted);
  }
  :host([variant="filled"]) .trigger:hover {
    background-color: color-mix(in oklch, var(--tec-muted), var(--tec-foreground) 4%);
  }
  :host([variant="filled"]) .trigger:focus-visible {
    border-color: var(--tec-ring);
  }
  :host([variant="filled"]) .trigger[aria-invalid="true"] {
    border-block-end-color: var(--tec-destructive);
    background-color: color-mix(in oklab, var(--tec-destructive) 20%, transparent);
    box-shadow: none;
  }

  /* text */
  :host([variant="text"]) .trigger {
    border-inline-width: 0;
    border-block-start-width: 0;
    border-block-end-color: var(--tec-border);
    border-radius: 0;
    padding-inline-start: 0;
  }
  :host([variant="text"]) .trigger:hover {
    border-block-end-color: color-mix(in oklab, var(--tec-foreground) 60%, transparent);
  }
  :host([variant="text"]) .trigger:focus-visible {
    border-color: var(--tec-ring);
  }
  :host([variant="text"]) .trigger[aria-invalid="true"] {
    border-block-end-color: var(--tec-destructive);
    box-shadow: none;
  }

  .value {
    display: flex;
    flex: 1 1 0%;
    min-width: 0;
    align-items: center;
    gap: 0.375rem;
    overflow: hidden;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value[data-placeholder] {
    color: var(--tec-muted-foreground);
  }
  .value svg,
  .value tec-icon,
  .trigger svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    pointer-events: none;
  }
  .chevron {
    color: var(--tec-muted-foreground);
  }

  @media (forced-colors: active) {
    .trigger {
      border-color: ButtonText;
    }
    .trigger:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }

  /* ------------------------------------------------------------------ popup */
  .content {
    box-sizing: border-box;
    flex-direction: column;
    width: var(--tec-select-content-width, var(--tec-popup-anchor-width, auto));
    min-width: 9rem;
    max-height: var(--tec-popup-available-height, 24rem);
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
    overflow-x: hidden;
    overflow-y: auto;
    outline: none;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }

  /* search field (searchable) */
  .search-wrapper {
    padding: 0.25rem 0.25rem 0;
  }
  .search {
    display: flex;
    height: 2rem;
    align-items: center;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
  }
  .search:hover {
    border-color: var(--tec-input-hover);
  }
  .search:has(input:focus-visible) {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .search input {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding-inline: 0.375rem 0.5rem;
    font: inherit;
    color: var(--tec-foreground);
  }
  .search input::placeholder {
    color: var(--tec-muted-foreground);
  }
  .search input::-webkit-search-cancel-button {
    display: none;
  }
  .search svg {
    order: -1;
    width: 1rem;
    height: 1rem;
    margin-inline-start: 0.5rem;
    flex-shrink: 0;
    opacity: 0.5;
  }
`
