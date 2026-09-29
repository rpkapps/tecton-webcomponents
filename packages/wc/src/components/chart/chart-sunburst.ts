/**
 * @module chart-sunburst
 * The sunburst kind (`tec-chart-sunburst`).
 */
import { nothing, svg } from "lit"
import type { ChartKind } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * @summary TODO
 *
 * @tag tec-chart-sunburst
 */
export class TecChartSunburst extends TecChartPart {}

export const sunburstKind: ChartKind = {
  id: "sunburst",
  claims: () => false,
  label: () => "Chart",
  model: () => undefined,
  render: () => svg``,
  payload: () => ({ label: undefined, items: [] }),
  anchor: () => undefined,
  hit: () => -1,
  table: () => nothing,
  legend: () => [],
}
