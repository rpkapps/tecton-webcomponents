/**
 * @module chart-kinds
 * The chart families, in the order they are tried: the first kind that claims a chart draws it.
 * The cartesian kind claims every chart and comes last.
 */
import { cartesianKind } from "./chart-cartesian.js"
import { funnelKind, funnelStyles } from "./chart-funnel.js"
import type { ChartKind } from "./chart-kind.js"
import { pieKind, pieStyles } from "./chart-pie.js"
import { polarStyles, radarKind, radialBarKind } from "./chart-polar.js"
import { sankeyKind, sankeyStyles } from "./chart-sankey.js"
import { sunburstKind, sunburstStyles } from "./chart-sunburst.js"
import { treemapKind, treemapStyles } from "./chart-treemap.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KINDS: ChartKind<any>[] = [sankeyKind, treemapKind, sunburstKind, funnelKind, radarKind, radialBarKind, pieKind, cartesianKind]

/** The styles of every kind module, added after `chartStyles`. */
export const KIND_STYLES = [pieStyles, polarStyles, funnelStyles, treemapStyles, sunburstStyles, sankeyStyles]
