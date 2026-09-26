import { css } from "lit"

export const fieldStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  :host(:state(invalid)) {
    color: var(--tec-destructive);
  }

  /* vertical: every part takes the full width */
  :host(:not([orientation="horizontal"])) ::slotted(*) {
    width: 100%;
  }

  :host([orientation="horizontal"]) {
    flex-direction: row;
    align-items: center;
  }
  :host([orientation="horizontal"]:state(has-content)) {
    align-items: flex-start;
  }
  :host([orientation="horizontal"]) ::slotted(:is(tec-field-label, tec-field-title)) {
    flex: 1 1 auto;
  }
  /* Optical alignment of a box beside a two-line label (mt-px). */
  :host([orientation="horizontal"]:state(has-content)) ::slotted(:is(tec-checkbox, tec-radio-group-item)) {
    translate: 0 1px;
  }

  /* The nearest size container: the enclosing tec-field-group (container names do not cross shadow scopes). */
  @container (min-width: 28rem) {
    :host([orientation="responsive"]) {
      flex-direction: row;
      align-items: center;
    }
    :host([orientation="responsive"]) ::slotted(*) {
      width: auto;
    }
    :host([orientation="responsive"]:state(has-content)) {
      align-items: flex-start;
    }
    :host([orientation="responsive"]) ::slotted(:is(tec-field-label, tec-field-title)) {
      flex: 1 1 auto;
    }
    :host([orientation="responsive"]:state(has-content)) ::slotted(:is(tec-checkbox, tec-radio-group-item)) {
      translate: 0 1px;
    }
  }
`

export const fieldGroupStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    width: 100%;
    container: field-group / inline-size;
  }
  ::slotted(tec-field-group) {
    gap: 1rem;
  }
`

export const fieldSetStyles = css`
  /* The shadow fieldset is the flex box; it takes its layout from the host, so layout classes on
     the element (gap-3, flex-row, items-start) work. */
  :host {
    display: block;
    flex-direction: column;
    gap: 1.5rem;
  }
  :host(:state(compact)) {
    gap: 0.75rem;
  }
  fieldset {
    display: flex;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    gap: inherit;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
  }
`

export const fieldLegendStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    font-weight: var(--tec-font-weight-medium);
  }
  :host([variant="label"]) {
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  .base {
    margin-bottom: 0.75rem;
  }
`

export const fieldContentStyles = css`
  :host {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    gap: 0.25rem;
    line-height: 1.375;
  }
`

export const fieldLabelStyles = css`
  :host {
    width: fit-content;
    line-height: 1.375;
  }
  :host(:state(field-disabled)) {
    opacity: 0.5;
  }

  /* Choice card: a label wrapping a whole tec-field. */
  :host(:state(card)) {
    width: 100%;
  }
  :host(:state(card)) .base {
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-md);
  }
  :host(:state(card):not(:state(disabled)):hover) .base {
    background-color: color-mix(in oklab, var(--tec-muted) 50%, transparent);
  }
  :host(:state(card):state(checked)) .base {
    border-color: light-dark(
      color-mix(in oklab, var(--tec-primary) 30%, transparent),
      color-mix(in oklab, var(--tec-primary) 20%, transparent)
    );
    background-color: light-dark(
      color-mix(in oklab, var(--tec-primary) 5%, transparent),
      color-mix(in oklab, var(--tec-primary) 10%, transparent)
    );
  }
  :host(:state(card):state(focus-visible)) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host(:state(card)) .base {
      border-color: CanvasText;
    }
    :host(:state(card):state(checked)) .base {
      border-color: Highlight;
      border-width: 2px;
    }
    :host(:state(card):state(focus-visible)) .base {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

export const fieldTitleStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    font-size: var(--tec-text-sm);
    font-weight: var(--tec-font-weight-medium);
  }
  :host(:state(field-disabled)) {
    opacity: 0.5;
  }
`

export const fieldDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: 1.5;
    font-weight: var(--tec-font-weight-normal);
    text-align: start;
  }
  /* Same precedence as the reference's utility order: last, second-last, then after-legend. */
  :host(:state(second-last)) .base {
    margin-top: -0.25rem;
  }
  :host(:state(last)) .base {
    margin-top: 0;
  }
  :host(:state(after-legend)) .base {
    margin-top: -0.375rem;
  }
  /* Links in help text (the reset of host documents styles anchors, so these are important). */
  ::slotted(a) {
    text-decoration-line: underline !important;
    text-underline-offset: 4px;
  }
  ::slotted(a:hover) {
    color: var(--tec-primary) !important;
  }
`

export const fieldSeparatorStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  .base {
    position: relative;
    height: 1.25rem;
    margin-block: -0.5rem;
  }
  .line {
    position: absolute;
    inset-inline: 0;
    top: 50%;
    height: 1px;
    background-color: var(--tec-border);
  }
  .content {
    position: relative;
    display: block;
    width: fit-content;
    margin-inline: auto;
    padding-inline: 0.5rem;
    background-color: var(--tec-field-separator-background, var(--tec-background));
    color: var(--tec-muted-foreground);
  }
  :host(:not(:state(has-default))) .content {
    display: none;
  }
  @media (forced-colors: active) {
    .line {
      background-color: CanvasText;
    }
  }
`

export const fieldErrorStyles = css`
  :host {
    display: block;
    color: var(--tec-destructive);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-normal);
  }
  :host(:not(:state(displayed))) {
    display: none !important;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    margin-inline-start: 1rem;
    list-style: disc;
  }
`
