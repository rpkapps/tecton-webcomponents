/**
 * @module chart-funnel
 * The funnel kind (`tec-chart-funnel`).
 */
import { nothing, svg } from "lit"
import type { ChartKind } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * @summary TODO
 *
 * @tag tec-chart-funnel
 */
export class TecChartFunnel extends TecChartPart {}

export const funnelKind: ChartKind = {
  id: "funnel",
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
