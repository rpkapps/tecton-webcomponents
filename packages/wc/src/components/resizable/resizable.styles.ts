import { css } from "lit"

export const groupStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
  }
`

export const panelStyles = css`
  /* Like the reference layout engine: the panel cannot shrink below its content's minimum size
     (min-size: auto), and the content box scrolls when it is larger than the panel. */
  :host {
    display: flex;
    flex: 1 1 0px;
    overflow: visible;
  }
  .content {
    flex-grow: 1;
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
    touch-action: pan-y;
  }
  :host(:state(vertical)) .content {
    touch-action: pan-x;
  }
`

export const handleStyles = css`
  :host {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 1px;
    align-self: stretch;
    outline: none;
    touch-action: none;
    cursor: col-resize;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(vertical)) {
    width: auto;
    height: 1px;
    cursor: row-resize;
  }
  :host(:state(disabled)) {
    cursor: not-allowed;
  }
  :host(:state(group-disabled)) {
    cursor: default;
  }
  .base {
    position: absolute;
    inset: 0;
    background-color: var(--tec-border);
  }
  :host(:focus-visible) .base {
    box-shadow: 0 0 0 1px var(--tec-ring);
  }
  /* Invisible hit area, wider than the 1px line. */
  .hit {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 50%;
    width: 0.625rem;
    transform: translateX(-50%);
  }
  :host(:dir(rtl)) .hit {
    transform: translateX(50%);
  }
  :host(:state(vertical)) .hit {
    inset-inline: 0;
    inset-block: 50% auto;
    width: auto;
    height: 0.625rem;
    transform: translateY(-50%);
  }
  @media (pointer: coarse) {
    .hit {
      width: 1.25rem;
    }
    :host(:state(vertical)) .hit {
      width: auto;
      height: 1.25rem;
    }
  }
  .grip {
    position: relative;
    z-index: 10;
    display: flex;
    flex-shrink: 0;
    width: 0.25rem;
    height: 1.5rem;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-border);
  }
  :host(:state(vertical)) .grip {
    transform: rotate(90deg);
  }
  @media (forced-colors: active) {
    .base,
    .grip {
      background-color: CanvasText;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }
`
