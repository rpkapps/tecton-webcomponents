import { defineElement } from "../../internal/define.js"
import "../avatar/define.js"
import "../button/define.js"
import "../shortcuts/define.js"
import "../tooltip/define.js"
import {
  TecAppShell,
  TecAppShellActions,
  TecAppShellAside,
  TecAppShellBody,
  TecAppShellBrand,
  TecAppShellDivider,
  TecAppShellHeader,
  TecAppShellMain,
  TecAppShellNav,
  TecAppShellSidebar,
} from "./app-shell.js"
import { TecAppShellAction, TecAppShellCommandTrigger, TecAppShellOverflowTrigger, TecAppShellUserMenuTrigger } from "./app-shell-action.js"
import { TecAppShellSplit, TecAppShellSplitHandle, TecAppShellSplitPanel } from "./app-shell-split.js"

defineElement("tec-app-shell", TecAppShell)
defineElement("tec-app-shell-header", TecAppShellHeader)
defineElement("tec-app-shell-brand", TecAppShellBrand)
defineElement("tec-app-shell-nav", TecAppShellNav)
defineElement("tec-app-shell-body", TecAppShellBody)
defineElement("tec-app-shell-sidebar", TecAppShellSidebar)
defineElement("tec-app-shell-main", TecAppShellMain)
defineElement("tec-app-shell-aside", TecAppShellAside)
defineElement("tec-app-shell-actions", TecAppShellActions)
defineElement("tec-app-shell-action", TecAppShellAction)
defineElement("tec-app-shell-command-trigger", TecAppShellCommandTrigger)
defineElement("tec-app-shell-divider", TecAppShellDivider)
defineElement("tec-app-shell-overflow-trigger", TecAppShellOverflowTrigger)
defineElement("tec-app-shell-user-menu-trigger", TecAppShellUserMenuTrigger)
// Split parts first: the split drives its panels and handles.
defineElement("tec-app-shell-split-panel", TecAppShellSplitPanel)
defineElement("tec-app-shell-split-handle", TecAppShellSplitHandle)
defineElement("tec-app-shell-split", TecAppShellSplit)

export {
  TecAppShell,
  TecAppShellAction,
  TecAppShellActions,
  TecAppShellAside,
  TecAppShellBody,
  TecAppShellBrand,
  TecAppShellCommandTrigger,
  TecAppShellDivider,
  TecAppShellHeader,
  TecAppShellMain,
  TecAppShellNav,
  TecAppShellOverflowTrigger,
  TecAppShellSidebar,
  TecAppShellSplit,
  TecAppShellSplitHandle,
  TecAppShellSplitPanel,
  TecAppShellUserMenuTrigger,
}
export type { SplitLayoutChangeDetail, SplitOrientation } from "./app-shell-split.js"
