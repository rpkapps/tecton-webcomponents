import { defineElement } from "../../internal/define.js"
import { TecSelect } from "./select.js"
import { TecSelectEmpty, TecSelectGroup, TecSelectItem, TecSelectLabel, TecSelectSeparator } from "./select-item.js"

// Parts first, so the select reads upgraded items on its first render.
defineElement("tec-select-group", TecSelectGroup)
defineElement("tec-select-label", TecSelectLabel)
defineElement("tec-select-item", TecSelectItem)
defineElement("tec-select-separator", TecSelectSeparator)
defineElement("tec-select-empty", TecSelectEmpty)
defineElement("tec-select", TecSelect)

export { TecSelect, TecSelectEmpty, TecSelectGroup, TecSelectItem, TecSelectLabel, TecSelectSeparator }
