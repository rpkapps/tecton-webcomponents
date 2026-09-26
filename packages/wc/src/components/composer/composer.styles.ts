import { css } from "lit"

/* Box styles (border, padding, background, radius, rings) live on inner `part` elements: document
 * resets such as Tailwind's preflight beat `:host` rules. Hosts carry display, layout and text only. */

const visuallyHiddenHost = css`
  :host {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

export const composerStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
    position: relative;
    font-family: var(--tec-font-sans);
  }
`

export const composerFieldStyles = css`
  :host {
    display: flex;
    width: 100%;
    min-width: 0;
    position: relative;
  }
  .base {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    outline: none;
  }
  :host(:hover) .base {
    border-color: var(--tec-input-hover);
  }
  :host(:state(focused)) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, box-shadow, border-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:state(focused)) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const composerInputStyles = css`
  :host {
    display: flex;
    width: 100%;
    min-width: 0;
  }
  .base {
    flex: 1 1 auto;
    display: flex;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 2.5rem;
    max-height: 12rem;
    field-sizing: content;
    margin: 0;
    padding: 0.5rem 0.75rem;
    overflow-y: auto;
    resize: none;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--tec-foreground);
    font-family: inherit;
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    outline: none;
  }
  @media (min-width: 48rem) {
    .base {
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
    }
  }
  .base::placeholder {
    color: var(--tec-muted-foreground);
    opacity: 1;
  }
  .base:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

export const composerToolbarStyles = css`
  /* The host is the layout box (align, gap, wrap classes on it apply); the padding is the part's. */
  :host {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    min-width: 0;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    gap: inherit;
    width: 100%;
    min-width: 0;
    padding: 0.375rem 0.5rem 0.5rem;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    cursor: text;
    user-select: none;
    -webkit-user-select: none;
  }
  /* The send button goes last, after the flexible space. */
  .spacer {
    flex: 1 1 0;
    align-self: stretch;
    order: 1;
  }
  ::slotted(tec-composer-submit) {
    order: 2;
  }
  ::slotted(*) {
    cursor: auto;
  }
`

export const composerSubmitStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    vertical-align: middle;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: 1px solid transparent;
    border-radius: var(--tec-composer-submit-radius, 9999px);
    background-color: var(--_bg);
    background-clip: padding-box;
    color: var(--_fg);
    cursor: pointer;
    outline: none;
  }
  .send {
    --_bg: var(--tec-primary);
    --_fg: var(--tec-primary-foreground);
    --_bg-hover: var(--tec-primary-hover);
    --_fg-hover: var(--tec-primary-hover-foreground);
    --_bg-pressed: var(--tec-primary-pressed);
    --_fg-pressed: var(--tec-primary-pressed-foreground);
  }
  .stop {
    --_bg: var(--tec-secondary);
    --_fg: var(--tec-secondary-foreground);
    --_bg-hover: var(--tec-secondary-hover);
    --_fg-hover: var(--tec-secondary-hover-foreground);
    --_bg-pressed: var(--tec-secondary-pressed);
    --_fg-pressed: var(--tec-secondary-pressed-foreground);
  }
  .base:hover {
    background-color: var(--_bg-hover);
    color: var(--_fg-hover);
  }
  .base:focus-visible {
    background-color: var(--_bg-hover);
    color: var(--_fg-hover);
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .base:active {
    background-color: var(--_bg-pressed);
    color: var(--_fg-pressed);
    translate: 0 1px;
  }
  .base[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .base:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  svg {
    width: 1rem;
    height: 1rem;
    pointer-events: none;
  }
  .square {
    fill: currentColor;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, translate, opacity;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
    .spinner {
      animation: tec-composer-spin 1s linear infinite;
    }
  }
  @keyframes tec-composer-spin {
    to {
      rotate: 360deg;
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: ButtonText;
    }
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    .base[aria-disabled="true"],
    .base:disabled {
      border-color: GrayText;
      color: GrayText;
    }
  }
`

export const composerHintStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  .base {
    margin: 0;
    padding-inline: 0.25rem;
  }
  :host([visually-hidden]) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`

export const composerStatusStyles = visuallyHiddenHost

export const composerSuggestionsStyles = css`
  /* The host is the layout box. */
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    min-width: 0;
  }
  .base {
    display: contents;
  }
`

export const composerSuggestionStyles = css`
  :host {
    display: inline-flex;
    max-width: 100%;
    min-width: 0;
    vertical-align: middle;
  }
  .base {
    max-width: 100%;
    --tec-button-radius: 9999px;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const composerAttachmentsStyles = css`
  /* The host is the layout box (wrap, gap, align classes on it apply); the padding is the part's. */
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    width: 100%;
    min-width: 0;
  }
  :host(:state(empty)) {
    display: none !important;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    gap: inherit;
    min-width: 0;
    padding: 0.5rem 0.5rem 0;
  }
`

export const composerAttachmentStyles = css`
  :host {
    display: inline-flex;
    max-width: 100%;
    min-width: 0;
    outline: none;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    --tec-icon-size: 0.875rem;
  }
  .base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    box-sizing: border-box;
    max-width: 100%;
    height: 1.5rem;
    padding-inline: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-4xl);
    background: transparent;
    color: var(--tec-foreground);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(has-start)) .base {
    padding-inline-start: 0.375rem;
  }
  :host(:hover) .base {
    filter: brightness(1.1);
  }
  :host(:focus-visible) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  .label,
  .description {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The description gives way before the label (which keeps its whole width up to the chip's). */
  .label {
    flex-shrink: 0;
    max-width: 100%;
  }
  .description {
    color: var(--tec-muted-foreground);
    font-weight: var(--tec-font-weight-normal);
  }
  .remove {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
  .remove:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .remove svg {
    width: 0.75rem;
    height: 0.75rem;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const composerCommandsStyles = css`
  :host {
    display: block;
    position: absolute;
    inset-inline: 0;
    bottom: 100%;
    height: 0;
  }
  :host(:not(:state(open))) {
    display: none !important;
  }
  .content {
    box-sizing: border-box;
    flex-direction: column;
    max-height: min(var(--tec-composer-commands-max-height, 16rem), var(--tec-popup-available-height, 16rem));
    overflow-y: auto;
    padding: 0.25rem;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow: var(--tec-shadow-md);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    outline: none;
  }
  /* Never set display on a closed popover: author rules beat the UA's display:none. */
  .content:popover-open {
    display: flex;
  }
  .group {
    display: flex;
    flex-direction: column;
  }
  .group-label {
    padding: 0.375rem 0.5rem 0.25rem;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
  }
  @media (forced-colors: active) {
    .content {
      border-color: CanvasText;
    }
  }
`

export const composerCommandStyles = css`
  :host {
    display: block;
    min-width: 0;
    cursor: default;
    --tec-icon-size: 1rem;
  }
  .base {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border-radius: var(--tec-radius-md);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    user-select: none;
    -webkit-user-select: none;
  }
  :host([highlighted]) .base {
    background-color: var(--tec-accent);
    color: var(--tec-accent-foreground);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    color: var(--tec-muted-foreground);
    pointer-events: none;
  }
  .command {
    flex-shrink: 0;
    font-family: var(--tec-font-mono);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  .label,
  .description {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .description {
    margin-inline-start: auto;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  @media (forced-colors: active) {
    :host([highlighted]) .base {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
`
