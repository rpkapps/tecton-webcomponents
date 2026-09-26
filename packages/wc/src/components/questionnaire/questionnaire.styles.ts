import { css } from "lit"

export const questionnaireStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    min-width: 0;
  }
`

export const questionnaireItemStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
    outline: none;
  }
  :host(:not(:state(active))) {
    display: none !important;
  }
`

export const questionnaireTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    font-weight: var(--tec-font-weight-semibold);
    text-wrap: pretty;
  }
  :host(:state(alone)) .base {
    margin-block-end: 1.25rem;
  }
  .base {
    display: block;
  }
`

export const questionnaireDescriptionStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-muted-foreground);
    text-wrap: pretty;
  }
`

export const questionnaireChoicesStyles = css`
  :host {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }
`

export const questionnaireChoiceStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
  }
  :host(:state(disabled)) {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.5;
  }
  .base {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-height: 2.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: light-dark(transparent, color-mix(in oklab, var(--tec-input) 20%, transparent));
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .base:hover {
    background-color: color-mix(in oklab, var(--tec-muted) 50%, transparent);
  }
  :host(:state(checked)) .base {
    border-color: color-mix(in oklab, var(--tec-primary) 40%, transparent);
    background-color: var(--tec-muted);
  }
  :host(:state(invalid)) .base {
    border-color: var(--tec-destructive);
  }
  .base:has(.input:focus-visible) {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .input {
    appearance: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .indicator {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    translate: 0 0.1125rem;
    border: 1px solid var(--tec-input);
    border-radius: 4px;
    background-color: light-dark(transparent, color-mix(in oklab, var(--tec-input) 30%, transparent));
    pointer-events: none;
  }
  :host(:state(radio)) .indicator {
    border-radius: 9999px;
  }
  :host(:state(checked)) .indicator {
    border-color: var(--tec-primary);
    background-color: var(--tec-primary);
    color: var(--tec-primary-foreground);
  }
  :host(:state(has-description)) :is(.indicator, .shortcut) {
    translate: 0 0.125rem;
  }
  .dot,
  .check {
    display: none;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background-color: var(--tec-primary-foreground);
  }
  .check {
    width: 0.875rem;
    height: 0.875rem;
  }
  :host(:state(radio):state(checked)) .dot,
  :host(:state(checkbox):state(checked)) .check {
    display: block;
  }
  .label {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    line-height: 1.375;
  }
  .shortcut {
    display: none;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    margin-inline-start: auto;
    translate: 0 0.1125rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-background);
    color: var(--tec-muted-foreground);
    font-family: var(--tec-font-mono);
    font-size: 0.625rem;
    line-height: 1;
    font-weight: var(--tec-font-weight-medium);
    pointer-events: none;
  }
  :host(:state(has-shortcut)) .shortcut {
    display: inline-flex;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: background-color var(--tec-duration) var(--tec-ease), border-color var(--tec-duration) var(--tec-ease),
        box-shadow var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:state(checked)) .base {
      border-color: Highlight;
      border-width: 2px;
    }
    :host(:state(checked)) .indicator {
      background-color: Highlight;
      border-color: Highlight;
    }
    .base:has(.input:focus-visible) {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const questionnaireChoiceDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
  }
`

export const questionnaireInputStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    min-width: 0;
  }
  .input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    min-width: 0;
    height: 2rem;
    min-height: 2.75rem;
    margin: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    outline: none;
  }
  @media (min-width: 640px) {
    .input {
      min-height: 0;
    }
  }
  @media (min-width: 768px) {
    .input {
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
    }
  }
  .input::placeholder {
    color: var(--tec-muted-foreground);
  }
  .input::selection {
    background-color: var(--tec-primary);
    color: var(--tec-primary-foreground);
  }
  .input:hover {
    border-color: var(--tec-input-hover);
  }
  .input:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  .input[aria-invalid="true"] {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: 0 0 0 2px
      light-dark(color-mix(in oklab, var(--tec-destructive) 20%, transparent), color-mix(in oklab, var(--tec-destructive) 40%, transparent));
  }
  .input:disabled {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.5;
  }
  @media (prefers-reduced-motion: no-preference) {
    .input {
      transition: color var(--tec-duration) var(--tec-ease), box-shadow var(--tec-duration) var(--tec-ease),
        background-color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .input {
      border-color: CanvasText;
    }
    .input:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const questionnaireErrorStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    color: var(--tec-destructive);
  }
  :host(:not(:state(invalid))) {
    display: none !important;
  }
`

export const questionnaireProgressStyles = css`
  :host {
    display: block;
    width: fit-content;
    min-width: 14ch;
    min-height: 1lh;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-muted-foreground);
    font-variant-numeric: tabular-nums;
  }
  :host([segments]) {
    width: 100%;
  }
  .segments {
    display: flex;
    gap: 0.375rem;
    margin-block-end: 0.5rem;
  }
  .segment {
    flex: 1 1 0%;
    height: 0.375rem;
    border-radius: 9999px;
    background-color: var(--tec-muted);
  }
  .segment.done {
    background-color: var(--tec-primary);
  }
  @media (forced-colors: active) {
    .segment {
      border: 1px solid CanvasText;
    }
    .segment.done {
      background-color: Highlight;
    }
  }
`

export const questionnaireActionsStyles = css`
  :host {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 2.75rem;
  }
  @media (min-width: 640px) {
    :host {
      min-height: 2rem;
    }
  }
`

export const questionnaireNavStyles = css`
  :host {
    grid-row-start: 1;
    justify-self: end;
  }
  :host(:state(hidden)) {
    display: none !important;
  }
  @media (max-width: 639.98px) {
    :host {
      min-height: 2.75rem;
    }
  }
`
