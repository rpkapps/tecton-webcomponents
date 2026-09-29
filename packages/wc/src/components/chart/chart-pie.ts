/**
 * @module chart-pie
 * The pie kind (`tec-chart-pie`): pie and donut charts, one slice per data row. Several
 * `tec-chart-pie` elements draw concentric rings (an inner pie and an outer donut); a
 * `tec-chart-label-list` inside a pie labels its slices (inside when the label fits, or outside with
 * leader lines), and one with `position="center"` puts a total in the hole of a donut.
 */
import { css, html, nothing, svg, type SVGTemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { formatValue, type ChartRow } from "./chart-config.js"
import { pieLayout, polarPoint, resolveRadius, type Point } from "./chart-engine.js"
import { numeric, type ChartContext, type ChartKind, type ChartModelBase, type Rect } from "./chart-kind.js"
import { TecChartPart, type TecChartLabelList } from "./chart-parts.js"
import {
  angleDistance,
  angleInArc,
  arcBounds,
  boxInSector,
  fitBounds,
  fitRadius,
  leaderLabels,
  mirrorAngle,
  roundedSectorPath,
  toPolar,
  unionBounds,
  type LeaderLabel,
} from "./chart-polar-engine.js"
import { anchorFor, centerLabel, isCenter, labelListsOf, labelText, truncate } from "./chart-polar-labels.js"

/**
 * Slice colours come from the row's `fill` field, then from the config entry named by the row's
 * `name-key` value, then from the chart palette.
 *
 * Several pies in one chart are drawn as concentric rings, in document order: give each its own
 * `inner-radius` / `outer-radius` (an inner pie with `outer-radius="60"` and an outer donut with
 * `inner-radius="70" outer-radius="90"`), its own `key` and, when the rings show different rows,
 * its own `data`.
 *
 * Put a `tec-chart-label-list` inside to label the slices: `position="inside"` (the default) draws
 * a label inside a slice only when it fits; `outside` draws it outside the pie with a leader line
 * (on the outermost ring); `center` shows the total of the pie in the hole of a donut, with the
 * config label of `key` as its caption.
 *
 * @summary A pie (or, with `inner-radius`, donut) series of a `tec-chart`: one slice per data row.
 *
 * @tag tec-chart-pie
 */
export class TecChartPie extends TecChartPart {
  /** The data field holding the slice values. */
  @property({ reflect: true }) key = ""

  /** The data field holding the slice names (also the config keys of the slices). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** Inner radius: pixels (`60`) or a percentage of the available radius (`"50%"`). 0 = pie. */
  @property({ attribute: "inner-radius" }) innerRadius = "0"

  /** Outer radius: pixels or a percentage of the available radius. */
  @property({ attribute: "outer-radius" }) outerRadius = "80%"

  /** Gap between slices in degrees. */
  @property({ type: Number, attribute: "padding-angle" }) paddingAngle = 0

  /** Radius of the slices' corners, in pixels. */
  @property({ type: Number, attribute: "corner-radius" }) cornerRadius = 0

  /**
   * Angle of the first slice's start, in degrees counter-clockwise from 3 o'clock. In a
   * right-to-left context the angles are mirrored (the slices run the other way round).
   */
  @property({ type: Number, attribute: "start-angle" }) startAngle = 0

  /** Angle of the last slice's end. `start-angle` + 360 is a full circle. */
  @property({ type: Number, attribute: "end-angle" }) endAngle = 360

  /**
   * A slice drawn emphasised (4px larger) while no other slice is active — e.g. the slice the text
   * next to the chart talks about. Hovered and keyboard-selected slices are emphasised the same way.
   */
  @property({ type: Number, attribute: "active-index" }) activeIndex?: number

  /** The rows of this pie, when they are not the chart's `data` (e.g. an outer ring with more detail). */
  @property({ attribute: false }) data?: ChartRow[]
}

type PieSpec = Pick<TecChartPie, "key" | "nameKey" | "innerRadius" | "outerRadius" | "paddingAngle" | "startAngle" | "endAngle" | "cornerRadius"> & {
  activeIndex?: number
  data?: ChartRow[]
  element?: TecChartPie
}

/** Emphasis of the active slice, in pixels. */
const GROW = 4
/** Outside labels: the leader starts this far out from the slice (clear of the emphasis), then runs horizontally. */
const LEADER_START = 2
const LEADER_RUN = 8

export interface PieSlice {
  /** Index over all the slices of all the rings. */
  index: number
  /** Index of the row in its ring's rows. */
  row: number
  ring: number
  d: string
  /** The path of the slice when emphasised. */
  grown: string
  color: string
  name: string
  start: number
  end: number
  mid: number
  value: number
}

export interface PieRing {
  spec: PieSpec
  rows: ChartRow[]
  /** Whether the ring uses the chart's `data`. */
  shared: boolean
  inner: number
  outer: number
  grow: number
  slices: PieSlice[]
  labels: { text: string; x: number; y: number; slice: number }[]
  leaders: (LeaderLabel & { text: string })[]
}

export interface PieModel extends ChartModelBase {
  kind: "pie"
  cx: number
  cy: number
  rings: PieRing[]
  slices: PieSlice[]
  center: SVGTemplateResult | typeof nothing
}

function pieSpecs(ctx: ChartContext): PieSpec[] {
  const pies = ctx.parts(TecChartPie).filter((pie) => pie.key)
  if (pies.length)
    return pies.map((pie) => ({
      key: pie.key,
      nameKey: pie.nameKey,
      innerRadius: pie.innerRadius,
      outerRadius: pie.outerRadius,
      paddingAngle: pie.paddingAngle,
      startAngle: pie.startAngle,
      endAngle: pie.endAngle,
      cornerRadius: pie.cornerRadius,
      activeIndex: pie.activeIndex,
      data: pie.data,
      element: pie,
    }))
  if (ctx.host.type !== "pie") return []
  // The `type="pie"` shortcut: the first numeric field, named by the category key.
  const row = ctx.rows[0]
  if (!row) return []
  const key = Object.keys(row).find((k) => typeof row[k] === "number")
  if (!key) return []
  return [
    {
      key,
      nameKey: ctx.host.categoryKey ?? Object.keys(row).find((k) => typeof row[k] === "string") ?? "name",
      innerRadius: "0",
      outerRadius: "80%",
      paddingAngle: 0,
      startAngle: 0,
      endAngle: 360,
      cornerRadius: 0,
    },
  ]
}

/** The label lists of a ring, split into slice labels and the centre label. */
function ringLabels(ctx: ChartContext, spec: PieSpec) {
  const lists = labelListsOf(ctx, spec.element)
  return { slice: lists.find((l) => !isCenter(l)), center: lists.find(isCenter) }
}

const isOutside = (list: TecChartLabelList | undefined) => list?.position === "outside" || list?.position === "end"

function computeModel(ctx: ChartContext): PieModel | undefined {
  const specs = pieSpecs(ctx)
  if (!specs.length) return undefined
  const { margin: m, width: W, height: H, rtl } = ctx
  const plot: Rect = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const bounds: Rect = { x: 1, y: 1, w: Math.max(0, W - 2), h: Math.max(0, H - 2) }
  const ringRows = specs.map((spec) => spec.data ?? ctx.rows)
  const layouts = specs.map((spec, r) =>
    pieLayout(
      ringRows[r]!.map((row) => numeric(row?.[spec.key]) ?? 0),
      spec.startAngle,
      spec.endAngle,
      spec.paddingAngle
    ).map((slice) => ({
      ...slice,
      startAngle: mirrorAngle(slice.startAngle, rtl),
      endAngle: mirrorAngle(slice.endAngle, rtl),
      midAngle: mirrorAngle(slice.midAngle, rtl),
    }))
  )
  // The union of the rings' arcs decides how the pie fits the plot (a half pie uses the full width).
  const shape = unionBounds(specs.map((spec) => arcBounds(mirrorAngle(spec.startAngle, rtl), mirrorAngle(spec.endAngle, rtl))))
  // Radii resolve against the largest radius that fits (`maxRadius`); pixel radii larger than that
  // are scaled down with the others, so a small chart shows the same shape.
  const outerOf = (spec: PieSpec, maxRadius: number) => resolveRadius(spec.outerRadius, maxRadius, maxRadius * 0.8)
  const maxOuter = (maxRadius: number) => Math.max(...specs.map((spec) => outerOf(spec, maxRadius)))
  const drawn = (maxRadius: number) => Math.min(maxRadius, maxOuter(maxRadius))
  const fit = fitBounds(plot, shape, drawn)
  const maxRadius = fit.maxRadius
  let { cx, cy } = fit
  let outerRadius = drawn(maxRadius)

  // Outside labels of the outermost ring: shrink the pie until they fit in the chart.
  const outermost = specs.reduce((best, spec, i) => (outerOf(spec, maxRadius) > outerOf(specs[best]!, maxRadius) ? i : best), 0)
  const outerList = ringLabels(ctx, specs[outermost]!).slice
  const leaderLength = Math.max(8, (outerList?.offset ?? 5) + 7)
  let outsideTexts: { index: number; angle: number; width: number; height: number; text: string }[] = []
  if (isOutside(outerList)) {
    const spec = specs[outermost]!
    const rows = ringRows[outermost]!
    outsideTexts = layouts[outermost]!.filter((s) => s.value > 0).map((s) => {
      const row = rows[s.index]
      const text = labelText(ctx, outerList!, row?.[outerList!.key ?? spec.key], row, s.index)
      return { index: s.index, angle: s.midAngle, width: ctx.measure(text), height: ctx.fontSize * 1.2, text }
    })
    const minOuter = outerRadius * 0.45
    const room = outsideTexts.map((t) => ({ ...t, width: t.width + LEADER_RUN + 3 }))
    for (let pass = 0; pass < 2; pass++) {
      const allowed = fitRadius(cx, cy, room, leaderLength + LEADER_START, bounds, outerRadius, minOuter)
      if (allowed >= outerRadius - 0.5) break
      outerRadius = allowed
      ;({ cx, cy } = fitBounds(plot, shape, () => outerRadius))
    }
  }

  const rings: PieRing[] = []
  const slices: PieSlice[] = []
  const k = outerRadius / (maxOuter(maxRadius) || 1)
  const radii = specs.map((spec) => ({ inner: k * resolveRadius(spec.innerRadius, maxRadius, 0), outer: k * outerOf(spec, maxRadius) }))
  specs.forEach((spec, r) => {
    const rows = ringRows[r]!
    const { inner, outer } = radii[r]!
    // Room to grow: up to the next ring out.
    const next = radii.filter((o) => o.inner >= outer - 0.5).map((o) => o.inner)
    const grow = next.length ? Math.max(0, Math.min(GROW, Math.min(...next) - outer)) : GROW
    const ring: PieRing = { spec, rows, shared: !spec.data, inner, outer, grow, slices: [], labels: [], leaders: [] }
    layouts[r]!.forEach((slice, i) => {
      const row = rows[i]
      const name = String(row?.[spec.nameKey] ?? i)
      const visible = slice.value > 0
      const s: PieSlice = {
        index: slices.length,
        row: i,
        ring: r,
        d: visible ? roundedSectorPath(cx, cy, inner, outer, slice.startAngle, slice.endAngle, spec.cornerRadius) : "",
        grown: visible ? roundedSectorPath(cx, cy, inner, outer + grow, slice.startAngle, slice.endAngle, spec.cornerRadius) : "",
        color: ctx.rowColor(row, name, i),
        name,
        start: slice.startAngle,
        end: slice.endAngle,
        mid: slice.midAngle,
        value: slice.value,
      }
      ring.slices.push(s)
      slices.push(s)
    })
    // Slice labels.
    const list = ringLabels(ctx, spec).slice
    if (list && !(isOutside(list) && r === outermost)) {
      for (const s of ring.slices) {
        if (!s.value) continue
        const row = rows[s.row]
        const text = labelText(ctx, list, row?.[list.key ?? spec.key], row, s.row)
        if (!text) continue
        const width = ctx.measure(text)
        const height = ctx.fontSize
        const radius = inner > 0 ? (inner + outer) / 2 : outer * 0.62
        const p = polarPoint(cx, cy, radius, s.mid)
        const box = { x: p.x - width / 2, y: p.y - height / 2, w: width, h: height }
        if (boxInSector(box, cx, cy, inner, outer, s.start, s.end, 3)) ring.labels.push({ text, x: p.x, y: p.y, slice: s.index })
      }
    } else if (list && r === outermost) {
      const placed = leaderLabels(cx, cy, outer + LEADER_START, outsideTexts, bounds, leaderLength, LEADER_RUN)
      ring.leaders = placed.map((label) => ({ ...label, text: outsideTexts.find((t) => t.index === label.index)!.text }))
    }
    rings.push(ring)
  })

  // The centre label: the total of the ring that asks for it, in the hole of the innermost ring.
  let center: SVGTemplateResult | typeof nothing = nothing
  const centerRing = specs.findIndex((spec) => ringLabels(ctx, spec).center)
  if (centerRing >= 0) {
    const spec = specs[centerRing]!
    const list = ringLabels(ctx, spec).center!
    const key = list.key ?? spec.key
    const rows = ringRows[centerRing]!
    const total = rows.reduce((sum, row) => sum + (numeric(row?.[key]) ?? 0), 0)
    const hole = Math.min(...radii.map((o) => o.inner))
    center = centerLabel(ctx, {
      cx,
      cy,
      inner: hole,
      bounds: shape,
      value: labelText(ctx, list, total, rows.length === 1 ? rows[0] : undefined, -1),
      caption: ctx.config[key]?.label,
    })
  }
  return { kind: "pie", plot, cx, cy, rings, slices, center, count: slices.length }
}

/** The slice drawn emphasised: the active one, else the `active-index` of a ring. */
function emphasised(model: PieModel, ctx: ChartContext): number {
  if (ctx.active >= 0) return ctx.active
  for (const ring of model.rings) {
    const i = ring.spec.activeIndex
    if (i != null && i >= 0 && ring.slices[i]) return ring.slices[i]!.index
  }
  return -1
}

function renderPie(model: PieModel, ctx: ChartContext): SVGTemplateResult {
  const emphasis = emphasised(model, ctx)
  const keyboard = ctx.keyboard && ctx.active >= 0
  return svg`<g class="pie" style=${`transform-origin: ${model.cx}px ${model.cy}px`}>
    ${model.rings.map(
      (ring) => svg`<g class="pie-ring">
        ${ring.slices.map((slice) => {
          if (!slice.d) return nothing
          const d = slice.index === emphasis ? slice.grown : slice.d
          return svg`<path class="sector" d=${d} style=${`d: path("${d}")`} fill=${slice.color} data-index=${slice.index}
            ?data-active=${keyboard && ctx.active === slice.index} ?data-emphasis=${slice.index === emphasis}></path>`
        })}
      </g>`
    )}
    ${model.rings.map((ring) =>
      ring.labels.length
        ? svg`<g class="inside-labels">${ring.labels.map((label) => {
            const slice = model.slices[label.slice]!
            return svg`<text class="inside-label" x=${label.x} y=${label.y} dy="0.355em" text-anchor="middle" style=${`--tec-chart-label-on: ${slice.color}`}>${label.text}</text>`
          })}</g>`
        : nothing
    )}
    ${model.rings.map((ring) =>
      ring.leaders.length
        ? svg`<g class="outside-labels">${ring.leaders.map(
            (label) => svg`<polyline class="leader" points=${`${label.from.x},${label.from.y} ${label.elbow.x},${label.elbow.y} ${label.to.x},${label.to.y}`}></polyline>
              <text class="outside-label" x=${label.x} y=${label.y} dy="0.355em" text-anchor=${anchorFor(label.side, ctx.rtl)}>${truncate(ctx, label.text, label.width + 1)}</text>`
          )}</g>`
        : nothing
    )}
    ${model.center}
  </g>`
}

/** The slice under a point: the ring by radius, then the slice by angle; thin rings and slices get a 24px target. */
function hitSlice(model: PieModel, point: Point): number {
  const { angle, radius } = toPolar(model.cx, model.cy, point)
  let best = -1
  let bestScore = Infinity
  for (const ring of model.rings) {
    const thickness = ring.outer - ring.inner
    const pad = Math.max(0, (24 - thickness) / 2)
    const low = Math.max(0, ring.inner - pad)
    const high = ring.outer + Math.max(ring.grow, pad)
    if (radius < low || radius > high) continue
    const minSpan = radius > 0 ? (24 / radius) * (180 / Math.PI) : 360
    for (const slice of ring.slices) {
      if (!slice.value) continue
      const span = Math.abs(slice.end - slice.start)
      const halfExtent = Math.max(span, minSpan) / 2
      const inside = angleInArc(angle, slice.start, slice.end)
      const distance = angleDistance(angle, slice.mid)
      if (!inside && distance > halfExtent) continue
      // Small slices win near their centre; the ring whose band holds the radius wins over a padded one.
      const radial = radius >= ring.inner && radius <= ring.outer + ring.grow ? 0 : 1
      const score = radial * 10 + distance / halfExtent
      if (score < bestScore) {
        bestScore = score
        best = slice.index
      }
    }
  }
  return best
}

export const pieKind: ChartKind<PieModel> = {
  id: "pie",
  claims: (ctx) => ctx.parts(TecChartPie).length > 0 || ctx.host.type === "pie",
  label: () => "Pie chart",
  model: computeModel,
  render: renderPie,
  payload(model, index) {
    const slice = model.slices[index]
    const ring = slice ? model.rings[slice.ring] : undefined
    const row = ring?.rows[slice!.row]
    if (!slice || !ring || !row) return { label: undefined, items: [] }
    // With several rings, the label names the ring (its key's config label).
    const label = model.rings.length > 1 ? ring.spec.key : undefined
    return { label, items: [{ dataKey: ring.spec.key, name: slice.name, value: row[ring.spec.key], color: slice.color, row }] }
  },
  anchor(model, index) {
    const slice = model.slices[index]
    const ring = slice ? model.rings[slice.ring] : undefined
    if (!slice || !ring) return undefined
    return polarPoint(model.cx, model.cy, (ring.inner + ring.outer) / 2, slice.mid)
  },
  hit(model, point) {
    return hitSlice(model, point)
  },
  table(model, ctx) {
    const config = ctx.config
    const heading = (key: string) => config[key]?.label ?? key
    const rowName = (name: string) => config[name]?.label ?? name
    const first = model.rings[0]!
    // Rings over the same rows and names share one table; otherwise each ring has its own.
    const together = model.rings.every((ring) => ring.shared && ring.spec.nameKey === first.spec.nameKey)
    const table = (caption: string, nameKey: string, rings: PieRing[]) => html`<table part="table" class="sr-only">
      <caption>${caption}</caption>
      <thead>
        <tr>
          <th scope="col">${heading(nameKey)}</th>
          ${rings.map((ring) => html`<th scope="col">${heading(ring.spec.key)}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rings[0]!.slices.map(
          (slice) => html`<tr>
            <th scope="row">${rowName(slice.name)}</th>
            ${rings.map((ring) => html`<td>${formatValue(ring.rows[slice.row]?.[ring.spec.key], ctx.locale)}</td>`)}
          </tr>`
        )}
      </tbody>
    </table>`
    if (together) return ctx.rows.length ? table(ctx.name(), first.spec.nameKey, model.rings) : nothing
    return html`${model.rings.map((ring) => (ring.rows.length ? table(`${ctx.name()}: ${heading(ring.spec.key)}`, ring.spec.nameKey, [ring]) : nothing))}`
  },
  legend(model, ctx) {
    const seen = new Set<string>()
    return model.slices
      .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
      .map((s) => ({ dataKey: s.name, color: s.color, row: model.rings[s.ring]?.rows[s.row] ?? ctx.rows[s.row] }))
  },
}

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const pieStyles = css`
  /* A 2px surface-coloured gap between touching slices (and rings). */
  .pie .sector {
    stroke: var(--tec-background);
    stroke-width: 2px;
    stroke-linejoin: round;
  }
  .pie .sector[data-active] {
    stroke: var(--tec-background);
    stroke-width: 2px;
  }
  .leader {
    fill: none;
    stroke: var(--tec-muted-foreground);
    stroke-width: 1px;
  }
  .outside-label {
    fill: var(--tec-foreground);
  }
  @media (prefers-reduced-motion: no-preference) {
    svg[data-transition] .pie .sector {
      transition: d 150ms var(--tec-ease, ease);
    }
  }
  @media (forced-colors: active) {
    .pie .sector {
      stroke: Canvas;
    }
    .leader {
      stroke: CanvasText;
    }
    .outside-label {
      fill: CanvasText;
    }
  }
`

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-pie": TecChartPie
  }
}
