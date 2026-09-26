import { css } from "lit"

export const circularProgressStyles = css`
  :host {
    --_stroke: 4.2px;
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
    width: 2.5rem;
    height: 2.5rem;
    color: var(--tec-progress);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  /* The stroke is in units of the ring's 48-unit viewBox, so it scales with the diameter:
     2.5 / 3 / 3.5 / 4 / 5 screen px at the size's own diameter. */
  :host([size="xs"]) {
    --_stroke: 7.5px;
    width: 1rem;
    height: 1rem;
    font-size: 0.5rem;
    line-height: 1;
  }
  :host([size="sm"]) {
    --_stroke: 6px;
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.625rem;
    line-height: 1;
  }
  :host([size="lg"]) {
    --_stroke: 3px;
    width: 4rem;
    height: 4rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="xl"]) {
    --_stroke: 2.5px;
    width: 6rem;
    height: 6rem;
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
  }
  :host([color="foreground"]) {
    color: var(--tec-foreground);
  }
  :host([color="success"]) {
    color: var(--tec-success);
  }
  :host([color="warning"]) {
    color: var(--tec-warning);
  }
  :host([color="error"]) {
    color: var(--tec-destructive);
  }
  :host([color="info"]) {
    color: var(--tec-info);
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    rotate: -90deg;
    overflow: visible;
  }
  circle {
    fill: none;
    stroke: currentColor;
    stroke-width: var(--tec-circular-progress-stroke, var(--_stroke));
  }
  .track {
    opacity: 0.38;
  }
  .value {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tec-foreground);
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
  }

  @keyframes tec-circular-progress-spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* Reduced motion keeps a slow turn: a still arc would read as a stuck value. */
  :host([indeterminate]) svg {
    animation: tec-circular-progress-spin 3s linear infinite;
  }
  @media (prefers-reduced-motion: no-preference) {
    :host([indeterminate]) svg {
      animation-duration: 1s;
    }
    .indicator {
      transition: stroke-dashoffset 300ms var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    circle {
      stroke: CanvasText;
    }
    .indicator {
      stroke: Highlight;
    }
  }
`
