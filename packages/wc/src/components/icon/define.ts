import { defineElement } from "../../internal/define.js"
import { TecIcon } from "./icon.js"
import { getIcon, iconNames, registerIcon, registerIcons } from "./registry.js"

defineElement("tec-icon", TecIcon)

export { TecIcon, getIcon, iconNames, registerIcon, registerIcons }
