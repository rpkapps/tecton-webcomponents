import { css } from "lit"

/**
 * Key cap look (`Kbd`): `.kbd` for one cap, `.kbd-group` for a row of caps. Shared by the shortcut
 * and composer families, which draw their caps in their own shadow roots.
 */
export const kbdStyles = css`
  .kbd {
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
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
  /* Inverted inside a tooltip (the host sets the in-tooltip state). */
  :host(:state(in-tooltip)) .kbd {
    background-color: var(
      --tec-kbd-background,
      light-dark(
        color-mix(in oklab, var(--tec-background) 20%, transparent),
        color-mix(in oklab, var(--tec-background) 10%, transparent)
      )
    );
    color: var(--tec-kbd-foreground, var(--tec-background));
  }
  .kbd-group {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  @media (forced-colors: active) {
    .kbd {
      border: 1px solid CanvasText;
    }
  }
`
