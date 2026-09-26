import { css } from "lit"

/*
 * Date pickers: the field appearance reuses the date field box (`dateFieldStyles`) with a ghost
 * icon button at the end; the button appearance is an outline button showing the formatted value.
 * The popover surface is the Tecton popover (`bg-popover`, ring + shadow) with no padding.
 */
export const datePickerStyles = css`
  :host([appearance="field"]) .field {
    padding-inline-end: 0.25rem;
  }

  /* ---------------------------------------------------------------- icon trigger (field) */
  .icon-trigger {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: min(var(--tec-radius-md), 8px);
    color: var(--tec-ghost-foreground);
    cursor: default;
  }
  .icon-trigger svg {
    width: 1rem;
    height: 1rem;
    pointer-events: none;
  }
  .icon-trigger:hover,
  .icon-trigger:focus-visible {
    background-color: var(--tec-ghost-hover);
    color: var(--tec-ghost-hover-foreground);
  }
  .icon-trigger[aria-expanded="true"] {
    background-color: var(--tec-ghost-active);
    color: var(--tec-ghost-active-foreground);
  }
  .icon-trigger:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  .icon-trigger:disabled {
    opacity: 0.5;
  }
  .separator {
    padding-inline: 0.25rem;
    color: var(--tec-muted-foreground);
  }

  /* ---------------------------------------------------------------- button appearance */
  :host([appearance="button"]) {
    display: inline-flex;
    height: 2rem;
    vertical-align: middle;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  .button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding-inline: 0.5rem;
    border: 1px solid var(--tec-outline-border);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    background-clip: padding-box;
    color: var(--tec-outline-foreground);
    font: inherit;
    font-weight: var(--tec-font-weight-normal, 400);
    white-space: nowrap;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }
  :host(:state(has-start)) .button {
    padding-inline-start: 0.375rem;
  }
  :host(:state(has-end)) .button {
    padding-inline-end: 0.375rem;
  }
  .button:hover {
    border-color: var(--tec-outline-hover-border);
    background-color: var(--tec-outline-hover);
    color: var(--tec-outline-hover-foreground);
  }
  .button:focus-visible {
    border-color: var(--tec-ring);
    background-color: var(--tec-outline-hover);
    color: var(--tec-outline-hover-foreground);
    box-shadow: var(--tec-focus-ring);
  }
  .button[aria-expanded="true"] {
    border-color: var(--tec-outline-active-border);
    background-color: var(--tec-outline-active);
    color: var(--tec-outline-active-foreground);
  }
  .button:disabled {
    opacity: 0.5;
  }
  :host(:state(user-invalid)) .button {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  .value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
  }
  .value[data-placeholder] {
    color: var(--tec-muted-foreground);
  }

  /* ---------------------------------------------------------------- popover */
  .content {
    --tec-calendar-background: transparent;
    flex-direction: column;
    box-sizing: border-box;
    max-width: calc(100vw - 1rem);
    max-height: var(--tec-popup-available-height, none);
    overflow: auto;
    padding: 0;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    outline: none;
  }
  .content:popover-open {
    display: flex;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
    .button {
      border-color: ButtonText;
    }
  }
`
