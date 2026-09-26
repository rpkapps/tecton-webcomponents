import { css } from "lit"

/*
 * Each variant/appearance pair sets private custom properties on the host:
 *   --_tec-alert-fg    text and icon colour of the box (titles inherit it)
 *   --_tec-alert-desc  description colour (tec-alert-description reads it)
 *   --_bg, --_border   the box
 * They inherit into the slotted light-DOM parts, which is how `tec-alert-title` and
 * `tec-alert-description` pick up the severity colours.
 */
export const alertStyles = css`
  :host {
    --_tec-alert-fg: var(--tec-card-foreground);
    --_tec-alert-desc: var(--tec-muted-foreground);
    --_bg: var(--tec-card);
    --_border: var(--tec-border);

    display: block;
    width: 100%;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
  }

  /* ---------------------------------------------------------------- default variant */
  :host([appearance="outline"]) {
    --_bg: transparent;
    --_border: var(--tec-border-strong);
    --_tec-alert-desc: color-mix(in oklab, var(--_tec-alert-fg) 85%, transparent);
  }
  :host([appearance="filled"]) {
    --_tec-alert-fg: var(--tec-neutral-surface-foreground);
    --_bg: var(--tec-neutral-surface);
    --_border: transparent;
    --_tec-alert-desc: color-mix(in oklab, var(--_tec-alert-fg) 85%, transparent);
  }

  /* ---------------------------------------------------------------- severities */
  :host([variant="destructive"]) {
    --_status: var(--tec-destructive);
    --_surface: var(--tec-destructive-surface);
    --_surface-fg: var(--tec-destructive-surface-foreground);
  }
  :host([variant="success"]) {
    --_status: var(--tec-success);
    --_surface: var(--tec-success-surface);
    --_surface-fg: var(--tec-success-surface-foreground);
  }
  :host([variant="warning"]) {
    --_status: var(--tec-warning);
    --_surface: var(--tec-warning-surface);
    --_surface-fg: var(--tec-warning-surface-foreground);
  }
  :host([variant="info"]) {
    --_status: var(--tec-info);
    --_surface: var(--tec-info-surface);
    --_surface-fg: var(--tec-info-surface-foreground);
  }
  :host(:is([variant="destructive"], [variant="success"], [variant="warning"], [variant="info"])) {
    --_tec-alert-fg: var(--_status);
    --_tec-alert-desc: color-mix(in oklab, var(--_status) 90%, transparent);
  }
  :host(:is([variant="destructive"], [variant="success"], [variant="warning"], [variant="info"])[appearance="outline"]) {
    --_border: var(--_status);
    --_tec-alert-desc: color-mix(in oklab, var(--_status) 85%, transparent);
  }
  :host(:is([variant="destructive"], [variant="success"], [variant="warning"], [variant="info"])[appearance="filled"]) {
    --_tec-alert-fg: var(--_surface-fg);
    --_bg: var(--_surface);
    --_tec-alert-desc: color-mix(in oklab, var(--_surface-fg) 85%, transparent);
  }

  /* ---------------------------------------------------------------- layout */
  .base {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    column-gap: 0.625rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--_border);
    border-radius: var(--tec-alert-radius, var(--tec-radius-md));
    background-color: var(--_bg);
    color: var(--_tec-alert-fg);
  }
  :host(:state(has-icon)) .base {
    grid-template-columns: auto minmax(0, 1fr);
  }
  :host(:state(has-action)) .base,
  :host([dismissible]) .base {
    padding-inline-end: 4.5rem;
  }

  .icon {
    display: none;
    color: currentColor;
    --tec-icon-size: 1rem;
    translate: 0 0.125rem;
  }
  :host(:state(has-icon)) .icon {
    display: flex;
  }
  ::slotted([slot="icon"]) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    color: currentColor;
  }

  .content {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }

  .action {
    position: absolute;
    top: 0.625rem;
    inset-inline-end: 0.75rem;
    display: none;
    align-items: center;
    gap: 0.25rem;
  }
  :host(:state(has-action)) .action,
  :host([dismissible]) .action {
    display: flex;
  }
  ::slotted(tec-button),
  .action tec-button {
    height: 1.75rem;
  }
  ::slotted(tec-button[variant="ghost"]),
  ::slotted(tec-button[variant="link"]),
  .action tec-button {
    --_fg: currentColor;
    --_fg-hover: currentColor;
    --_fg-pressed: currentColor;
    --_fg-expanded: currentColor;
  }
  ::slotted(tec-button[variant="ghost"]),
  .action tec-button {
    --_bg-hover: color-mix(in oklab, currentColor 10%, transparent);
    --_bg-pressed: color-mix(in oklab, currentColor 15%, transparent);
    --_bg-expanded: color-mix(in oklab, currentColor 10%, transparent);
  }

  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

export const alertTitleStyles = css`
  :host {
    display: block;
    grid-column: 1 / -1;
    color: inherit;
    font-weight: var(--tec-font-weight-medium);
  }
  /* !important: page resets (\`a { text-decoration: inherit }\`) beat ::slotted rules otherwise. */
  ::slotted(a) {
    text-decoration-line: underline !important;
    text-underline-offset: 3px !important;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground) !important;
  }
`

export const alertDescriptionStyles = css`
  :host {
    display: block;
    color: var(--_tec-alert-desc, var(--tec-muted-foreground));
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-wrap: balance;
  }
  @media (min-width: 48rem) {
    :host {
      text-wrap: pretty;
    }
  }
  /* !important: page resets (\`a { text-decoration: inherit }\`) beat ::slotted rules otherwise. */
  ::slotted(a) {
    text-decoration-line: underline !important;
    text-underline-offset: 3px !important;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground) !important;
  }
  ::slotted(p:not(:last-child)) {
    margin-block-end: 1rem !important;
  }
`
