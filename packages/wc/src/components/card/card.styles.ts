import { css } from "lit"

/*
 * `tec-card` is the layout box of its parts: a flex column on `:host` spaced by `--tec-card-spacing`
 * (so `gap-*` / `flex-*` classes on the element work). Its surface (background, ring, radius, block
 * padding) is the inner `part="base"`, which inherits that layout (`forwardLayout`).
 *
 * The layout parts (`tec-card-header`, `-content`, `-footer`) follow the library rule "the host is
 * the layout box": their flex/grid layout is declared on `:host`, so layout utilities on the element
 * (`<tec-card-footer class="flex-col gap-2">`) change it exactly as on a `div`. Their inset is a box
 * style, so it lives on the inner `part="base"`, which fills the host and inherits the host's layout
 * properties (see `forwardLayout`): the slotted children are laid out by the base with the layout the
 * host computed.
 *
 * The card publishes `--tec-card-spacing` (and a private title size) on its host; every part
 * inherits them, so a size or spacing change reaches all of them.
 */
/**
 * The inner part of a layout part: fills the host (in a flex or grid host) and takes over the layout
 * the host computed from its own styles and the author's classes.
 */
export const forwardLayout = css`
  .base {
    box-sizing: border-box;
    display: inherit;
    flex: 1 1 auto;
    align-self: stretch;
    grid-column: 1 / -1;
    grid-row: 1 / -1;
    min-width: 0;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    align-content: inherit;
    justify-content: inherit;
    justify-items: inherit;
    row-gap: inherit;
    column-gap: inherit;
    grid-template-columns: inherit;
    grid-template-rows: inherit;
    grid-auto-flow: inherit;
    grid-auto-rows: inherit;
    grid-auto-columns: inherit;
    border-radius: inherit;
  }
`

export const cardStyles = [
  forwardLayout,
  css`
  :host {
    --tec-card-spacing: 1.5rem;
    --_tec-card-title-size: var(--tec-text-base);
    display: flex;
    flex-direction: column;
    gap: var(--tec-card-spacing);
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
`,
]

export const cardHeaderStyles = [
  forwardLayout,
  css`
    :host {
      display: grid;
      grid-auto-rows: min-content;
      align-items: start;
      gap: 0.25rem;
      container: card-header / inline-size;
      border-start-start-radius: var(--tec-radius-xl);
      border-start-end-radius: var(--tec-radius-xl);
    }
    :host(:state(has-action)) {
      grid-template-columns: 1fr auto;
    }
    :host(:state(has-description)) {
      grid-template-rows: auto auto;
    }
    .base {
      padding-inline: var(--tec-card-spacing);
    }
    /* A bottom border (\`class="border-b"\`) gets the matching padding. */
    :host(.border-b) .base {
      padding-block-end: var(--tec-card-spacing);
    }
  `,
]

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

export const cardContentStyles = [
  forwardLayout,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .base {
      padding-inline: var(--tec-card-spacing);
    }
  `,
]

export const cardFooterStyles = [
  forwardLayout,
  css`
    :host {
      display: flex;
      align-items: center;
      border-end-start-radius: var(--tec-radius-xl);
      border-end-end-radius: var(--tec-radius-xl);
    }
    .base {
      padding-inline: var(--tec-card-spacing);
    }
    /* A top border (\`class="border-t"\`) gets the matching padding. */
    :host(.border-t) .base {
      padding-block-start: var(--tec-card-spacing);
    }
  `,
]
