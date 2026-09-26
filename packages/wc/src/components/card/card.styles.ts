import { css } from "lit"

/*
 * `tec-card` draws its surface (background, ring, radius, block padding) on the inner `part="base"`,
 * which lays its slotted parts out as a column spaced by `--tec-card-spacing`.
 *
 * The parts (`tec-card-header`, `-content`, `-footer` …) are the layout containers of their own light
 * DOM, like the elements they stand for, so layout utilities on them work as expected
 * (`<tec-card-footer class="flex-col gap-2">`). Their inline inset is the card's spacing: it is
 * declared `!important` in `:host` because document resets (`* { padding: 0 }`) would otherwise win
 * over it — important declarations of a shadow tree beat the document's. Change the inset with
 * `--tec-card-spacing`, never with padding classes.
 *
 * The card publishes `--tec-card-spacing` (and a private title size) on its host; every part
 * inherits them, so a size or spacing change reaches all of them.
 */
export const cardStyles = css`
  :host {
    --tec-card-spacing: 1.5rem;
    --_tec-card-title-size: var(--tec-text-base);
    display: flex;
    flex-direction: column;
    min-width: 0;
    color: var(--tec-card-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="sm"]) {
    --tec-card-spacing: 1rem;
    --_tec-card-title-size: var(--tec-text-sm);
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--tec-card-spacing);
    min-width: 0;
    overflow: hidden;
    padding-block: var(--tec-card-spacing);
    border-radius: var(--tec-radius-xl);
    background-color: var(--tec-card);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent);
  }
  /* An image as the first child sits flush with the top edge. */
  :host(:state(image-first)) .base {
    padding-block-start: 0;
  }
  ::slotted(img:first-child) {
    border-start-start-radius: var(--tec-radius-xl);
    border-start-end-radius: var(--tec-radius-xl);
  }
  ::slotted(img:last-child) {
    border-end-start-radius: var(--tec-radius-xl);
    border-end-end-radius: var(--tec-radius-xl);
  }
  @media (forced-colors: active) {
    .base {
      outline: 1px solid CanvasText;
    }
  }
`

export const cardHeaderStyles = css`
  :host {
    display: grid;
    grid-auto-rows: min-content;
    align-items: start;
    gap: 0.25rem;
    container: card-header / inline-size;
    padding-inline: var(--tec-card-spacing) !important;
    border-start-start-radius: var(--tec-radius-xl);
    border-start-end-radius: var(--tec-radius-xl);
  }
  :host(:state(has-action)) {
    grid-template-columns: 1fr auto;
  }
  :host(:state(has-description)) {
    grid-template-rows: auto auto;
  }
  /* A bottom border (\`class="border-b border-border"\`) gets the matching padding. */
  :host(.border-b) {
    padding-block-end: var(--tec-card-spacing) !important;
  }
`

export const cardTitleStyles = css`
  :host {
    display: block;
    font-size: var(--_tec-card-title-size, var(--tec-text-base));
    line-height: 1.5;
    font-weight: var(--tec-font-weight-medium);
  }
`

export const cardDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
`

export const cardActionStyles = css`
  :host {
    display: block;
    grid-column-start: 2;
    grid-row: 1 / span 2;
    align-self: start;
    justify-self: end;
  }
`

export const cardContentStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-inline: var(--tec-card-spacing) !important;
  }
`

export const cardFooterStyles = css`
  :host {
    display: flex;
    align-items: center;
    padding-inline: var(--tec-card-spacing) !important;
    border-end-start-radius: var(--tec-radius-xl);
    border-end-end-radius: var(--tec-radius-xl);
  }
  /* A top border (\`class="border-t border-border"\`) gets the matching padding. */
  :host(.border-t) {
    padding-block-start: var(--tec-card-spacing) !important;
  }
`
