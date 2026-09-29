/**
 * @module chart-sunburst
 * The sunburst kind (`tec-chart-sunburst`): nested data rows drawn as concentric rings, one ring per
 * depth, each node's angle proportional to its value.
 */
import { css, nothing, svg } from "lit"
import { property } from "lit/decorators.js"
import { motionSafe } from "../../internal/styles.js"
import { formatValue } from "./chart-config.js"
import { resolveRadius, sectorPath, type Point } from "./chart-engine.js"
import {
  angleWithin,
  boxInSector,
  buildHierarchy,
  contrastLabelStyles,
  hierarchyLegend,
  hierarchyPayload,
  hierarchyTable,
  pathText,
  polarOf,
  sectorCentroid,
  sunburstLayout,
  tangentRotation,
  targetIndex,
  type Hierarchy,
  type HierarchyFields,
  type HierarchyNode,
  type Sector,
} from "./chart-hierarchy.js"
import type { ChartContext, ChartKind, ChartModelBase } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * The data is an array of nodes, each with a name, a value (on the leaves) and optionally
 * children: `{ name: "Energy", children: [{ name: "Oil", size: 120 }, …] }`. The top-level nodes
 * form the inner ring and each level of children the next ring out; a node spans an angle
 * proportional to its value (a parent's value is the sum of its children), in data order from
 * `start-angle`.
 *
 * Colours come from the top-level nodes — the row's `fill`, else the config entry named by its
 * name, else the chart palette in data order — and every descendant keeps the colour of its
 * top-level ancestor (unless its own row has a `fill`). Sectors are separated by a 2px gap of the
 * chart surface. A sector shows its name only when it fits inside it — horizontally, else along the
 * arc (never upside down); the centre
 * shows the total, or the path and value of the active node. The tooltip and the data table carry
 * every value.
 *
 * The arrow keys move over the nodes in depth-first order (a parent before its children). Angles
 * are not mirrored in right-to-left: like a pie, the chart reads the same in both directions.
 *
 * @summary A sunburst series of a `tec-chart`: a hierarchy drawn as concentric rings, each node's
 * angle proportional to its value.
 *
 * @tag tec-chart-sunburst
 */
export class TecChartSunburst extends TecChartPart {
  /** The data field holding the values of the leaves. */
  @property({ reflect: true }) key = "size"

  /** The data field holding the node names (also the config keys of the nodes). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** The data field holding a node's children. */
  @property({ attribute: "children-key", reflect: true }) childrenKey = "children"

  /**
   * Radius of the hole in the middle (where the total is shown): pixels (`60`) or a percentage of
   * the available radius (`"30%"`). 0 fills the centre.
   */
  @property({ attribute: "inner-radius" }) innerRadius = "30%"

  /** Outer radius: pixels or a percentage of the available radius. */
  @property({ attribute: "outer-radius" }) outerRadius = "100%"

  /** Angle where the first node starts, in degrees counter-clockwise from 3 o'clock. */
  @property({ type: Number, attribute: "start-angle" }) startAngle = 0

  /** Angle where the last node ends. `start-angle` + 360 is a full circle. */
  @property({ type: Number, attribute: "end-angle" }) endAngle = 360

  /** Gap between sibling sectors, in degrees. */
  @property({ type: Number, attribute: "padding-angle" }) paddingAngle = 0

  /** Gap between the rings, in pixels (on top of the 2px surface gap between all sectors). */
  @property({ type: Number, attribute: "ring-padding" }) ringPadding = 0

  /** What the centre calls the whole when no node is active. */
  @property({ attribute: "root-label" }) rootLabel = "Total"
}

type SunburstSpec = HierarchyFields &
  Pick<TecChartSunburst, "innerRadius" | "outerRadius" | "startAngle" | "endAngle" | "paddingAngle" | "ringPadding" | "rootLabel">

/** One node's sector. */
export interface SunburstSector extends Sector {
  node: HierarchyNode
  d: string
  /** The name label, when it fits inside the sector. */
  label?: { x: number; y: number; text: string; rotation: number }
}

export interface SunburstModel extends ChartModelBase {
  kind: "sunburst"
  spec: SunburstSpec
  tree: Hierarchy
  cx: number
  cy: number
  inner: number
  outer: number
  /** One per node, in depth-first order (`sectors[i].node.index === i`). */
  sectors: SunburstSector[]
}

/** Distance kept between a label and its sector's edges, in pixels. */
const LABEL_INSET = 3
/** Nearest-sector hit tolerance along the arc, in pixels (half of the 24px target). */
const HIT_SLOP = 12

function specOf(ctx: ChartContext): SunburstSpec | undefined {
  const part = ctx.parts(TecChartSunburst)[0]
  if (!part) return undefined
  const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback)
  return {
    key: part.key || "size",
    nameKey: part.nameKey || "name",
    childrenKey: part.childrenKey || "children",
    innerRadius: part.innerRadius,
    outerRadius: part.outerRadius,
    startAngle: finite(part.startAngle, 0),
    endAngle: finite(part.endAngle, 360),
    paddingAngle: Math.max(0, finite(part.paddingAngle, 0)),
    ringPadding: Math.max(0, finite(part.ringPadding, 0)),
    rootLabel: part.rootLabel,
  }
}

function computeModel(ctx: ChartContext): SunburstModel | undefined {
  const spec = specOf(ctx)
  if (!spec) return undefined
  const { margin: m, width: W, height: H } = ctx
  const plot = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const maxRadius = Math.min(plot.w, plot.h) / 2
  const outer = Math.max(0, resolveRadius(spec.outerRadius, maxRadius, maxRadius))
  const inner = Math.min(outer, Math.max(0, resolveRadius(spec.innerRadius, maxRadius, 0)))
  const cx = plot.x + plot.w / 2
  const cy = plot.y + plot.h / 2
  const tree = buildHierarchy(ctx.rows, spec, { color: (row, name, i) => ctx.rowColor(row, name, i) })
  const layout = sunburstLayout(tree.roots, {
    startAngle: spec.startAngle,
    endAngle: spec.endAngle,
    paddingAngle: spec.paddingAngle,
    inner,
    outer,
    ringPadding: spec.ringPadding,
    depth: tree.depth,
  })
  const labelHeight = ctx.fontSize + 2
  const sectors = tree.nodes.map((node): SunburstSector => {
    const sector = layout.get(node)!
    const empty = node.value <= 0 || sector.startAngle === sector.endAngle || sector.outer <= sector.inner
    const d = empty ? "" : sectorPath(cx, cy, sector.inner, sector.outer, sector.startAngle, sector.endAngle)
    let label: SunburstSector["label"]
    if (!empty) {
      const text = ctx.text(node.name)
      const center = sectorCentroid(cx, cy, sector)
      const width = ctx.measure(text) * 1.06
      // Horizontal when it fits, else along the arc (tangent to it at the sector's mid angle).
      const tangent = tangentRotation((sector.startAngle + sector.endAngle) / 2)
      const rotation = [0, tangent].find((r) => boxInSector(cx, cy, sector, center, width, labelHeight, LABEL_INSET, r))
      if (rotation != null) label = { x: center.x, y: center.y, text, rotation }
    }
    return { ...sector, node, d, label }
  })
  return { kind: "sunburst", plot, spec, tree, cx, cy, inner, outer, sectors, count: sectors.length }
}

/** The centre text: the active node (its path, else its name) or the total, when it fits in the hole. */
function centerLines(model: SunburstModel, ctx: ChartContext): { value: string; name?: string; big: number } | undefined {
  const { inner } = model
  if (inner <= 0 || !model.tree.nodes.length) return undefined
  const node = model.sectors[ctx.active]?.node
  const big = Math.round(ctx.fontSize * 1.5)
  const value = formatValue(node ? node.value : model.tree.total, ctx.locale)
  // Width available on a line `offset` pixels from the centre, within the hole.
  const room = (offset: number) => 2 * Math.sqrt(Math.max(0, (inner - 4) ** 2 - offset ** 2))
  const valueWidth = ctx.measure(value) * (big / ctx.fontSize) * 1.08
  if (valueWidth > room(big / 2 + 2) * 0.95) return undefined
  const names = node ? [pathText(node, ctx), ctx.text(node.name)] : [model.spec.rootLabel]
  const name = names.find((text) => ctx.measure(text) <= room(big / 2 + ctx.fontSize + 4) * 0.95)
  return { value, name, big }
}

/** The sector index of the ring and angle under `point`, the nearest within the hit slop, or -1. */
function sectorAt(model: SunburstModel, point: Point): number {
  const { angle, radius } = polarOf(model.cx, model.cy, point)
  let best = -1
  let distance = Infinity
  for (const sector of model.sectors) {
    if (!sector.d || radius < sector.inner - 1 || radius > sector.outer + 1) continue
    if (angleWithin(angle, sector.startAngle, sector.endAngle)) return sector.node.index
    // Nearest edge along the arc (for thin sectors and the gaps between them).
    for (const edge of [sector.startAngle, sector.endAngle]) {
      const delta = Math.abs(((((angle - edge) % 360) + 540) % 360) - 180)
      const arc = (delta * Math.PI * radius) / 180
      if (arc < distance) {
        distance = arc
        best = sector.node.index
      }
    }
  }
  return distance <= HIT_SLOP ? best : -1
}

export const sunburstKind: ChartKind<SunburstModel> = {
  id: "sunburst",
  claims: (ctx) => ctx.parts(TecChartSunburst).length > 0,
  label: () => "Sunburst chart",
  model: computeModel,
  render(model, ctx) {
    const active = model.sectors[ctx.active]
    const center = centerLines(model, ctx)
    const { cx, cy } = model
    return svg`<g class="sunburst" style=${`transform-origin: ${cx}px ${cy}px`}>
      <g class="sectors">
        ${model.sectors.map((s) =>
          s.d ? svg`<path class="sunburst-sector" d=${s.d} fill=${s.node.color} data-index=${s.node.index}></path>` : nothing
        )}
      </g>
      <g class="contrast-labels">
        ${model.sectors.map((s) =>
          s.label
            ? svg`<text x=${s.label.x} y=${s.label.y} dy="0.35em" text-anchor="middle" style=${`--tec-chart-cell: ${s.node.color}`}
                transform=${s.label.rotation ? `rotate(${s.label.rotation} ${s.label.x} ${s.label.y})` : nothing}>${s.label.text}</text>`
            : nothing
        )}
      </g>
      ${active?.d ? svg`<path class="sector-outline" d=${active.d}></path>` : nothing}
      ${center
        ? svg`<g class="sunburst-center">
            <text class="center-value" x=${cx} y=${center.name ? cy - 2 : cy} dy=${center.name ? "0" : "0.35em"} text-anchor="middle"
              style=${`font-size: ${center.big}px`}>${center.value}</text>
            ${center.name
              ? svg`<text class="center-name" x=${cx} y=${cy + 4} dy="0.8em" text-anchor="middle">${center.name}</text>`
              : nothing}
          </g>`
        : nothing}
    </g>`
  },
  payload(model, index, ctx) {
    return hierarchyPayload(model.sectors[index]?.node, model.spec, ctx)
  },
  anchor(model, index) {
    const sector = model.sectors[index]
    return sector ? sectorCentroid(model.cx, model.cy, sector) : undefined
  },
  hit(model, point, target) {
    const index = targetIndex(target)
    if (index != null && model.sectors[index]) return index
    return sectorAt(model, point)
  },
  table(model, ctx) {
    return hierarchyTable(model.tree, model.spec, ctx)
  },
  legend(model) {
    return hierarchyLegend(model.tree)
  },
}

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const sunburstStyles = css`
  ${contrastLabelStyles}
  .sunburst-sector {
    stroke: var(--tec-background);
    stroke-width: 2px;
    stroke-linejoin: round;
  }
  .sector-outline {
    fill: none;
    stroke: var(--tec-foreground);
    stroke-width: 2.5px;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .sunburst-center {
    pointer-events: none;
  }
  .center-value {
    fill: var(--tec-foreground);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .center-name {
    fill: var(--tec-muted-foreground);
  }
  ${motionSafe(css`
    .sunburst {
      animation: tec-chart-sunburst-in 400ms var(--tec-ease-out, ease-out) both;
    }
    @keyframes tec-chart-sunburst-in {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
    }
  `)}
  @media (forced-colors: active) {
    .sunburst-sector {
      forced-color-adjust: none;
      stroke: Canvas;
    }
    .sector-outline {
      stroke: Highlight;
    }
    .center-value,
    .center-name {
      fill: CanvasText;
    }
  }
`

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-sunburst": TecChartSunburst
  }
}
