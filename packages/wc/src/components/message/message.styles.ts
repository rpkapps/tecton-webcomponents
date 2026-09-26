import { css } from "lit"

/*
 * Layout-only parts. Where a part needs padding (header, footer, avatar circle) it lives on the
 * inner `part="base"`; the flex parameters (gap, justify-content, align-items) are set on the host
 * and inherited by the base, so layout utilities on the element (`class="gap-2"`) still apply.
 */

export const messageGroupStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
`

export const messageStyles = css`
  :host {
    display: flex;
    position: relative;
    width: 100%;
    min-width: 0;
    gap: 0.5rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    /* Neutralises the legacy align="end" presentational hint (text-align) of the attribute. */
    text-align: inherit;
  }
  :host(:state(end)) {
    flex-direction: row-reverse;
  }
`

export const messageAvatarStyles = css`
  :host {
    display: flex;
    align-self: flex-end;
    flex-shrink: 0;
    width: fit-content;
    min-width: 2rem;
  }
  :host(:state(footer)) {
    translate: 0 -2rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    overflow: hidden;
    border-radius: 9999px;
    background-color: var(--tec-muted);
  }
`

export const messageContentStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
  }
  :host(:state(end)) ::slotted(*) {
    align-self: flex-end;
  }
`

export const messageMetaStyles = css`
  :host {
    display: block;
    max-width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    color: var(--tec-muted-foreground);
  }
  .base {
    display: flex;
    align-items: inherit;
    justify-content: inherit;
    flex-wrap: inherit;
    gap: inherit;
    min-width: 0;
    padding-inline: 0.75rem;
  }
  :host(:state(ghost)) .base {
    padding-inline: 0;
  }
`

export const messageFooterStyles = css`
  :host(:state(end)) {
    justify-content: flex-end;
  }
`
