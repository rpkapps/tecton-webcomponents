/**
 * @module chart-engine
 * The geometry behind `<tec-chart>`: nice value ticks, band/point category scales, bar placement,
 * curve and area paths, pie sectors and tick-label thinning. Pure functions over numbers — no DOM,
 * no dependencies — so they are cheap to test and to reason about.
 *
 * The algorithms follow the conventions of the charting libraries the shadcn/ui chart builds on
 * (nice steps of 1/2/2.5/5 × 10ⁿ, 10% category gap and 4px gap between bars, curves equivalent to
 * the d3-shape `curveLinear`, `curveMonotoneX`, `curveNatural` and `curveStep`), so charts built with
 * the same data look the same.
 */

/** A point in chart coordinates (pixels, origin top-left). */
export interface Point {
  x: number
  y: number
}

/** Curve interpolation of line and area series. */
export type ChartCurve = "linear" | "monotone" | "natural" | "step"

// ------------------------------------------------------------------------------------------ numbers

function digitCount(value: number): number {
  return value === 0 ? 1 : Math.floor(Math.log10(Math.abs(value))) + 1
}

/** Rounds away floating-point noise (0.1 + 0.2 → 0.3). */
function clean(value: number): number {
  return Number.parseFloat(value.toPrecision(12))
}

function adaptiveStep(roughStep: number, correction: number): number {
  if (roughStep <= 0) return 0
  const digits = digitCount(roughStep)
  const magnitude = 10 ** digits
  const ratio = roughStep / magnitude
  const ratioScale = digits !== 1 ? 0.05 : 0.1
  const amended = clean((Math.ceil(clean(ratio / ratioScale)) + correction) * ratioScale)
  return clean(amended * magnitude)
}

function calculateStep(min: number, max: number, count: number, correction = 0): { step: number; tickMin: number; tickMax: number } {
  const step = adaptiveStep((max - min) / (count - 1), correction)
  if (!step) return { step: 1, tickMin: min, tickMax: max }
  let middle: number
  if (min <= 0 && max >= 0) middle = 0
  else {
    middle = (min + max) / 2
    middle = clean(middle - (middle % step))
  }
  let below = Math.ceil(clean((middle - min) / step))
  let up = Math.ceil(clean((max - middle) / step))
  const total = below + up + 1
  if (total > count) return calculateStep(min, max, count, correction + 1)
  if (total < count) {
    if (max > 0) up += count - total
    else below += count - total
  }
  return { step, tickMin: clean(middle - below * step), tickMax: clean(middle + up * step) }
}

/**
 * "Nice" tick values covering `[min, max]` — `count` ticks at a round step (1, 2, 2.5, 5 × 10ⁿ in
 * 5% increments), including 0 when the interval crosses it. `niceTicks(0, 305)` → `[0, 80, 160, 240, 320]`.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  count = Math.max(2, Math.round(count))
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min > max) [min, max] = [max, min]
  if (min === max) {
    if (min === 0) return Array.from({ length: count }, (_, i) => i)
    const middle = Math.floor(min)
    const mid = Math.floor((count - 1) / 2)
    return Array.from({ length: count }, (_, i) => middle + (i - mid))
  }
  const { step, tickMin, tickMax } = calculateStep(min, max, count)
  const ticks: number[] = []
  for (let v = tickMin; v <= tickMax + step * 0.1; v = clean(v + step)) ticks.push(v)
  return ticks
}

/** A linear scale `[d0, d1]` → `[r0, r1]`. */
export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (value) => r0 + ((value - d0) / span) * (r1 - r0)
}

// ------------------------------------------------------------------------------------------ categories

/** Placement of one category along the category axis. */
export interface CategorySlot {
  /** Start of the category's band (equals `center` for a point scale). */
  start: number
  /** Centre of the band (where the tick and line points sit). */
  center: number
  /** Width of the band (0 for a point scale). */
  size: number
}

/**
 * Places `count` categories along `[start, end]`. A `band` scale (bar charts) splits the range into
 * equal bands; a `point` scale (line and area charts) puts the first and last category on the edges.
 */
export function categoryScale(count: number, start: number, end: number, kind: "band" | "point"): CategorySlot[] {
  const length = end - start
  if (count <= 0) return []
  if (kind === "band") {
    const size = length / count
    return Array.from({ length: count }, (_, i) => ({ start: start + i * size, center: start + (i + 0.5) * size, size }))
  }
  if (count === 1) return [{ start: start + length / 2, center: start + length / 2, size: 0 }]
  const step = length / (count - 1)
  return Array.from({ length: count }, (_, i) => ({ start: start + i * step, center: start + i * step, size: 0 }))
}

/** Index of the category under `position` (nearest one for a point scale), or -1 outside the range. */
export function categoryAt(slots: CategorySlot[], position: number): number {
  if (!slots.length) return -1
  const first = slots[0]!
  const last = slots[slots.length - 1]!
  if (first.size > 0) {
    if (position < first.start || position > last.start + last.size) return -1
    return Math.min(slots.length - 1, Math.max(0, Math.floor((position - first.start) / first.size)))
  }
  let best = 0
  let distance = Infinity
  slots.forEach((slot, i) => {
    const d = Math.abs(slot.center - position)
    if (d < distance) {
      distance = d
      best = i
    }
  })
  return best
}

/** Offset and size of each bar group ("slot") inside a band. */
export interface BarPosition {
  offset: number
  size: number
}

/**
 * Splits a band of `bandSize` into `groups` bars: a category gap of `categoryGap` (a fraction of the
 * band) on each side, `barGap` pixels between bars; `maxBarSize` caps the bar thickness.
 */
export function barPositions(bandSize: number, groups: number, categoryGap = 0.1, barGap = 4, maxBarSize?: number): BarPosition[] {
  if (groups < 1) return []
  const offset = bandSize * categoryGap
  let gap = barGap
  if (bandSize - 2 * offset - (groups - 1) * gap <= 0) gap = 0
  let original = (bandSize - 2 * offset - (groups - 1) * gap) / groups
  if (original > 1) original = Math.trunc(original)
  const size = maxBarSize != null && Number.isFinite(maxBarSize) ? Math.min(original, maxBarSize) : original
  return Array.from({ length: groups }, (_, i) => ({ offset: offset + (original + gap) * i + (original - size) / 2, size }))
}

// ------------------------------------------------------------------------------------------ shapes

const f = (n: number) => clean(Math.round(n * 1000) / 1000)

/**
 * A rectangle path with per-corner radii `[topStart, topEnd, bottomEnd, bottomStart]` (in the
 * chart's physical left-to-right frame: top-left, top-right, bottom-right, bottom-left). Radii are
 * clamped to half the smaller side. Always emits the same command sequence, so the path's `d`
 * can be transitioned between values.
 */
export function roundedRect(x: number, y: number, width: number, height: number, radius: [number, number, number, number]): string {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }
  const max = Math.min(width, height) / 2
  const [tl, tr, br, bl] = radius.map((r) => Math.max(0, Math.min(r, max))) as [number, number, number, number]
  return (
    `M${f(x + tl)},${f(y)}` +
    `H${f(x + width - tr)}A${f(tr)},${f(tr)},0,0,1,${f(x + width)},${f(y + tr)}` +
    `V${f(y + height - br)}A${f(br)},${f(br)},0,0,1,${f(x + width - br)},${f(y + height)}` +
    `H${f(x + bl)}A${f(bl)},${f(bl)},0,0,1,${f(x)},${f(y + height - bl)}` +
    `V${f(y + tl)}A${f(tl)},${f(tl)},0,0,1,${f(x + tl)},${f(y)}Z`
  )
}

function sign(n: number): number {
  return n < 0 ? -1 : 1
}

/** Path commands (without the initial move) for a curve through `points`, starting at points[0]. */
function curveSegments(points: Point[], curve: ChartCurve): string {
  const n = points.length
  if (n < 2) return ""
  if (curve === "linear" || n === 2) {
    if (curve === "step" && n === 2) return stepSegments(points)
    return points.slice(1).map((p) => `L${f(p.x)},${f(p.y)}`).join("")
  }
  if (curve === "step") return stepSegments(points)
  if (curve === "natural") return naturalSegments(points)
  return monotoneSegments(points)
}

function stepSegments(points: Point[]): string {
  let out = ""
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const mid = (a.x + b.x) / 2
    out += `L${f(mid)},${f(a.y)}L${f(mid)},${f(b.y)}`
  }
  const last = points[points.length - 1]!
  return out + `L${f(last.x)},${f(last.y)}`
}

function naturalControlPoints(x: number[]): [number[], number[]] {
  const n = x.length - 1
  const a = new Array<number>(n)
  const b = new Array<number>(n)
  const r = new Array<number>(n)
  a[0] = 0
  b[0] = 2
  r[0] = x[0]! + 2 * x[1]!
  for (let i = 1; i < n - 1; ++i) {
    a[i] = 1
    b[i] = 4
    r[i] = 4 * x[i]! + 2 * x[i + 1]!
  }
  a[n - 1] = 2
  b[n - 1] = 7
  r[n - 1] = 8 * x[n - 1]! + x[n]!
  for (let i = 1; i < n; ++i) {
    const m = a[i]! / b[i - 1]!
    b[i] = b[i]! - m
    r[i] = r[i]! - m * r[i - 1]!
  }
  a[n - 1] = r[n - 1]! / b[n - 1]!
  for (let i = n - 2; i >= 0; --i) a[i] = (r[i]! - a[i + 1]!) / b[i]!
  b[n - 1] = (x[n]! + a[n - 1]!) / 2
  for (let i = 0; i < n - 1; ++i) b[i] = 2 * x[i + 1]! - a[i + 1]!
  return [a, b]
}

function naturalSegments(points: Point[]): string {
  const [ax, bx] = naturalControlPoints(points.map((p) => p.x))
  const [ay, by] = naturalControlPoints(points.map((p) => p.y))
  let out = ""
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    out += `C${f(ax[i - 1]!)},${f(ay[i - 1]!)},${f(bx[i - 1]!)},${f(by[i - 1]!)},${f(p.x)},${f(p.y)}`
  }
  return out
}

function monotoneSegments(points: Point[]): string {
  // Steffen's monotone cubic interpolation along x (d3 curveMonotoneX).
  const n = points.length
  const tangents = new Array<number>(n)
  const slope = (a: Point, b: Point) => (b.x - a.x ? (b.y - a.y) / (b.x - a.x) : 0)
  for (let i = 1; i < n - 1; i++) {
    const p0 = points[i - 1]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const h0 = p1.x - p0.x
    const h1 = p2.x - p1.x
    const s0 = slope(p0, p1)
    const s1 = slope(p1, p2)
    const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1)
    tangents[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  const endSlope = (a: Point, b: Point, t: number) => {
    const h = b.x - a.x
    return h ? (3 * (b.y - a.y) / h - t) / 2 : t
  }
  tangents[0] = endSlope(points[0]!, points[1]!, tangents[1]!)
  tangents[n - 1] = endSlope(points[n - 2]!, points[n - 1]!, tangents[n - 2]!)
  let out = ""
  for (let i = 1; i < n; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const dx = (b.x - a.x) / 3
    out += `C${f(a.x + dx)},${f(a.y + dx * tangents[i - 1]!)},${f(b.x - dx)},${f(b.y - dx * tangents[i]!)},${f(b.x)},${f(b.y)}`
  }
  return out
}

/** An open path through `points` with the given curve. */
export function linePath(points: Point[], curve: ChartCurve = "linear"): string {
  if (!points.length) return ""
  const first = points[0]!
  return `M${f(first.x)},${f(first.y)}` + curveSegments(points, curve)
}

/**
 * A closed area between the `top` points and the `base` points (same length, same x), both drawn
 * with the given curve — the base in reverse, as d3's `area()` does.
 */
export function areaPath(top: Point[], base: Point[], curve: ChartCurve = "linear"): string {
  if (!top.length) return ""
  const reversed = [...base].reverse()
  const start = reversed[0]!
  return linePath(top, curve) + `L${f(start.x)},${f(start.y)}` + curveSegments(reversed, curve) + "Z"
}

// ------------------------------------------------------------------------------------------ polar

const RAD = Math.PI / 180

/** The point at `angle` degrees (counter-clockwise from 3 o'clock) and `radius` around `(cx, cy)`. */
export function polarPoint(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.cos(-angle * RAD), y: cy + radius * Math.sin(-angle * RAD) }
}

/** A pie/donut sector from `startAngle` to `endAngle` (degrees, counter-clockwise). */
export function sectorPath(cx: number, cy: number, inner: number, outer: number, startAngle: number, endAngle: number): string {
  const delta = endAngle - startAngle
  if (Math.abs(delta) >= 359.999) {
    // A full ring: two half arcs (an arc cannot start and end on the same point).
    const mid = startAngle + 180
    const o0 = polarPoint(cx, cy, outer, startAngle)
    const o1 = polarPoint(cx, cy, outer, mid)
    let d = `M${f(o0.x)},${f(o0.y)}A${f(outer)},${f(outer)},0,1,0,${f(o1.x)},${f(o1.y)}A${f(outer)},${f(outer)},0,1,0,${f(o0.x)},${f(o0.y)}`
    if (inner > 0) {
      const i0 = polarPoint(cx, cy, inner, startAngle)
      const i1 = polarPoint(cx, cy, inner, mid)
      d += `M${f(i0.x)},${f(i0.y)}A${f(inner)},${f(inner)},0,1,1,${f(i1.x)},${f(i1.y)}A${f(inner)},${f(inner)},0,1,1,${f(i0.x)},${f(i0.y)}`
    }
    return d + "Z"
  }
  const large = Math.abs(delta) > 180 ? 1 : 0
  const sweep = delta > 0 ? 0 : 1
  const o0 = polarPoint(cx, cy, outer, startAngle)
  const o1 = polarPoint(cx, cy, outer, endAngle)
  let d = `M${f(o0.x)},${f(o0.y)}A${f(outer)},${f(outer)},0,${large},${sweep},${f(o1.x)},${f(o1.y)}`
  if (inner > 0) {
    const i1 = polarPoint(cx, cy, inner, endAngle)
    const i0 = polarPoint(cx, cy, inner, startAngle)
    d += `L${f(i1.x)},${f(i1.y)}A${f(inner)},${f(inner)},0,${large},${1 - sweep},${f(i0.x)},${f(i0.y)}`
  } else {
    d += `L${f(cx)},${f(cy)}`
  }
  return d + "Z"
}

/** One slice of a pie layout. */
export interface PieSlice {
  index: number
  value: number
  startAngle: number
  endAngle: number
  midAngle: number
}

/** Angles of the slices for `values` (negative/NaN values count as 0), with `padAngle` between them. */
export function pieLayout(values: number[], startAngle = 0, endAngle = 360, padAngle = 0): PieSlice[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = clean.reduce((a, b) => a + b, 0)
  const nonZero = clean.filter((v) => v > 0).length
  const range = endAngle - startAngle
  const absRange = Math.abs(range)
  const padding = nonZero > 1 ? (absRange >= 360 ? nonZero : nonZero - 1) * padAngle : 0
  const available = Math.max(0, absRange - padding)
  const dir = Math.sign(range) || 1
  let angle = startAngle
  let first = true
  return clean.map((value, index) => {
    const sweep = total ? (value / total) * available : 0
    if (value > 0 && !first && nonZero > 1) angle += dir * padAngle
    if (value > 0) first = false
    const slice = { index, value, startAngle: angle, endAngle: angle + dir * sweep, midAngle: angle + (dir * sweep) / 2 }
    angle += dir * sweep
    return slice
  })
}

/** Resolves a radius given as pixels (`60`, `"60"`) or a percentage of `max` (`"80%"`). */
export function resolveRadius(value: string | number | undefined, max: number, fallback: number): number {
  if (value == null || value === "") return fallback
  if (typeof value === "number") return value
  const text = value.trim()
  if (text.endsWith("%")) return (Number.parseFloat(text) / 100) * max
  const n = Number.parseFloat(text)
  return Number.isFinite(n) ? n : fallback
}

// ------------------------------------------------------------------------------------------ ticks

/** A candidate tick label along an axis. */
export interface AxisTick {
  index: number
  /** Position of the tick along the axis. */
  coordinate: number
  /** Position of the label (moved inwards when the first or last label would overflow). */
  labelCoordinate: number
}

/**
 * Picks which tick labels to show so that none overlap: walks from the end (the last label is always
 * kept, nudged inside the range when needed) and keeps a label when it clears the previous one by
 * `minGap` pixels. The first label is nudged inside the range too, rather than dropped. `sizeOf(i)`
 * is the label's extent along the axis; `start`/`end` bound the labels (the chart's whole width,
 * so edge labels can use its margin).
 */
export function thinTicks(
  coordinates: number[],
  sizeOf: (index: number) => number,
  start: number,
  end: number,
  minGap = 5
): AxisTick[] {
  const shown: AxisTick[] = []
  let limit = end
  for (let i = coordinates.length - 1; i >= 0; i--) {
    const coordinate = coordinates[i]!
    let label = coordinate
    const size = sizeOf(i)
    if (i === coordinates.length - 1) {
      const overflow = coordinate + size / 2 - end
      if (overflow > 0) label = coordinate - overflow
    }
    if (i === 0) {
      const overflow = start - (label - size / 2)
      if (overflow > 0) label += overflow
    }
    if (label < start || label > limit) continue
    if (label - size / 2 - start >= -0.001 && label + size / 2 - limit <= 0.001) {
      shown.unshift({ index: i, coordinate, labelCoordinate: label })
      limit = label - (size / 2 + minGap)
    }
  }
  return shown
}
