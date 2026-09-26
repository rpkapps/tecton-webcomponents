import { defineElement } from "../../internal/define.js"
import { TecResizableGroup } from "./resizable-group.js"
import { TecResizableHandle } from "./resizable-handle.js"
import { TecResizablePanel } from "./resizable-panel.js"

// Parts first: the group drives its panels and handles.
defineElement("tec-resizable-panel", TecResizablePanel)
defineElement("tec-resizable-handle", TecResizableHandle)
defineElement("tec-resizable-group", TecResizableGroup)

export { TecResizableGroup, TecResizableHandle, TecResizablePanel }
