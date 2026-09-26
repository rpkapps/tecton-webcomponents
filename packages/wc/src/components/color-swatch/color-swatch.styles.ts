import { css } from "lit"

export const colorSwatchStyles = css`
  :host {
    --_size: 1.5rem;
    --_radius: var(--tec-radius-md);
    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
    max-width: 100%;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="xs"]) {
    --_size: 0.75rem;
  }
  :host([size="sm"]) {
    --_size: 1rem;
  }
  :host([size="lg"]) {
    --_size: 2rem;
  }
  :host([size="xl"]) {
    --_size: 3rem;
  }
  :host([shape="square"]) {
    --_radius: var(--tec-radius-sm);
  }
  :host([shape="circle"]) {
    --_radius: 9999px;
  }

  .base {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .swatch {
    display: block;
    flex-shrink: 0;
    width: var(--tec-color-swatch-size, var(--_size));
    height: var(--tec-color-swatch-size, var(--_size));
    border: 1px solid var(--tec-border-subtle);
    border-radius: var(--tec-color-swatch-radius, var(--_radius));
    box-shadow: var(--tec-shadow-xs);
    background-clip: padding-box;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }
  .label,
  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label {
    font-weight: var(--tec-font-weight-medium);
  }
  .value {
    font-family: var(--tec-font-mono);
    font-size: var(--tec-text-xs);
    color: var(--tec-muted-foreground);
  }

  /* ---------------------------------------------------------------- editable */
  .trigger {
    all: unset;
    display: inline-flex;
    flex-shrink: 0;
    border-radius: var(--tec-color-swatch-radius, var(--_radius));
    cursor: pointer;
    outline: none;
  }
  .trigger:hover {
    filter: brightness(1.1);
  }
  .trigger:active {
    translate: 0 1px;
    filter: brightness(0.95);
  }
  .trigger:focus-visible {
    box-shadow:
      0 0 0 1px var(--tec-background),
      0 0 0 3px var(--tec-ring);
  }
  :host([disabled]) .trigger {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .picker {
    flex-direction: column;
    gap: 0.75rem;
    box-sizing: border-box;
    min-width: 16rem;
    max-width: calc(100vw - 1rem);
    padding: 0.75rem;
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
  /* Never set display on a closed popover: author rules beat the UA's display:none. */
  .picker:popover-open {
    display: flex;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .heading {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-muted-foreground);
  }
  .separator {
    flex-shrink: 0;
    height: 1px;
    margin: 0;
    border: 0;
    background-color: var(--tec-border-subtle);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .preset {
    display: inline-flex;
    border-radius: var(--_radius);
    cursor: pointer;
    outline: none;
  }
  .preset .swatch {
    --_size: 1.5rem;
  }
  .preset[aria-selected="true"] {
    box-shadow:
      0 0 0 1px var(--tec-popover),
      0 0 0 3px var(--tec-ring);
  }
  .preset:focus-visible {
    box-shadow: 0 0 0 2px var(--tec-ring);
  }
  .preset[aria-selected="true"]:focus-visible {
    box-shadow:
      0 0 0 1px var(--tec-popover),
      0 0 0 3px var(--tec-ring);
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .native {
    --_size: 2rem;
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .native:hover {
    filter: brightness(1.1);
  }
  .native:active {
    translate: 0 1px;
  }
  .native:has(:focus-visible) {
    box-shadow:
      0 0 0 1px var(--tec-popover),
      0 0 0 3px var(--tec-ring);
  }
  .native input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }
  .hex {
    flex: 1 1 auto;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 2rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: transparent;
    color: var(--tec-foreground);
    font-family: var(--tec-font-mono);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    outline: none;
  }
  .hex:hover {
    border-color: var(--tec-input-hover);
  }
  .hex:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }

  @media (prefers-reduced-motion: no-preference) {
    .trigger,
    .native {
      transition-property: filter, translate, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
    .hex {
      transition: color var(--tec-duration) var(--tec-ease), box-shadow var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .swatch {
      forced-color-adjust: none;
      border-color: CanvasText;
    }
    .picker {
      border: 1px solid CanvasText;
    }
    .trigger:focus-visible,
    .preset:focus-visible,
    .native:has(:focus-visible),
    .hex:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    .preset[aria-selected="true"] {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }
`
