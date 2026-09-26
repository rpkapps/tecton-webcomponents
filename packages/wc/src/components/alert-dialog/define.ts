import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import {
  TecAlertDialog,
  TecAlertDialogAction,
  TecAlertDialogCancel,
  TecAlertDialogDescription,
  TecAlertDialogFooter,
  TecAlertDialogHeader,
  TecAlertDialogMedia,
  TecAlertDialogTitle,
} from "./alert-dialog.js"

defineElement("tec-alert-dialog", TecAlertDialog)
defineElement("tec-alert-dialog-header", TecAlertDialogHeader)
defineElement("tec-alert-dialog-footer", TecAlertDialogFooter)
defineElement("tec-alert-dialog-media", TecAlertDialogMedia)
defineElement("tec-alert-dialog-title", TecAlertDialogTitle)
defineElement("tec-alert-dialog-description", TecAlertDialogDescription)
defineElement("tec-alert-dialog-action", TecAlertDialogAction)
defineElement("tec-alert-dialog-cancel", TecAlertDialogCancel)

export {
  TecAlertDialog,
  TecAlertDialogAction,
  TecAlertDialogCancel,
  TecAlertDialogDescription,
  TecAlertDialogFooter,
  TecAlertDialogHeader,
  TecAlertDialogMedia,
  TecAlertDialogTitle,
}
