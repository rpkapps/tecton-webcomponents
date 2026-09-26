import { defineElement } from "../../internal/define.js"
import { TecToggleGroup } from "./toggle-group.js"
import { TecToggleGroupItem } from "./toggle-group-item.js"

defineElement("tec-toggle-group", TecToggleGroup)
defineElement("tec-toggle-group-item", TecToggleGroupItem)

export { TecToggleGroup, TecToggleGroupItem }
