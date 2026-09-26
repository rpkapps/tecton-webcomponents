import { defineElement } from "../../internal/define.js"
import { TecSidebar } from "./sidebar.js"
import {
  TecSidebarMenu,
  TecSidebarMenuAction,
  TecSidebarMenuBadge,
  TecSidebarMenuButton,
  TecSidebarMenuItem,
  TecSidebarMenuSkeleton,
  TecSidebarMenuSub,
  TecSidebarMenuSubButton,
  TecSidebarMenuSubItem,
} from "./sidebar-menu.js"
import {
  TecSidebarContent,
  TecSidebarFooter,
  TecSidebarGroup,
  TecSidebarGroupAction,
  TecSidebarGroupContent,
  TecSidebarGroupLabel,
  TecSidebarHeader,
  TecSidebarInput,
  TecSidebarInset,
  TecSidebarRail,
  TecSidebarSeparator,
  TecSidebarTrigger,
} from "./sidebar-parts.js"
import { TecSidebarProvider } from "./sidebar-provider.js"

// Context providers before their consumers.
defineElement("tec-sidebar-provider", TecSidebarProvider)
defineElement("tec-sidebar", TecSidebar)
defineElement("tec-sidebar-menu-item", TecSidebarMenuItem)
defineElement("tec-sidebar-header", TecSidebarHeader)
defineElement("tec-sidebar-footer", TecSidebarFooter)
defineElement("tec-sidebar-content", TecSidebarContent)
defineElement("tec-sidebar-group", TecSidebarGroup)
defineElement("tec-sidebar-group-label", TecSidebarGroupLabel)
defineElement("tec-sidebar-group-content", TecSidebarGroupContent)
defineElement("tec-sidebar-group-action", TecSidebarGroupAction)
defineElement("tec-sidebar-separator", TecSidebarSeparator)
defineElement("tec-sidebar-trigger", TecSidebarTrigger)
defineElement("tec-sidebar-rail", TecSidebarRail)
defineElement("tec-sidebar-inset", TecSidebarInset)
defineElement("tec-sidebar-input", TecSidebarInput)
defineElement("tec-sidebar-menu", TecSidebarMenu)
defineElement("tec-sidebar-menu-button", TecSidebarMenuButton)
defineElement("tec-sidebar-menu-action", TecSidebarMenuAction)
defineElement("tec-sidebar-menu-badge", TecSidebarMenuBadge)
defineElement("tec-sidebar-menu-skeleton", TecSidebarMenuSkeleton)
defineElement("tec-sidebar-menu-sub", TecSidebarMenuSub)
defineElement("tec-sidebar-menu-sub-item", TecSidebarMenuSubItem)
defineElement("tec-sidebar-menu-sub-button", TecSidebarMenuSubButton)

export {
  TecSidebar,
  TecSidebarContent,
  TecSidebarFooter,
  TecSidebarGroup,
  TecSidebarGroupAction,
  TecSidebarGroupContent,
  TecSidebarGroupLabel,
  TecSidebarHeader,
  TecSidebarInput,
  TecSidebarInset,
  TecSidebarMenu,
  TecSidebarMenuAction,
  TecSidebarMenuBadge,
  TecSidebarMenuButton,
  TecSidebarMenuItem,
  TecSidebarMenuSkeleton,
  TecSidebarMenuSub,
  TecSidebarMenuSubButton,
  TecSidebarMenuSubItem,
  TecSidebarProvider,
  TecSidebarRail,
  TecSidebarSeparator,
  TecSidebarTrigger,
}
