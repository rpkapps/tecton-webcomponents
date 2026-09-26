import { css } from "lit"

/* The host is the layout box (flex row / column); author layout classes on it win over these. */
export const toggleGroupStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: fit-content;
    gap: var(--tec-toggle-group-gap, calc(0.25rem * var(--_toggle-group-spacing, 2)));
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
    align-items: stretch;
  }
`

/*
 * Joined group (`spacing="0"`): square inner corners, the group's outer corners rounded (logical, so
 * RTL rounds the right ends), and outline items share one border between neighbours. The focused
 * item is raised so its ring is not covered by the next item.
 */
export const toggleGroupItemStyles = css`
  :host(:focus-visible),
  :host(:focus) {
    z-index: 10;
  }
  :host(:state(joined)) {
    --_pad: 0.5rem;
  }
  :host(:state(joined)) .base {
    border-radius: 0;
  }
  :host(:state(joined):state(first):not(:state(vertical))) .base {
    border-start-start-radius: var(--tec-toggle-radius, var(--tec-radius-md));
    border-end-start-radius: var(--tec-toggle-radius, var(--tec-radius-md));
  }
  :host(:state(joined):state(last):not(:state(vertical))) .base {
    border-start-end-radius: var(--tec-toggle-radius, var(--tec-radius-md));
    border-end-end-radius: var(--tec-toggle-radius, var(--tec-radius-md));
  }
  :host(:state(joined):state(first):state(vertical)) .base {
    border-start-start-radius: var(--tec-toggle-radius, var(--tec-radius-md));
    border-start-end-radius: var(--tec-toggle-radius, var(--tec-radius-md));
  }
  :host(:state(joined):state(last):state(vertical)) .base {
    border-end-start-radius: var(--tec-toggle-radius, var(--tec-radius-md));
    border-end-end-radius: var(--tec-toggle-radius, var(--tec-radius-md));
  }
  :host(:state(joined):state(outline):not(:state(vertical)):not(:state(first))) .base {
    border-inline-start-width: 0;
  }
  :host(:state(joined):state(outline):state(vertical):not(:state(first))) .base {
    border-block-start-width: 0;
  }
`
