import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import { TecAlert, TecAlertDescription, TecAlertTitle } from "./alert.js"

defineElement("tec-alert", TecAlert)
defineElement("tec-alert-title", TecAlertTitle)
defineElement("tec-alert-description", TecAlertDescription)

export { TecAlert, TecAlertDescription, TecAlertTitle }
