import { defineElement } from "../../internal/define.js"
import { TecPopover } from "./popover.js"
import { TecPopoverDescription, TecPopoverHeader, TecPopoverTitle } from "./popover-header.js"

defineElement("tec-popover", TecPopover)
defineElement("tec-popover-header", TecPopoverHeader)
defineElement("tec-popover-title", TecPopoverTitle)
defineElement("tec-popover-description", TecPopoverDescription)

export { TecPopover, TecPopoverDescription, TecPopoverHeader, TecPopoverTitle }
