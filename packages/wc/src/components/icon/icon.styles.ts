import { css } from "lit"

export const iconStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--tec-icon-size, 1.5rem);
    height: var(--tec-icon-size, 1.5rem);
    vertical-align: middle;
    color: inherit;
    line-height: 1;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  @media (forced-colors: active) {
    svg {
      forced-color-adjust: auto;
    }
  }
`
