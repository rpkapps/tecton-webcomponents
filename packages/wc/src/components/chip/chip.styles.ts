import { css } from "lit"

/*
 * A chip looks exactly like a badge with the same `variant` / `appearance` / `size`: the element
 * includes `badgeStyles` (the badge family's shared styles) and adds only the interactive states
 * here: hover brightening, the focus ring, the selected foreground ring and the remove button.
 *
 * The host is the grid row (it takes focus); the box is `part="base"` (the grid cell).
 */
export const chipStyles = css`
  :host {
    outline: none;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .base {
    padding-block: 0.125rem;
    border-radius: var(--tec-chip-radius, var(--tec-badge-radius, var(--tec-radius-4xl)));
    background-clip: padding-box;
  }
  :host(:state(removable)) .base {
    padding-inline-end: var(--_pad-icon);
  }

  /* ---------------------------------------------------------------- states */
  :host(:state(interactive):hover) .base {
    filter: brightness(1.1);
  }
  :host(:state(selected)) .base {
    border-color: var(--tec-foreground);
    box-shadow: 0 0 0 1px var(--tec-foreground);
  }
  :host(:focus-visible) .base {
    border-color: var(--_ring);
    box-shadow: var(--_ring-shadow);
  }
  :host([disabled]) {
    pointer-events: none;
    opacity: 0.5;
  }

  /* ---------------------------------------------------------------- remove button */
  .remove {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    margin-inline-start: 0.125rem;
    margin-inline-end: -0.25rem;
    border-radius: 9999px;
    opacity: 0.7;
    cursor: pointer;
  }
  .remove:hover {
    opacity: 1;
  }
  .remove:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  .remove svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, filter;
    }
  }
  @media (forced-colors: active) {
    :host(:state(selected)) .base {
      border-color: Highlight;
      outline: 1px solid Highlight;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const chipGroupStyles = css`
  :host {
    display: block;
  }
  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .empty {
    display: contents;
  }
  :host(:state(has-chips)) .empty {
    display: none;
  }
  ::slotted([slot="empty"]) {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
`
