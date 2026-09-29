/**
 * @module chart-cartesian-engine
 * Pure geometry of the cartesian extensions of `<tec-chart>`: axis domains, number-axis slots,
 * scatter symbols and bubble sizes, nearest-point search, error extents, value-label placement and
 * the brush window. No DOM, no dependencies.
 */
import { niceTicks, type CategorySlot, type Point } from "./chart-engine.js"
import type { Rect } from "./chart-kind.js"

// ------------------------------------------------------------------------------------------ domains

/** One side of an axis domain: a number, a nice value around the data, or the data's own extent. */
export type DomainSide = number | "auto" | "data"

/**
 * Parses a `domain` attribute: `"0,100"`, `"auto"`, `"auto,100"`, `"dataMin,dataMax"`… Returns
 * `undefined` for an empty or unreadable value.
 */
export function parseDomain(spec: string | undefined): [DomainSide, DomainSide] | undefined {
  if (spec == null) return undefined
  const parts = spec
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return undefined
  if (parts.length === 1) parts.push(parts[0]!)
  const side = (text: string): DomainSide | undefined => {
    const lower = text.toLowerCase()
    if (lower === "auto") return "auto"
    if (lower === "datamin" || lower === "datamax") return "data"
    const n = Number(text)
    return text !== "" && Number.isFinite(n) ? n : undefined
  }
  const a = side(parts[0]!)
  const b = side(parts[1]!)
  if (a === undefined || b === undefined) return undefined
  return [a, b]
}

/** Ticks and domain of an axis. */
export interface AxisDomain {
  ticks: number[]
  domain: [number, number]
}

const EPSILON = 1e-9

function evenTicks(d0: number, d1: number, count: number): number[] {
  const n = Math.max(2, Math.round(count))
  return Array.from({ length: n }, (_, i) => Number.parseFloat((d0 + ((d1 - d0) * i) / (n - 1)).toPrecision(12)))
}

/**
 * The ticks and domain of an axis covering `[lo, hi]` (the data, error bars and reference
 * elements). Without a `spec`, the domain is nice on both sides and includes zero when
 * `includeZero` (the value axis default). A number side is widened to include the data; `data`
 * is the data's own extent; `auto` is the nice tick around it.
 */
export function resolveDomain(spec: string | undefined, lo: number, hi: number, count = 5, includeZero = false): AxisDomain {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0
    hi = 1
  }
  const sides = parseDomain(spec)
  if (!sides) {
    if (includeZero) {
      lo = Math.min(0, lo)
      hi = Math.max(0, hi)
    }
    const ticks = niceTicks(lo, hi === lo ? lo + 1 : hi, count)
    return { ticks, domain: [ticks[0]!, ticks[ticks.length - 1]!] }
  }
  const [s0, s1] = sides
  if (s0 === "auto" && s1 === "auto") {
    const ticks = niceTicks(lo, hi === lo ? lo + 1 : hi, count)
    return { ticks, domain: [ticks[0]!, ticks[ticks.length - 1]!] }
  }
  let d0 = typeof s0 === "number" ? Math.min(s0, lo) : s0 === "data" ? lo : undefined
  let d1 = typeof s1 === "number" ? Math.max(s1, hi) : s1 === "data" ? hi : undefined
  if (d0 !== undefined && d1 !== undefined && d0 === d1) {
    d1 = d0 + 1
  }
  const nice = niceTicks(d0 ?? lo, d1 ?? (hi === (d0 ?? lo) ? hi + 1 : hi), count)
  d0 ??= Math.min(nice[0]!, d1 ?? nice[0]!)
  d1 ??= Math.max(nice[nice.length - 1]!, d0)
  if (d1 <= d0) d1 = d0 + 1
  const from = d0
  const to = d1
  let ticks = nice.filter((t) => t >= from - EPSILON * Math.abs(to - from) && t <= to + EPSILON * Math.abs(to - from))
  if (ticks.length < 2) ticks = evenTicks(from, to, count)
  return { ticks, domain: [from, to] }
}

// ------------------------------------------------------------------------------------------ number axis

/**
 * Slots of rows placed on a number axis at `centers`. With bars, every slot is as wide as the
 * smallest gap between two distinct positions (`fallback` when there is only one).
 */
export function numericSlots(centers: number[], bands: boolean, fallback: number): CategorySlot[] {
  let size = 0
  if (bands) {
    const sorted = [...new Set(centers)].sort((a, b) => a - b)
    let gap = Infinity
    for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i]! - sorted[i - 1]!)
    size = Number.isFinite(gap) ? gap : fallback
  }
  return centers.map((center) => ({ start: center - size / 2, center, size }))
}

/** The smallest gap between two distinct values (in data units), or 0. */
export function smallestStep(values: number[]): number {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  let gap = Infinity
  for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i]! - sorted[i - 1]!)
  return Number.isFinite(gap) ? gap : 0
}

/** Index of the position in `positions` nearest to `value` (-1 when empty). */
export function nearestIndex(positions: number[], value: number): number {
  let best = -1
  let distance = Infinity
  positions.forEach((p, i) => {
    const d = Math.abs(p - value)
    if (d < distance) {
      distance = d
      best = i
    }
  })
  return best
}

// ------------------------------------------------------------------------------------------ scatter

/** A mark of a scatter series, for the nearest-point search. */
export interface PointMark extends Point {
  /** The radius of the mark. */
  r: number
}

/**
 * Index of the mark nearest to `point` whose edge is within `max` pixels of it (-1 for none).
 * A linear scan: fine for the few hundred points a readable scatter chart holds.
 */
export function nearestPoint(marks: PointMark[], point: Point, max = 24): number {
  let best = -1
  let distance = Infinity
  marks.forEach((m, i) => {
    const d = Math.hypot(m.x - point.x, m.y - point.y)
    if (d - m.r <= max && d < distance) {
      distance = d
      best = i
    }
  })
  return best
}

/** Parses `"min,max"` (a single number is both). */
export function parseRange(value: string | undefined, fallback: [number, number]): [number, number] {
  const parts = String(value ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return fallback
  const a = parts[0]!
  const b = parts[1] ?? a
  return [Math.min(a, b), Math.max(a, b)]
}

/**
 * The radius of a bubble whose area grows linearly with `value` between `[zMin, zMax]` (the data
 * extent), from the radius `rMin` to `rMax`.
 */
export function bubbleRadius(value: number | null, zMin: number, zMax: number, rMin: number, rMax: number): number {
  if (value == null || zMax <= zMin) return value == null ? rMin : rMax
  const t = Math.min(1, Math.max(0, (value - zMin) / (zMax - zMin)))
  return Math.sqrt(rMin * rMin + t * (rMax * rMax - rMin * rMin))
}

const f = (n: number) => Number.parseFloat((Math.round(n * 1000) / 1000).toPrecision(12))

/**
 * A symbol path centred on `(cx, cy)` with the area of a circle of radius `r` (the d3-shape symbol
 * geometry, so shapes of the same `r` weigh the same).
 */
export function symbolPath(shape: string, cx: number, cy: number, r: number): string {
  const size = Math.PI * r * r
  const pts = (list: [number, number][]) => `M${list.map(([x, y]) => `${f(cx + x)},${f(cy + y)}`).join("L")}Z`
  switch (shape) {
    case "square": {
      const h = Math.sqrt(size) / 2
      return pts([
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
      ])
    }
    case "diamond": {
      const tan30 = Math.sqrt(1 / 3)
      const y = Math.sqrt(size / (tan30 * 2))
      const x = y * tan30
      return pts([
        [0, -y],
        [x, 0],
        [0, y],
        [-x, 0],
      ])
    }
    case "triangle": {
      const sqrt3 = Math.sqrt(3)
      const y = -Math.sqrt(size / (sqrt3 * 3))
      return pts([
        [0, y * 2],
        [-sqrt3 * y, -y],
        [sqrt3 * y, -y],
      ])
    }
    case "cross": {
      const a = Math.sqrt(size / 5) / 2
      return pts([
        [-3 * a, -a],
        [-a, -a],
        [-a, -3 * a],
        [a, -3 * a],
        [a, -a],
        [3 * a, -a],
        [3 * a, a],
        [a, a],
        [a, 3 * a],
        [-a, 3 * a],
        [-a, a],
        [-3 * a, a],
      ])
    }
    case "star": {
      const ka = 0.8908130915292852
      const kr = Math.sin(Math.PI / 10) / Math.sin((7 * Math.PI) / 10)
      const kx = Math.sin((2 * Math.PI) / 10) * kr
      const ky = -Math.cos((2 * Math.PI) / 10) * kr
      const R = Math.sqrt(size * ka)
      const x = kx * R
      const y = ky * R
      const list: [number, number][] = [
        [0, -R],
        [x, y],
      ]
      for (let i = 1; i < 5; i++) {
        const a = (2 * Math.PI * i) / 5
        const c = Math.cos(a)
        const s = Math.sin(a)
        list.push([s * R, -c * R], [c * x - s * y, s * x + c * y])
      }
      return pts(list)
    }
    default:
      return `M${f(cx - r)},${f(cy)}A${f(r)},${f(r)},0,1,0,${f(cx + r)},${f(cy)}A${f(r)},${f(r)},0,1,0,${f(cx - r)},${f(cy)}Z`
  }
}

// ------------------------------------------------------------------------------------------ error bars

/**
 * The `[low, high]` values of an error bar around `value`: the error is a number (±) or a
 * `[below, above]` pair of distances. `null` when either is missing.
 */
export function errorExtent(value: number | null, error: unknown): [number, number] | null {
  if (value == null || error == null) return null
  if (Array.isArray(error)) {
    const below = Number(error[0])
    const above = Number(error[1] ?? error[0])
    if (!Number.isFinite(below) || !Number.isFinite(above)) return null
    return [value - Math.abs(below), value + Math.abs(above)]
  }
  const e = typeof error === "number" ? error : Number(error)
  if (typeof error === "string" && error.trim() === "") return null
  if (!Number.isFinite(e)) return null
  return [value - Math.abs(e), value + Math.abs(e)]
}

// ------------------------------------------------------------------------------------------ labels

/** Where a value label sits relative to its mark (see `tec-chart-label-list`). */
export type LabelPosition =
  | "top"
  | "bottom"
  | "start"
  | "end"
  | "outside"
  | "inside"
  | "center"
  | "inside-start"
  | "inside-end"
  | "inside-top"
  | "inside-bottom"

/** A placed label: the centre of its box, and whether it sits inside a filled mark. */
export interface LabelPlacement extends Point {
  inside: boolean
  /** The label could not go where it was asked to and moved (it yields to labels that did not). */
  moved?: boolean
}

const INSIDE: ReadonlySet<string> = new Set(["inside", "center", "inside-start", "inside-end", "inside-top", "inside-bottom"])

function centerOf(position: string, box: Rect, width: number, height: number, offset: number): Point {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  switch (position) {
    case "top":
      return { x: cx, y: box.y - offset - height / 2 }
    case "bottom":
      return { x: cx, y: box.y + box.h + offset + height / 2 }
    case "start":
      return { x: box.x - offset - width / 2, y: cy }
    case "end":
      return { x: box.x + box.w + offset + width / 2, y: cy }
    case "inside-top":
      return { x: cx, y: box.y + offset + height / 2 }
    case "inside-bottom":
      return { x: cx, y: box.y + box.h - offset - height / 2 }
    case "inside-start":
      return { x: box.x + offset + width / 2, y: cy }
    case "inside-end":
      return { x: box.x + box.w - offset - width / 2, y: cy }
    default:
      return { x: cx, y: cy }
  }
}

function fitsInside(position: string, box: Rect, width: number, height: number, offset: number): boolean {
  const padX = position === "inside-start" || position === "inside-end" ? offset * 2 : 4
  const padY = position === "inside-top" || position === "inside-bottom" ? offset * 2 : 2
  return width + padX <= box.w && height + padY <= box.h
}

function within(center: Point, width: number, height: number, bounds: Rect): boolean {
  return (
    center.x - width / 2 >= bounds.x - 0.5 &&
    center.x + width / 2 <= bounds.x + bounds.w + 0.5 &&
    center.y - height / 2 >= bounds.y - 0.5 &&
    center.y + height / 2 <= bounds.y + bounds.h + 0.5
  )
}

/**
 * Places a label of `width` × `height` on a bar `box`. An inside position is used only when the
 * label fits in the bar; otherwise (and for `outside`) the label goes past the bar's value end
 * (`negative`: the bar runs down, or towards the start when `horizontal`). An outside label that
 * would leave `bounds` goes inside at the value end when it fits there. `null`: no room anywhere.
 */
export function placeBarLabel(
  position: string,
  box: Rect,
  width: number,
  height: number,
  offset: number,
  horizontal: boolean,
  negative: boolean,
  bounds: Rect
): LabelPlacement | null {
  const outside = horizontal ? (negative ? "start" : "end") : negative ? "bottom" : "top"
  const insideEnd = horizontal ? (negative ? "inside-start" : "inside-end") : negative ? "inside-bottom" : "inside-top"
  let pos = position === "outside" ? outside : position
  let moved = false
  if (INSIDE.has(pos)) {
    if (fitsInside(pos, box, width, height, offset)) return { ...centerOf(pos, box, width, height, offset), inside: true }
    pos = outside
    moved = true
  }
  const center = centerOf(pos, box, width, height, offset)
  if (within(center, width, height, bounds)) return { ...center, inside: false, moved }
  if (fitsInside(insideEnd, box, width, height, offset)) return { ...centerOf(insideEnd, box, width, height, offset), inside: true, moved: true }
  return null
}

const OPPOSITE: Record<string, string> = { top: "bottom", bottom: "top", start: "end", end: "start" }

/**
 * Places a label of `width` × `height` beside a point mark of radius `r`: `top`, `bottom`, `start`,
 * `end` (flipped to the other side when it would leave `bounds`), or centred on it (any inside
 * position). `null` when it fits nowhere.
 */
export function placePointLabel(position: string, point: Point, r: number, width: number, height: number, offset: number, bounds: Rect): LabelPlacement | null {
  const box = { x: point.x - r, y: point.y - r, w: r * 2, h: r * 2 }
  const pos = position === "outside" ? "top" : position
  if (!(pos in OPPOSITE)) return { ...centerOf("center", box, width, height, offset), inside: false }
  for (const candidate of [pos, OPPOSITE[pos]!]) {
    const center = centerOf(candidate, box, width, height, offset)
    // Above or below a point near the start or end edge: slide the label along, inside the chart.
    if (candidate === "top" || candidate === "bottom") center.x = Math.min(Math.max(center.x, bounds.x + width / 2), bounds.x + bounds.w - width / 2)
    if (within(center, width, height, bounds)) return { ...center, inside: false, moved: candidate !== pos }
  }
  return null
}

/** A label box to de-overlap: its centre, size and whether it moved from its asked position. */
export interface LabelBox extends Point {
  width: number
  height: number
  moved?: boolean
}

/**
 * The indexes of the labels to draw so that no two overlap: labels at their asked position first
 * (in order), then the ones that had to move, each kept only when it clears every label kept so far.
 */
export function avoidOverlaps(labels: LabelBox[], gap = 2): number[] {
  const kept: number[] = []
  const overlaps = (a: LabelBox, b: LabelBox) =>
    Math.abs(a.x - b.x) * 2 < a.width + b.width + gap * 2 && Math.abs(a.y - b.y) * 2 < a.height + b.height + gap * 2
  for (const pass of [false, true])
    labels.forEach((label, i) => {
      if (Boolean(label.moved) !== pass) return
      if (kept.some((k) => overlaps(labels[k]!, label))) return
      kept.push(i)
    })
  return kept.sort((a, b) => a - b)
}

// ------------------------------------------------------------------------------------------ brush

/** Clamps a brush window to `[0, total - 1]` with `start <= end`. */
export function clampWindow(start: number, end: number | undefined, total: number): [number, number] {
  if (total <= 0) return [0, -1]
  const last = total - 1
  let s = Math.round(Number.isFinite(start) ? start : 0)
  let e = Math.round(end != null && Number.isFinite(end) ? end : last)
  s = Math.min(Math.max(0, s), last)
  e = Math.min(Math.max(0, e), last)
  if (e < s) [s, e] = [e, s]
  return [s, e]
}

/** Moves a window of rows by `delta`, keeping its length and staying inside `[0, total - 1]`. */
export function panWindow(start: number, end: number, delta: number, total: number): [number, number] {
  const length = end - start
  const s = Math.min(Math.max(0, start + delta), Math.max(0, total - 1 - length))
  return [s, s + length]
}

/** The position of row `index` along a brush of `width` (the first and last rows on its edges). */
export function brushPosition(index: number, total: number, width: number): number {
  return total > 1 ? (index / (total - 1)) * width : width / 2
}

/** The row nearest to `position` along a brush of `width`. */
export function brushIndexAt(position: number, total: number, width: number): number {
  if (total <= 1 || width <= 0) return 0
  return Math.min(total - 1, Math.max(0, Math.round((position / width) * (total - 1))))
}
