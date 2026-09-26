import { css } from "lit"
import { focusRing, forcedColors, motionSafe } from "../../internal/styles.js"

/** `<tec-chart>`: the container (`flex aspect-video justify-center text-xs`), plot and SVG marks. */
export const chartStyles = [
  css`
    :host {
      display: flex;
      justify-content: center;
      aspect-ratio: 16 / 9;
      min-width: 0;
      font-size: var(--tec-text-xs);
      line-height: var(--tec-text-xs--line-height);
    }
    .base {
      position: relative;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }
    .plot {
      position: relative;
      flex: 1 1 0;
      min-height: 0;
      border-radius: var(--tec-radius-md);
      outline: none;
      -webkit-user-select: none;
      user-select: none;
    }
    svg {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      display: block;
      overflow: visible;
    }
    /* Right-to-left: the cartesian geometry is mirrored (categories run from the right, the value
       axis sits on the right); labels are flipped back so their glyphs read normally. */
    :host(:dir(rtl)) .mirror {
      transform: scaleX(-1);
      transform-box: view-box;
      transform-origin: 50% 0;
    }
    :host(:dir(rtl)) .mirror text {
      transform: scaleX(-1);
      transform-box: fill-box;
      transform-origin: center;
    }
    .tick {
      fill: var(--tec-muted-foreground);
    }
    .grid line {
      stroke: color-mix(in oklab, var(--tec-border) 50%, transparent);
    }
    .grid[data-dashed] line {
      stroke-dasharray: 3 3;
    }
    .axis-line,
    .tick-line {
      stroke: var(--tec-border);
    }
    .cursor-band {
      fill: var(--tec-muted);
    }
    .cursor-line {
      stroke: var(--tec-border);
    }
    .dot {
      fill: var(--tec-background);
    }
    .sector {
      stroke: none;
    }
    .sector[data-active] {
      stroke: var(--tec-background);
      stroke-width: 2px;
    }
    .sector,
    .bar {
      cursor: default;
    }
  `,
  focusRing(".plot"),
  motionSafe(css`
    .bar {
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation: tec-chart-grow-y 400ms var(--tec-ease-out, ease-out) both;
    }
    .bar[data-negative] {
      transform-origin: 50% 0;
    }
    [data-orientation="horizontal"] .bar {
      transform-origin: 0 50%;
      animation-name: tec-chart-grow-x;
    }
    [data-orientation="horizontal"] .bar[data-negative] {
      transform-origin: 100% 50%;
    }
    .reveal {
      animation: tec-chart-reveal 700ms var(--tec-ease-out, ease-out) both;
    }
    [data-orientation="horizontal"] .reveal {
      animation-name: tec-chart-reveal-y;
    }
    .pie {
      animation: tec-chart-pop 400ms var(--tec-ease-out, ease-out) both;
    }
    svg[data-transition] .bar,
    svg[data-transition] .series-path {
      transition: d 300ms var(--tec-ease, ease);
    }
    svg[data-transition] .cursor-band,
    svg[data-transition] .cursor-line {
      transition:
        x 150ms var(--tec-ease, ease),
        y 150ms var(--tec-ease, ease),
        transform 150ms var(--tec-ease, ease);
    }
    @keyframes tec-chart-grow-y {
      from {
        transform: scaleY(0);
      }
    }
    @keyframes tec-chart-grow-x {
      from {
        transform: scaleX(0);
      }
    }
    @keyframes tec-chart-reveal {
      from {
        clip-path: inset(0 100% 0 0);
      }
      to {
        clip-path: inset(0 0 0 0);
      }
    }
    @keyframes tec-chart-reveal-y {
      from {
        clip-path: inset(0 0 100% 0);
      }
      to {
        clip-path: inset(0 0 0 0);
      }
    }
    @keyframes tec-chart-pop {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
    }
  `),
  forcedColors(css`
    .plot:focus-visible {
      outline: 2px solid Highlight;
    }
    .bar,
    .sector,
    .series-path,
    .area {
      forced-color-adjust: none;
    }
    .tick {
      fill: CanvasText;
    }
    .grid line,
    .axis-line,
    .tick-line,
    .cursor-line {
      stroke: GrayText;
    }
    .cursor-band {
      fill: Highlight;
      opacity: 0.25;
    }
  `),
]

/**
 * `<tec-chart-tooltip>`: `grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50
 * bg-background px-2.5 py-1.5 text-xs shadow-xl`, and the rows.
 */
export const tooltipStyles = [
  css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
      display: block;
      min-width: 8rem;
      pointer-events: none;
      white-space: nowrap;
    }
    :host(:not(:state(active))) {
      display: none;
    }
    :host([standalone]) {
      position: relative;
      z-index: auto;
      pointer-events: auto;
    }
    .base {
      display: grid;
      align-items: start;
      gap: 0.375rem;
      min-width: 8rem;
      padding: 0.375rem 0.625rem;
      border: 1px solid color-mix(in oklab, var(--tec-border) 50%, transparent);
      border-radius: var(--tec-radius-lg);
      background: var(--tec-background);
      color: var(--tec-foreground);
      box-shadow: var(--tec-shadow-xl);
      font-size: var(--tec-text-xs);
      line-height: var(--tec-text-xs--line-height);
    }
    .label {
      font-weight: 500;
    }
    .items {
      display: grid;
      gap: 0.375rem;
    }
    .item {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 0.5rem;
      width: 100%;
    }
    .item[data-indicator="dot"] {
      align-items: center;
    }
    .icon {
      display: flex;
      color: var(--tec-muted-foreground);
    }
    .icon > * {
      width: 0.625rem;
      height: 0.625rem;
    }
    .indicator {
      flex-shrink: 0;
      border: 0 solid var(--tec-chart-indicator);
      border-radius: 2px;
      background: var(--tec-chart-indicator);
      forced-color-adjust: none;
    }
    [data-indicator="dot"] .indicator {
      width: 0.625rem;
      height: 0.625rem;
    }
    [data-indicator="line"] .indicator {
      width: 0.25rem;
    }
    [data-indicator="dashed"] .indicator {
      width: 0;
      border-width: 1.5px;
      border-style: dashed;
      background: transparent;
    }
    [data-indicator="dashed"] .indicator[data-nested] {
      margin-block: 0.125rem;
    }
    .text {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: space-between;
      line-height: 1;
    }
    .text[data-nested] {
      align-items: flex-end;
    }
    .names {
      display: grid;
      gap: 0.375rem;
    }
    .name {
      color: var(--tec-muted-foreground);
    }
    .value {
      color: var(--tec-foreground);
      font-family: var(--tec-font-mono);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  `,
  motionSafe(css`
    :host(:state(moving)) {
      transition: translate 400ms var(--tec-ease, ease);
    }
  `),
  forcedColors(css`
    .base {
      border-color: CanvasText;
    }
  `),
]

/** `<tec-chart-legend>`: `flex items-center justify-center gap-4 pt-3` (`pb-3` on top), wrapping. */
export const legendStyles = css`
  :host {
    display: block;
    order: 1;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host([vertical-align="top"]) {
    order: -1;
  }
  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 1rem;
    padding-block-start: 0.75rem;
  }
  :host([vertical-align="top"]) .base {
    padding-block: 0 0.75rem;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .icon {
    display: flex;
    color: var(--tec-muted-foreground);
  }
  .icon > * {
    width: 0.75rem;
    height: 0.75rem;
  }
  .swatch {
    flex-shrink: 0;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 2px;
    forced-color-adjust: none;
  }
`
