import { defineElement } from "../../internal/define.js"
import { TecChart } from "./chart.js"
import { TecChartFunnel } from "./chart-funnel.js"
import { TecChartLegend } from "./chart-legend.js"
import {
  TecChartArea,
  TecChartBar,
  TecChartBrush,
  TecChartErrorBar,
  TecChartGrid,
  TecChartLabelList,
  TecChartLine,
  TecChartReferenceArea,
  TecChartReferenceDot,
  TecChartReferenceLine,
  TecChartScatter,
  TecChartXAxis,
  TecChartYAxis,
  TecChartZAxis,
} from "./chart-parts.js"
import { TecChartPie } from "./chart-pie.js"
import { TecChartPolarAngleAxis, TecChartPolarGrid, TecChartPolarRadiusAxis, TecChartRadar, TecChartRadialBar } from "./chart-polar.js"
import { TecChartSankey } from "./chart-sankey.js"
import { TecChartSunburst } from "./chart-sunburst.js"
import { TecChartTooltip } from "./chart-tooltip.js"
import { TecChartTreemap } from "./chart-treemap.js"

// Parts first, so the chart's first render sees upgraded children.
defineElement("tec-chart-bar", TecChartBar)
defineElement("tec-chart-line", TecChartLine)
defineElement("tec-chart-area", TecChartArea)
defineElement("tec-chart-scatter", TecChartScatter)
defineElement("tec-chart-pie", TecChartPie)
defineElement("tec-chart-radar", TecChartRadar)
defineElement("tec-chart-radial-bar", TecChartRadialBar)
defineElement("tec-chart-funnel", TecChartFunnel)
defineElement("tec-chart-treemap", TecChartTreemap)
defineElement("tec-chart-sunburst", TecChartSunburst)
defineElement("tec-chart-sankey", TecChartSankey)
defineElement("tec-chart-x-axis", TecChartXAxis)
defineElement("tec-chart-y-axis", TecChartYAxis)
defineElement("tec-chart-z-axis", TecChartZAxis)
defineElement("tec-chart-grid", TecChartGrid)
defineElement("tec-chart-polar-grid", TecChartPolarGrid)
defineElement("tec-chart-polar-angle-axis", TecChartPolarAngleAxis)
defineElement("tec-chart-polar-radius-axis", TecChartPolarRadiusAxis)
defineElement("tec-chart-reference-line", TecChartReferenceLine)
defineElement("tec-chart-reference-area", TecChartReferenceArea)
defineElement("tec-chart-reference-dot", TecChartReferenceDot)
defineElement("tec-chart-label-list", TecChartLabelList)
defineElement("tec-chart-error-bar", TecChartErrorBar)
defineElement("tec-chart-brush", TecChartBrush)
defineElement("tec-chart-tooltip", TecChartTooltip)
defineElement("tec-chart-legend", TecChartLegend)
defineElement("tec-chart", TecChart)

export * from "./chart.js"
