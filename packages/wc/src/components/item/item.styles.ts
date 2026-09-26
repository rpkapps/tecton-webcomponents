import { css } from "lit"
import { motionSafe } from "../../internal/styles.js"
import { forwardLayout } from "../card/card.styles.js"

/*
 * `tec-item` is the layout box: its flex row (wrap, alignment, gap) is declared on `:host`, so layout
 * utilities on the element work as on a `div`. The box (border, padding, radius, background, focus
 * ring) is the inner `part="base"` — a `<div>`, or an `<a>` with `href` — which fills the host and
 * inherits the host's layout properties to lay out the slotted parts.
 *
 * The item publishes private custom properties on its host for its parts (media size, content gap,
 * description size, media alignment when a description is present); they inherit into the light DOM.
 * The parts are the layout containers of their own light DOM, so layout utilities on them work.
 */
export const itemStyles = [
  forwardLayout,
  css`
  :host {
    --_tec-item-gap: 0.875rem;
    --_tec-item-padding-inline: 1rem;
    --_tec-item-padding-block: 0.875rem;
    --_tec-item-media-size: 2.5rem;
    --_tec-item-content-gap: 0.25rem;
    --_tec-item-description-size: var(--tec-text-sm);
    --_tec-item-media-align: auto;
    --_tec-item-media-shift: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--_tec-item-gap);
    min-width: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host([size="sm"]) {
    --_tec-item-gap: 0.625rem;
    --_tec-item-padding-inline: 0.75rem;
    --_tec-item-padding-block: 0.625rem;
    --_tec-item-media-size: 2rem;
  }
  :host([size="xs"]) {
    --_tec-item-gap: 0.5rem;
    --_tec-item-padding-inline: 0.625rem;
    --_tec-item-padding-block: 0.5rem;
    --_tec-item-media-size: 1.5rem;
    --_tec-item-content-gap: 0;
    --_tec-item-description-size: var(--tec-text-xs);
  }
  :host(:state(has-description)) {
    --_tec-item-media-align: flex-start;
    --_tec-item-media-shift: 0.125rem;
  }
  .base {
    padding: var(--_tec-item-padding-block) var(--_tec-item-padding-inline);
    border: 1px solid transparent;
    border-radius: var(--tec-radius-md);
    color: inherit;
    font: inherit;
    text-decoration: none;
    outline: none;
  }
  :host([variant="outline"]) .base {
    border-color: var(--tec-border);
  }
  :host([variant="muted"]) .base {
    background-color: color-mix(in oklab, var(--tec-muted) 50%, transparent);
  }
  a.base {
    cursor: pointer;
  }
  a.base:hover {
    background-color: var(--tec-muted);
  }
  @media (forced-colors: active) {
    :host([variant="outline"]) .base {
      border-color: CanvasText;
    }
  }
`,
]

export const itemTransitionStyles = motionSafe(css`
  .base {
    transition-property: color, background-color, border-color;
    transition-duration: var(--tec-duration-fast);
    transition-timing-function: var(--tec-ease);
  }
`)

export const itemGroupStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }
  :host(:state(has-sm)) {
    gap: 0.625rem;
  }
  :host(:state(has-xs)) {
    gap: 0.5rem;
  }
`

export const itemSeparatorStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
  }
  .base {
    height: 1px;
    margin-block: 0.5rem;
    background-color: var(--tec-border);
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
  }
`

export const itemMediaStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    align-self: var(--_tec-item-media-align, auto);
    translate: 0 var(--_tec-item-media-shift, 0);
  }
  ::slotted(svg) {
    pointer-events: none;
  }
  :host([variant="icon"]) ::slotted(svg),
  :host([variant="icon"]) ::slotted(tec-icon) {
    width: 1rem;
    height: 1rem;
  }
  :host([variant="image"]) {
    width: var(--_tec-item-media-size, 2.5rem);
    height: var(--_tec-item-media-size, 2.5rem);
    overflow: hidden;
    border-radius: var(--tec-radius-sm);
  }
  :host([variant="image"]) ::slotted(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const itemContentStyles = css`
  :host {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    gap: var(--_tec-item-content-gap, 0.25rem);
  }
  /* A second content column (e.g. a duration) takes only its own width. */
  :host(:state(after-content)) {
    flex: none;
  }
`

export const itemTitleStyles = css`
  :host {
    display: flex;
    width: fit-content;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    font-size: var(--tec-text-sm);
    line-height: 1.375;
    font-weight: var(--tec-font-weight-medium);
    text-underline-offset: 4px;
  }
`

export const itemDescriptionStyles = css`
  :host {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    color: var(--tec-muted-foreground);
    font-size: var(--_tec-item-description-size, var(--tec-text-sm));
    line-height: 1.5;
    font-weight: var(--tec-font-weight-normal);
    text-align: start;
  }
  ::slotted(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  ::slotted(a:hover) {
    color: var(--tec-primary);
  }
`

export const itemActionsStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`

export const itemHeaderFooterStyles = css`
  :host {
    display: flex;
    flex-basis: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
`
