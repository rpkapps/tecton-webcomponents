import { css } from "lit"

/* Frosted floating surface shared by the toolbar and the legend (`bg-card/90 backdrop-blur-sm`). */
const floating = css`
  border: 1px solid var(--tec-border-subtle);
  border-radius: var(--tec-radius-md);
  background-color: color-mix(in oklab, var(--tec-card) 90%, transparent);
  color: var(--tec-card-foreground);
  box-shadow: var(--tec-shadow-md);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
`

export const canvasStyles = css`
  :host {
    display: flex;
    position: relative;
    isolation: isolate;
    flex: 1 1 0%;
    min-height: 0;
    min-width: 0;
    /* Fills a block parent of definite height too (a flex column uses flex-basis instead). */
    height: 100%;
    overflow: hidden;
  }
  .base {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    border-radius: inherit;
    background-color: color-mix(in oklab, var(--tec-muted) 40%, transparent);
  }
`

export const canvasSurfaceStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
`

export const canvasOverlayStyles = css`
  :host {
    position: absolute;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    /* The gaps between the controls let the surface below receive drags and wheels. */
    pointer-events: none;
    inset-block-start: 0.75rem;
    inset-inline-start: 0.75rem;
  }
  ::slotted(*) {
    pointer-events: auto;
  }
  :host([position="top"]),
  :host([position="bottom"]) {
    flex-direction: row;
    align-items: center;
    inset-inline-start: 50%;
    translate: -50% 0;
  }
  :host([position="top"]:dir(rtl)),
  :host([position="bottom"]:dir(rtl)) {
    translate: 50% 0;
  }
  :host([position="top-right"]),
  :host([position="right"]),
  :host([position="bottom-right"]) {
    align-items: flex-end;
    inset-inline-start: auto;
    inset-inline-end: 0.75rem;
  }
  :host([position="left"]),
  :host([position="right"]) {
    inset-block-start: 50%;
    translate: 0 -50%;
  }
  :host([position="bottom-left"]),
  :host([position="bottom"]),
  :host([position="bottom-right"]) {
    inset-block-start: auto;
    inset-block-end: 0.75rem;
  }
`

export const canvasToolbarStyles = css`
  :host {
    display: inline-flex;
    pointer-events: auto;
  }
  .base {
    ${floating}
    display: flex;
    flex-direction: column;
    padding: 0.125rem;
  }
  :host([orientation="horizontal"]) .base {
    flex-direction: row;
  }
  @supports (backdrop-filter: blur(4px)) {
    .base {
      background-color: color-mix(in oklab, var(--tec-card) 80%, transparent);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

export const canvasLegendStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  .base {
    ${floating}
    display: grid;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
  }
  @supports (backdrop-filter: blur(4px)) {
    .base {
      background-color: color-mix(in oklab, var(--tec-card) 80%, transparent);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

export const canvasLegendItemStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 0.75rem;
    height: 0.75rem;
    overflow: hidden;
    border-radius: 2px;
  }
  .fill {
    width: 100%;
    height: 100%;
    forced-color-adjust: none;
  }
  ::slotted([slot="swatch"]) {
    width: 100%;
    height: 100%;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`
