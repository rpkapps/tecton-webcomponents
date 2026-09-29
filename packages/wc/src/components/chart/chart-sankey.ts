/**
 * @module chart-sankey
 * The sankey kind (`tec-chart-sankey`).
 */
import { css, nothing, svg } from "lit"
import type { ChartKind } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * @summary TODO
 *
 * @tag tec-chart-sankey
 */
export class TecChartSankey extends TecChartPart {}

export const sankeyKind: ChartKind = {
  id: "sankey",
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

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const sankeyStyles = css``
