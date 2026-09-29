/**
 * @module chart-polar
 * The polar kinds: radar (`tec-chart-radar`) and radial bar (`tec-chart-radial-bar`) charts, with the polar grid and axes.
 */
import { nothing, svg } from "lit"
import type { ChartKind } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * @summary TODO
 *
 * @tag tec-chart-radar
 */
export class TecChartRadar extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-radial-bar
 */
export class TecChartRadialBar extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-polar-grid
 */
export class TecChartPolarGrid extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-polar-angle-axis
 */
export class TecChartPolarAngleAxis extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-polar-radius-axis
 */
export class TecChartPolarRadiusAxis extends TecChartPart {}

export const radarKind: ChartKind = {
  id: "radar",
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

export const radialBarKind: ChartKind = {
  id: "radial-bar",
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
