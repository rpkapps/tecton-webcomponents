import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import { TecDialog, TecDialogClose, TecDialogDescription, TecDialogFooter, TecDialogHeader, TecDialogTitle } from "./dialog.js"

defineElement("tec-dialog", TecDialog)
defineElement("tec-dialog-header", TecDialogHeader)
defineElement("tec-dialog-footer", TecDialogFooter)
defineElement("tec-dialog-title", TecDialogTitle)
defineElement("tec-dialog-description", TecDialogDescription)
defineElement("tec-dialog-close", TecDialogClose)

export { TecDialog, TecDialogClose, TecDialogDescription, TecDialogFooter, TecDialogHeader, TecDialogTitle }
