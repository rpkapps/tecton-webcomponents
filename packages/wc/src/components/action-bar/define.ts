import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import "../overflow/define.js"
import { TecActionBar, TecActionBarActions, TecActionBarMessage, TecActionBarSelection } from "./action-bar.js"

defineElement("tec-action-bar", TecActionBar)
defineElement("tec-action-bar-selection", TecActionBarSelection)
defineElement("tec-action-bar-message", TecActionBarMessage)
defineElement("tec-action-bar-actions", TecActionBarActions)

export { TecActionBar, TecActionBarActions, TecActionBarMessage, TecActionBarSelection }
export type { ActionBarPlacement } from "./action-bar.js"
