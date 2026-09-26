import { css, unsafeCSS } from "lit"

/** Shadow styles of `tec-table`: the scroll container around the slotted `<table>`. */
export const tableStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    min-width: 0;
  }
  .base {
    position: relative;
    width: 100%;
    overflow-x: auto;
  }
`

/*
 * Styles of the slotted native table (thead/tbody/tfoot/tr/th/td/caption).
 *
 * The table lives in the light DOM — table parts cannot be split across shadow roots without losing
 * native table semantics — so these rules are adopted once into the document (or the shadow root)
 * that contains the `tec-table` (see `adoptLightStyles`). Two cascade tiers:
 *
 * 1. Box properties that CSS resets zero out (padding, margin, borders) are **unlayered with zero
 *    specificity** (`:where()`): adopted sheets come after the document's sheets, so they beat a reset
 *    such as Tailwind's preflight (`* { padding: 0; border: 0 solid }`, layered or not), yet any
 *    class or element rule of the app (specificity > 0) still overrides them.
 * 2. Everything else sits in `@layer components`: below Tailwind utilities and unlayered app CSS, so
 *    `class="text-right"` or `bg-*` on a cell always wins.
 *
 * Only the direct table (`tec-table > table`) is styled; tables nested in cells are left alone.
 */
const T = "tec-table > table"
const W = (selector: string) => `:where(${selector})`

export const tableLightStyles = unsafeCSS(`
${W(`${T} > caption`)} {
  margin-top: 1rem;
}
${W(`${T} > :is(thead, tbody, tfoot) > tr`)} {
  border: 0 solid var(--tec-border-subtle);
  border-bottom-width: 1px;
}
${W(`${T} > thead > tr, ${T} > :is(tbody, tfoot) > tr:last-child`)} {
  border-bottom-width: 0;
}
${W(`${T} > tfoot`)} {
  border-top-width: 0;
}
${W(`${T} > thead > tr > :is(th, td)`)} {
  padding: 0 1rem;
}
${W(`${T} > :is(tbody, tfoot) > tr > :is(th, td)`)} {
  padding: 0.75rem 1rem;
}
${W(`${T} > * > tr > :is(th, td):has(> tec-checkbox, > [role="checkbox"], > input[type="checkbox"])`)} {
  padding-inline-end: 0;
}
${W(`tec-table[density="compact"] > table > :is(tbody, tfoot) > tr > :is(th, td)`)} {
  padding-block: 0.25rem;
}
@media (forced-colors: active) {
  ${W(`${T} > :is(thead, tbody, tfoot) > tr`)} {
    border-color: CanvasText;
  }
}

@layer components {
  ${T} {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    text-indent: 0;
    caption-side: bottom;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  ${T} > caption {
    text-align: center;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-muted-foreground);
  }

  @media (prefers-reduced-motion: no-preference) {
    ${T} > :is(tbody, tfoot) > tr {
      transition: background-color var(--tec-duration-fast) var(--tec-ease);
    }
  }
  tec-table[striped] > table > tbody > tr:nth-child(even) {
    background-color: var(--tec-surface-alt);
  }
  ${T} > :is(tbody, tfoot) > tr:hover {
    background-color: var(--tec-accent);
  }
  ${T} > :is(tbody, tfoot) > tr:has([aria-expanded="true"]) {
    background-color: color-mix(in oklab, var(--tec-muted) 50%, transparent);
  }
  ${T} > :is(tbody, tfoot) > tr:is([data-state="selected"], [aria-selected="true"]) {
    background-color: var(--tec-table-active);
  }

  /* Footer: muted band, regular weight. */
  ${T} > tfoot {
    background-color: var(--tec-muted);
    color: var(--tec-muted-foreground);
    font-weight: var(--tec-font-weight-normal);
  }

  /* Column headers. */
  ${T} > thead > tr > :is(th, td) {
    height: 3rem;
    background-color: var(--tec-table-header);
    color: var(--tec-muted-foreground);
    font-weight: var(--tec-font-weight-medium);
    text-align: start;
    vertical-align: middle;
    white-space: nowrap;
  }

  /* Cells (row headers look like cells, in medium weight). */
  ${T} > :is(tbody, tfoot) > tr > :is(th, td) {
    text-align: start;
    vertical-align: middle;
    white-space: nowrap;
  }
  ${T} > tbody > tr > th {
    font-weight: var(--tec-font-weight-medium);
  }
  ${T} > tfoot > tr > th {
    font-weight: inherit;
  }
  ${T} > * > tr > :is(th, td)[data-align="end"] {
    text-align: end;
  }
  ${T} > * > tr > :is(th, td)[data-align="center"] {
    text-align: center;
  }

  /* Empty state: one tall centred cell. */
  ${T} > tbody[data-empty] > tr > td {
    height: 6rem;
    text-align: center;
    color: var(--tec-muted-foreground);
  }
  ${T} > tbody[data-empty] > tr:hover {
    background-color: transparent;
  }

  /* Compact density. */
  tec-table[density="compact"] > table {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  tec-table[density="compact"] > table > thead > tr > :is(th, td) {
    height: 2rem;
  }

  @media (forced-colors: active) {
    ${T} > :is(tbody, tfoot) > tr:is([data-state="selected"], [aria-selected="true"]) {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
    }
  }
}
`)
