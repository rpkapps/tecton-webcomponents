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
  /* Inverted inside a tooltip. */
  :host(:state(in-tooltip)) .base {
    background-color: var(
      --tec-kbd-background,
      light-dark(
        color-mix(in oklab, var(--tec-background) 20%, transparent),
        color-mix(in oklab, var(--tec-background) 10%, transparent)
      )
    );
    color: var(--tec-kbd-foreground, var(--tec-background));
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
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: inherit;
  }
`
