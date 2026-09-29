/**
 * @module chart-treemap
 * The treemap kind (`tec-chart-treemap`).
 */
import { css, nothing, svg } from "lit"
import type { ChartKind } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * @summary TODO
 *
 * @tag tec-chart-treemap
 */
export class TecChartTreemap extends TecChartPart {}

export const treemapKind: ChartKind = {
  id: "treemap",
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
export const treemapStyles = css``
