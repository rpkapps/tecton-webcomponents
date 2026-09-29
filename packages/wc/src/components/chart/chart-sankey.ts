/**
 * @module chart-sankey
 * The sankey kind (`tec-chart-sankey`): flows between nodes, drawn as ribbons whose thickness is
 * the flow's value, between columns of nodes whose height is their total flow.
 */
import { css, html, nothing, svg } from "lit"
import { property } from "lit/decorators.js"
import { forcedColors, motionSafe } from "../../internal/styles.js"
import { formatValue, type ChartRow } from "./chart-config.js"
import type { Point } from "./chart-engine.js"
import { numeric, type ChartContext, type ChartKind, type ChartModelBase, type Rect } from "./chart-kind.js"
import { textAnchor } from "./chart-funnel.js"
import { TecChartPart } from "./chart-parts.js"
import { sankeyLayout, sankeyLinkPath, sankeyLinkY, type SankeyAlign, type SankeyLayout, type SankeyLinkLayout, type SankeyNodeLayout } from "./chart-sankey-engine.js"

/** One flow of a sankey: from `source` to `target` (node indexes into the chart `data`, or node names). */
export interface ChartSankeyLink {
  source: number | string
  target: number | string
  /** The flow (the field named by the sankey's `key`, `value` by default). */
  value?: number
  [field: string]: unknown
}

/** How the ribbons are coloured. */
export type ChartSankeyLinkColor = "source" | "target" | "gradient" | "neutral"

/**
 * The chart's `data` holds the **nodes** (one row per node, named by `name-key`); the sankey's
 * `links` property holds the **flows** between them — `{ source, target, value }` with `source` and
 * `target` given as node indexes (like Recharts) or node names:
 *
 * ```js
 * chart.data = [{ name: "Solar" }, { name: "Grid" }, { name: "Homes" }]
 * chart.querySelector("tec-chart-sankey").links = [
 *   { source: "Solar", target: "Grid", value: 40 },
 *   { source: 1, target: 2, value: 90 },
 * ]
 * ```
 *
 * Nodes are placed in columns by their longest path from a source (sinks are pushed to the last
 * column with `align="justify"`), sized by `max(incoming, outgoing)`, then relaxed over
 * `iterations` passes so that connected nodes line up and links cross less. Node colours come from
 * the row's `fill`, then from the config entry of the node's name, then from the palette; a link
 * takes its source node's colour. The graph must be acyclic: links that would close a cycle (and
 * self-links, links to unknown nodes, non-positive values) are left out of the drawing and the data
 * table, with a console warning.
 *
 * Node labels sit beside their node, towards the next column (the last column's labels face back
 * into the diagram); a label that would not fit between the columns is shortened with an ellipsis,
 * and labels that would overlap are left out (the tooltip and the data table carry every name).
 *
 * The keyboard visits the nodes (column by column, from the top) and then the links. The tooltip
 * shows a node's incoming and outgoing totals (named by the `incoming` and `outgoing` config
 * entries, "Incoming" and "Outgoing" by default), and "Source → Target" with the value for a link.
 * The data table lists every link (headers from the `source` and `target` config entries and the
 * `key`'s entry), and a second table the node totals.
 *
 * @summary A sankey series of a `tec-chart`: flows between nodes, as ribbons as thick as their value.
 *
 * @tag tec-chart-sankey
 */
export class TecChartSankey extends TecChartPart {
  /** The links (flows) between the nodes of the chart `data`: `{ source, target, value }`. */
  @property({ attribute: false }) links: ChartSankeyLink[] = []

  /** The link field holding the flow values. */
  @property({ reflect: true }) key = "value"

  /** The node field holding the node names (also the config keys of the nodes). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** Width of the nodes, in pixels. */
  @property({ type: Number, attribute: "node-width" }) nodeWidth = 10

  /** Minimum gap between the nodes of a column, in pixels (smaller when a column is crowded). */
  @property({ type: Number, attribute: "node-padding" }) nodePadding = 10

  /** Where the control points of a link's curves sit, as a fraction of its length (0 = straight). */
  @property({ type: Number, attribute: "link-curvature" }) linkCurvature = 0.5

  /** Relaxation passes that line connected nodes up (0 keeps the nodes stacked in data order). */
  @property({ type: Number }) iterations = 32

  /**
   * Which column a node goes to: `justify` (sinks in the last column), `start` (by distance from
   * the sources), `end` (by distance to the sinks) or `center`.
   */
  @property({ reflect: true }) align: SankeyAlign = "justify"

  /**
   * The colour of the links: their `source` node's (default), their `target` node's, a `gradient`
   * from source to target, or `neutral` (a muted grey).
   */
  @property({ attribute: "link-color", reflect: true }) linkColor: ChartSankeyLinkColor = "source"

  /** Hides the node labels (the tooltip and the data table still name every node). */
  @property({ type: Boolean, attribute: "hide-labels" }) hideLabels = false
}

type SankeySpec = Pick<TecChartSankey, "links" | "key" | "nameKey" | "nodeWidth" | "nodePadding" | "linkCurvature" | "iterations" | "align" | "linkColor" | "hideLabels">

interface SankeyNodeDraw {
  /** The item index (keyboard order). */
  item: number
  node: SankeyNodeLayout
  name: string
  color: string
  row: ChartRow | undefined
}

interface SankeyLinkDraw {
  item: number
  link: SankeyLinkLayout
  row: ChartSankeyLink
  d: string
  sx: number
  tx: number
  fill: string
  sourceColor: string
  targetColor: string
}

interface SankeyLabelDraw {
  item: number
  x: number
  y: number
  anchor: "start" | "end"
  text: string
}

export interface SankeyModel extends ChartModelBase {
  kind: "sankey"
  spec: SankeySpec
  layout: SankeyLayout
  /** Every input node's name. */
  names: string[]
  /** The drawn nodes, in keyboard order (item index = position). */
  nodes: SankeyNodeDraw[]
  /** The drawn links, in keyboard order (item index = `nodes.length` + position). */
  links: SankeyLinkDraw[]
  labels: SankeyLabelDraw[]
}

/** Gap between a node and the end of its links, in pixels (the surface gap between touching fills). */
const LINK_GAP = 2
/** Gap between a node and its label, in pixels. */
const LABEL_GAP = 6
/** Half the minimum pointer target, in pixels. */
const HIT = 12

const warned = new WeakSet<object>()

function sankeySpec(ctx: ChartContext): SankeySpec | undefined {
  return ctx.parts(TecChartSankey)[0]
}

/** `text`, shortened with an ellipsis to `max` pixels ("" when not even one character fits). */
export function fitText(text: string, max: number, measure: (text: string) => number): string {
  if (measure(text) <= max) return text
  const chars = [...text]
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(`${chars.slice(0, mid).join("").trimEnd()}…`) <= max) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? `${chars.slice(0, lo).join("").trimEnd()}…` : ""
}

function resolveNode(value: unknown, names: Map<string, number>, count: number): number {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value < count ? value : -1
  if (typeof value === "string") return names.get(value) ?? -1
  return -1
}

function computeModel(ctx: ChartContext): SankeyModel | undefined {
  const spec = sankeySpec(ctx)
  if (!spec) return undefined
  const { rows, margin: m, width: W, height: H } = ctx
  const plot: Rect = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const names = rows.map((row, i) => String(row?.[spec.nameKey] ?? i))
  const nameIndex = new Map<string, number>()
  names.forEach((name, i) => {
    if (!nameIndex.has(name)) nameIndex.set(name, i)
  })
  const inputLinks = Array.isArray(spec.links) ? spec.links : []
  const layout = sankeyLayout(
    rows.length,
    inputLinks.map((link) => ({
      source: resolveNode(link?.source, nameIndex, rows.length),
      target: resolveNode(link?.target, nameIndex, rows.length),
      value: numeric(link?.[spec.key]) ?? 0,
    })),
    {
      x0: plot.x,
      y0: plot.y,
      x1: plot.x + plot.w,
      y1: plot.y + plot.h,
      nodeWidth: Math.max(1, spec.nodeWidth),
      nodePadding: Math.max(0, spec.nodePadding),
      iterations: Math.max(0, Math.round(spec.iterations)),
      align: spec.align,
    }
  )
  if (layout.dropped.length && !warned.has(inputLinks)) {
    warned.add(inputLinks)
    const cyclic = layout.cyclic.length ? ` (${layout.cyclic.length} would close a cycle)` : ""
    console.warn(`tec-chart-sankey: ${layout.dropped.length} link(s) left out${cyclic}: links ${layout.dropped.join(", ")}.`)
  }

  // Nodes in keyboard order: column by column, from the top.
  const visible = layout.nodes.filter((n) => n.value > 0).sort((a, b) => a.column - b.column || a.y0 - b.y0)
  const nodes: SankeyNodeDraw[] = visible.map((node, item) => {
    const row = rows[node.index]
    const name = names[node.index]!
    return { item, node, name, row, color: ctx.rowColor(row, name, node.index) }
  })
  const nodeDraw = new Map(nodes.map((n) => [n.node.index, n]))
  const links: SankeyLinkDraw[] = []
  const curvature = Math.min(1, Math.max(0, spec.linkCurvature))
  for (const source of nodes) {
    for (const l of source.node.sourceLinks) {
      const link = layout.links[l]!
      const target = nodeDraw.get(link.target)!
      const sx = source.node.x1 + LINK_GAP
      const tx = target.node.x0 - LINK_GAP
      const item = nodes.length + links.length
      const fill =
        spec.linkColor === "target"
          ? target.color
          : spec.linkColor === "gradient"
            ? `url(#sankey-link-${item})`
            : spec.linkColor === "neutral"
              ? "var(--tec-muted-foreground)"
              : source.color
      links.push({
        item,
        link,
        row: inputLinks[link.index]!,
        d: sankeyLinkPath(sx, link.y0, tx, link.y1, Math.max(1, link.width), curvature),
        sx,
        tx,
        fill,
        sourceColor: source.color,
        targetColor: target.color,
      })
    }
  }

  const labels = spec.hideLabels ? [] : layoutLabels(nodes, layout, ctx, plot)
  return { kind: "sankey", plot, spec, layout, names, nodes, links, labels, count: nodes.length + links.length }
}

/** Node labels: beside each node towards the next column, shortened to the gap, without overlaps. */
function layoutLabels(nodes: SankeyNodeDraw[], layout: SankeyLayout, ctx: ChartContext, plot: Rect): SankeyLabelDraw[] {
  const last = layout.columns - 1
  if (last < 1) return []
  const fs = ctx.fontSize
  const first = nodes.find((n) => n.node.column === 0)?.node
  const second = nodes.find((n) => n.node.column === 1)?.node
  const gap = first && second ? second.x0 - first.x1 : 0
  const room = gap - 2 * LABEL_GAP
  type Draft = SankeyLabelDraw & { column: number; value: number; full: string; width: number }
  const drafts: Draft[] = nodes.map((n) => {
    const full = ctx.text(n.name)
    const end = n.node.column < last
    const text = fitText(full, room, ctx.measure)
    const mid = (n.node.y0 + n.node.y1) / 2
    return {
      item: n.item,
      column: n.node.column,
      value: n.node.value,
      full,
      text,
      width: ctx.measure(text),
      x: end ? n.node.x1 + LABEL_GAP : n.node.x0 - LABEL_GAP,
      y: Math.min(plot.y + plot.h - fs / 2, Math.max(plot.y + fs / 2, mid)),
      anchor: end ? "start" : "end",
    }
  })
  // The gap before the last column holds labels from both sides: halve the ones that meet.
  const facing = drafts.filter((d) => d.column === last)
  const before = drafts.filter((d) => d.column === last - 1)
  const half = (room - LABEL_GAP) / 2
  for (const a of before)
    for (const b of facing) {
      if (Math.abs(a.y - b.y) >= fs + 2) continue
      if (a.x + a.width + LABEL_GAP <= b.x - b.width) continue
      for (const d of [a, b]) {
        if (d.width > half) {
          d.text = fitText(d.full, half, ctx.measure)
          d.width = ctx.measure(d.text)
        }
      }
    }
  // Labels of one column and side that would overlap: the larger node keeps its label.
  const kept: Draft[] = []
  for (const d of [...drafts].filter((d) => d.text).sort((a, b) => b.value - a.value)) {
    const clash = kept.some((k) => k.column === d.column && k.anchor === d.anchor && Math.abs(k.y - d.y) < fs + 1)
    if (!clash) kept.push(d)
  }
  return kept.sort((a, b) => a.item - b.item).map(({ item, x, y, anchor, text }) => ({ item, x, y, anchor, text }))
}

/** The items related to the active one: itself, and its links and nodes. */
function related(model: SankeyModel, active: number): { nodes: Set<number>; links: Set<number> } | undefined {
  if (active < 0) return undefined
  const nodes = new Set<number>()
  const links = new Set<number>()
  const node = model.nodes[active]
  if (node) {
    nodes.add(node.item)
    for (const l of model.links) {
      if (l.link.source === node.node.index || l.link.target === node.node.index) {
        links.add(l.item)
        for (const n of model.nodes) if (n.node.index === l.link.source || n.node.index === l.link.target) nodes.add(n.item)
      }
    }
    return { nodes, links }
  }
  const link = model.links[active - model.nodes.length]
  if (!link) return undefined
  links.add(link.item)
  for (const n of model.nodes) if (n.node.index === link.link.source || n.node.index === link.link.target) nodes.add(n.item)
  return { nodes, links }
}

function renderSankey(model: SankeyModel, ctx: ChartContext) {
  const focus = related(model, ctx.active)
  const gradients =
    model.spec.linkColor === "gradient"
      ? model.links.map(
          (l) => svg`<linearGradient id="sankey-link-${l.item}" gradientUnits="userSpaceOnUse" x1=${l.sx} x2=${l.tx} y1="0" y2="0">
            <stop offset="0" stop-color=${l.sourceColor}></stop>
            <stop offset="1" stop-color=${l.targetColor}></stop>
          </linearGradient>`
        )
      : []
  return svg`<g class="sankey" ?data-has-active=${!!focus}>
    ${gradients.length ? svg`<defs>${gradients}</defs>` : nothing}
    <g class="links">${model.links.map(
      (l) => svg`<path class="link" d=${l.d} fill=${l.fill} data-index=${l.item}
        ?data-highlight=${focus?.links.has(l.item)} ?data-active=${ctx.active === l.item}></path>`
    )}</g>
    <g class="nodes">${model.nodes.map(({ node, item, color }) => {
      const h = Math.max(1, node.y1 - node.y0)
      const y = node.y1 - node.y0 < 1 ? (node.y0 + node.y1 - 1) / 2 : node.y0
      return svg`<rect class="node" x=${node.x0} y=${y} width=${node.x1 - node.x0} height=${h}
        rx=${Math.min(2, (node.x1 - node.x0) / 2, h / 2)} fill=${color} data-index=${item}
        ?data-highlight=${focus?.nodes.has(item)} ?data-active=${ctx.active === item}></rect>`
    })}</g>
    <g class="node-labels">${model.labels.map(
      (t) => svg`<text class="node-label" x=${t.x} y=${t.y} dy="0.355em" text-anchor=${textAnchor(t.anchor, ctx.rtl)}
        ?data-dim=${!!focus && !focus.nodes.has(t.item)}>${t.text}</text>`
    )}</g>
  </g>`
}

function linkName(model: SankeyModel, link: SankeyLinkDraw, ctx: ChartContext): string {
  // The names are bidi-isolated so the arrow follows the chart's direction whatever script they use.
  const arrow = ctx.rtl ? "←" : "→"
  return `\u2068${ctx.text(model.names[link.link.source])}\u2069 ${arrow} \u2068${ctx.text(model.names[link.link.target])}\u2069`
}

function configLabel(ctx: ChartContext, key: string, fallback: string): string {
  return ctx.config[key]?.label ?? fallback
}

export const sankeyKind: ChartKind<SankeyModel> = {
  id: "sankey",
  mirrored: true,
  claims: (ctx) => ctx.parts(TecChartSankey).length > 0,
  label: () => "Sankey diagram",
  model: computeModel,
  render: renderSankey,
  payload(model, index, ctx) {
    const node = model.nodes[index]
    if (node) {
      const items = [
        { key: "incoming", fallback: "Incoming", value: node.node.in },
        { key: "outgoing", fallback: "Outgoing", value: node.node.out },
      ]
        .filter((entry) => entry.value > 0)
        .map((entry) => ({ name: configLabel(ctx, entry.key, entry.fallback), value: entry.value, color: node.color, row: node.row }))
      return { label: node.name, items }
    }
    const link = model.links[index - model.nodes.length]
    if (!link) return { label: undefined, items: [] }
    return {
      label: undefined,
      items: [{ dataKey: model.spec.key, name: linkName(model, link, ctx), value: link.link.value, color: link.sourceColor, row: link.row as ChartRow }],
    }
  },
  anchor(model, index) {
    const node = model.nodes[index]
    if (node) return { x: (node.node.x0 + node.node.x1) / 2, y: (node.node.y0 + node.node.y1) / 2 }
    const link = model.links[index - model.nodes.length]
    if (!link) return undefined
    const x = (link.sx + link.tx) / 2
    return { x, y: sankeyLinkY(link.sx, link.link.y0, link.tx, link.link.y1, x, model.spec.linkCurvature) }
  },
  hit(model, point, target) {
    const index = (target as SVGElement | undefined)?.dataset?.index
    if (index != null) return Number(index)
    return nearestItem(model, point)
  },
  table(model, ctx) {
    const config = ctx.config
    const valueHeader = config[model.spec.key]?.label ?? model.spec.key
    const format = (v: number) => formatValue(v, ctx.locale)
    return html`<table part="table" class="sr-only">
        <caption>${ctx.name()}</caption>
        <thead>
          <tr>
            <th scope="col">${configLabel(ctx, "source", "Source")}</th>
            <th scope="col">${configLabel(ctx, "target", "Target")}</th>
            <th scope="col">${valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          ${model.links.map(
            (l) => html`<tr>
              <th scope="row">${ctx.text(model.names[l.link.source])}</th>
              <td>${ctx.text(model.names[l.link.target])}</td>
              <td>${format(l.link.value)}</td>
            </tr>`
          )}
        </tbody>
      </table>
      <table part="table" class="sr-only">
        <caption>${ctx.name()}: ${configLabel(ctx, "totals", "Node totals")}</caption>
        <thead>
          <tr>
            <th scope="col">${configLabel(ctx, "node", "Node")}</th>
            <th scope="col">${configLabel(ctx, "incoming", "Incoming")}</th>
            <th scope="col">${configLabel(ctx, "outgoing", "Outgoing")}</th>
          </tr>
        </thead>
        <tbody>
          ${model.layout.nodes.map(
            (n) => html`<tr>
              <th scope="row">${ctx.text(model.names[n.index])}</th>
              <td>${format(n.in)}</td>
              <td>${format(n.out)}</td>
            </tr>`
          )}
        </tbody>
      </table>`
  },
  legend(model) {
    return model.nodes.map((n) => ({ dataKey: n.name, color: n.color, row: n.row }))
  },
}

/** The node or link nearest to `point` within half the minimum pointer target, or -1. */
function nearestItem(model: SankeyModel, point: Point): number {
  for (const { node, item } of model.nodes) {
    const padX = Math.max(0, HIT - (node.x1 - node.x0) / 2)
    const padY = Math.max(0, HIT - (node.y1 - node.y0) / 2)
    if (point.x >= node.x0 - padX && point.x <= node.x1 + padX && point.y >= node.y0 - padY && point.y <= node.y1 + padY) return item
  }
  let best = -1
  let distance = HIT
  for (const l of model.links) {
    if (point.x < l.sx || point.x > l.tx) continue
    const y = sankeyLinkY(l.sx, l.link.y0, l.tx, l.link.y1, point.x, model.spec.linkCurvature)
    const d = Math.max(0, Math.abs(point.y - y) - l.link.width / 2)
    if (d <= distance) {
      distance = d
      best = l.item
    }
  }
  return best
}

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const sankeyStyles = [
  css`
    .sankey .link {
      fill-opacity: 0.35;
      cursor: default;
    }
    .sankey[data-has-active] .link {
      fill-opacity: 0.12;
    }
    .sankey[data-has-active] .link[data-highlight] {
      fill-opacity: 0.6;
    }
    .sankey .node {
      cursor: default;
    }
    .sankey[data-has-active] .node:not([data-highlight]) {
      opacity: 0.4;
    }
    .sankey .node[data-active] {
      stroke: var(--tec-foreground);
      stroke-width: 1.5px;
    }
    .node-label {
      fill: var(--tec-foreground);
      stroke: var(--tec-background);
      stroke-width: 3px;
      stroke-linejoin: round;
      paint-order: stroke;
      pointer-events: none;
    }
    .node-label[data-dim] {
      fill: var(--tec-muted-foreground);
    }
  `,
  motionSafe(css`
    .sankey .links {
      animation: tec-chart-sankey-fade 600ms var(--tec-ease-out, ease-out) both;
    }
    .sankey .nodes,
    .sankey .node-labels {
      animation: tec-chart-sankey-fade 300ms var(--tec-ease-out, ease-out) both;
    }
    .sankey .link,
    .sankey .node {
      transition:
        fill-opacity 150ms var(--tec-ease, ease),
        opacity 150ms var(--tec-ease, ease);
    }
    @keyframes tec-chart-sankey-fade {
      from {
        opacity: 0;
      }
    }
  `),
  forcedColors(css`
    .sankey .link,
    .sankey .node {
      forced-color-adjust: none;
    }
    .sankey .node[data-active] {
      stroke: Highlight;
    }
    .node-label {
      fill: CanvasText;
      stroke: Canvas;
    }
  `),
]

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-sankey": TecChartSankey
  }
}
