import { css } from "lit"

export const sheetStyles = css`
  :host {
    --_modal-exit: var(--tec-duration-slow);
  }
  .content {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
    overflow-y: auto;
    background-color: var(--tec-card);
    background-clip: padding-box;
    color: var(--tec-card-foreground);
    box-shadow: var(--tec-shadow-lg);
    border: 0 solid var(--tec-border);
  }
  :host([side="right"]) .content,
  :host([side="left"]) .content {
    top: 0;
    bottom: 0;
    height: 100%;
    width: var(--tec-sheet-width, 75%);
  }
  @media (min-width: 40rem) {
    :host([side="right"]) .content,
    :host([side="left"]) .content {
      max-width: var(--tec-sheet-max-width, 24rem);
    }
  }
  :host([side="right"]) .content {
    right: 0;
    border-left-width: 1px;
    --_slide-x: 2.5rem;
  }
  :host([side="left"]) .content {
    left: 0;
    border-right-width: 1px;
    --_slide-x: -2.5rem;
  }
  :host([side="top"]) .content,
  :host([side="bottom"]) .content {
    left: 0;
    right: 0;
    height: auto;
    max-height: var(--tec-sheet-max-height, 100%);
  }
  :host([side="top"]) .content {
    top: 0;
    border-bottom-width: 1px;
    --_slide-y: -2.5rem;
  }
  :host([side="bottom"]) .content {
    bottom: 0;
    border-top-width: 1px;
    --_slide-y: 2.5rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .dialog[data-state="open"] .overlay {
      animation: tec-enter 150ms var(--tec-ease);
      --tec-enter-opacity: 0;
    }
    .dialog[data-state="closed"] .overlay {
      animation: tec-exit 150ms var(--tec-ease) forwards;
      --tec-exit-opacity: 0;
    }
    .dialog[data-state="open"] .content {
      animation: tec-enter var(--tec-duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
      --tec-enter-opacity: 0;
      --tec-enter-translate-x: var(--_slide-x, 0);
      --tec-enter-translate-y: var(--_slide-y, 0);
    }
    .dialog[data-state="closed"] .content {
      animation: tec-exit var(--tec-duration-slow) cubic-bezier(0.4, 0, 0.2, 1) forwards;
      --tec-exit-opacity: 0;
      --tec-exit-translate-x: var(--_slide-x, 0);
      --tec-exit-translate-y: var(--_slide-y, 0);
    }
  }
`

/* The host is the layout box (flex column, gap); the padded part inherits the layout. */
export const sheetHeaderStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: inherit;
    flex-wrap: inherit;
    gap: inherit;
    align-items: inherit;
    justify-content: inherit;
    padding: 1rem;
  }
`

/* mt-auto flex flex-col gap-2 p-4. The auto margin must survive document resets (Tailwind's
   preflight zeroes margins and beats :host rules), hence !important behind a custom property. */
export const sheetFooterStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-block-start: var(--tec-sheet-footer-margin, auto) !important;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: inherit;
    flex-wrap: inherit;
    gap: inherit;
    align-items: inherit;
    justify-content: inherit;
    padding: 1rem;
  }
`

export const sheetTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-foreground);
  }
`

export const sheetDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
`
