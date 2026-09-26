import { css } from "lit"

export const labelStyles = css`
  :host {
    display: flex;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
    -webkit-user-select: none;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  :host(:state(disabled)) {
    cursor: not-allowed;
    opacity: 0.5;
  }
`
