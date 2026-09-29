/**
 * @module chart-polar
 * The polar kinds: radar (`tec-chart-radar`) and radial bar (`tec-chart-radial-bar`) charts, with
 * the polar grid (`tec-chart-polar-grid`) and axes (`tec-chart-polar-angle-axis`,
 * `tec-chart-polar-radius-axis`).
 *
 * In a right-to-left context the angles are mirrored (`θ → 180° − θ`): a radar that runs clockwise
 * from 12 o'clock in LTR runs counter-clockwise, so the categories follow the reading direction and
 * the arrow keys; text is positioned for the mirrored geometry but never mirrored itself.
 */
import { css, html, nothing, svg, type SVGTemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { entryColor, formatValue, type ChartRow } from "./chart-config.js"
import { barPositions, niceTicks, polarPoint, resolveRadius, type Point } from "./chart-engine.js"
import { numeric, type ChartContext, type ChartKind, type ChartModelBase, type ChartPayload, type Rect } from "./chart-kind.js"
import { TecChartPart, type ChartTickFormatter, type TecChartLabelList } from "./chart-parts.js"
import {
  angleDistance,
  angleInArc,
  arcBounds,
  fitArc,
  fitRadius,
  labelLift,
  labelSide,
  mirrorAngle,
  nonOverlapping,
  normalizeAngle,
  polygonPath,
  radialLabelBox,
  rectInside,
  rectsOverlap,
  roundedSectorPath,
  toPolar,
  type UnitBounds,
} from "./chart-polar-engine.js"
import { anchorFor, centerLabel, isCenter, labelListsOf, labelText, truncate } from "./chart-polar-labels.js"

/** A boolean attribute that defaults to `true`: `radial-lines="false"` turns it off. */
const defaultTrue = {
  fromAttribute: (value: string | null) => value !== "false",
  toAttribute: (value: boolean) => (value ? "" : "false"),
}

// ------------------------------------------------------------------------------------------ parts

/**
 * One radar series: a closed shape through the series' value on every category axis (one axis per
 * data row). Several radars overlap; the angle axis' `key` (or the chart's `category-key`) names
 * the categories. Put a `tec-chart-label-list` inside to label the values at the vertices.
 *
 * @summary A radar series of a `tec-chart`: a filled polygon over one axis per category.
 *
 * @tag tec-chart-radar
 */
export class TecChartRadar extends TecChartPart {
  /** The data field this series plots (also the key of its entry in the chart `config`). */
  @property({ reflect: true }) key = ""

  /**
   * The series colour (outline and dots). Defaults to the config entry's colour
   * (`var(--tec-chart-color-<key>)`), then to the chart palette in series order.
   */
  @property() color?: string

  /** The fill: the series colour by default, `none` for an outline only, or any CSS colour. */
  @property() fill = ""

  /** Opacity of the fill (0–1). */
  @property({ type: Number, attribute: "fill-opacity" }) fillOpacity = 0.6

  /** Width of the outline in pixels (0: no outline). */
  @property({ type: Number, attribute: "stroke-width" }) strokeWidth = 0

  /** Draws a dot on every vertex. */
  @property({ type: Boolean }) dots = false
}

/**
 * One radial bar series: one ring per data row (the first row innermost), the bar's sweep showing
 * the value. The layout attributes (`inner-radius`, `outer-radius`, `start-angle`, `end-angle`,
 * `bar-size`, `max-value`) apply to the whole chart and are read from the first radial bar that
 * sets them.
 *
 * Rows are coloured like pie slices (the row's `fill`, the config entry of its `name-key` value, the
 * palette) when the chart has one radial bar; with several, each series takes its own colour.
 * Series with the same `stack` are stacked along the ring.
 *
 * Put a `tec-chart-label-list` inside to label the bars (`inside-start`, `inside-end`, `end`; a
 * label is drawn only when it fits), or one with `position="center"` to show the total in the
 * middle of the chart with the config label of the key as its caption.
 *
 * @summary A radial bar series of a `tec-chart`: bars bent into rings, one ring per data row.
 *
 * @tag tec-chart-radial-bar
 */
export class TecChartRadialBar extends TecChartPart {
  /** The data field this series plots (also the key of its entry in the chart `config`). */
  @property({ reflect: true }) key = ""

  /**
   * The data field holding the row names (also the config keys of the rows). Defaults to the
   * chart's `category-key`, then to the first text field of the data.
   */
  @property({ attribute: "name-key", reflect: true }) nameKey?: string

  /** The series colour. Defaults to the row colours (one series) or the config/palette colour (several). */
  @property() color?: string

  /** Series with the same `stack` id are stacked along the ring. */
  @property({ reflect: true }) stack?: string

  /** Draws the full track behind each bar in the muted colour. */
  @property({ type: Boolean }) background = false

  /** Radius of the bars' corners, in pixels. */
  @property({ type: Number, attribute: "corner-radius" }) cornerRadius = 0

  /** Inner radius of the innermost ring: pixels or a percentage of the available radius (30% by default). */
  @property({ attribute: "inner-radius" }) innerRadius?: string

  /** Outer radius of the outermost ring: pixels or a percentage of the available radius (80% by default). */
  @property({ attribute: "outer-radius" }) outerRadius?: string

  /**
   * Where the bars start, in degrees counter-clockwise from 3 o'clock (0 by default). Mirrored in
   * a right-to-left context.
   */
  @property({ type: Number, attribute: "start-angle" }) startAngle?: number

  /** Where a bar of `max-value` ends (360 by default: a full circle). */
  @property({ type: Number, attribute: "end-angle" }) endAngle?: number

  /** Thickness of each bar in pixels (at most the ring's band). */
  @property({ type: Number, attribute: "bar-size" }) barSize?: number

  /** The value of a bar that sweeps from `start-angle` to `end-angle`. Defaults to the largest value (or stack). */
  @property({ type: Number, attribute: "max-value" }) maxValue?: number
}

/**
 * @summary The web of a radar chart (rings at the radius ticks and a line per category), or rings
 * behind the bars of a radial bar chart.
 *
 * @tag tec-chart-polar-grid
 */
export class TecChartPolarGrid extends TecChartPart {
  /** `polygon` rings (the radar web) or `circle` rings. */
  @property({ attribute: "grid-type", reflect: true }) gridType: "polygon" | "circle" = "polygon"

  /** Draws a line from the centre to every category (`radial-lines="false"` hides them). */
  @property({ attribute: "radial-lines", converter: defaultTrue }) radialLines = true

  /** Fills the area inside the outer ring with the muted colour. */
  @property({ type: Boolean }) filled = false
}

/**
 * @summary The category labels of a radar chart, placed around the outside of the web. The chart
 * shrinks the radar so the labels stay inside it.
 *
 * @tag tec-chart-polar-angle-axis
 */
export class TecChartPolarAngleAxis extends TecChartPart {
  /** The data field of the categories. */
  @property({ reflect: true }) key?: string

  /** Space between the web and the labels, in pixels. */
  @property({ type: Number, attribute: "tick-margin" }) tickMargin = 8

  /** Formats the labels: `axis.tickFormatter = (value) => String(value).slice(0, 3)`. */
  @property({ attribute: false }) tickFormatter?: ChartTickFormatter
}

/**
 * @summary The value scale of a radar chart: tick labels along one spoke.
 *
 * @tag tec-chart-polar-radius-axis
 */
export class TecChartPolarRadiusAxis extends TecChartPart {
  /** Number of ticks (and grid rings). */
  @property({ type: Number, attribute: "tick-count" }) tickCount = 5

  /** Direction of the spoke the ticks sit on, in degrees counter-clockwise from 3 o'clock. */
  @property({ type: Number }) angle = 90

  /**
   * The value range, `"min max"`, either of which may be `auto`: `"0 150"`, `"0 auto"` (the
   * default: from 0 to a nice value above the largest one).
   */
  @property() domain = "0 auto"

  /** Draws the spoke the ticks sit on. */
  @property({ type: Boolean, attribute: "axis-line" }) axisLine = false

  /** Formats the tick labels. */
  @property({ attribute: false }) tickFormatter?: ChartTickFormatter
}

// ------------------------------------------------------------------------------------------ shared

const firstTextField = (row: ChartRow | undefined) => (row ? Object.keys(row).find((k) => typeof row[k] === "string") : undefined)

const isNumericField = (rows: ChartRow[], key: string) => rows.some((row) => typeof row?.[key] === "number")

/** The keys drawn by a `type` shortcut: the coloured config keys holding numbers, else every numeric field. */
function shortcutKeys(ctx: ChartContext, exclude: string | undefined): string[] {
  const rows = ctx.rows
  let keys = Object.entries(ctx.config)
    .filter(([key, entry]) => entryColor(entry) && isNumericField(rows, key))
    .map(([key]) => key)
  if (!keys.length && rows[0]) keys = Object.keys(rows[0]).filter((key) => key !== exclude && isNumericField(rows, key))
  return keys
}

/** A row's name as the tooltip label would show it (the tooltip's `labelFormatter` when it returns text). */
function rowText(ctx: ChartContext, key: string | undefined, index: number): string {
  const raw = key ? ctx.rows[index]?.[key] : index + 1
  const formatter = ctx.tooltip?.labelFormatter
  if (formatter && key) {
    const formatted = formatter(typeof raw === "string" ? (ctx.config[raw]?.label ?? raw) : raw, [])
    if (typeof formatted === "string") return formatted
  }
  return ctx.text(raw)
}

function dataTable(ctx: ChartContext, key: string | undefined, series: { key: string }[]) {
  const config = ctx.config
  return html`<table part="table" class="sr-only">
    <caption>${ctx.name()}</caption>
    <thead>
      <tr>
        <th scope="col">${key ? (config[key]?.label ?? key) : "#"}</th>
        ${series.map((s) => html`<th scope="col">${config[s.key]?.label ?? s.key}</th>`)}
      </tr>
    </thead>
    <tbody>
      ${ctx.rows.map(
        (row, i) => html`<tr>
          <th scope="row">${rowText(ctx, key, i)}</th>
          ${series.map((s) => html`<td>${formatValue(row?.[s.key], ctx.locale)}</td>`)}
        </tr>`
      )}
    </tbody>
  </table>`
}

/** Parses a `"min max"` domain (`auto` or a number each). */
export function parseDomain(value: string | undefined): [number | null, number | null] {
  const parts = String(value ?? "")
    .trim()
    .split(/[\s,]+/)
  const read = (part: string | undefined) => {
    if (part == null || part === "" || part === "auto") return null
    const n = Number(part)
    return Number.isFinite(n) ? n : null
  }
  return [read(parts[0]), read(parts[1])]
}

/** The rotation and anchor side of a label written along a ring at `angle`, reading upright. */
export function tangentText(angle: number, forwardAngle: number): { rotate: number; forward: boolean } {
  let reading = normalizeAngle(angle - 90)
  if (reading > 180) reading -= 360
  if (reading > 90) reading -= 180
  else if (reading <= -90) reading += 180
  const forward = Math.cos(((reading - forwardAngle) * Math.PI) / 180) > 0
  return { rotate: -reading, forward }
}

const halfPad = (size: number) => Math.max(0, (24 - size) / 2)

// ------------------------------------------------------------------------------------------ radar

interface RadarSpec {
  key: string
  element?: TecChartRadar
  color?: string
  fill: string
  fillOpacity: number
  strokeWidth: number
  dots: boolean
}

interface RadarSeries {
  spec: RadarSpec
  color: string
  fill: string | null
  points: Point[]
  /** Whether the category has a value (missing values sit at the centre, without a dot). */
  present: boolean[]
  radii: number[]
}

export interface RadarModel extends ChartModelBase {
  kind: "radar"
  cx: number
  cy: number
  radius: number
  angles: number[]
  categoryKey?: string
  series: RadarSeries[]
  ticks: { value: number; r: number }[]
  angleLabels: { index: number; text: string; x: number; y: number; anchor: string; box: Rect }[]
  valueLabels: { text: string; x: number; y: number; anchor: string }[]
}

function radarSpecs(ctx: ChartContext, categoryKey: string | undefined): RadarSpec[] {
  const specs: RadarSpec[] = ctx
    .parts(TecChartRadar)
    .filter((el) => el.key)
    .map((el) => ({ key: el.key, element: el, color: el.color || undefined, fill: el.fill, fillOpacity: el.fillOpacity, strokeWidth: el.strokeWidth, dots: el.dots }))
  if (specs.length || ctx.host.type !== "radar") return specs
  return shortcutKeys(ctx, categoryKey).map((key) => ({ key, fill: "", fillOpacity: 0.6, strokeWidth: 0, dots: false }))
}

function radarCategoryKey(ctx: ChartContext): string | undefined {
  return ctx.host.categoryKey ?? ctx.parts(TecChartPolarAngleAxis)[0]?.key ?? firstTextField(ctx.rows[0])
}

function computeRadar(ctx: ChartContext): RadarModel | undefined {
  const categoryKey = radarCategoryKey(ctx)
  const specs = radarSpecs(ctx, categoryKey)
  const rows = ctx.rows
  const n = rows.length
  if (!specs.length) return undefined
  const { margin: m, width: W, height: H, rtl } = ctx
  const plot: Rect = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const bounds: Rect = { x: 1, y: 1, w: Math.max(0, W - 2), h: Math.max(0, H - 2) }
  const cx = plot.x + plot.w / 2
  const cy = plot.y + plot.h / 2
  const maxRadius = Math.min(plot.w, plot.h) / 2
  // Categories run clockwise from 12 o'clock (counter-clockwise in RTL).
  const angles = rows.map((_, i) => mirrorAngle(90 - (360 * i) / Math.max(1, n), rtl))

  // The angle axis labels decide how large the web can be.
  const angleAxis = ctx.parts(TecChartPolarAngleAxis)[0]
  const lineHeight = ctx.fontSize * 1.2
  const texts = angleAxis
    ? rows.map((row, i) => {
        const value = categoryKey ? row?.[categoryKey] : i + 1
        return angleAxis.tickFormatter ? String(angleAxis.tickFormatter(value, i)) : ctx.text(value)
      })
    : []
  const gap = angleAxis?.tickMargin ?? 8
  const minRadius = maxRadius * 0.35
  let radius = maxRadius * 0.8
  if (angleAxis) {
    const labels = texts.map((text, i) => ({ angle: angles[i]!, width: ctx.measure(text), height: lineHeight }))
    radius = fitRadius(cx, cy, labels, gap, bounds, radius, Math.min(minRadius, radius))
  }
  radius = Math.max(0, radius)

  // The radius scale.
  const radiusAxis = ctx.parts(TecChartPolarRadiusAxis)[0]
  const [dMin, dMax] = parseDomain(radiusAxis?.domain)
  let dataMin = 0
  let dataMax = 0
  for (const spec of specs)
    for (const row of rows) {
      const v = numeric(row?.[spec.key])
      if (v == null) continue
      dataMin = Math.min(dataMin, v)
      dataMax = Math.max(dataMax, v)
    }
  const tickCount = Math.max(2, radiusAxis?.tickCount ?? 5)
  let tickValues: number[]
  if (dMin != null && dMax != null && dMax > dMin) {
    tickValues = Array.from({ length: tickCount }, (_, i) => dMin + ((dMax - dMin) * i) / (tickCount - 1))
  } else {
    const lo = dMin ?? dataMin
    const hi = dMax ?? (dataMax === lo ? lo + 1 : dataMax)
    tickValues = niceTicks(lo, hi, tickCount)
    if (dMin != null) tickValues = tickValues.filter((t) => t >= dMin)
    if (dMax != null) tickValues = tickValues.filter((t) => t <= dMax)
  }
  const d0 = dMin ?? tickValues[0] ?? 0
  const d1 = dMax ?? tickValues[tickValues.length - 1] ?? 1
  const span = d1 - d0 || 1
  const scale = (v: number) => Math.max(0, ((v - d0) / span) * radius)
  const ticks = tickValues.map((value) => ({ value, r: scale(value) }))

  const series: RadarSeries[] = specs.map((spec, si) => {
    const color = ctx.seriesColor(spec.key, si, spec.color)
    const present: boolean[] = []
    const radii: number[] = []
    const points = rows.map((row, i) => {
      const v = numeric(row?.[spec.key])
      present.push(v != null)
      const r = v == null ? 0 : scale(v)
      radii.push(r)
      return polarPoint(cx, cy, r, angles[i]!)
    })
    const fill = spec.fill === "none" ? null : spec.fill || color
    return { spec, color, fill, points, present, radii }
  })

  // Angle labels: placed beyond the web, thinned where they would overlap, shortened when the web
  // reached its minimum size and they still do not fit.
  const angleLabels: RadarModel["angleLabels"] = []
  if (angleAxis) {
    const placed = texts.map((text, i) => {
      const angle = angles[i]!
      const side = labelSide(angle)
      const point = polarPoint(cx, cy, radius + gap, angle)
      const room = side === 1 ? bounds.x + bounds.w - point.x : side === -1 ? point.x - bounds.x : 2 * Math.min(point.x - bounds.x, bounds.x + bounds.w - point.x)
      const shown = truncate(ctx, text, room)
      const box = radialLabelBox(point, { angle, width: ctx.measure(shown), height: lineHeight })
      return { index: i, text: shown, point, side, box }
    })
    for (const k of nonOverlapping(placed.map((p) => p.box))) {
      const p = placed[k]!
      if (!p.text) continue
      angleLabels.push({ index: p.index, text: p.text, x: p.point.x, y: p.box.y + p.box.h / 2, anchor: anchorFor(p.side, rtl), box: p.box })
    }
  }

  // Value labels at the vertices.
  const valueLabels: RadarModel["valueLabels"] = []
  const boxes: Rect[] = angleLabels.map((l) => l.box)
  series.forEach((s) => {
    const list = labelListsOf(ctx, s.spec.element).find((l) => !isCenter(l))
    if (!list) return
    rows.forEach((row, i) => {
      if (!s.present[i]) return
      const text = labelText(ctx, list, row?.[list.key ?? s.spec.key], row, i)
      if (!text) return
      const angle = angles[i]!
      const width = ctx.measure(text)
      // Outside the vertex, else inside it (towards the centre) when that side is taken.
      for (const [radius, direction] of [
        [s.radii[i]! + list.offset, angle],
        [s.radii[i]! - list.offset, angle + 180],
      ] as const) {
        if (radius < 0) continue
        const point = polarPoint(cx, cy, radius, angle)
        const box = radialLabelBox(point, { angle: direction, width, height: lineHeight })
        if (boxes.some((b) => rectsOverlap(b, box)) || !rectInside(box, bounds)) continue
        boxes.push(box)
        valueLabels.push({ text, x: point.x, y: box.y + box.h / 2, anchor: anchorFor(labelSide(direction), rtl) })
        break
      }
    })
  })

  return { kind: "radar", plot, cx, cy, radius, angles, categoryKey, series, ticks, angleLabels, valueLabels, count: n }
}

function renderRadar(model: RadarModel, ctx: ChartContext): SVGTemplateResult {
  const { cx, cy, radius, angles, series } = model
  const grid = ctx.parts(TecChartPolarGrid)[0]
  const radiusAxis = ctx.parts(TecChartPolarRadiusAxis)[0]
  const active = ctx.active
  const tooltip = ctx.tooltip

  let gridMarks: SVGTemplateResult | typeof nothing = nothing
  if (grid) {
    const rings = model.ticks.filter((t) => t.r > 0.5)
    const ring = (r: number) =>
      grid.gridType === "circle" || angles.length < 3
        ? svg`<circle cx=${cx} cy=${cy} r=${r}></circle>`
        : svg`<path d=${polygonPath(angles.map((a) => polarPoint(cx, cy, r, a)))}></path>`
    const outer = rings[rings.length - 1]?.r ?? radius
    gridMarks = svg`<g class="grid polar-grid">
      ${grid.filled ? svg`<g class="grid-fill">${ring(outer)}</g>` : nothing}
      ${rings.map((t) => ring(t.r))}
      ${grid.radialLines ? angles.map((a) => {
        const p = polarPoint(cx, cy, outer, a)
        return svg`<line x1=${cx} y1=${cy} x2=${p.x} y2=${p.y}></line>`
      }) : nothing}
    </g>`
  }

  const cursor =
    tooltip && !tooltip.hideCursor && active >= 0 && angles[active] != null
      ? (() => {
          const p = polarPoint(cx, cy, radius, angles[active]!)
          return svg`<line class="cursor-line" x1=${cx} y1=${cy} x2=${p.x} y2=${p.y}></line>`
        })()
      : nothing

  const shapes = series.map((s) => {
    const d = polygonPath(s.points)
    return svg`<path class="radar-shape" d=${d} style=${`d: path("${d}")`}
      fill=${s.fill ?? "none"} fill-opacity=${s.fill ? s.spec.fillOpacity : nothing}
      stroke=${s.spec.strokeWidth > 0 || !s.fill ? s.color : "none"} stroke-width=${s.spec.strokeWidth > 0 ? s.spec.strokeWidth : s.fill ? 0 : 2}></path>`
  })

  const dots = series.map(
    (s) => svg`
      ${s.spec.dots ? s.points.map((p, i) => (s.present[i] ? svg`<circle class="radar-dot" cx=${p.x} cy=${p.y} r="4" fill=${s.color}></circle>` : nothing)) : nothing}
      ${active >= 0 && s.present[active] && s.points[active] ? svg`<circle class="radar-dot active-dot" cx=${s.points[active]!.x} cy=${s.points[active]!.y} r="5" fill=${s.color}></circle>` : nothing}`
  )

  let radiusMarks: SVGTemplateResult | typeof nothing = nothing
  if (radiusAxis) {
    const angle = mirrorAngle(radiusAxis.angle, ctx.rtl)
    const end = polarPoint(cx, cy, radius, angle)
    // Labels sit beside the spoke, on its clockwise side.
    const normal = angle - 90
    const side = labelSide(normal)
    const lift = labelLift(normal)
    const taken: Rect[] = model.angleLabels.map((l) => l.box)
    radiusMarks = svg`<g class="polar-radius-axis">
      ${radiusAxis.axisLine ? svg`<line class="axis-line" x1=${cx} y1=${cy} x2=${end.x} y2=${end.y}></line>` : nothing}
      ${model.ticks
        .filter((t) => t.r > 0.5)
        .map((t, i) => {
          const p = polarPoint(cx, cy, t.r, angle)
          const q = polarPoint(p.x, p.y, 4, normal)
          const text = radiusAxis.tickFormatter ? String(radiusAxis.tickFormatter(t.value, i)) : formatValue(t.value, ctx.locale)
          const y = q.y + (lift * ctx.fontSize) / 2
          const width = ctx.measure(text)
          const box = { x: side === 1 ? q.x : side === -1 ? q.x - width : q.x - width / 2, y: y - ctx.fontSize / 2, w: width, h: ctx.fontSize }
          // Ticks never cover a category label (or each other).
          if (taken.some((b) => rectsOverlap(b, box, 1))) return nothing
          taken.push(box)
          return svg`<text class="tick halo" x=${q.x} y=${y} dy="0.355em" text-anchor=${anchorFor(side, ctx.rtl)}>${text}</text>`
        })}
    </g>`
  }

  return svg`
    ${gridMarks}
    ${cursor}
    <g class="radar" style=${`transform-origin: ${cx}px ${cy}px`}>${shapes}</g>
    ${dots}
    ${radiusMarks}
    <g class="polar-angle-axis">
      ${model.angleLabels.map(
        (l) => svg`<text class="tick" x=${l.x} y=${l.y} dy="0.355em" text-anchor=${l.anchor} ?data-active=${l.index === active}>${l.text}</text>`
      )}
    </g>
    ${model.valueLabels.length ? svg`<g class="value-labels">${model.valueLabels.map((l) => svg`<text class="value-label halo" x=${l.x} y=${l.y} dy="0.355em" text-anchor=${l.anchor}>${l.text}</text>`)}</g>` : nothing}
  `
}

export const radarKind: ChartKind<RadarModel> = {
  id: "radar",
  claims: (ctx) => ctx.parts(TecChartRadar).length > 0 || ctx.host.type === "radar",
  label: () => "Radar chart",
  model: computeRadar,
  render: renderRadar,
  payload(model, index, ctx) {
    const row = ctx.rows[index]
    if (!row) return { label: undefined, items: [] }
    return {
      label: model.categoryKey ? row[model.categoryKey] : index + 1,
      items: model.series.map((s) => ({ dataKey: s.spec.key, name: s.spec.key, value: row[s.spec.key], color: s.color, row })),
    }
  },
  anchor(model, index) {
    const angle = model.angles[index]
    if (angle == null) return undefined
    const r = Math.max(0, ...model.series.map((s) => s.radii[index] ?? 0))
    return polarPoint(model.cx, model.cy, r, angle)
  },
  hit(model, point) {
    const { angle, radius } = toPolar(model.cx, model.cy, point)
    if (!model.angles.length || radius > model.radius + 16) return -1
    let best = -1
    let distance = Infinity
    model.angles.forEach((a, i) => {
      const d = angleDistance(angle, a)
      if (d < distance) {
        distance = d
        best = i
      }
    })
    return best
  },
  table(model, ctx) {
    if (!model.series.length || !ctx.rows.length) return nothing
    return dataTable(ctx, model.categoryKey, model.series.map((s) => s.spec))
  },
  legend(model) {
    return model.series.map((s) => ({ dataKey: s.spec.key, color: s.color }))
  },
}

// ------------------------------------------------------------------------------------------ radial bar

interface RadialSpec {
  key: string
  element?: TecChartRadialBar
  color?: string
  stack?: string
  background: boolean
  cornerRadius: number
}

interface RadialBarDraw {
  row: number
  d: string
  track: string
  fill: string
  start: number
  end: number
  r0: number
  r1: number
  value: number
}

interface RadialSeries {
  spec: RadialSpec
  color: string
  bars: RadialBarDraw[]
}

export interface RadialBarModel extends ChartModelBase {
  kind: "radial-bar"
  cx: number
  cy: number
  inner: number
  outer: number
  band: number
  start: number
  end: number
  nameKey?: string
  /** One series: rows are coloured and named individually (like pie slices). */
  perRow: boolean
  series: RadialSeries[]
  labels: { text: string; row: number; path: string; inside: boolean; color: string }[]
  center: SVGTemplateResult | typeof nothing
}

/** The first value among the radial bars that set it. */
function layoutValue<K extends keyof TecChartRadialBar>(elements: TecChartRadialBar[], key: K): TecChartRadialBar[K] | undefined {
  for (const el of elements) if (el[key] != null) return el[key]
  return undefined
}

function computeRadial(ctx: ChartContext): RadialBarModel | undefined {
  const elements = ctx.parts(TecChartRadialBar).filter((el) => el.key)
  const nameKey = layoutValue(elements, "nameKey") ?? ctx.host.categoryKey ?? firstTextField(ctx.rows[0])
  let specs: RadialSpec[] = elements.map((el) => ({
    key: el.key,
    element: el,
    color: el.color || undefined,
    stack: el.stack || undefined,
    background: el.background,
    cornerRadius: el.cornerRadius,
  }))
  if (!specs.length && ctx.host.type === "radial-bar") {
    specs = shortcutKeys(ctx, nameKey).map((key) => ({ key, stack: ctx.host.stacked ? "stack" : undefined, background: false, cornerRadius: 0 }))
  }
  if (!specs.length) return undefined
  const rows = ctx.rows
  const { margin: m, width: W, height: H, rtl } = ctx
  const plot: Rect = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const start = mirrorAngle(layoutValue(elements, "startAngle") ?? 0, rtl)
  const end = mirrorAngle(layoutValue(elements, "endAngle") ?? 360, rtl)
  const outerAttr = layoutValue(elements, "outerRadius")
  const innerAttr = layoutValue(elements, "innerRadius")
  // Pixel radii larger than the room are scaled down with the inner radius (same shape, smaller).
  const outerOf = (max: number) => resolveRadius(outerAttr, max, max * 0.8)
  const drawn = (max: number) => Math.min(max, outerOf(max))
  const { maxRadius, cx, cy } = fitArc(plot, start, end, drawn)
  const outer = drawn(maxRadius)
  const k = outer / (outerOf(maxRadius) || 1)
  const inner = Math.min(outer, k * resolveRadius(innerAttr, maxRadius, maxRadius * 0.3))

  // Stacks: cumulative values per stack id and row.
  const sums = new Map<string, number[]>()
  const ranges = specs.map((spec) =>
    rows.map((row, i) => {
      const value = Math.max(0, numeric(row?.[spec.key]) ?? 0)
      if (!spec.stack) return { base: 0, top: value }
      let stack = sums.get(spec.stack)
      if (!stack) sums.set(spec.stack, (stack = []))
      const base = stack[i] ?? 0
      stack[i] = base + value
      return { base, top: base + value }
    })
  )
  const maxValue = layoutValue(elements, "maxValue") ?? Math.max(0, ...ranges.flat().map((r) => r.top))
  const domain = maxValue > 0 ? maxValue : 1
  const angleOf = (v: number) => start + (end - start) * Math.min(1, Math.max(0, v / domain))

  const groups: string[] = []
  specs.forEach((spec, i) => {
    const id = spec.stack ? `stack:${spec.stack}` : `bar:${i}`
    if (!groups.includes(id)) groups.push(id)
  })
  const band = rows.length ? (outer - inner) / rows.length : 0
  const positions = barPositions(band, groups.length, ctx.host.barCategoryGap, ctx.host.barGap, layoutValue(elements, "barSize"))
  const perRow = specs.length === 1
  const series: RadialSeries[] = specs.map((spec, si) => {
    const color = ctx.seriesColor(spec.key, si, spec.color)
    const position = positions[groups.indexOf(spec.stack ? `stack:${spec.stack}` : `bar:${si}`)]!
    const bars = rows.map((row, i) => {
      const r0 = inner + i * band + position.offset
      const r1 = r0 + position.size
      const range = ranges[si]![i]!
      const a0 = angleOf(range.base)
      const a1 = angleOf(range.top)
      const name = nameKey ? String(row?.[nameKey] ?? i) : String(i)
      const fill = spec.color ?? (perRow ? ctx.rowColor(row, name, i) : color)
      return {
        row: i,
        d: range.top > range.base ? roundedSectorPath(cx, cy, r0, r1, a0, a1, spec.cornerRadius) : "",
        track: spec.background ? roundedSectorPath(cx, cy, r0, r1, start, end, spec.cornerRadius) : "",
        fill,
        start: a0,
        end: a1,
        r0,
        r1,
        value: range.top - range.base,
      }
    })
    return { spec, color, bars }
  })

  // Bar labels, drawn along the ring when they fit.
  const labels: RadialBarModel["labels"] = []
  const dir = Math.sign(end - start) || 1
  const lineHeight = ctx.fontSize
  series.forEach((s) => {
    const list = labelListsOf(ctx, s.spec.element).find((l) => !isCenter(l))
    if (!list) return
    s.bars.forEach((bar) => {
      const row = rows[bar.row]
      const text = labelText(ctx, list, row?.[list.key ?? s.spec.key], row, bar.row)
      if (!text) return
      const label = radialBarLabel(list, bar, ctx.measure(text), lineHeight, { cx, cy, end, dir })
      if (label) labels.push({ ...label, text, row: bar.row, color: bar.fill })
    })
  })

  // The centre label.
  let center: SVGTemplateResult | typeof nothing = nothing
  const centerSeries = series.find((s) => labelListsOf(ctx, s.spec.element).some(isCenter))
  if (centerSeries) {
    const list = labelListsOf(ctx, centerSeries.spec.element).find(isCenter)!
    const key = list.key ?? centerSeries.spec.key
    const total = rows.reduce((sum, row) => sum + (numeric(row?.[key]) ?? 0), 0)
    center = centerLabel(ctx, {
      cx,
      cy,
      inner,
      bounds: arcBounds(start, end) satisfies UnitBounds,
      value: labelText(ctx, list, total, rows.length === 1 ? rows[0] : undefined, -1),
      caption: ctx.config[key]?.label,
    })
  }

  return { kind: "radial-bar", plot, cx, cy, inner, outer, band, start, end, nameKey, perRow, series, labels, center, count: rows.length }
}

/**
 * The path a label follows along a ring: a half circle centred on the label's middle angle `mid`,
 * running left to right (clockwise over the top half, counter-clockwise under it) so the text reads
 * upright, at the radius that centres the glyphs (cap height `0.7em`) on `r`.
 */
export function arcTextPath(cx: number, cy: number, r: number, mid: number, fontSize: number): string {
  const top = Math.sin((mid * Math.PI) / 180) >= 0
  // Glyphs stand outside the baseline over the top half, inside it under the bottom half.
  const baseline = top ? r - fontSize * 0.35 : r + fontSize * 0.35
  const from = polarPoint(cx, cy, baseline, top ? mid + 89 : mid - 89)
  const to = polarPoint(cx, cy, baseline, top ? mid - 89 : mid + 89)
  const n = (v: number) => Math.round(v * 1000) / 1000
  return `M${n(from.x)},${n(from.y)}A${n(baseline)},${n(baseline)},0,0,${top ? 1 : 0},${n(to.x)},${n(to.y)}`
}

/**
 * A label written along a radial bar (following the ring, so it stays inside its own band): inside
 * the bar's start or end, or past its end. `undefined` when the text does not fit: the glyphs
 * (~0.8em) across the bar, and the text plus padding along the bar (or the rest of the track) at
 * the bar's middle radius.
 */
function radialBarLabel(
  list: TecChartLabelList,
  bar: RadialBarDraw,
  width: number,
  fontSize: number,
  frame: { cx: number; cy: number; end: number; dir: number }
): { path: string; inside: boolean } | undefined {
  const r = (bar.r0 + bar.r1) / 2
  const thickness = bar.r1 - bar.r0
  if (r <= 0 || thickness < fontSize * 0.8 + 2) return undefined
  const pad = Math.max(4, list.offset)
  const deg = (px: number) => (px / r) * (180 / Math.PI)
  const arc = (from: number, to: number) => (Math.abs(to - from) * Math.PI * r) / 180
  const { dir } = frame
  let mid: number
  let inside = true
  switch (list.position) {
    case "inside-end":
    case "inside":
      if (arc(bar.start, bar.end) < width + 2 * pad) return undefined
      mid = bar.end - dir * deg(pad + width / 2)
      break
    case "end":
    case "outside":
      if (arc(bar.end, frame.end) < width + 2 * pad) return undefined
      mid = bar.end + dir * deg(pad + width / 2)
      inside = false
      break
    default:
      // `inside-start` (and positions that do not apply to a ring).
      if (arc(bar.start, bar.end) < width + 2 * pad) return undefined
      mid = bar.start + dir * deg(pad + width / 2)
  }
  return { path: arcTextPath(frame.cx, frame.cy, r, mid, fontSize), inside }
}

function renderRadial(model: RadialBarModel, ctx: ChartContext): SVGTemplateResult {
  const { cx, cy } = model
  const grid = ctx.parts(TecChartPolarGrid)[0]
  const active = ctx.active
  const rows = ctx.rows
  const gridMarks = grid
    ? svg`<g class="grid polar-grid">${rows.map((_, i) => svg`<circle cx=${cx} cy=${cy} r=${model.inner + (i + 0.5) * model.band}></circle>`)}</g>`
    : nothing
  return svg`
    ${gridMarks}
    <g class="radial" style=${`transform-origin: ${cx}px ${cy}px`} ?data-has-active=${active >= 0}>
      ${model.series.map((s) => svg`${s.bars.map((bar) => (bar.track ? svg`<path class="track" d=${bar.track} data-index=${bar.row}></path>` : nothing))}`)}
      ${model.series.map(
        (s) => svg`<g class="radial-bars" ?data-stacked=${!!s.spec.stack}>${s.bars.map((bar) =>
          bar.d
            ? svg`<path class="radial-bar" d=${bar.d} style=${`d: path("${bar.d}")`} fill=${bar.fill} data-index=${bar.row} ?data-active=${bar.row === active}></path>`
            : nothing
        )}</g>`
      )}
    </g>
    ${model.labels.length
      ? // After every bar, so no ring paints over a label.
        svg`<g class="inside-labels radial-labels">
          <defs>${model.labels.map((l, i) => svg`<path id=${`radial-label-${i}`} d=${l.path}></path>`)}</defs>
          ${model.labels.map(
            (l, i) => svg`<text class=${l.inside ? "inside-label" : "value-label"} data-row=${l.row} style=${`--tec-chart-label-on: ${l.color}`}>
              <textPath href=${`#radial-label-${i}`} startOffset="50%" text-anchor="middle">${l.text}</textPath>
            </text>`
          )}
        </g>`
      : nothing}
    ${model.center}
  `
}

export const radialBarKind: ChartKind<RadialBarModel> = {
  id: "radial-bar",
  claims: (ctx) => ctx.parts(TecChartRadialBar).length > 0 || ctx.host.type === "radial-bar",
  label: () => "Radial bar chart",
  model: computeRadial,
  render: renderRadial,
  payload(model, index, ctx): ChartPayload {
    const row = ctx.rows[index]
    if (!row) return { label: undefined, items: [] }
    const name = model.nameKey ? String(row[model.nameKey] ?? index) : String(index + 1)
    if (model.perRow) {
      const s = model.series[0]!
      return { label: undefined, items: [{ dataKey: s.spec.key, name, value: row[s.spec.key], color: s.bars[index]?.fill ?? s.color, row }] }
    }
    return {
      label: model.nameKey ? row[model.nameKey] : undefined,
      items: model.series.map((s) => ({ dataKey: s.spec.key, name: s.spec.key, value: row[s.spec.key], color: s.color, row })),
    }
  },
  anchor(model, index) {
    const bars = model.series.map((s) => s.bars[index]).filter((b): b is RadialBarDraw => !!b)
    if (!bars.length) return undefined
    const last = bars.reduce((a, b) => (Math.abs(b.end - model.start) > Math.abs(a.end - model.start) ? b : a))
    return polarPoint(model.cx, model.cy, (Math.min(...bars.map((b) => b.r0)) + Math.max(...bars.map((b) => b.r1))) / 2, last.end)
  },
  hit(model, point) {
    const { angle, radius } = toPolar(model.cx, model.cy, point)
    if (!model.count || model.band <= 0) return -1
    const pad = halfPad(model.band)
    if (radius < model.inner - pad || radius > model.outer + pad) return -1
    const pixels = radius > 0 ? (12 / radius) * (180 / Math.PI) : 0
    if (!angleInArc(angle, model.start, model.end, pixels)) return -1
    return Math.min(model.count - 1, Math.max(0, Math.floor((radius - model.inner) / model.band)))
  },
  table(model, ctx) {
    if (!ctx.rows.length) return nothing
    return dataTable(ctx, model.nameKey, model.series.map((s) => s.spec))
  },
  legend(model, ctx) {
    if (model.perRow) {
      return ctx.rows.map((row, i) => ({
        dataKey: model.nameKey ? String(row?.[model.nameKey] ?? i) : String(i),
        color: model.series[0]!.bars[i]?.fill ?? model.series[0]!.color,
        row,
      }))
    }
    return model.series.map((s) => ({ dataKey: s.spec.key, color: s.color }))
  },
}

/** Styles of the marks of this module (and the labels shared with the pie), added to `<tec-chart>`'s shadow root. */
export const polarStyles = css`
  .polar-grid line,
  .polar-grid path,
  .polar-grid circle {
    fill: none;
    stroke: color-mix(in oklab, var(--tec-border) 50%, transparent);
  }
  .polar-grid .grid-fill > * {
    fill: var(--tec-muted);
    stroke: none;
  }
  .radar-shape {
    stroke-linejoin: round;
  }
  .radar-dot {
    stroke: var(--tec-background);
    stroke-width: 2px;
  }
  .tick[data-active] {
    fill: var(--tec-foreground);
  }
  /* Text drawn over marks keeps a surface-coloured halo. */
  .halo {
    paint-order: stroke;
    stroke: var(--tec-background);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .value-label {
    fill: var(--tec-foreground);
  }
  .track {
    fill: var(--tec-muted);
  }
  .radial-bars[data-stacked] .radial-bar {
    stroke: var(--tec-background);
    stroke-width: 2px;
    stroke-linejoin: round;
  }
  /* Labels inside a coloured mark: white or ink by the fill's lightness. The group's fill is the
     fallback, and what an invalid computed colour inherits. */
  .inside-labels {
    fill: var(--tec-background);
  }
  @supports (color: oklch(from red l c h)) {
    .inside-label {
      fill: oklch(from var(--tec-chart-label-on) clamp(0, (0.62 - l) * 1000, 1) 0 0);
    }
  }
  .center-value {
    fill: var(--tec-foreground);
    font-weight: 700;
  }
  .center-caption {
    fill: var(--tec-muted-foreground);
  }
  .radial-bar {
    cursor: default;
  }
  /* A label on a ring is centred on its path; the base direction stays LTR so the layout never
     flips (right-to-left text is still ordered by the bidi algorithm). */
  .radial-labels text {
    direction: ltr;
  }
  /* The active row stands out: the other rows recede. */
  .radial[data-has-active] .radial-bar:not([data-active]) {
    opacity: 0.45;
  }
  @media (prefers-reduced-motion: no-preference) {
    .radar,
    .radial {
      animation: tec-chart-pop 400ms var(--tec-ease-out, ease-out) both;
    }
    svg[data-transition] .radar-shape,
    svg[data-transition] .radial-bar {
      transition:
        d 300ms var(--tec-ease, ease),
        opacity 150ms var(--tec-ease, ease);
    }
  }
  @media (forced-colors: active) {
    .radar-shape,
    .radar-dot,
    .radial-bar,
    .track,
    .sector,
    .inside-labels {
      forced-color-adjust: none;
    }
    .polar-grid line,
    .polar-grid path,
    .polar-grid circle {
      stroke: GrayText;
    }
    .halo,
    .radar-dot {
      stroke: Canvas;
    }
    .value-label,
    .center-value,
    .center-caption,
    .tick[data-active] {
      fill: CanvasText;
    }
  }
`

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-radar": TecChartRadar
    "tec-chart-radial-bar": TecChartRadialBar
    "tec-chart-polar-grid": TecChartPolarGrid
    "tec-chart-polar-angle-axis": TecChartPolarAngleAxis
    "tec-chart-polar-radius-axis": TecChartPolarRadiusAxis
  }
}
