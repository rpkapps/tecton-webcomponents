import { css } from "lit"

/**
 * Shared styles of the modal families: the `<dialog>` is a transparent full-viewport layer (the same
 * box whether it is modal, non-modal or leaving the top layer) holding the overlay and the panel.
 * `--_modal-exit` is how long the element stays in the top layer after closing (≥ the exit animation).
 */
export const modalStyles = css`
  :host {
    display: contents;
    --_modal-exit: var(--tec-duration-fast);
  }
  .dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--tec-popover-foreground);
    overflow: hidden;
    outline: none;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
  }
  .dialog::backdrop {
    background: transparent;
  }
  .dialog[data-modal="false"] {
    pointer-events: none;
  }
  .dialog[data-state="closed"] {
    pointer-events: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .dialog {
      transition:
        display var(--_modal-exit) allow-discrete,
        overlay var(--_modal-exit) allow-discrete;
    }
  }

  /* bg-black/10 supports-backdrop-filter:backdrop-blur-xs, fade 100ms */
  .overlay {
    position: fixed;
    inset: 0;
    background-color: color-mix(in oklab, var(--tecton-palette-black) 10%, transparent);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }

  .content {
    pointer-events: auto;
    outline: none;
  }

  .close {
    position: absolute;
    top: 1rem;
    inset-inline-end: 1rem;
  }
  .close svg {
    width: 1rem;
    height: 1rem;
  }

  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }
`
