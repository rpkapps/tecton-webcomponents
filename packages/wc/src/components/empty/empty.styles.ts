import { css } from "lit"

/*
 * `tec-empty`: the corner radius sits on the host (CSS resets leave radius alone), the box styles on
 * `part="base"`, which inherits the radius — so a border or background class on the element still
 * gets rounded corners.
 */
export const emptyStyles = css`
  /*
   * The host is the layout box (flex column, centred, gap-4), so layout classes on the element
   * (\`flex-row\`, \`gap-2\`, \`justify-start\`) work; the padded, bordered base inherits the layout
   * and fills the host.
   */
  :host {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-width: 0;
    width: 100%;
    border-radius: var(--tec-empty-radius, var(--tec-radius-lg));
    font-family: var(--tec-font-sans);
    text-align: center;
    text-wrap: balance;
  }
  .base {
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-self: stretch;
    min-width: 0;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    gap: inherit;
    padding: var(--tec-empty-padding, 3rem);
    border: 1px dashed transparent;
    border-radius: inherit;
  }
  :host([variant="outline"]) .base {
    border-color: var(--tec-border);
  }
  :host([variant="muted"]) .base {
    background-color: color-mix(in oklab, var(--tec-muted) 30%, transparent);
  }
  @media (forced-colors: active) {
    :host([variant="outline"]) .base {
      border-color: CanvasText;
    }
  }
`

export const emptyHeaderStyles = css`
  :host {
    display: flex;
    max-width: 24rem;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
`

export const emptyMediaStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }
  .base {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    margin-block-end: 0.5rem;
  }
  ::slotted(svg) {
    flex-shrink: 0;
    pointer-events: none;
  }
  :host([variant="icon"]) {
    --tec-icon-size: 1.5rem;
    color: var(--tec-foreground);
  }
  :host([variant="icon"]) .base {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-muted);
  }
  :host([variant="icon"]) ::slotted(svg),
  :host([variant="icon"]) ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
  }
  @media (forced-colors: active) {
    :host([variant="icon"]) .base {
      border: 1px solid CanvasText;
    }
  }
`

export const emptyTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-heading, var(--tec-font-sans));
    font-size: var(--tec-text-lg);
    line-height: var(--tec-text-lg--line-height);
    font-weight: var(--tec-font-weight-medium);
    letter-spacing: -0.025em;
  }
`

export const emptyDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: 1.625;
  }
  /* !important: page resets (\`a { text-decoration: inherit }\`) beat ::slotted rules otherwise. */
  ::slotted(a) {
    text-decoration-line: underline !important;
    text-underline-offset: 4px !important;
  }
  ::slotted(a:hover) {
    color: var(--tec-primary) !important;
  }
`

export const emptyContentStyles = css`
  :host {
    display: flex;
    width: 100%;
    max-width: 24rem;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-wrap: balance;
  }
`
