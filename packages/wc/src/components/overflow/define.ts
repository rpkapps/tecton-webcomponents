import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import { TecOverflow, TecToolbar } from "./overflow.js"
import { TecOverflowItem, TecOverflowLabel } from "./overflow-item.js"
import { TecOverflowDivider, TecOverflowGroup, TecOverflowSpacer } from "./overflow-parts.js"

// Parts first, so the row classifies its children as upgraded elements on its first pass.
defineElement("tec-overflow-item", TecOverflowItem)
defineElement("tec-overflow-label", TecOverflowLabel)
defineElement("tec-overflow-group", TecOverflowGroup)
defineElement("tec-overflow-divider", TecOverflowDivider)
defineElement("tec-overflow-spacer", TecOverflowSpacer)
defineElement("tec-overflow", TecOverflow)
defineElement("tec-toolbar", TecToolbar)

export { TecOverflow, TecOverflowDivider, TecOverflowGroup, TecOverflowItem, TecOverflowLabel, TecOverflowSpacer, TecToolbar }
export type { OverflowChangeDetail, OverflowLabels, OverflowLastResort, OverflowOrientation } from "./overflow.js"
export type { OverflowLabelBehavior, OverflowMenuEntry, OverflowMenuForm, OverflowMenuType } from "./overflow-item.js"
