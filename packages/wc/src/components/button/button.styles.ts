import { css } from "lit"

/*
 * The visual box (border, padding, background, radius, ring) is the inner <button>/<a>
 * (`part="base"`). The host only carries display, sizing and the private variant variables:
 * document-level resets such as Tailwind's preflight (`* { border: 0; padding: 0; margin: 0 }`)
 * beat \`:host\` rules, so box styles on the host would be wiped out in Tailwind apps.
 *
 * Height and width live on the host (size variants) and the base fills it, so layout utilities on
 * the host (`class="w-full h-10"`) resize the button. Round it with `--tec-button-radius`.
 *
 * Each variant only sets private custom properties; the state rules below read them.
 */
export const buttonStyles = css`
  :host {
    /* default variant */
    --_bg: var(--tec-primary);
    --_fg: var(--tec-primary-foreground);
    --_border: var(--tec-button-border-color, transparent);
    --_bg-hover: var(--tec-primary-hover);
    --_fg-hover: var(--tec-primary-hover-foreground);
    --_border-hover: var(--_border);
    --_bg-focus: var(--_bg-hover);
    --_fg-focus: var(--_fg-hover);
    --_bg-pressed: var(--tec-primary-pressed);
    --_fg-pressed: var(--tec-primary-pressed-foreground);
    --_border-pressed: var(--_border);
    --_bg-expanded: var(--tec-primary-active);
    --_fg-expanded: var(--tec-primary-active-foreground);
    --_border-expanded: var(--_border);
    --_ring-border: var(--tec-ring);
    --_ring: var(--tec-focus-ring);
    --_radius: var(--tec-radius-md);
    --_pad: 0.5rem;
    --_pad-icon: 0.375rem;
    --tec-icon-size: 1rem;

    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
    position: relative;
    height: 2rem;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }

  .base {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: var(--_gap, 0.25rem);
    min-width: 0;
    width: 100%;
    height: 100%;
    padding-inline: var(--_pad);
    border: 1px solid var(--_border);
    border-radius: var(--tec-button-radius, var(--_radius));
    background-color: var(--_bg);
    background-clip: padding-box;
    color: var(--_fg);
    font: inherit;
    text-decoration: inherit;
    text-underline-offset: var(--_underline-offset, auto);
    cursor: inherit;
    outline: none;
  }
  :host(:state(has-start)) .base {
    padding-inline-start: var(--_pad-icon);
  }
  :host(:state(has-end)) .base {
    padding-inline-end: var(--_pad-icon);
  }

  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }

  /* ---------------------------------------------------------------- variants */
  :host([variant="outline"]) {
    --_bg: transparent;
    --_fg: var(--tec-outline-foreground);
    --_border: var(--tec-outline-border);
    --_bg-hover: var(--tec-outline-hover);
    --_fg-hover: var(--tec-outline-hover-foreground);
    --_border-hover: var(--tec-outline-hover-border);
    --_bg-pressed: var(--tec-outline-pressed);
    --_fg-pressed: var(--tec-outline-pressed-foreground);
    --_border-pressed: var(--tec-outline-pressed-border);
    --_bg-expanded: var(--tec-outline-active);
    --_fg-expanded: var(--tec-outline-active-foreground);
    --_border-expanded: var(--tec-outline-active-border);
  }
  :host([variant="secondary"]) {
    --_bg: var(--tec-secondary);
    --_fg: var(--tec-secondary-foreground);
    --_bg-hover: var(--tec-secondary-hover);
    --_fg-hover: var(--tec-secondary-hover-foreground);
    --_bg-pressed: var(--tec-secondary-pressed);
    --_fg-pressed: var(--tec-secondary-pressed-foreground);
    --_bg-expanded: var(--tec-secondary-active);
    --_fg-expanded: var(--tec-secondary-active-foreground);
  }
  :host([variant="ghost"]) {
    --_bg: transparent;
    --_fg: var(--tec-ghost-foreground);
    --_bg-hover: var(--tec-ghost-hover);
    --_fg-hover: var(--tec-ghost-hover-foreground);
    --_bg-pressed: var(--tec-ghost-pressed);
    --_fg-pressed: var(--tec-ghost-pressed-foreground);
    --_bg-expanded: var(--tec-ghost-active);
    --_fg-expanded: var(--tec-ghost-active-foreground);
  }
  :host([variant="destructive"]) {
    --_bg: light-dark(
      color-mix(in oklab, var(--tec-destructive) 10%, transparent),
      color-mix(in oklab, var(--tec-destructive) 20%, transparent)
    );
    --_fg: var(--tec-destructive);
    --_bg-hover: light-dark(
      color-mix(in oklab, var(--tec-destructive) 20%, transparent),
      color-mix(in oklab, var(--tec-destructive) 30%, transparent)
    );
    --_fg-hover: var(--_fg);
    --_bg-focus: var(--_bg);
    --_fg-focus: var(--_fg);
    --_bg-pressed: var(--_bg-hover);
    --_fg-pressed: var(--_fg);
    --_bg-expanded: var(--_bg);
    --_fg-expanded: var(--_fg);
    --_ring-border: color-mix(in oklab, var(--tec-destructive) 40%, transparent);
    --_ring: 0 0 0 2px
      light-dark(
        color-mix(in oklab, var(--tec-destructive) 20%, transparent),
        color-mix(in oklab, var(--tec-destructive) 40%, transparent)
      );
  }
  :host([variant="link"]) {
    --_bg: transparent;
    --_fg: var(--tec-link-foreground);
    --_bg-hover: transparent;
    --_fg-hover: var(--tec-link-hover-foreground);
    --_bg-focus: transparent;
    --_fg-focus: var(--_fg);
    --_bg-pressed: transparent;
    --_fg-pressed: var(--tec-link-pressed-foreground);
    --_bg-expanded: transparent;
    --_fg-expanded: var(--tec-link-active-foreground);
    --_underline-offset: 4px;
  }
  :host([variant="link"]:hover) .base {
    text-decoration-line: underline;
  }

  /* ---------------------------------------------------------------- sizes */
  :host([size="xs"]) {
    height: 1.5rem;
    --_radius: min(var(--tec-radius-md), 8px);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    --tec-icon-size: 0.75rem;
  }
  :host([size="sm"]) {
    height: 1.75rem;
    --_radius: min(var(--tec-radius-md), 10px);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host([size="lg"]) {
    height: 2.25rem;
    --_gap: 0.375rem;
    --_pad: 0.625rem;
    --_pad-icon: 0.5rem;
  }
  :host([size="icon"]),
  :host([size="icon-xs"]),
  :host([size="icon-sm"]),
  :host([size="icon-lg"]) {
    width: 2rem;
    --_pad: 0;
    --_pad-icon: 0;
  }
  :host([size="icon-xs"]) {
    width: 1.5rem;
    height: 1.5rem;
    --_radius: min(var(--tec-radius-md), 8px);
    --tec-icon-size: 0.75rem;
  }
  :host([size="icon-sm"]) {
    width: 1.75rem;
    height: 1.75rem;
    --_radius: min(var(--tec-radius-md), 10px);
  }
  :host([size="icon-lg"]) {
    width: 2.25rem;
    height: 2.25rem;
  }

  /* ---------------------------------------------------------------- states (Tailwind variant order) */
  :host(:hover) .base {
    background-color: var(--_bg-hover);
    color: var(--_fg-hover);
    border-color: var(--_border-hover);
  }
  :host(:state(focus-visible)) .base {
    background-color: var(--_bg-focus);
    color: var(--_fg-focus);
    border-color: var(--_ring-border);
    box-shadow: var(--_ring);
  }
  :host(:active) .base {
    background-color: var(--_bg-pressed);
    color: var(--_fg-pressed);
    border-color: var(--_border-pressed);
  }
  :host(:active:not([aria-haspopup])) .base {
    translate: 0 1px;
  }
  :host([aria-expanded="true"]) .base {
    background-color: var(--_bg-expanded);
    color: var(--_fg-expanded);
    border-color: var(--_border-expanded);
  }
  :host([aria-invalid="true"]) .base {
    border-color: light-dark(var(--tec-destructive), color-mix(in oklab, var(--tec-destructive) 50%, transparent));
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host([disabled]),
  :host(:disabled) {
    pointer-events: none;
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow, translate, opacity;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: ButtonText;
    }
    :host(:state(focus-visible)) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    :host([disabled]) .base,
    :host(:disabled) .base {
      border-color: GrayText;
      color: GrayText;
    }
  }
`
