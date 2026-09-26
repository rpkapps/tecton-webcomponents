import { css } from "lit"

/* Breadcrumb parts carry no box (border/padding/background), so their styles live on the host. */

export const breadcrumbStyles = css`
  :host {
    display: block;
  }
`

export const breadcrumbListStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    overflow-wrap: break-word;
    color: var(--tec-muted-foreground);
  }
  @media (min-width: 640px) {
    :host {
      gap: 0.625rem;
    }
  }
`

export const breadcrumbItemStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .separator {
    display: inline-flex;
    align-items: center;
  }
  .separator svg,
  ::slotted([slot="separator"]) {
    width: 0.875rem;
    height: 0.875rem;
  }
  :host(:dir(rtl)) .separator svg {
    transform: scaleX(-1);
  }
`

export const breadcrumbSeparatorStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
  }
  svg,
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: 0.875rem;
    height: 0.875rem;
  }
  :host(:dir(rtl)) svg {
    transform: scaleX(-1);
  }
`

export const breadcrumbLinkStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--tec-link-foreground);
    --tec-icon-size: 1rem;
  }
  .base {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: inherit;
    color: inherit;
    text-underline-offset: 2px;
    border-radius: var(--tec-radius-sm);
    cursor: pointer;
  }
  span.base {
    cursor: inherit;
  }
  :host(:hover) {
    color: var(--tec-link-hover-foreground);
  }
  :host(:hover) .base {
    text-decoration-line: underline;
  }
  :host([current]) .base {
    cursor: default;
  }
  :host([current]:hover) {
    color: var(--tec-link-foreground);
  }
  :host([current]:hover) .base {
    text-decoration-line: none;
  }
  .base:focus-visible {
    outline: 2px solid var(--tec-ring);
    outline-offset: 2px;
  }
  ::slotted(a) {
    color: inherit;
    text-decoration: inherit;
    text-underline-offset: 2px;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    :host {
      transition: color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host {
      color: LinkText;
    }
    .base:focus-visible {
      outline-color: Highlight;
    }
  }
`

export const breadcrumbPageStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 400;
    color: var(--tec-foreground);
    --tec-icon-size: 1rem;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
`

export const breadcrumbEllipsisStyles = css`
  :host {
    display: flex;
    width: 1.25rem;
    height: 1.25rem;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
`
