import { defineElement } from "../../internal/define.js"
import { TecMarker, TecMarkerContent, TecMarkerIcon } from "./marker.js"

defineElement("tec-marker", TecMarker)
defineElement("tec-marker-icon", TecMarkerIcon)
defineElement("tec-marker-content", TecMarkerContent)

export { TecMarker, TecMarkerContent, TecMarkerIcon }
