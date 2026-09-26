import { html } from "lit"
import { AriaDelegateController } from "../../internal/aria.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  appShellActionsStyles,
  appShellAsideStyles,
  appShellBodyStyles,
  appShellBrandStyles,
  appShellDividerStyles,
  appShellHeaderStyles,
  appShellMainStyles,
  appShellNavStyles,
  appShellSidebarStyles,
  appShellStyles,
} from "./app-shell.styles.js"

/**
 * Pure layout: a grid with the header row and the body row. It fills the viewport (`100svh`) and
 * clips its own overflow, so each region scrolls on its own; give it another height with a class
 * (`class="h-72"`) when it is embedded.
 *
 * @summary The application frame: top bar, optional sidebar, main work area and optional aside.
 *
 * @tag tec-app-shell
 *
 * @slot - A `tec-app-shell-header` followed by a `tec-app-shell-body`.
 *
 * @csspart base - The grid (background and text colour; its radius follows the element's).
 */
export class TecAppShell extends TectonElement {
  static styles = [hostStyles, appShellStyles]

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * A native `<header>` in the shadow root: a `banner` landmark when the shell is the page's frame.
 *
 * @summary The solid top bar of the shell (48px).
 *
 * @tag tec-app-shell-header
 *
 * @slot - `tec-app-shell-brand`, `tec-app-shell-nav`, `tec-app-shell-actions`.
 *
 * @csspart base - The `<header>` bar.
 */
export class TecAppShellHeader extends TectonElement {
  static styles = [hostStyles, appShellHeaderStyles]

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.renderRoot.querySelector("header") })
  }

  protected override render() {
    return html`<header class="base" part="base"><slot></slot></header>`
  }
}

/**
 * @summary The product mark and name at the start of the header (or a `tec-app-finder`).
 *
 * @tag tec-app-shell-brand
 *
 * @slot - The logo (SVG or `tec-icon`, sized 20px) and the name.
 *
 * @cssprop --tec-icon-size - Size of the slotted logo (default 1.25rem).
 */
export class TecAppShellBrand extends TectonElement {
  static styles = [hostStyles, appShellBrandStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `navigation` landmark: give it an `aria-label` when the page has other navigation regions.
 *
 * @summary The application's top-level destinations, after the brand.
 *
 * @tag tec-app-shell-nav
 *
 * @slot - Links or ghost buttons (`<tec-button variant="ghost" size="sm" href="…">`).
 */
export class TecAppShellNav extends TectonElement {
  static styles = [hostStyles, appShellNavStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "navigation"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The row below the header that holds the sidebar, the main area and the aside side by side.
 *
 * @tag tec-app-shell-body
 *
 * @slot - `tec-app-shell-sidebar`, `tec-app-shell-main`, `tec-app-shell-aside` or a `tec-app-shell-split`.
 */
export class TecAppShellBody extends TectonElement {
  static styles = [hostStyles, appShellBodyStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `complementary` landmark on the sidebar surface, 256px wide, scrolling on its own. Put a tree
 * view or a `tec-sidebar` inside, and pad the content with a wrapper element.
 *
 * @summary The left column of the shell body.
 *
 * @tag tec-app-shell-sidebar
 *
 * @slot - The navigation content.
 *
 * @csspart base - The column surface (background, end border, scrolling).
 *
 * @cssprop --tec-app-shell-sidebar-width - Width of the column (default 16rem).
 */
export class TecAppShellSidebar extends TectonElement {
  static styles = [hostStyles, appShellSidebarStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "complementary"
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * The `main` landmark and the scrolling region of the work area. A `tec-canvas` placed directly
 * inside fills it.
 *
 * @summary The work area of the shell.
 *
 * @tag tec-app-shell-main
 *
 * @slot - The page content.
 *
 * @csspart base - The scroll container.
 */
export class TecAppShellMain extends TectonElement {
  static styles = [hostStyles, appShellMainStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "main"
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * A `complementary` landmark on the card surface, 320px wide, scrolling on its own; combine it with
 * `tec-panel`. Inside a `tec-app-shell-split-panel` it fills the panel and drops its border (the
 * handle draws the divider).
 *
 * @summary The right column of the shell body, for tool panels.
 *
 * @tag tec-app-shell-aside
 *
 * @slot - The tool panels.
 *
 * @csspart base - The column surface (background, start border, scrolling).
 *
 * @cssprop --tec-app-shell-aside-width - Width of the column (default 20rem).
 *
 * @cssstate in-split - The aside sits in a `tec-app-shell-split-panel`.
 */
export class TecAppShellAside extends TectonElement {
  static styles = [hostStyles, appShellAsideStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "complementary"
    this.toggleState("in-split", !!this.parentElement?.closest("tec-app-shell-split-panel"))
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * The global action cluster at the end of the header: the command palette trigger, icon actions
 * (help, settings, release notes, bug report) and the user menu. These belong to the shell, not to
 * the mounted application. It grows into the free space of the header and aligns its content to
 * the end.
 *
 * @summary The shell's own actions, pinned to the end of the header.
 *
 * @tag tec-app-shell-actions
 *
 * @slot - `tec-app-shell-command-trigger`, `tec-app-shell-action`s, `tec-app-shell-divider`s and menus.
 */
export class TecAppShellActions extends TectonElement {
  static styles = [hostStyles, appShellActionsStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `separator` (vertical) between groups of header actions.
 *
 * @summary A vertical hairline between groups of actions.
 *
 * @tag tec-app-shell-divider
 *
 * @csspart base - The 1×16px line.
 */
export class TecAppShellDivider extends TectonElement {
  static styles = [hostStyles, appShellDividerStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "separator"
    this.internals.ariaOrientation = "vertical"
  }

  protected override render() {
    return html`<span class="base" part="base"></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-app-shell": TecAppShell
    "tec-app-shell-header": TecAppShellHeader
    "tec-app-shell-brand": TecAppShellBrand
    "tec-app-shell-nav": TecAppShellNav
    "tec-app-shell-body": TecAppShellBody
    "tec-app-shell-sidebar": TecAppShellSidebar
    "tec-app-shell-main": TecAppShellMain
    "tec-app-shell-aside": TecAppShellAside
    "tec-app-shell-actions": TecAppShellActions
    "tec-app-shell-divider": TecAppShellDivider
  }
}
