import { css } from "lit"

export const treeViewStyles = css`
  /* The host is the layout box of the rows (layout classes on the element apply to them). */
  :host {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    overflow: auto;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-foreground);
  }
  .base {
    display: contents;
  }
`

export const treeViewItemStyles = css`
  :host {
    display: block;
    outline: none;
    min-width: 0;
    --tec-icon-size: 1rem;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    height: 2rem;
    min-width: 0;
    padding-inline-start: calc((var(--_level, 1) - 1) * 1.25rem + 0.25rem);
    padding-inline-end: 0.25rem;
    border-radius: var(--tec-radius-md);
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }
  .row:hover {
    background-color: color-mix(in oklab, var(--tec-accent) 60%, transparent);
  }
  .row:active,
  :host(:state(selected)) .row {
    background-color: var(--tec-accent);
  }
  :host(:state(selected)) .row {
    color: var(--tec-accent-foreground);
  }
  :host([dimmed]) .row {
    color: var(--tec-muted-foreground);
  }
  :host([disabled]) .row {
    opacity: 0.5;
    pointer-events: none;
  }
  :host(:focus-visible) .row {
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--tec-ring) 60%, transparent);
  }
  .chevron,
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    color: var(--tec-muted-foreground);
  }
  .chevron {
    border-radius: var(--tec-radius-sm);
  }
  .chevron:hover {
    background-color: var(--tec-accent);
    color: var(--tec-foreground);
  }
  :host(:not(:state(has-children))) .chevron {
    visibility: hidden;
  }
  .chevron svg,
  .icon svg,
  .icon ::slotted(svg),
  .icon ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  :host(:dir(rtl)) .chevron svg {
    transform: scaleX(-1);
  }
  :host([expanded]) .chevron svg {
    transform: rotate(90deg);
  }
  .dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 9999px;
    background-color: currentColor;
  }
  .color-tag {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
  .color-tag ::slotted(*) {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.125rem;
    /* A tec-color-swatch sizes its own inner box. */
    --tec-color-swatch-size: 0.75rem;
    --tec-color-swatch-radius: 0.125rem;
  }
  .label {
    flex: 1 1 0%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .suffix,
  .end {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
  .end {
    gap: 0.125rem;
    color: var(--tec-muted-foreground);
  }
  :host(:not(:state(has-color-tag))) .color-tag,
  :host(:not(:state(has-suffix))) .suffix,
  :host(:not(:state(has-end))) .end {
    display: none;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 1px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .chevron svg {
      transition: transform var(--tec-duration-fast, 150ms) var(--tec-ease, ease);
    }
  }
  @media (forced-colors: active) {
    :host(:focus-visible) .row {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    :host(:state(selected)) .row {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    :host([disabled]) .row {
      color: GrayText;
    }
  }
`

export const treeViewActionStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--tec-muted-foreground);
    --tec-icon-size: 1rem;
  }
  .base {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--tec-radius-sm);
    background: transparent;
    color: inherit;
    cursor: default;
    outline: none;
  }
  .base:hover {
    background-color: var(--tec-accent);
    color: var(--tec-foreground);
  }
  .base:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--tec-ring) 60%, transparent);
  }
  .base svg,
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    pointer-events: none;
  }
  @media (forced-colors: active) {
    .base:focus-visible {
      outline: 2px solid Highlight;
    }
  }
`
