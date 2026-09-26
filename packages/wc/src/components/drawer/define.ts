import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import { TecDrawer, TecDrawerClose, TecDrawerDescription, TecDrawerFooter, TecDrawerHeader, TecDrawerTitle } from "./drawer.js"

defineElement("tec-drawer", TecDrawer)
defineElement("tec-drawer-header", TecDrawerHeader)
defineElement("tec-drawer-footer", TecDrawerFooter)
defineElement("tec-drawer-title", TecDrawerTitle)
defineElement("tec-drawer-description", TecDrawerDescription)
defineElement("tec-drawer-close", TecDrawerClose)

export { TecDrawer, TecDrawerClose, TecDrawerDescription, TecDrawerFooter, TecDrawerHeader, TecDrawerTitle }
