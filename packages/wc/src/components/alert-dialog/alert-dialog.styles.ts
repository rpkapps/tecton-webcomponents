import { css } from "lit"

export const alertDialogStyles = css`
  .content {
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    max-width: min(calc(100% - 2rem), var(--tec-alert-dialog-max-width, 20rem));
  }
  @media (min-width: 40rem) {
    :host(:not([size="sm"])) .content {
      max-width: min(calc(100% - 2rem), var(--tec-alert-dialog-max-width, 32rem));
    }
  }
`

/* grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center; sm + size default: start-aligned,
   media spanning two rows beside the title and description. */
export const alertDialogHeaderStyles = css`
  :host {
    display: grid;
    grid-template-rows: auto 1fr;
    place-items: center;
    gap: 0.375rem;
    text-align: center;
  }
  :host(:state(has-media)) {
    grid-template-rows: auto auto 1fr;
    column-gap: 1.5rem;
  }
  @media (min-width: 40rem) {
    :host(:not(:state(size-sm))) {
      place-items: start;
      text-align: start;
    }
    :host(:not(:state(size-sm)):state(has-media)) {
      grid-template-rows: auto 1fr;
    }
    :host(:not(:state(size-sm)):state(has-media)) ::slotted(tec-alert-dialog-title) {
      grid-column-start: 2;
    }
  }
`

/* flex flex-col-reverse gap-2 sm:flex-row sm:justify-end; size sm: a two-column grid. */
export const alertDialogFooterStyles = css`
  :host {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
  @media (min-width: 40rem) {
    :host {
      flex-direction: row;
      justify-content: flex-end;
    }
  }
  :host(:state(size-sm)) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .base {
    display: contents;
  }
`

/* mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted, svg size-8;
   row-span-2 beside the text in a default-size dialog from sm up. */
export const alertDialogMediaStyles = css`
  :host {
    display: inline-flex;
    align-items: flex-start;
    width: 4rem;
    height: 4.5rem;
    --tec-icon-size: 2rem;
  }
  @media (min-width: 40rem) {
    :host(:not(:state(size-sm))) {
      grid-row: span 2;
    }
  }
  .base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4rem;
    height: 4rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-alert-dialog-media-background, var(--tec-muted));
    color: inherit;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  ::slotted(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
  }
`

export const alertDialogTitleStyles = css`
  :host {
    display: block;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-lg);
    line-height: var(--tec-text-lg--line-height);
    font-weight: var(--tec-font-weight-medium);
  }
`

export const alertDialogDescriptionStyles = css`
  :host {
    display: block;
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-wrap: balance;
  }
  @media (min-width: 48rem) {
    :host {
      text-wrap: pretty;
    }
  }
  ::slotted(a) {
    text-decoration-line: underline;
    text-underline-offset: 3px;
  }
  ::slotted(a:hover) {
    color: var(--tec-foreground);
  }
`
