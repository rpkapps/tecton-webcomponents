import { defineElement } from "../../internal/define.js"
import { TecCanvas, TecCanvasLegend, TecCanvasLegendItem, TecCanvasOverlay, TecCanvasSurface, TecCanvasToolbar } from "./canvas.js"

defineElement("tec-canvas", TecCanvas)
defineElement("tec-canvas-surface", TecCanvasSurface)
defineElement("tec-canvas-overlay", TecCanvasOverlay)
defineElement("tec-canvas-toolbar", TecCanvasToolbar)
defineElement("tec-canvas-legend", TecCanvasLegend)
defineElement("tec-canvas-legend-item", TecCanvasLegendItem)

export { TecCanvas, TecCanvasLegend, TecCanvasLegendItem, TecCanvasOverlay, TecCanvasSurface, TecCanvasToolbar }
