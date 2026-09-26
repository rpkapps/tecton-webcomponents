import { css, unsafeCSS } from "lit"

export const dataTableStyles = css`
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }

  /* ------------------------------------------------------------- toolbar */
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding-block: 1rem;
  }
  .filter {
    box-sizing: border-box;
    width: 100%;
    max-width: var(--tec-data-table-filter-width, 24rem);
    min-width: 0;
    flex: 1 1 12rem;
    height: 2rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background: transparent;
    color: var(--tec-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    outline: none;
  }
  .filter::placeholder {
    color: var(--tec-muted-foreground);
  }
  .filter:hover {
    border-color: var(--tec-input-hover);
  }
  .filter:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .filter::-webkit-search-cancel-button {
    cursor: pointer;
  }
  @media (prefers-reduced-motion: no-preference) {
    .filter {
      transition:
        color var(--tec-duration-fast) var(--tec-ease),
        box-shadow var(--tec-duration-fast) var(--tec-ease);
    }
  }
  .toolbar-end {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-inline-start: auto;
  }
  ::slotted([slot="toolbar"]) {
    flex: none;
  }

  /* ------------------------------------------------------ columns menu */
  .menu {
    box-sizing: border-box;
    min-width: 8rem;
    width: var(--tec-data-table-menu-width, 11rem);
    max-height: var(--tec-popup-available-height, 20rem);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0.25rem;
    border-radius: var(--tec-radius-md);
    background: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow:
      var(--tec-shadow-md),
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent);
    text-align: start;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    outline: none;
  }
  .menu:popover-open {
    display: flex;
    flex-direction: column;
  }
  .menu-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 2rem 0.375rem 0.5rem;
    padding-inline: 0.5rem 2rem;
    border-radius: var(--tec-radius-sm);
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  .menu-item:focus,
  .menu-item:hover {
    background: var(--tec-accent);
    color: var(--tec-accent-foreground);
  }
  .menu-check {
    position: absolute;
    inset-inline-end: 0.5rem;
    display: flex;
    width: 1rem;
    height: 1rem;
    pointer-events: none;
  }
  .menu-check svg {
    width: 1rem;
    height: 1rem;
  }
  .menu-item[aria-checked="false"] .menu-check {
    visibility: hidden;
  }
  @media (forced-colors: active) {
    .menu {
      border: 1px solid CanvasText;
    }
    .menu-item:focus {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  /* ----------------------------------------------------------- table box */
  .container {
    overflow: hidden;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-md);
  }

  /* -------------------------------------------------------------- footer */
  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem 1rem;
    padding-block: 1rem;
    color: var(--tec-muted-foreground);
  }
  .summary {
    flex: 1 1 auto;
    font-variant-numeric: tabular-nums;
  }
  .pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }
  .page-size {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .select {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .select select {
    appearance: none;
    height: 2rem;
    min-width: 4.5rem;
    padding-block: 0;
    padding-inline: 0.625rem 2rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background: transparent;
    color: var(--tec-foreground);
    font-size: var(--tec-text-sm);
    font-variant-numeric: tabular-nums;
    outline: none;
    cursor: pointer;
  }
  .select select:hover {
    border-color: var(--tec-input-hover);
  }
  .select select:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .select option {
    background: var(--tec-popover);
    color: var(--tec-popover-foreground);
  }
  .select svg {
    position: absolute;
    inset-inline-end: 0.5rem;
    width: 1rem;
    height: 1rem;
    color: var(--tec-muted-foreground);
    pointer-events: none;
  }
  .page {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .pager {
    display: inline-flex;
    gap: 0.25rem;
  }
  .pager tec-button svg {
    width: var(--tec-icon-size, 1rem);
    height: var(--tec-icon-size, 1rem);
  }
  .pager tec-button:dir(rtl) svg {
    scale: -1 1;
  }
  @media (forced-colors: active) {
    .filter:focus-visible,
    .select select:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

/*
 * Light-DOM styles of the rendered table's extras (sort buttons, selection column), adopted next to
 * `tec-table`'s. Same two tiers: box properties unlayered with zero specificity (they survive a CSS
 * reset), the rest in `@layer components` (utilities and app CSS win).
 */
const S = "tec-data-table .tec-data-table-sort"

export const dataTableLightStyles = unsafeCSS(`
:where(${S}) {
  margin: 0 -0.5rem;
  padding: 0.25rem 0.5rem;
  border: 0;
}
:where(tec-data-table th[data-align="center"] .tec-data-table-sort) {
  margin: 0;
}
@layer components {
  ${S} {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: calc(100% + 1rem);
    border-radius: var(--tec-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: inherit;
    text-align: inherit;
    white-space: nowrap;
    cursor: pointer;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  ${S}:hover {
    background: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  ${S}:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  ${S} svg {
    width: 0.875rem;
    height: 0.875rem;
    flex: none;
    color: var(--tec-muted-foreground);
  }
  tec-data-table th[aria-sort] .tec-data-table-sort {
    color: var(--tec-foreground);
  }
  tec-data-table th[data-tec-select] {
    width: 2.5rem;
  }
  tec-data-table tbody[data-selectable] > tr:not([data-empty-row]) {
    cursor: default;
  }
  @media (forced-colors: active) {
    ${S}:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
}
`)
