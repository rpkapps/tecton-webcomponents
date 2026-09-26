import { css } from "lit"

/*
 * Calendar look (Tecton): the box is `.base` (padding, background, radius inherited from the host so
 * `class="rounded-lg border"` on the element rounds it). Each day is a `.cell` (the range band,
 * today's tint) holding a `.day` (the ghost icon-button look, the selected fill, the focus ring).
 */
export const calendarStyles = css`
  :host {
    --_cell: var(--tec-calendar-cell-size, 2rem);
    --_radius: var(--tec-calendar-cell-radius, var(--tec-radius-md));
    display: inline-block;
    vertical-align: top;
    width: fit-content;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-foreground);
  }
  /* Inside a card or a popover the calendar takes the surface colour of its container. */
  :host-context(tec-card, tec-popover) {
    --tec-calendar-background: transparent;
  }

  .base {
    box-sizing: border-box;
    width: 100%;
    padding: var(--tec-calendar-padding, 0.75rem);
    background-color: var(--tec-calendar-background, var(--tec-background));
    border-radius: inherit;
    outline: none;
  }

  .months {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  @media (min-width: 768px) {
    .months {
      flex-direction: row;
    }
  }

  .nav {
    position: absolute;
    inset-inline: 0;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    pointer-events: none;
  }
  .nav tec-button {
    width: var(--_cell);
    height: var(--_cell);
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
  }
  .nav tec-button::part(base) {
    padding: 0;
  }
  :host(:dir(rtl)) .nav svg {
    transform: scaleX(-1);
  }

  .month {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .caption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: var(--_cell);
    padding-inline: var(--_cell);
  }
  .heading {
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Month / year dropdowns: the Tecton select trigger look on a native <select>. */
  .select {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .select select {
    appearance: none;
    field-sizing: content;
    box-sizing: border-box;
    height: 2rem;
    min-width: 0;
    margin: 0;
    padding-block: 0.25rem;
    padding-inline: 0.5rem 1.875rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    white-space: nowrap;
    cursor: default;
    outline: none;
  }
  .select select:hover {
    border-color: var(--tec-input-hover);
  }
  .select select:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .select select:disabled {
    opacity: 0.5;
  }
  .select option {
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
  }
  .select svg {
    position: absolute;
    inset-inline-end: 0.375rem;
    width: 1rem;
    height: 1rem;
    color: var(--tec-muted-foreground);
    pointer-events: none;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
  }
  th,
  td {
    padding: 0;
  }
  .weekday {
    border-radius: var(--_radius);
    color: var(--tec-muted-foreground);
    font-size: 0.8rem;
    font-weight: var(--tec-font-weight-normal, 400);
    user-select: none;
    -webkit-user-select: none;
  }
  .week-number {
    width: var(--_cell);
    padding-top: 0.5rem;
    color: var(--tec-muted-foreground);
    font-size: 0.8rem;
    font-weight: var(--tec-font-weight-normal, 400);
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
  }

  .cell {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    margin-top: 0.5rem;
    padding: 0;
    border-radius: var(--_radius);
    text-align: center;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  .cell[data-today] {
    background-color: var(--tec-muted);
    color: var(--tec-foreground);
  }
  .cell[data-today][data-selected] {
    border-radius: 0;
  }
  .cell[data-selection-start],
  .cell[data-selection-end] {
    isolation: isolate;
    background-color: var(--tec-muted);
    border-radius: var(--_radius);
  }
  .cell[data-selection-start] {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  .cell[data-selection-end] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }
  .cell[data-outside-month] {
    color: var(--tec-muted-foreground);
  }
  .cell[data-disabled],
  .cell[data-unavailable] {
    color: var(--tec-muted-foreground);
    opacity: 0.5;
  }
  .cell[data-unavailable] .day {
    text-decoration: line-through;
  }

  .day {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    min-width: var(--_cell);
    aspect-ratio: 1;
    border-radius: var(--tec-radius-md);
    color: var(--tec-ghost-foreground);
    background-color: transparent;
    font-size: var(--tec-text-sm);
    font-weight: var(--tec-font-weight-normal, 400);
    line-height: 1;
    white-space: nowrap;
  }
  .cell[data-outside-month] .day,
  .cell[data-disabled] .day,
  .cell[data-unavailable] .day {
    color: inherit;
  }
  .day > span {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    opacity: 0.7;
  }
  .cell:not([data-disabled], [data-unavailable]):hover .day {
    background-color: var(--tec-ghost-hover);
    color: light-dark(var(--tec-ghost-hover-foreground), var(--tec-foreground));
  }
  .cell:focus .day {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--tec-ring) 50%, transparent);
  }
  .cell[data-selection="single"] .day,
  .cell[data-selection="single"]:hover .day,
  .cell[data-selection="start"] .day,
  .cell[data-selection="start"]:hover .day,
  .cell[data-selection="end"] .day,
  .cell[data-selection="end"]:hover .day,
  .cell[data-selection="both"] .day,
  .cell[data-selection="both"]:hover .day {
    background-color: var(--tec-primary);
    color: var(--tec-primary-foreground);
    border-radius: var(--_radius);
  }
  .cell[data-selection="middle"] .day,
  .cell[data-selection="middle"]:hover .day {
    background-color: var(--tec-muted);
    color: var(--tec-foreground);
    border-radius: 0;
  }
  /* The selected band is rounded at the ends of each row. */
  td:first-of-type > .cell[data-selected] > .day {
    border-start-start-radius: var(--_radius);
    border-end-start-radius: var(--_radius);
  }
  td:last-of-type > .cell[data-selected] > .day {
    border-start-end-radius: var(--_radius);
    border-end-end-radius: var(--_radius);
  }
  .cell[data-invalid] .day {
    background-color: var(--tec-destructive);
    color: var(--tec-destructive-foreground, var(--tec-primary-foreground));
  }

  @media (forced-colors: active) {
    .cell:focus .day {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    .cell[data-selected] .day {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
    }
    .cell[data-disabled] .day,
    .cell[data-unavailable] .day {
      color: GrayText;
    }
  }
`
