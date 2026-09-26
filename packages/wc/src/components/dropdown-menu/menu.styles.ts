import { css } from "lit"

/**
 * Styles shared by every menu of the library (`tec-dropdown-menu`, `tec-context-menu` and their
 * parts). The families differ only in the few rules at the end of this file.
 */

/** Root menu: the trigger slot plus the floating `role="menu"` surface. */
export const menuRootStyles = css`
  :host {
    display: contents;
  }
  .content {
    flex-direction: column;
    box-sizing: border-box;
    min-width: var(--tec-menu-min-width, 8rem);
    max-width: calc(100vw - 1rem);
    max-height: var(--tec-popup-available-height, 24rem);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0.25rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    outline: none;
    /* A submenu inherits pointer-events from its parent surface in the flat tree; the safe-triangle
       logic turns the parent off while the pointer travels to the submenu. */
    pointer-events: auto;
  }
  /* Never set display on a closed popover: author rules beat the UA's display:none. */
  .content:popover-open {
    display: flex;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }
`

/** Submenu surface: auto width, larger shadow. */
export const menuSubContentStyles = css`
  :host {
    display: contents;
  }
  .content {
    width: var(--tec-menu-sub-width, auto);
    min-width: var(--tec-menu-sub-min-width, 96px);
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-lg);
  }
`

/** Menu item (plain, checkbox, radio) and submenu trigger. */
export const menuItemStyles = css`
  :host {
    display: block;
    outline: none;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    color: inherit;
    --tec-icon-size: 1rem;
  }
  :host([disabled]) {
    pointer-events: none;
  }
  .base {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--tec-radius-sm);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    min-width: 0;
  }
  :host([inset]) .base {
    padding-inline-start: 2rem;
  }
  :host(:state(checkable)) .base {
    padding-inline-end: 2rem;
  }
  :host([disabled]) .base {
    opacity: 0.5;
  }
  :host(:focus) .base,
  :host(:state(open)) .base {
    background-color: var(--tec-accent);
    color: var(--tec-accent-foreground);
  }
  :host(:focus) {
    --tec-menu-shortcut-color: var(--tec-accent-foreground);
  }
  :host([variant="destructive"]) .base {
    color: var(--tec-destructive);
  }
  :host([variant="destructive"]:focus) .base {
    background-color: light-dark(
      color-mix(in oklab, var(--tec-destructive) 10%, transparent),
      color-mix(in oklab, var(--tec-destructive) 20%, transparent)
    );
    color: var(--tec-destructive);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  .indicator {
    position: absolute;
    inset-inline-end: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .indicator svg,
  .chevron {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .chevron {
    margin-inline-start: auto;
    pointer-events: none;
  }
  :host(:dir(rtl)) .chevron {
    transform: scaleX(-1);
  }
  @media (forced-colors: active) {
    :host(:focus) .base,
    :host(:state(open)) .base {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    :host([disabled]) .base {
      color: GrayText;
    }
  }
`

export const menuGroupStyles = css`
  :host {
    display: block;
  }
`

export const menuLabelStyles = css`
  :host {
    display: block;
    user-select: none;
  }
  .base {
    padding: 0.375rem 0.5rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium, 500);
    color: var(--tec-muted-foreground);
  }
  :host([inset]) .base {
    padding-inline-start: 2rem;
  }
`

export const menuSeparatorStyles = css`
  :host {
    display: block;
  }
  .base {
    height: 1px;
    margin: 0.25rem -0.25rem;
    background-color: var(--tec-border);
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
  }
`

/** The shortcut hint grows to fill the row and right-aligns its text (the spec's `ml-auto`, without a host margin). */
export const menuShortcutStyles = css`
  :host {
    display: inline-flex;
    flex: 1 0 auto;
    justify-content: flex-end;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    letter-spacing: 0.1em;
    color: var(--tec-menu-shortcut-color, var(--tec-muted-foreground));
  }
`

export const menuSubStyles = css`
  :host {
    display: contents;
  }
`

// --- context-menu differences --------------------------------------------------------------------

/** Context menus are at least 9rem wide and as wide as their target area by default. */
export const contextMenuRootStyles = css`
  .content {
    min-width: var(--tec-menu-min-width, 9rem);
    width: var(--tec-context-menu-width, var(--tec-context-menu-target-width, auto));
  }
`

/** Context submenus have a border on top of the ring. */
export const contextMenuSubContentStyles = css`
  .content {
    min-width: var(--tec-menu-sub-min-width, 8rem);
    border: 1px solid var(--tec-border);
  }
`

/** The dropdown menu is as wide as its trigger by default (at least 8rem). */
export const dropdownMenuRootStyles = css`
  .content {
    width: var(--tec-dropdown-menu-width, var(--tec-popup-anchor-width, auto));
  }
`
