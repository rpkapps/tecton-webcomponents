import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import { TecSheet, TecSheetClose, TecSheetDescription, TecSheetFooter, TecSheetHeader, TecSheetTitle } from "./sheet.js"

defineElement("tec-sheet", TecSheet)
defineElement("tec-sheet-header", TecSheetHeader)
defineElement("tec-sheet-footer", TecSheetFooter)
defineElement("tec-sheet-title", TecSheetTitle)
defineElement("tec-sheet-description", TecSheetDescription)
defineElement("tec-sheet-close", TecSheetClose)

export { TecSheet, TecSheetClose, TecSheetDescription, TecSheetFooter, TecSheetHeader, TecSheetTitle }
