import { css } from "lit"

export const popoverStyles = css`
  :host {
    display: contents;
  }
  .content {
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
    width: var(--tec-popover-width, 18rem);
    max-width: calc(100vw - 1rem);
    padding: 1rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    outline: none;
  }
  /* Never set display on a closed popover: author rules beat the UA's display:none. */
  .content:popover-open {
    display: flex;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }
`

export const popoverHeaderStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
`

export const popoverTitleStyles = css`
  :host {
    display: block;
    font-weight: var(--tec-font-weight-medium);
  }
`

export const popoverDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
  }
`
