import { css } from "lit"

export const labelStyles = css`
  /* Layout on the host (gap/items classes on the element work); the base inherits it. */
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    gap: inherit;
    min-width: 0;
  }
  :host(:state(disabled)) {
    cursor: not-allowed;
    opacity: 0.5;
  }
`
