import { css } from "lit"

export const bubbleGroupStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
`

/*
 * The bubble host is the layout box (width, alignment, position for the reactions). Each variant
 * only sets private custom properties; they inherit into the slotted tec-bubble-content, whose
 * shadow base paints the surface.
 */
export const bubbleStyles = css`
  :host {
    --_bubble-bg: var(--tec-primary);
    --_bubble-fg: var(--tec-primary-foreground);
    --_bubble-border: transparent;
    --_bubble-bg-hover: color-mix(in oklab, var(--tec-primary) 80%, transparent);
    --_bubble-fg-hover: var(--_bubble-fg);
    --_bubble-radius: var(--tec-radius-xl);
    --_bubble-pad-block: 0.5rem;
    --_bubble-pad-inline: 0.75rem;

    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    position: relative;
    width: fit-content;
    max-width: 80%;
    min-width: 0;
    /* Neutralises the legacy align="end" presentational hint (text-align) of the attribute. */
    text-align: inherit;
  }
  :host(:state(end)) {
    align-self: flex-end;
  }
  :host(:state(end)) ::slotted(tec-bubble-content) {
    align-self: flex-end;
  }

  :host([variant="secondary"]) {
    --_bubble-bg: var(--tec-secondary);
    --_bubble-fg: var(--tec-secondary-foreground);
    --_bubble-bg-hover: color-mix(in oklch, var(--tec-secondary), var(--tec-foreground) 5%);
  }
  :host([variant="muted"]) {
    --_bubble-bg: var(--tec-muted);
    --_bubble-fg: currentColor;
    --_bubble-bg-hover: color-mix(in oklch, var(--tec-muted), var(--tec-foreground) 5%);
  }
  :host([variant="tinted"]) {
    --_bubble-bg: light-dark(
      oklch(from var(--tec-primary) 0.93 calc(c * 0.4) h),
      oklch(from var(--tec-primary) 0.3 calc(c * 0.4) h)
    );
    --_bubble-fg: var(--tec-foreground);
    --_bubble-bg-hover: light-dark(
      oklch(from var(--tec-primary) 0.88 calc(c * 0.5) h),
      oklch(from var(--tec-primary) 0.35 calc(c * 0.5) h)
    );
  }
  :host([variant="outline"]) {
    --_bubble-bg: var(--tec-background);
    --_bubble-fg: currentColor;
    --_bubble-border: var(--tec-border);
    --_bubble-bg-hover: light-dark(var(--tec-muted), color-mix(in oklab, var(--tec-input) 30%, transparent));
    --_bubble-fg-hover: var(--tec-foreground);
  }
  :host([variant="ghost"]) {
    --_bubble-bg: transparent;
    --_bubble-fg: currentColor;
    --_bubble-bg-hover: light-dark(var(--tec-muted), color-mix(in oklab, var(--tec-muted) 50%, transparent));
    --_bubble-fg-hover: var(--tec-foreground);
    --_bubble-radius: 0;
    --_bubble-pad-block: 0;
    --_bubble-pad-inline: 0;
    max-width: 100%;
  }
  :host([variant="destructive"]) {
    --_bubble-bg: light-dark(
      color-mix(in oklab, var(--tec-destructive) 10%, transparent),
      color-mix(in oklab, var(--tec-destructive) 20%, transparent)
    );
    --_bubble-fg: var(--tec-destructive);
    --_bubble-bg-hover: light-dark(
      color-mix(in oklab, var(--tec-destructive) 20%, transparent),
      color-mix(in oklab, var(--tec-destructive) 30%, transparent)
    );
  }
`

export const bubbleContentStyles = css`
  :host {
    display: block;
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    font-size: var(--tec-text-sm);
    line-height: 1.625;
    overflow-wrap: break-word;
  }
  .base {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    padding: var(--_bubble-pad-block, 0.5rem) var(--_bubble-pad-inline, 0.75rem);
    border: 1px solid var(--_bubble-border, transparent);
    border-radius: var(--_bubble-radius, var(--tec-radius-xl));
    background-color: var(--_bubble-bg, var(--tec-primary));
    color: var(--_bubble-fg, var(--tec-primary-foreground));
    font: inherit;
    text-align: inherit;
    text-decoration: none;
    overflow-wrap: inherit;
  }
  button.base {
    all: unset;
    box-sizing: border-box;
    display: block;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    padding: var(--_bubble-pad-block, 0.5rem) var(--_bubble-pad-inline, 0.75rem);
    border: 1px solid var(--_bubble-border, transparent);
    border-radius: var(--_bubble-radius, var(--tec-radius-xl));
    background-color: var(--_bubble-bg, var(--tec-primary));
    color: var(--_bubble-fg, var(--tec-primary-foreground));
    font: inherit;
    text-align: start;
    cursor: pointer;
    overflow-wrap: inherit;
  }
  a.base {
    cursor: pointer;
  }
  :is(a, button).base:hover {
    background-color: var(--_bubble-bg-hover);
    color: var(--_bubble-fg-hover);
  }
  :is(a, button).base:focus-visible {
    outline: none;
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  @media (prefers-reduced-motion: no-preference) {
    :is(a, button).base {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :is(a, button).base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const bubbleReactionsStyles = css`
  :host {
    --tec-button-radius: 9999px;
    position: absolute;
    z-index: 10;
    bottom: 0;
    inset-inline-end: 0.75rem;
    translate: 0 75%;
    display: flex;
    width: fit-content;
    flex-shrink: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    /* Neutralises the legacy align="…" presentational hint (text-align) of the attribute. */
    text-align: inherit;
  }
  :host([side="top"]) {
    bottom: auto;
    top: 0;
    translate: 0 -75%;
  }
  :host(:state(align-start)) {
    inset-inline-end: auto;
    inset-inline-start: 0.75rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    background-color: var(--tec-muted);
    color: var(--tec-foreground);
    box-shadow: 0 0 0 2px var(--tec-card);
  }
  :host(:state(has-button)) .base {
    padding: 0;
  }
  @media (forced-colors: active) {
    .base {
      outline: 1px solid CanvasText;
    }
  }
`
