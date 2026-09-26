import { defineElement } from "../../internal/define.js"
import { TecButtonGroup, TecButtonGroupSeparator, TecButtonGroupText } from "./button-group.js"
import "../button/define.js"

defineElement("tec-button-group", TecButtonGroup)
defineElement("tec-button-group-text", TecButtonGroupText)
defineElement("tec-button-group-separator", TecButtonGroupSeparator)

export { TecButtonGroup, TecButtonGroupSeparator, TecButtonGroupText }
