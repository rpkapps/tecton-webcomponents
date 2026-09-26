import { defineElement } from "../../internal/define.js"
import {
  TecContextMenu,
  TecContextMenuGroup,
  TecContextMenuItem,
  TecContextMenuLabel,
  TecContextMenuSeparator,
  TecContextMenuShortcut,
  TecContextMenuSub,
  TecContextMenuSubContent,
  TecContextMenuSubTrigger,
} from "./context-menu.js"

defineElement("tec-context-menu", TecContextMenu)
defineElement("tec-context-menu-sub", TecContextMenuSub)
defineElement("tec-context-menu-sub-content", TecContextMenuSubContent)
defineElement("tec-context-menu-group", TecContextMenuGroup)
defineElement("tec-context-menu-item", TecContextMenuItem)
defineElement("tec-context-menu-sub-trigger", TecContextMenuSubTrigger)
defineElement("tec-context-menu-label", TecContextMenuLabel)
defineElement("tec-context-menu-separator", TecContextMenuSeparator)
defineElement("tec-context-menu-shortcut", TecContextMenuShortcut)

export {
  TecContextMenu,
  TecContextMenuGroup,
  TecContextMenuItem,
  TecContextMenuLabel,
  TecContextMenuSeparator,
  TecContextMenuShortcut,
  TecContextMenuSub,
  TecContextMenuSubContent,
  TecContextMenuSubTrigger,
}
