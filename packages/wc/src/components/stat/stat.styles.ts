import { css } from "lit"

export const statStyles = css`
  /* The host is the layout box (flex column), so layout classes on the element apply. */
  :host {
    --_stat-value: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    min-width: 0;
    text-align: start;
    font-family: var(--tec-font-sans);
  }
  :host([size="sm"]) {
    --_stat-value: 0.875rem;
  }
  :host([size="lg"]) {
    --_stat-value: 1.75rem;
  }
  .base {
    display: contents;
  }
  :host(:state(align-center)) {
    align-items: center;
    text-align: center;
  }
  :host(:state(align-end)) {
    align-items: flex-end;
    text-align: end;
  }
  ::slotted(*) {
    max-width: 100%;
  }
`

export const statLabelStyles = css`
  :host {
    display: block;
    min-width: 0;
    max-width: 100%;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
  .base {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const statValueStyles = css`
  :host {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    font-family: var(--tec-font-mono);
    font-size: var(--tec-stat-value-size, var(--_stat-value, 1.25rem));
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
  }
  .base {
    display: contents;
  }
  .unit {
    font-family: var(--tec-font-sans);
    font-size: 0.6em;
    font-weight: var(--tec-font-weight-normal);
    color: var(--tec-muted-foreground);
  }
`

export const statDeltaStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
    color: var(--tec-muted-foreground);
  }
  :host(:state(positive)) {
    color: var(--tec-success);
  }
  :host(:state(negative)) {
    color: var(--tec-destructive);
  }
  .base {
    display: contents;
  }
  svg {
    width: 0.75rem;
    height: 0.75rem;
  }
`

export const statHelpStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
`

export const statGroupStyles = css`
  /* The host is the grid, so layout classes on the element (gap-*, grid-cols-*) apply. */
  :host {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--tec-stat-group-min-width, 7rem), 1fr));
    column-gap: 1.5rem;
    row-gap: 1rem;
  }
`
