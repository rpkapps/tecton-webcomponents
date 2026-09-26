import { createContext } from "@lit/context"

export type SidebarSide = "left" | "right"
export type SidebarVariant = "sidebar" | "floating" | "inset"
export type SidebarCollapsible = "offcanvas" | "icon" | "none"
export type SidebarOpenChangeReason = "trigger" | "rail" | "shortcut" | "escape" | "outside"

/** What `tec-sidebar-provider` shares with its sidebars, triggers, rails and insets. A new object on every change. */
export interface SidebarProviderContextValue {
  /** Desktop state: expanded (`true`) or collapsed. */
  open: boolean
  /** Whether the mobile sheet is open. */
  openMobile: boolean
  /** Below the mobile breakpoint: sidebars render as a sheet. */
  mobile: boolean
  /** Some sidebar uses `variant="inset"` (the inset gets a margin, radius and shadow). */
  inset: boolean
  /** User toggle (desktop or mobile, whichever applies) — fires the cancelable `tec-open-change`. */
  toggle(reason: SidebarOpenChangeReason, event?: Event): void
  /** User request to open/close the mobile sheet — fires the cancelable `tec-open-change`. */
  requestMobile(open: boolean, reason: SidebarOpenChangeReason, event?: Event): void
}

export const sidebarProviderContext = createContext<SidebarProviderContextValue | undefined>(Symbol("tec-sidebar-provider"))

/** What `tec-sidebar` shares with its parts. */
export interface SidebarContextValue {
  side: SidebarSide
  variant: SidebarVariant
  collapsible: SidebarCollapsible
  /** Desktop and collapsed (whatever `collapsible` is). */
  collapsed: boolean
  /** Collapsed to the icon rail (`collapsible="icon"`): labels hide, buttons shrink to icons, tooltips show. */
  iconCollapsed: boolean
  /** Rendered as the mobile sheet. */
  mobile: boolean
}

export const sidebarContext = createContext<SidebarContextValue | undefined>(Symbol("tec-sidebar"))

/** What `tec-sidebar-menu-item` shares with its button, action and badge. */
export interface SidebarMenuItemContextValue {
  /** The item has a `tec-sidebar-menu-action` (the button leaves room for it). */
  hasAction: boolean
  /** Size of the item's menu button (the action and badge align to it). */
  buttonSize: "default" | "sm" | "lg"
  /** The item's menu button is `active`. */
  buttonActive: boolean
  /** The pointer is over the item or focus is inside it (reveals `show-on-hover` actions). */
  engaged: boolean
}

export const sidebarMenuItemContext = createContext<SidebarMenuItemContextValue | undefined>(Symbol("tec-sidebar-menu-item"))

/** Default widths (the `--tec-sidebar-width*` custom properties override them). */
export const SIDEBAR_WIDTH = "16rem"
export const SIDEBAR_WIDTH_MOBILE = "18rem"
export const SIDEBAR_WIDTH_ICON = "3rem"
