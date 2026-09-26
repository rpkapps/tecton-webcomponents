import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import "../input/define.js"
import "../textarea/define.js"
import { TecInputGroup, TecInputGroupAddon, TecInputGroupText } from "./input-group.js"
import { TecInputGroupButton, TecInputGroupInput, TecInputGroupTextarea } from "./input-group-controls.js"

defineElement("tec-input-group", TecInputGroup)
defineElement("tec-input-group-addon", TecInputGroupAddon)
defineElement("tec-input-group-text", TecInputGroupText)
defineElement("tec-input-group-input", TecInputGroupInput)
defineElement("tec-input-group-textarea", TecInputGroupTextarea)
defineElement("tec-input-group-button", TecInputGroupButton)

export { TecInputGroup, TecInputGroupAddon, TecInputGroupButton, TecInputGroupInput, TecInputGroupText, TecInputGroupTextarea }
