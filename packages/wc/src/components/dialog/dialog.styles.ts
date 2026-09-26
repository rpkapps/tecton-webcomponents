import { css } from "lit"

/** The centred dialog panel (`tec-dialog`, `tec-alert-dialog`). */
export const dialogPanelStyles = css`
  .content {
    position: fixed;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    display: grid;
    gap: 1.5rem;
    box-sizing: border-box;
    width: 100%;
    max-width: calc(100% - 2rem);
    max-height: calc(100% - 2rem);
    overflow-y: auto;
    padding: 1.5rem;
    border-radius: var(--tec-radius-xl);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent);
  }
  @media (prefers-reduced-motion: no-preference) {
    .dialog[data-state="open"] .overlay {
      animation: tec-enter var(--tec-duration-fast) var(--tec-ease-out);
      --tec-enter-opacity: 0;
    }
    .dialog[data-state="closed"] .overlay {
      animation: tec-exit var(--tec-duration-fast) var(--tec-ease-out) forwards;
      --tec-exit-opacity: 0;
    }
    .dialog[data-state="open"] .content {
      animation: tec-enter var(--tec-duration-fast) var(--tec-ease-out);
      --tec-enter-opacity: 0;
      --tec-enter-scale: 0.95;
    }
    .dialog[data-state="closed"] .content {
      animation: tec-exit var(--tec-duration-fast) var(--tec-ease-out) forwards;
      --tec-exit-opacity: 0;
      --tec-exit-scale: 0.95;
    }
  }
`

export const dialogStyles = css`
  @media (min-width: 40rem) {
    .content {
      max-width: var(--tec-dialog-max-width, 28rem);
    }
  }
`

export const dialogHeaderStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
`

export const dialogFooterStyles = css`
  :host {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
  @media (min-width: 40rem) {
    :host {
      flex-direction: row;
      justify-content: flex-end;
    }
  }
  .base {
    display: contents;
  }
`

export const dialogTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-weight: var(--tec-font-weight-medium);
    line-height: 1;
  }
`

export const dialogDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  /* Document resets (a { text-decoration: inherit; color: inherit }) beat ::slotted rules. */
  ::slotted(a) {
    text-decoration-line: underline !important;
    text-underline-offset: 3px;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground) !important;
  }
`
