import { defineElement } from "../../internal/define.js"
import { TecTreeView } from "./tree-view.js"
import { TecTreeViewAction, TecTreeViewVisibilityToggle } from "./tree-view-action.js"
import { TecTreeViewItem } from "./tree-view-item.js"

defineElement("tec-tree-view", TecTreeView)
defineElement("tec-tree-view-item", TecTreeViewItem)
defineElement("tec-tree-view-action", TecTreeViewAction)
defineElement("tec-tree-view-visibility-toggle", TecTreeViewVisibilityToggle)

export { TecTreeView, TecTreeViewAction, TecTreeViewItem, TecTreeViewVisibilityToggle }
