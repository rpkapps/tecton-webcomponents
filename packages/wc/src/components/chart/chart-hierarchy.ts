/**
 * @module chart-hierarchy
 * What the hierarchical kinds (`tec-chart-treemap`, `tec-chart-sunburst`) share: the tree built from
 * nested data rows, its geometry (the squarified treemap layout, the sunburst rings, fitting a label
 * inside a ring sector) and the tooltip, data table and legend of a tree. The geometry is pure
 * functions over numbers, unit-tested in `chart-treemap.test.ts` and `chart-sunburst.test.ts`.
 */
import { css, html, nothing, type TemplateResult } from "lit"
import { formatValue, type ChartLegendItem, type ChartRow } from "./chart-config.js"
import { pieLayout, polarPoint, type Point } from "./chart-engine.js"
import { numeric, type ChartContext, type ChartPayload, type Rect } from "./chart-kind.js"

// ------------------------------------------------------------------------------------------ tree

/** The data fields a hierarchical part reads (its `key`, `name-key` and `children-key`). */
export interface HierarchyFields {
  /** The value field of the leaves. */
  key: string
  /** The name field (also the config key of a node). */
  nameKey: string
  /** The field holding a node's children. */
  childrenKey: string
}

/** One node of the tree. */
export interface HierarchyNode {
  /** Position in depth-first (pre-order) order over the whole tree. */
  index: number
  /** Positions in the data from the top level down, joined with dots (`"2.0"`): stable across sorting. */
  id: string
  row: ChartRow
  name: string
  /** A leaf's own value (0 when missing or negative); a parent's is the sum of its children. */
  value: number
  /** 1 for the top-level rows. */
  depth: number
  parent?: HierarchyNode
  children: HierarchyNode[]
  /** The row's `fill`, else the colour of its top-level ancestor. */
  color: string
}

export interface Hierarchy {
  /** The top-level nodes. */
  roots: HierarchyNode[]
  /** Every node in depth-first (pre-order) order: `nodes[n.index] === n`. */
  nodes: HierarchyNode[]
  /** Sum of the top-level values. */
  total: number
  /** Depth of the deepest node (0 without data). */
  depth: number
}

const MAX_DEPTH = 64

/**
 * Builds the tree from nested rows. `sort` orders siblings by decreasing value (the treemap lays
 * the largest out first); otherwise the data order is kept. `color(row, name, i)` colours the i-th
 * top-level row (the chart's `rowColor`); descendants inherit it unless their row has a `fill`.
 */
export function buildHierarchy(
  rows: readonly unknown[],
  fields: HierarchyFields,
  options: { sort?: boolean; color?: (row: ChartRow, name: string, index: number) => string } = {}
): Hierarchy {
  const build = (row: ChartRow, position: number, parent: HierarchyNode | undefined, id: string): HierarchyNode => {
    const depth = (parent?.depth ?? 0) + 1
    const name = String(row[fields.nameKey] ?? position + 1)
    const fill = typeof row.fill === "string" && row.fill ? row.fill : undefined
    const color = parent ? (fill ?? parent.color) : (options.color?.(row, name, position) ?? fill ?? "currentColor")
    const node: HierarchyNode = { index: -1, id, row, name, value: 0, depth, parent, children: [], color }
    const kids = row[fields.childrenKey]
    if (Array.isArray(kids) && kids.length && depth < MAX_DEPTH) {
      node.children = kids.flatMap((kid, i) => (isRow(kid) ? [build(kid, i, node, `${id}.${i}`)] : []))
    }
    node.value = node.children.length ? node.children.reduce((sum, c) => sum + c.value, 0) : Math.max(0, numeric(row[fields.key]) ?? 0)
    if (options.sort) node.children.sort((a, b) => b.value - a.value)
    return node
  }
  const roots = rows.flatMap((row, i) => (isRow(row) ? [build(row, i, undefined, String(i))] : []))
  if (options.sort) roots.sort((a, b) => b.value - a.value)
  const nodes: HierarchyNode[] = []
  let depth = 0
  const visit = (node: HierarchyNode) => {
    node.index = nodes.length
    nodes.push(node)
    depth = Math.max(depth, node.depth)
    node.children.forEach(visit)
  }
  roots.forEach(visit)
  return { roots, nodes, total: roots.reduce((sum, r) => sum + r.value, 0), depth }
}

function isRow(value: unknown): value is ChartRow {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The node and its ancestors, from the top level down. */
export function ancestry(node: HierarchyNode): HierarchyNode[] {
  const out: HierarchyNode[] = []
  for (let n: HierarchyNode | undefined = node; n; n = n.parent) out.unshift(n)
  return out
}

/** The node's names from the top level down, each through the config labels: `"Energy › Oil"`. */
export function pathText(node: HierarchyNode, ctx: ChartContext): string {
  return ancestry(node)
    .map((n) => ctx.text(n.name))
    .join(" › ")
}

// ------------------------------------------------------------------------------------------ treemap geometry

/** The golden ratio: the default target aspect ratio of treemap cells. */
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2

/**
 * The squarified treemap algorithm (Bruls, Huizing & van Wijk): tiles `rect` with one rectangle per
 * value, areas proportional to the values, in rows whose cells are kept as close as possible to
 * `ratio` (width : height or height : width). Pass the values sorted by decreasing size for the
 * best aspect ratios. Returns the rectangles in the order of `values`; zero values get empty ones.
 */
export function squarify(values: readonly number[], rect: Rect, ratio = GOLDEN_RATIO): Rect[] {
  const n = values.length
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const out: Rect[] = new Array(n)
  let x0 = rect.x
  let y0 = rect.y
  const x1 = rect.x + Math.max(0, rect.w)
  const y1 = rect.y + Math.max(0, rect.h)
  let remaining = clean.reduce((a, b) => a + b, 0)
  ratio = Number.isFinite(ratio) && ratio >= 1 ? ratio : GOLDEN_RATIO
  let i0 = 0
  while (i0 < n) {
    const dx = x1 - x0
    const dy = y1 - y0
    // Start the row with the next non-empty value.
    let i1 = i0
    let sum = 0
    do sum = clean[i1++]!
    while (!sum && i1 < n)
    let min = sum
    let max = sum
    const alpha = remaining > 0 && dx > 0 && dy > 0 ? Math.max(dy / dx, dx / dy) / (remaining * ratio) : 0
    let beta = sum * sum * alpha
    let worst = alpha ? Math.max(max / beta, beta / min) : Infinity
    // Add values to the row while its worst aspect ratio improves.
    for (; i1 < n; i1++) {
      const value = clean[i1]!
      const nextSum = sum + value
      const nextMin = Math.min(min, value)
      const nextMax = Math.max(max, value)
      beta = nextSum * nextSum * alpha
      const next = Math.max(nextMax / beta, beta / nextMin)
      if (!(next <= worst)) break
      sum = nextSum
      min = nextMin
      max = nextMax
      worst = next
    }
    // Lay the row out along the shorter side of what is left.
    const share = remaining > 0 ? sum / remaining : 0
    if (dx < dy) {
      const h = i1 >= n ? y1 - y0 : dy * share
      let x = x0
      for (let i = i0; i < i1; i++) {
        const w = sum > 0 ? (dx * clean[i]!) / sum : 0
        out[i] = { x, y: y0, w, h }
        x += w
      }
      y0 += h
    } else {
      const w = i1 >= n ? x1 - x0 : dx * share
      let y = y0
      for (let i = i0; i < i1; i++) {
        const h = sum > 0 ? (dy * clean[i]!) / sum : 0
        out[i] = { x: x0, y, w, h }
        y += h
      }
      x0 += w
    }
    remaining -= sum
    i0 = i1
  }
  return out
}

/** Options of {@link treemapLayout}. */
export interface TreemapLayoutOptions {
  /** Target aspect ratio of the cells. */
  ratio?: number
  /** Space between a parent's edge and its children, in pixels (0: children fill their parent). */
  padding?: number
  /** Height of a parent's header band (its label), used when `padding` > 0 and the parent is tall enough. */
  header?: number
  /** How many levels to lay out (1: only `nodes`). All by default. */
  levels?: number
}

/** A node's rectangle and the height of its header band (0 when it has none). */
export interface TreemapBox extends Rect {
  header: number
}

/**
 * Lays out `nodes` (siblings, sorted by decreasing value) and all their descendants inside `rect`.
 * Returns a map from node to its box.
 */
export function treemapLayout(nodes: readonly HierarchyNode[], rect: Rect, options: TreemapLayoutOptions = {}): Map<HierarchyNode, TreemapBox> {
  const padding = Math.max(0, options.padding ?? 0)
  const headerSize = padding > 0 ? Math.max(0, options.header ?? 0) : 0
  const boxes = new Map<HierarchyNode, TreemapBox>()
  const levels = options.levels ?? Infinity
  const level = (siblings: readonly HierarchyNode[], area: Rect, depth: number) => {
    const rects = squarify(
      siblings.map((s) => s.value),
      area,
      options.ratio
    )
    siblings.forEach((node, i) => {
      const r = rects[i]!
      // A header only when the children keep at least as much height as it takes.
      const header = node.children.length && headerSize && r.h - 2 * padding >= 2 * headerSize ? headerSize : 0
      boxes.set(node, { ...r, header })
      if (!node.children.length || depth >= levels) return
      const inner = { x: r.x + padding, y: r.y + padding + header, w: Math.max(0, r.w - 2 * padding), h: Math.max(0, r.h - 2 * padding - header) }
      level(node.children, inner, depth + 1)
    })
  }
  level(nodes, rect, 1)
  return boxes
}

// ------------------------------------------------------------------------------------------ sunburst geometry

/** A ring sector: angles in degrees (counter-clockwise from 3 o'clock), radii in pixels. */
export interface Sector {
  startAngle: number
  endAngle: number
  inner: number
  outer: number
}

/** Options of {@link sunburstLayout}. */
export interface SunburstLayoutOptions {
  startAngle?: number
  endAngle?: number
  /** Angle between siblings, in degrees. */
  paddingAngle?: number
  inner: number
  outer: number
  /** Space between rings, in pixels. */
  ringPadding?: number
  /** Number of rings (the tree's depth). */
  depth: number
}

/**
 * Lays out a sunburst: one ring per depth, of equal thickness from `inner` to `outer`; each
 * top-level node spans an angle proportional to its value, and each child a share of its parent's
 * angle proportional to its value.
 */
export function sunburstLayout(roots: readonly HierarchyNode[], options: SunburstLayoutOptions): Map<HierarchyNode, Sector> {
  const { inner, outer, depth } = options
  const pad = options.paddingAngle ?? 0
  const ringPadding = Math.max(0, options.ringPadding ?? 0)
  const thickness = depth > 0 ? Math.max(0, outer - inner) / depth : 0
  const sectors = new Map<HierarchyNode, Sector>()
  const level = (siblings: readonly HierarchyNode[], start: number, end: number) => {
    const slices = pieLayout(
      siblings.map((s) => s.value),
      start,
      end,
      pad
    )
    siblings.forEach((node, i) => {
      const slice = slices[i]!
      const r0 = inner + (node.depth - 1) * thickness + (node.depth > 1 ? ringPadding / 2 : 0)
      const r1 = inner + node.depth * thickness - (node.depth < depth ? ringPadding / 2 : 0)
      sectors.set(node, { startAngle: slice.startAngle, endAngle: slice.endAngle, inner: r0, outer: Math.max(r0, r1) })
      if (node.children.length) level(node.children, slice.startAngle, slice.endAngle)
    })
  }
  level(roots, options.startAngle ?? 0, options.endAngle ?? 360)
  return sectors
}

/** Whether `angle` lies within the arc from `start` to `end` (either direction, any turn). */
export function angleWithin(angle: number, start: number, end: number): boolean {
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  if (hi - lo >= 360) return true
  const a = lo + ((((angle - lo) % 360) + 360) % 360)
  return a <= hi + 1e-9
}

/** The angle (degrees, counter-clockwise from 3 o'clock, in [0, 360)) and radius of `point` around `(cx, cy)`. */
export function polarOf(cx: number, cy: number, point: Point): { angle: number; radius: number } {
  const dx = point.x - cx
  const dy = point.y - cy
  const angle = ((((-Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360
  return { angle, radius: Math.hypot(dx, dy) }
}

/** Whether `point` lies inside the ring sector around `(cx, cy)`, `inset` pixels away from its edges. */
export function inSector(cx: number, cy: number, sector: Sector, point: Point, inset = 0): boolean {
  const { angle, radius } = polarOf(cx, cy, point)
  if (radius < sector.inner + inset - 1e-9 || radius > sector.outer - inset + 1e-9) return false
  const span = Math.abs(sector.endAngle - sector.startAngle)
  if (span >= 360) return true
  if (!angleWithin(angle, sector.startAngle, sector.endAngle)) return false
  if (inset <= 0) return true
  // Distance to the two radial edges.
  const RAD = Math.PI / 180
  for (const edge of [sector.startAngle, sector.endAngle]) {
    const delta = Math.abs(((((angle - edge) % 360) + 540) % 360) - 180)
    if (delta < 90 && radius * Math.sin(delta * RAD) < inset) return false
  }
  return true
}

/**
 * Whether a box of `width` × `height` centred on `center` — horizontal, or turned by `rotation`
 * degrees (clockwise, as SVG's `rotate()`) — fits inside the ring sector, `inset` pixels from its
 * edges. Samples the box outline (corners and points along the edges) and checks that the box
 * stays clear of the inner circle.
 */
export function boxInSector(cx: number, cy: number, sector: Sector, center: Point, width: number, height: number, inset = 2, rotation = 0): boolean {
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const at = (u: number, v: number): Point => ({ x: center.x + u * cos - v * sin, y: center.y + u * sin + v * cos })
  // Nearest point of the box to the centre (in the box's frame): the box must clear the inner radius.
  const du = (cx - center.x) * cos + (cy - center.y) * sin
  const dv = -(cx - center.x) * sin + (cy - center.y) * cos
  const nu = Math.min(Math.max(du, -width / 2), width / 2)
  const nv = Math.min(Math.max(dv, -height / 2), height / 2)
  if (Math.hypot(nu - du, nv - dv) < sector.inner + inset) return false
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const t = i / steps - 0.5
    const points = [at(t * width, -height / 2), at(t * width, height / 2), at(-width / 2, t * height), at(width / 2, t * height)]
    if (!points.every((p) => inSector(cx, cy, sector, p, inset))) return false
  }
  return true
}

/**
 * The rotation (degrees, clockwise) that lays text along the tangent of a circle at `angle`
 * (counter-clockwise from 3 o'clock), turned so that it never reads upside down.
 */
export function tangentRotation(angle: number): number {
  let rotation = ((((90 - angle) % 360) + 540) % 360) - 180
  if (rotation > 90) rotation -= 180
  else if (rotation < -90) rotation += 180
  return rotation
}

/** The centre of a ring sector (mid angle, mid radius; the centre itself for a full disc). */
export function sectorCentroid(cx: number, cy: number, sector: Sector): Point {
  const full = Math.abs(sector.endAngle - sector.startAngle) >= 359.999
  if (full && sector.inner <= 0) return { x: cx, y: cy }
  return polarPoint(cx, cy, (sector.inner + sector.outer) / 2, (sector.startAngle + sector.endAngle) / 2)
}

// ------------------------------------------------------------------------------------------ tooltip, table, legend

/** The tooltip of a node: its path as the label, its value named by the value key. */
export function hierarchyPayload(node: HierarchyNode | undefined, fields: HierarchyFields, ctx: ChartContext): ChartPayload {
  if (!node) return { label: undefined, items: [] }
  return {
    label: pathText(node, ctx),
    items: [{ dataKey: fields.key, name: fields.key, value: node.value, color: node.color, row: node.row }],
  }
}

/** The legend: one entry per top-level node. */
export function hierarchyLegend(tree: Hierarchy): ChartLegendItem[] {
  return tree.roots.map((node) => ({ dataKey: node.name, color: node.color, row: node.row }))
}

/** The data table: one row per node (depth-first), with its path, its value and its share of its parent. */
export function hierarchyTable(tree: Hierarchy, fields: HierarchyFields, ctx: ChartContext): TemplateResult | typeof nothing {
  if (!tree.nodes.length) return nothing
  const config = ctx.config
  const percent = new Intl.NumberFormat(ctx.locale, { style: "percent", maximumFractionDigits: 1 })
  return html`<table part="table" class="sr-only">
    <caption>${ctx.name()}</caption>
    <thead>
      <tr>
        <th scope="col">${config[fields.nameKey]?.label ?? fields.nameKey}</th>
        <th scope="col">${config[fields.key]?.label ?? fields.key}</th>
        <th scope="col">Share of parent</th>
      </tr>
    </thead>
    <tbody>
      ${tree.nodes.map((node) => {
        const whole = node.parent ? node.parent.value : tree.total
        return html`<tr>
          <th scope="row">${pathText(node, ctx)}</th>
          <td>${formatValue(node.value, ctx.locale)}</td>
          <td>${whole > 0 ? percent.format(node.value / whole) : ""}</td>
        </tr>`
      })}
    </tbody>
  </table>`
}

/** The index carried by the SVG element under the pointer, if any. */
export function targetIndex(target: Element | undefined): number | undefined {
  const index = (target as SVGElement | undefined)?.dataset?.index
  return index != null && index !== "" ? Number(index) : undefined
}

/**
 * Text on a filled mark: black or white, whichever contrasts most with the mark's colour
 * (`--tec-chart-cell`, set on the text). `contrast-color()` where supported; else computed with the
 * relative colour syntax (the lightness threshold that passes WCAG AA); else the chart surface
 * colour, inherited from the label group — which contrasts with the chart palette in both themes.
 * An invalid colour at computed-value time falls back to the inherited fill too (`fill` inherits).
 */
export const contrastLabelStyles = css`
  .contrast-labels {
    fill: var(--tec-background);
    pointer-events: none;
  }
  @supports (color: oklch(from red l c h)) {
    .contrast-labels text {
      --tec-chart-contrast-l: max(0, sign(0.623 - l));
      fill: oklch(from var(--tec-chart-cell) var(--tec-chart-contrast-l) 0 h);
    }
  }
  @supports (color: contrast-color(red)) {
    .contrast-labels text {
      fill: contrast-color(var(--tec-chart-cell));
    }
  }
  @media (forced-colors: active) {
    .contrast-labels {
      forced-color-adjust: none;
    }
  }
`
