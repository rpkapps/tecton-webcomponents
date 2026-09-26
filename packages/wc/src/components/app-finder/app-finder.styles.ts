import { css, unsafeCSS } from "lit"

/** Tile tones: Tecton palette steps (tint 120 background, 830 text; yellow uses 1000 for contrast). */
export const APP_FINDER_TONES = ["neutral", "blue", "azure", "green", "lime", "yellow", "saffron", "red", "pink", "orchid", "mauve", "violet", "lilac"] as const

const toneRules = APP_FINDER_TONES.filter((t) => t !== "neutral")
  .map(
    (t) =>
      `:host([tone="${t}"]) .base { background-color: var(--tecton-palette-${t}-120); color: var(--tecton-palette-${t}-${t === "yellow" ? "1000" : "830"}); }`,
  )
  .join("\n")

export const appFinderIconStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
    width: 1.75rem;
    height: 1.75rem;
    font-family: var(--tec-font-mono);
    font-size: 11px;
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    letter-spacing: 0.025em;
    text-transform: uppercase;
    user-select: none;
    -webkit-user-select: none;
    --tec-icon-size: 1rem;
  }
  :host([size="sm"]) {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 10px;
  }
  .base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-muted);
    color: var(--tec-foreground);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
  }
  ${unsafeCSS(toneRules)}
  @media (forced-colors: active) {
    .base {
      border: 1px solid CanvasText;
    }
  }
`

export const appFinderTriggerStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
    height: 2rem;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 100%;
    min-width: 0;
    padding-inline: 0.25rem 0.375rem;
    border: 1px solid transparent;
    border-radius: var(--tec-radius-lg);
    background-color: transparent;
    color: var(--tec-ghost-foreground);
    font: inherit;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }
  .base:hover {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  .base:focus-visible {
    outline: none;
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .base:active {
    background-color: var(--tec-ghost-pressed);
    color: var(--tec-ghost-pressed-foreground);
  }
  .base[aria-expanded="true"] {
    background-color: var(--tec-ghost-active);
    color: var(--tec-ghost-active-foreground);
  }
  .base:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .name {
    display: none;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (width >= 40rem) {
    .name {
      display: inline;
    }
  }
  .chevron {
    width: 0.875rem;
    height: 0.875rem;
    color: var(--tec-muted-foreground);
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const appFinderStyles = css`
  :host {
    display: contents;
  }
  .content {
    box-sizing: border-box;
    flex-direction: column;
    width: var(--tec-app-finder-width, 26rem);
    max-width: calc(100vw - 1rem);
    max-height: var(--tec-popup-available-height, none);
    overflow: hidden;
    padding: 0.25rem;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: normal;
    text-align: start;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    outline: none;
  }
  .content:popover-open {
    display: flex;
  }
  .search {
    padding: 0.25rem 0.25rem 0;
  }
  .field {
    display: flex;
    align-items: center;
    height: 2rem;
    border: 1px solid transparent;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-muted);
  }
  .search-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    margin-inline-start: 0.5rem;
    opacity: 0.5;
  }
  .input {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding-inline: 0.5rem 0.625rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-foreground);
  }
  .input::placeholder {
    color: var(--tec-muted-foreground);
  }
  .input::-webkit-search-cancel-button {
    display: none;
  }
  .list {
    max-height: var(--tec-app-finder-list-height, min(24rem, 60vh));
    overflow-x: hidden;
    overflow-y: auto;
    scroll-padding-block: 0.25rem;
    scrollbar-width: none;
    outline: none;
  }
  .list::-webkit-scrollbar {
    display: none;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding-block: 2rem;
    text-align: center;
  }
  .empty-icon {
    width: 1.25rem;
    height: 1.25rem;
    margin-block-end: 0.25rem;
    color: var(--tec-muted-foreground);
  }
  .empty-message {
    font-weight: var(--tec-font-weight-medium);
  }
  .empty-hint {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
    .field {
      border-color: CanvasText;
    }
  }
`

export const appFinderGroupStyles = css`
  :host {
    display: block;
  }
  :host(:state(hidden)) {
    display: none !important;
  }
  .base {
    overflow: hidden;
    padding: 0.25rem;
    color: var(--tec-foreground);
  }
  :host(:not(:state(first))) .base {
    border-block-start: 1px solid var(--tec-border);
  }
  .heading {
    padding: 0.375rem 0.5rem 0.25rem;
    font-size: 11px;
    line-height: 1rem;
    font-weight: var(--tec-font-weight-medium);
    letter-spacing: 0.025em;
    text-transform: uppercase;
    color: var(--tec-muted-foreground);
  }
  @media (forced-colors: active) {
    :host(:not(:state(first))) .base {
      border-block-start-color: CanvasText;
    }
  }
`

export const appFinderItemStyles = css`
  :host {
    display: block;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  :host(:state(filtered)) {
    display: none !important;
  }
  .base {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--tec-radius-md);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([highlighted]) .base {
    background-color: var(--tec-muted);
    color: var(--tec-foreground);
  }
  :host([disabled]) {
    pointer-events: none;
    opacity: 0.5;
  }
  .text {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    line-height: 1.25;
  }
  .name,
  .description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-weight: var(--tec-font-weight-medium);
  }
  .description {
    font-size: var(--tec-text-xs);
    color: var(--tec-muted-foreground);
  }
  .current {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    margin-inline-start: auto;
    font-size: 11px;
    color: var(--tec-muted-foreground);
  }
  .check {
    width: 1rem;
    height: 1rem;
    color: var(--tec-primary);
  }
  mark {
    border-radius: 0.125rem;
    background-color: color-mix(in oklab, var(--tec-primary) 20%, transparent);
    color: inherit;
    font-weight: var(--tec-font-weight-semibold);
  }
  @media (forced-colors: active) {
    :host([highlighted]) .base {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    mark {
      background-color: Mark;
      color: MarkText;
    }
  }
`
