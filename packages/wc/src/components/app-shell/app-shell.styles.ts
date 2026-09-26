import { css } from "lit"

export const appShellStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100svh;
    min-height: 0;
  }
  .base {
    display: grid;
    grid-template-rows: auto 1fr;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
    background-color: var(--tec-background);
    color: var(--tec-foreground);
  }
`

export const appShellHeaderStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
    height: 3rem;
    min-width: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  .base {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    padding-inline: 0.75rem;
    border-block-end: 1px solid var(--tec-border-subtle);
    background-color: var(--tec-card);
    color: var(--tec-card-foreground);
  }
  @media (forced-colors: active) {
    .base {
      border-block-end-color: CanvasText;
    }
  }
`

export const appShellBrandStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    font-weight: var(--tec-font-weight-medium);
    --tec-icon-size: 1.25rem;
  }
  ::slotted(svg),
  ::slotted(tec-icon),
  ::slotted(img) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
`

export const appShellNavStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1 1 0%;
    min-width: 0;
  }
`

export const appShellBodyStyles = css`
  :host {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
`

/* Shared by the sidebar and the aside: the host carries the size, the base the surface. */
const column = css`
  :host {
    display: flex;
    flex-shrink: 0;
    min-height: 0;
    min-width: 0;
  }
  .base {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

export const appShellSidebarStyles = [
  column,
  css`
    :host {
      width: var(--tec-app-shell-sidebar-width, 16rem);
    }
    .base {
      border-inline-end: 1px solid var(--tec-border-subtle);
      background-color: var(--tec-sidebar);
      color: var(--tec-sidebar-foreground);
    }
  `,
]

export const appShellAsideStyles = [
  column,
  css`
    :host {
      width: var(--tec-app-shell-aside-width, 20rem);
    }
    .base {
      border-inline-start: 1px solid var(--tec-border-subtle);
      background-color: var(--tec-card);
      color: var(--tec-card-foreground);
    }
    /* Inside a split panel the handle draws the divider and the panel sets the width. */
    :host(:state(in-split)) {
      width: 100%;
      height: 100%;
    }
    :host(:state(in-split)) .base {
      border-inline-start-width: 0;
    }
  `,
]

export const appShellMainStyles = css`
  :host {
    display: flex;
    position: relative;
    flex: 1 1 0%;
    min-width: 0;
    min-height: 0;
  }
  .base {
    position: relative;
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
`

export const appShellActionsStyles = css`
  /* Pinned to the end of the header by growing into the free space (a margin on the host would be
     reset by document-level CSS such as Tailwind's preflight). */
  :host {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    flex: 1 0 auto;
  }
`

export const appShellDividerStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
  .base {
    width: 1px;
    height: 1rem;
    margin-inline: 0.25rem;
    background-color: var(--tec-border);
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
  }
`
