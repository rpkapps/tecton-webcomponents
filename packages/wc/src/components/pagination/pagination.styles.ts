import { css } from "lit"

export const paginationStyles = css`
  :host {
    display: flex;
    width: 100%;
    justify-content: center;
  }
`

export const paginationContentStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`

export const paginationItemStyles = css`
  :host {
    display: flex;
  }
`

export const paginationEllipsisStyles = css`
  :host {
    display: flex;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
`

/* Previous / Next: a chevron and a label that is hidden below the sm breakpoint (640px). */
export const paginationStepStyles = css`
  .text {
    display: none;
  }
  @media (min-width: 640px) {
    .text {
      display: block;
    }
  }
  .chevron {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  :host(:dir(rtl)) .chevron {
    transform: scaleX(-1);
  }
`
