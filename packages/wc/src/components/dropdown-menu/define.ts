import { defineElement } from "../../internal/define.js"
import {
  TecDropdownMenu,
  TecDropdownMenuGroup,
  TecDropdownMenuItem,
  TecDropdownMenuLabel,
  TecDropdownMenuSeparator,
  TecDropdownMenuShortcut,
  TecDropdownMenuSub,
  TecDropdownMenuSubContent,
  TecDropdownMenuSubTrigger,
} from "./dropdown-menu.js"

defineElement("tec-dropdown-menu", TecDropdownMenu)
defineElement("tec-dropdown-menu-sub", TecDropdownMenuSub)
defineElement("tec-dropdown-menu-sub-content", TecDropdownMenuSubContent)
defineElement("tec-dropdown-menu-group", TecDropdownMenuGroup)
defineElement("tec-dropdown-menu-item", TecDropdownMenuItem)
defineElement("tec-dropdown-menu-sub-trigger", TecDropdownMenuSubTrigger)
defineElement("tec-dropdown-menu-label", TecDropdownMenuLabel)
defineElement("tec-dropdown-menu-separator", TecDropdownMenuSeparator)
defineElement("tec-dropdown-menu-shortcut", TecDropdownMenuShortcut)

export {
  TecDropdownMenu,
  TecDropdownMenuGroup,
  TecDropdownMenuItem,
  TecDropdownMenuLabel,
  TecDropdownMenuSeparator,
  TecDropdownMenuShortcut,
  TecDropdownMenuSub,
  TecDropdownMenuSubContent,
  TecDropdownMenuSubTrigger,
}
