import { css } from "lit"

export const shortcutsStyles = css`
  :host {
    display: contents;
  }
`

export const shortcutStyles = css`
  :host {
    display: none !important;
  }
`

export const shortcutKeysStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
  .text {
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
`

export const shortcutListStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  .base {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .group-label {
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 1.75rem;
  }
  .label {
    min-width: 0;
  }
  tec-shortcut-keys {
    flex-shrink: 0;
  }
`
