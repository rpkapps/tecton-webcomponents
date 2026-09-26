import { defineElement } from "../../internal/define.js"
import { TecPanel, TecPanelActions, TecPanelContent, TecPanelDescription, TecPanelFooter, TecPanelHeader, TecPanelTitle } from "./panel.js"

defineElement("tec-panel", TecPanel)
defineElement("tec-panel-header", TecPanelHeader)
defineElement("tec-panel-title", TecPanelTitle)
defineElement("tec-panel-description", TecPanelDescription)
defineElement("tec-panel-actions", TecPanelActions)
defineElement("tec-panel-content", TecPanelContent)
defineElement("tec-panel-footer", TecPanelFooter)

export { TecPanel, TecPanelActions, TecPanelContent, TecPanelDescription, TecPanelFooter, TecPanelHeader, TecPanelTitle }
export type { PanelSize, PanelVariant } from "./panel.js"
