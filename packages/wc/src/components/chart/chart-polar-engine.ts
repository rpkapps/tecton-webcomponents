/**
 * @module chart-polar-engine
 * The geometry of the polar kinds (radar, radial bar, pie): angles, fitting a circle or an arc
 * into a box, shrinking a radius so labels around it stay inside the chart, sectors with rounded
 * corners, label placement inside a sector and outside labels with leader lines. Pure functions
 * over numbers, like `chart-engine.ts`.
 *
 * Angles are in degrees, counter-clockwise from 3 o'clock (the convention of `polarPoint` and
 * `sectorPath`); screen `y` grows downwards.
 */
import { polarPoint, sectorPath, type Point } from "./chart-engine.js"
import type { Rect } from "./chart-kind.js"

const RAD = Math.PI / 180
const f = (n: number) => Math.round(n * 1000) / 1000

/** `angle` in `[0, 360)`. */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/**
 * Mirrors an angle across the vertical axis (`θ → 180° − θ`): the geometry of a polar chart in a
 * right-to-left context, where clockwise becomes counter-clockwise.
 */
export function mirrorAngle(angle: number, mirrored = true): number {
  return mirrored ? 180 - angle : angle
}

/** The angle of `point` seen from `(cx, cy)`, in `[0, 360)`, and its distance. */
export function toPolar(cx: number, cy: number, point: Point): { angle: number; radius: number } {
  const dx = point.x - cx
  const dy = cy - point.y
  return { angle: normalizeAngle(Math.atan2(dy, dx) / RAD), radius: Math.hypot(dx, dy) }
}

/**
 * Whether `angle` lies on the arc from `start` to `end` (either direction), widened by `pad`
 * degrees on both ends. A span of 360° or more contains every angle.
 */
export function angleInArc(angle: number, start: number, end: number, pad = 0): boolean {
  const span = Math.abs(end - start)
  if (span + 2 * pad >= 360) return true
  const from = Math.min(start, end) - pad
  return normalizeAngle(angle - from) <= span + 2 * pad + 1e-9
}

/** The smallest distance in degrees between two angles (0…180). */
export function angleDistance(a: number, b: number): number {
  const d = normalizeAngle(a - b)
  return d > 180 ? 360 - d : d
}

/** The bounding box of a unit sector from `start` to `end` (with its centre), in screen units. */
export function arcBounds(start: number, end: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const points: Point[] = [{ x: 0, y: 0 }]
  const push = (a: number) => points.push({ x: Math.cos(a * RAD), y: -Math.sin(a * RAD) })
  push(start)
  push(end)
  if (Math.abs(end - start) >= 360) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  }
  for (const axis of [0, 90, 180, 270]) {
    if (angleInArc(axis, start, end)) push(axis)
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n)
  return { minX: clean(Math.min(...xs)), maxX: clean(Math.max(...xs)), minY: clean(Math.min(...ys)), maxY: clean(Math.max(...ys)) }
}

/** The bounding box of a unit shape, as returned by {@link arcBounds}. */
export type UnitBounds = ReturnType<typeof arcBounds>

/** The union of unit bounding boxes. */
export function unionBounds(boxes: UnitBounds[]): UnitBounds {
  return boxes.reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) }))
}

/**
 * The largest radius (`maxRadius`) at which a unit shape with bounds `b` (see {@link arcBounds})
 * fits in `box`, and the centre that puts the shape drawn at `radius(maxRadius)` in the middle of
 * the box. A full circle gives `min(w, h) / 2` and the centre of the box; a top half circle
 * (0° → 180°) uses the full width and sits on the bottom half of its box.
 */
export function fitBounds(box: Rect, b: UnitBounds, radius: (maxRadius: number) => number = (r) => r) {
  const bw = b.maxX - b.minX || 1
  const bh = b.maxY - b.minY || 1
  const maxRadius = Math.max(0, Math.min(box.w / bw, box.h / bh))
  const r = radius(maxRadius)
  const cx = box.x + (box.w - bw * r) / 2 - b.minX * r
  const cy = box.y + (box.h - bh * r) / 2 - b.minY * r
  return { maxRadius, cx, cy }
}

/** {@link fitBounds} for the sector from `start` to `end`. */
export function fitArc(box: Rect, start: number, end: number, radius: (maxRadius: number) => number = (r) => r) {
  return fitBounds(box, arcBounds(start, end), radius)
}

/** A label placed around a circle: its angle and size. */
export interface RadialLabel {
  angle: number
  width: number
  height: number
}

/** Horizontal side a label extends to from its anchor point: -1 left, 0 centred, 1 right. */
export function labelSide(angle: number): -1 | 0 | 1 {
  const cos = Math.cos(angle * RAD)
  if (cos > 0.01) return 1
  if (cos < -0.01) return -1
  return 0
}

/** Vertical side a label extends to from its anchor point: -1 up, 0 centred, 1 down. */
export function labelLift(angle: number): -1 | 0 | 1 {
  const sin = Math.sin(angle * RAD)
  if (sin > 0.01) return -1
  if (sin < -0.01) return 1
  return 0
}

/**
 * The box of a label anchored at `point`: it extends away from the centre (to the right on the
 * right half, upwards on the top half, centred on the axes).
 */
export function radialLabelBox(point: Point, label: RadialLabel): Rect {
  const side = labelSide(label.angle)
  const lift = labelLift(label.angle)
  const x = side === 1 ? point.x : side === -1 ? point.x - label.width : point.x - label.width / 2
  const y = lift === 1 ? point.y : lift === -1 ? point.y - label.height : point.y - label.height / 2
  return { x, y, w: label.width, h: label.height }
}

/**
 * The largest radius `r ≤ maxRadius` such that labels placed at `r + gap` around `(cx, cy)` stay
 * inside `bounds` (never below `minRadius`). Labels extend away from the centre as in
 * {@link radialLabelBox}.
 */
export function fitRadius(cx: number, cy: number, labels: RadialLabel[], gap: number, bounds: Rect, maxRadius: number, minRadius = 0): number {
  let r = maxRadius
  const right = bounds.x + bounds.w
  const bottom = bounds.y + bounds.h
  for (const label of labels) {
    const cos = Math.cos(label.angle * RAD)
    const sin = Math.sin(label.angle * RAD)
    const side = labelSide(label.angle)
    const lift = labelLift(label.angle)
    // Horizontal room: the label's far edge is at cx + (r + gap)·cos (+ width on its side).
    const half = side === 0 ? label.width / 2 : 0
    const w = side === 0 ? 0 : label.width
    if (cos > 1e-6) r = Math.min(r, (right - cx - w - half) / cos - gap)
    else if (cos < -1e-6) r = Math.min(r, (cx - bounds.x - w - half) / -cos - gap)
    if (side === 0 && (cx - half < bounds.x || cx + half > right)) r = Math.min(r, minRadius)
    const vHalf = lift === 0 ? label.height / 2 : 0
    const h = lift === 0 ? 0 : label.height
    if (sin > 1e-6) r = Math.min(r, (cy - bounds.y - h - vHalf) / sin - gap)
    else if (sin < -1e-6) r = Math.min(r, (bottom - cy - h - vHalf) / -sin - gap)
    // A label on the horizontal axis is centred on cy: it must fit vertically in any case.
    if (lift === 0 && (cy - vHalf < bounds.y || cy + vHalf > bottom)) r = Math.min(r, minRadius)
  }
  return Math.max(minRadius, Math.min(maxRadius, r))
}

/** Whether two rectangles overlap (touching counts as not overlapping), with `gap` of clearance. */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
}

/** Indexes of the boxes kept so that none overlap (first come, first kept). */
export function nonOverlapping(boxes: Rect[], gap = 2): number[] {
  const kept: number[] = []
  boxes.forEach((box, i) => {
    if (kept.every((k) => !rectsOverlap(boxes[k]!, box, gap))) kept.push(i)
  })
  return kept
}

/** Whether `rect` lies entirely inside `outer`. */
export function rectInside(rect: Rect, outer: Rect, tolerance = 0.5): boolean {
  return (
    rect.x >= outer.x - tolerance &&
    rect.y >= outer.y - tolerance &&
    rect.x + rect.w <= outer.x + outer.w + tolerance &&
    rect.y + rect.h <= outer.y + outer.h + tolerance
  )
}

/**
 * Whether a box lies inside the sector (`inner`…`outer`, `start`…`end`) with `padding` pixels to
 * spare on every side: its corners and edge midpoints are tested in polar coordinates.
 */
export function boxInSector(box: Rect, cx: number, cy: number, inner: number, outer: number, start: number, end: number, padding = 2): boolean {
  const span = Math.abs(end - start)
  const points: Point[] = []
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) if (fx !== 0.5 || fy !== 0.5) points.push({ x: box.x + fx * box.w, y: box.y + fy * box.h })
  const lo = Math.min(start, end)
  return points.every((p) => {
    const { angle, radius } = toPolar(cx, cy, p)
    if (radius > outer - padding || radius < inner + padding) return false
    if (span >= 360) return true
    const offset = normalizeAngle(angle - lo)
    if (offset > span) return false
    // Distance to the nearer radial edge, in pixels.
    const toEdge = Math.min(offset, span - offset)
    return (toEdge >= 90 ? radius : Math.sin(toEdge * RAD) * radius) >= padding
  })
}

/**
 * A sector with rounded corners (`cornerRadius`, clamped to what the ring's thickness and the
 * sector's sweep allow), like a d3 arc with `cornerRadius`. A full ring has no corners.
 */
export function roundedSectorPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number, cornerRadius: number): string {
  const delta = end - start
  const span = Math.abs(delta)
  if (cornerRadius <= 0 || span >= 359.999 || span === 0 || outer <= inner) return sectorPath(cx, cy, inner, outer, start, end)
  const half = Math.sin((Math.min(span, 180) / 2) * RAD)
  let rc = Math.min(cornerRadius, (outer - inner) / 2, (outer * half) / (1 + half))
  if (inner > 0 && half < 1) rc = Math.min(rc, (inner * half) / (1 - half))
  if (rc <= 0.01) return sectorPath(cx, cy, inner, outer, start, end)
  const dir = Math.sign(delta)
  const sweep = dir > 0 ? 0 : 1
  const deg = (a: number) => a / RAD
  // Outer corners: corner circle centres at `outer - rc`, touching the arc `dOuter` degrees in.
  const dOuter = deg(Math.asin(rc / (outer - rc)))
  const tOuter = Math.sqrt((outer - rc) ** 2 - rc ** 2)
  const p = (r: number, a: number) => {
    const q = polarPoint(cx, cy, r, a)
    return `${f(q.x)},${f(q.y)}`
  }
  const large = span - 2 * dOuter > 180 ? 1 : 0
  let d = `M${p(tOuter, start)}`
  d += `A${f(rc)},${f(rc)},0,0,${sweep},${p(outer, start + dir * dOuter)}`
  d += `A${f(outer)},${f(outer)},0,${large},${sweep},${p(outer, end - dir * dOuter)}`
  d += `A${f(rc)},${f(rc)},0,0,${sweep},${p(tOuter, end)}`
  if (inner > 0) {
    const dInner = deg(Math.asin(rc / (inner + rc)))
    const tInner = Math.sqrt((inner + rc) ** 2 - rc ** 2)
    const largeInner = span - 2 * dInner > 180 ? 1 : 0
    d += `L${p(tInner, end)}`
    d += `A${f(rc)},${f(rc)},0,0,${sweep},${p(inner, end - dir * dInner)}`
    d += `A${f(inner)},${f(inner)},0,${largeInner},${1 - sweep},${p(inner, start + dir * dInner)}`
    d += `A${f(rc)},${f(rc)},0,0,${sweep},${p(tInner, start)}`
  } else {
    d += `L${f(cx)},${f(cy)}`
  }
  return d + "Z"
}

/** A closed polygon through `points`. */
export function polygonPath(points: Point[]): string {
  if (!points.length) return ""
  return points.map((pt, i) => `${i ? "L" : "M"}${f(pt.x)},${f(pt.y)}`).join("") + "Z"
}

/** An outside label with its leader line. */
export interface LeaderLabel {
  index: number
  /** Where the leader starts (on the sector's outer edge). */
  from: Point
  /** The elbow of the leader. */
  elbow: Point
  /** The end of the leader, next to the text. */
  to: Point
  /** The text's anchor point and side (1: extends right, -1: extends left). */
  x: number
  y: number
  side: -1 | 1
  width: number
  height: number
}

/**
 * Places labels outside a circle with leader lines: a radial segment from the sector's edge to
 * `radius + length`, then a short horizontal segment towards the label. Labels on each side are
 * pushed apart vertically so they never overlap, and dropped when they would leave `bounds`.
 */
export function leaderLabels(
  cx: number,
  cy: number,
  radius: number,
  items: { index: number; angle: number; width: number; height: number }[],
  bounds: Rect,
  length = 12,
  run = 8,
  gap = 2
): LeaderLabel[] {
  const out: LeaderLabel[] = []
  for (const side of [1, -1] as const) {
    const group = items
      .filter((item) => (Math.cos(item.angle * RAD) >= 0 ? 1 : -1) === side)
      .map((item) => {
        const from = polarPoint(cx, cy, radius, item.angle)
        const elbow = polarPoint(cx, cy, radius + length, item.angle)
        return { item, from, elbow, y: elbow.y }
      })
      .sort((a, b) => a.y - b.y)
    // Push down from the top, then back up from the bottom.
    let limit = bounds.y
    for (const entry of group) {
      const h = entry.item.height
      entry.y = Math.max(entry.y, limit + h / 2)
      limit = entry.y + h / 2 + gap
    }
    limit = bounds.y + bounds.h
    for (let i = group.length - 1; i >= 0; i--) {
      const entry = group[i]!
      const h = entry.item.height
      entry.y = Math.min(entry.y, limit - h / 2)
      limit = entry.y - h / 2 - gap
    }
    for (const entry of group) {
      const { item, from, elbow } = entry
      const h = item.height
      const endX = cx + side * (Math.max(Math.abs(elbow.x - cx), 0) + run)
      const x = endX + side * 3
      const label: LeaderLabel = {
        index: item.index,
        from,
        elbow: { x: elbow.x, y: entry.y },
        to: { x: endX, y: entry.y },
        x,
        y: entry.y,
        side,
        width: item.width,
        height: h,
      }
      const box = { x: side === 1 ? x : x - item.width, y: entry.y - h / 2, w: item.width, h }
      if (rectInside(box, bounds)) out.push(label)
    }
  }
  return out.sort((a, b) => a.index - b.index)
}
