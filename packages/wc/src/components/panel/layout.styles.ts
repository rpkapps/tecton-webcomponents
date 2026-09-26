import { css } from "lit"

/**
 * The host is the layout box: application layout classes (`flex gap-6`, `flex-col`, `justify-end`,
 * `grid grid-cols-2`) go on the element itself. The inner part carries the box styles (border,
 * padding, background, scrolling — they would lose to a host document's reset on the host) and takes
 * the host's layout, so the slotted children are laid out exactly as the host's classes say.
 */
export const forwardLayout = css`
  .base {
    box-sizing: border-box;
    display: inherit;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    align-content: inherit;
    justify-content: inherit;
    justify-items: inherit;
    gap: inherit;
    grid-template-columns: inherit;
    grid-template-rows: inherit;
    grid-template-areas: inherit;
    grid-auto-flow: inherit;
    grid-auto-columns: inherit;
    grid-auto-rows: inherit;
    /* The part fills the host whatever layout the host has. */
    flex: 1 1 0%;
    align-self: stretch;
    justify-self: stretch;
    grid-column: 1 / -1;
    grid-row: 1 / -1;
    min-width: 0;
    min-height: 0;
  }
`
