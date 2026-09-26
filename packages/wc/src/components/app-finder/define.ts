import { defineElement } from "../../internal/define.js"
import { TecAppFinder, TecAppFinderGroup, TecAppFinderIcon, TecAppFinderItem, TecAppFinderTrigger } from "./app-finder.js"

defineElement("tec-app-finder-icon", TecAppFinderIcon)
defineElement("tec-app-finder", TecAppFinder)
defineElement("tec-app-finder-trigger", TecAppFinderTrigger)
defineElement("tec-app-finder-group", TecAppFinderGroup)
defineElement("tec-app-finder-item", TecAppFinderItem)

export { TecAppFinder, TecAppFinderGroup, TecAppFinderIcon, TecAppFinderItem, TecAppFinderTrigger }
