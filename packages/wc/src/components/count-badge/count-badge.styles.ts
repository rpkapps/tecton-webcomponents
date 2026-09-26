import { css } from "lit"

export const countBadgeStyles = css`
  :host {
    --_bg: var(--tec-primary);
    --_fg: var(--tec-primary-foreground);
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
  }
  :host([color="secondary"]) {
    --_bg: var(--tec-secondary);
    --_fg: var(--tec-secondary-foreground);
  }
  :host([color="destructive"]) {
    --_bg: var(--tec-destructive);
    --_fg: var(--tec-destructive-foreground);
  }
  :host([color="success"]) {
    --_bg: var(--tec-success);
    --_fg: var(--tec-success-foreground);
  }
  :host([color="warning"]) {
    --_bg: var(--tec-warning);
    --_fg: var(--tec-warning-foreground);
  }
  :host([color="info"]) {
    --_bg: var(--tec-info);
    --_fg: var(--tec-info-foreground);
  }
  .badge {
    position: absolute;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 1rem;
    min-width: 1rem;
    padding-inline: 0.25rem;
    border-radius: 9999px;
    background-color: var(--_bg);
    color: var(--_fg);
    box-shadow: 0 0 0 2px var(--tec-background);
    font-family: var(--tec-font-sans);
    font-size: 0.625rem;
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
    top: -0.25rem;
    right: -0.25rem;
  }
  :host([variant="dot"]) .badge {
    width: 0.5rem;
    height: 0.5rem;
    min-width: 0;
    padding: 0;
  }
  /* The anchor names are physical corners, like the design system's: they do not mirror in RTL. */
  :host([anchor="top-left"]) .badge {
    right: auto;
    left: -0.25rem;
  }
  :host([anchor="bottom-right"]) .badge {
    top: auto;
    bottom: -0.25rem;
  }
  :host([anchor="bottom-left"]) .badge {
    top: auto;
    right: auto;
    bottom: -0.25rem;
    left: -0.25rem;
  }
  @media (forced-colors: active) {
    .badge {
      border: 1px solid CanvasText;
      forced-color-adjust: none;
      background-color: CanvasText;
      color: Canvas;
    }
  }
`
