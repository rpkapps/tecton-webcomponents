import { css } from "lit"

export const spinnerStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    width: var(--tec-icon-size, 1rem);
    height: var(--tec-icon-size, 1rem);
    color: inherit;
    line-height: 1;
  }
  .icon {
    display: flex;
    width: 100%;
    height: 100%;
    animation: tec-spinner-spin var(--tec-spinner-duration, 1s) linear infinite;
  }
  .icon svg,
  ::slotted(svg),
  ::slotted(tec-icon) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
  @keyframes tec-spinner-spin {
    to {
      rotate: 360deg;
    }
  }
  /*
   * A spinner is the only signal that work is going on, so it keeps turning under
   * reduced motion, but three times slower.
   */
  @media (prefers-reduced-motion: reduce) {
    .icon {
      animation-duration: calc(var(--tec-spinner-duration, 1s) * 3);
    }
  }
  @media (forced-colors: active) {
    .icon svg {
      forced-color-adjust: auto;
    }
  }
`
