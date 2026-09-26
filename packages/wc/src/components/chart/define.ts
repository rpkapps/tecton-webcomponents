import { defineElement } from "../../internal/define.js"
import { TecChart } from "./chart.js"
import { TecChartLegend } from "./chart-legend.js"
import {
  TecChartArea,
  TecChartBar,
  TecChartGrid,
  TecChartLine,
  TecChartPie,
  TecChartXAxis,
  TecChartYAxis,
} from "./chart-parts.js"
import { TecChartTooltip } from "./chart-tooltip.js"

// Parts first, so the chart's first render sees upgraded children.
defineElement("tec-chart-bar", TecChartBar)
defineElement("tec-chart-line", TecChartLine)
defineElement("tec-chart-area", TecChartArea)
defineElement("tec-chart-pie", TecChartPie)
defineElement("tec-chart-x-axis", TecChartXAxis)
defineElement("tec-chart-y-axis", TecChartYAxis)
defineElement("tec-chart-grid", TecChartGrid)
defineElement("tec-chart-tooltip", TecChartTooltip)
defineElement("tec-chart-legend", TecChartLegend)
defineElement("tec-chart", TecChart)

export * from "./chart.js"
