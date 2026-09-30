import { css } from "lit"

export const kbdStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    box-sizing: border-box;
    width: fit-content;
    min-width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    padding-inline: 0.25rem;
    border-radius: var(--tec-radius-sm);
    background-color: var(--tec-kbd-background, var(--tec-muted));
    color: var(--tec-kbd-foreground, var(--tec-muted-foreground));
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    font-style: normal;
    white-space: nowrap;
  }
  /* Match the tooltip text, with a subtle key cap surface. */
  :host(:state(in-tooltip)) .base {
    background-color: var(
      --tec-kbd-background,
      color-mix(in oklab, var(--tec-tooltip-foreground) 15%, transparent)
    );
    color: var(--tec-kbd-foreground, var(--tec-tooltip-foreground));
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 0.75rem;
    height: 0.75rem;
  }
  @media (forced-colors: active) {
    .base {
      border: 1px solid CanvasText;
    }
  }
`

export const kbdGroupStyles = css`
  /* The host is the layout box (the <kbd> only carries the semantics). */
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    vertical-align: middle;
  }
  .base {
    display: contents;
    font: inherit;
  }
`
