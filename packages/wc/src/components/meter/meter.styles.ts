import { css } from "lit"

export const meterStyles = css`
  :host {
    --_h: 0.375rem;
    display: block;
    width: 100%;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="sm"]) {
    --_h: 0.25rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host([size="lg"]) {
    --_h: 0.625rem;
  }
  .base {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .label {
    color: var(--tec-muted-foreground);
  }
  .value {
    margin-inline-start: auto;
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
  }
  .track {
    display: flex;
    gap: 0.125rem;
    width: 100%;
    height: var(--tec-meter-height, var(--_h));
  }
  .segment {
    position: relative;
    flex: 1 1 0%;
    overflow: hidden;
    border-radius: 9999px;
    background-color: var(--tec-muted);
  }
  .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    border-radius: 9999px;
    background-color: var(--_fill, var(--tec-primary));
  }
  .track[data-color="success"] {
    --_fill: var(--tec-success);
  }
  .track[data-color="warning"] {
    --_fill: var(--tec-warning);
  }
  .track[data-color="error"] {
    --_fill: var(--tec-destructive);
  }
  .track[data-color="info"] {
    --_fill: var(--tec-info);
  }
  .track[data-color="custom"] {
    --_fill: var(--tec-meter-fill, var(--tec-primary));
  }
  @media (prefers-reduced-motion: no-preference) {
    .fill {
      transition: width var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .segment {
      border: 1px solid CanvasText;
    }
    .fill {
      background-color: Highlight;
    }
  }
`
