import { describe, expect, it } from "vitest"
import { polarPoint, sectorPath } from "./chart-engine.js"
import {
  angleDistance,
  angleInArc,
  arcBounds,
  boxInSector,
  fitArc,
  fitRadius,
  leaderLabels,
  mirrorAngle,
  nonOverlapping,
  normalizeAngle,
  polygonPath,
  radialLabelBox,
  rectsOverlap,
  roundedSectorPath,
  toPolar,
} from "./chart-polar-engine.js"
import { parseDomain, tangentText } from "./chart-polar.js"

/** The points of a path's commands (end points of M, L and A). */
function endPoints(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (const [, cmd, args] of d.matchAll(/([MLA])([^MLAZ]*)/g)) {
    const n = args!.split(",").map(Number)
    const [x, y] = cmd === "A" ? n.slice(5) : n
    out.push({ x: x!, y: y! })
  }
  return out
}

describe("chart polar engine", () => {
  it("normalises, mirrors and compares angles", () => {
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(720 + 45)).toBe(45)
    expect(mirrorAngle(0)).toBe(180)
    expect(mirrorAngle(90)).toBe(90)
    expect(mirrorAngle(30, false)).toBe(30)
    expect(angleDistance(350, 10)).toBe(20)
    expect(angleDistance(90, 270)).toBe(180)
    // Arcs in either direction, across 0°, and padded.
    expect(angleInArc(10, -30, 30)).toBe(true)
    expect(angleInArc(350, -30, 30)).toBe(true)
    expect(angleInArc(40, 30, -30)).toBe(false)
    expect(angleInArc(40, 30, -30, 15)).toBe(true)
    expect(angleInArc(123, 0, 360)).toBe(true)
  })

  it("converts points to polar coordinates (screen y down)", () => {
    const top = toPolar(100, 100, { x: 100, y: 50 })
    expect(top.angle).toBeCloseTo(90)
    expect(top.radius).toBeCloseTo(50)
    expect(toPolar(100, 100, { x: 50, y: 100 }).angle).toBeCloseTo(180)
    const p = polarPoint(0, 0, 10, 225)
    expect(toPolar(0, 0, p).angle).toBeCloseTo(225)
  })

  it("bounds arcs and fits them into a box", () => {
    expect(arcBounds(0, 360)).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 })
    expect(arcBounds(0, 180)).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 0 })
    expect(arcBounds(0, 90)).toEqual({ minX: 0, maxX: 1, minY: -1, maxY: 0 })
    expect(arcBounds(180, 0)).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 0 })
    // A full circle: the smaller side, centred.
    expect(fitArc({ x: 0, y: 0, w: 200, h: 100 }, 0, 360)).toEqual({ maxRadius: 50, cx: 100, cy: 50 })
    // A top half circle uses the whole width and sits on the bottom edge.
    expect(fitArc({ x: 0, y: 0, w: 200, h: 100 }, 0, 180)).toEqual({ maxRadius: 100, cx: 100, cy: 100 })
    // Drawn at 80%, the half circle stays centred in the box.
    const fitted = fitArc({ x: 0, y: 0, w: 200, h: 100 }, 0, 180, (r) => r * 0.8)
    expect(fitted.cy).toBeCloseTo(90)
  })

  it("places labels away from the centre and shrinks the radius so they fit", () => {
    expect(radialLabelBox({ x: 10, y: 10 }, { angle: 0, width: 20, height: 10 })).toEqual({ x: 10, y: 5, w: 20, h: 10 })
    expect(radialLabelBox({ x: 10, y: 10 }, { angle: 90, width: 20, height: 10 })).toEqual({ x: 0, y: 0, w: 20, h: 10 })
    expect(radialLabelBox({ x: 10, y: 10 }, { angle: 180, width: 20, height: 10 })).toEqual({ x: -10, y: 5, w: 20, h: 10 })
    const bounds = { x: 0, y: 0, w: 200, h: 200 }
    // A 50px label at 3 o'clock: 100 - 50 - gap 8 = 42.
    expect(fitRadius(100, 100, [{ angle: 0, width: 50, height: 12 }], 8, bounds, 80)).toBeCloseTo(42)
    // A label at 12 o'clock needs its height above the web.
    expect(fitRadius(100, 100, [{ angle: 90, width: 50, height: 12 }], 8, bounds, 90)).toBeCloseTo(80)
    // Never below the minimum.
    expect(fitRadius(100, 100, [{ angle: 0, width: 150, height: 12 }], 8, bounds, 80, 30)).toBe(30)
    // Short labels: the maximum.
    expect(fitRadius(100, 100, [{ angle: 45, width: 5, height: 12 }], 8, bounds, 60)).toBe(60)
  })

  it("keeps boxes that do not overlap", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(rectsOverlap(a, { x: 9, y: 0, w: 10, h: 10 })).toBe(true)
    expect(nonOverlapping([a, { x: 5, y: 5, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }])).toEqual([0, 2])
  })

  it("draws sectors with rounded corners on the sector's circles", () => {
    const d = roundedSectorPath(100, 100, 40, 80, 0, 90, 6)
    expect(d.startsWith("M")).toBe(true)
    expect(d.endsWith("Z")).toBe(true)
    const points = endPoints(d)
    const radii = points.map((p) => Math.hypot(p.x - 100, p.y - 100))
    // Every point lies between the inner and the outer radius, and the arcs touch both circles.
    for (const r of radii) {
      expect(r).toBeGreaterThanOrEqual(40 - 0.01)
      expect(r).toBeLessThanOrEqual(80 + 0.01)
    }
    expect(radii.some((r) => Math.abs(r - 80) < 0.01)).toBe(true)
    expect(radii.some((r) => Math.abs(r - 40) < 0.01)).toBe(true)
    // Every point lies within the sector's angles.
    for (const p of points) expect(angleInArc(toPolar(100, 100, p).angle, 0, 90, 0.01)).toBe(true)
    // No corners: the plain sector; a full ring has no corners either.
    expect(roundedSectorPath(100, 100, 40, 80, 0, 90, 0)).toBe(sectorPath(100, 100, 40, 80, 0, 90))
    expect(roundedSectorPath(100, 100, 40, 80, 0, 360, 6)).toBe(sectorPath(100, 100, 40, 80, 0, 360))
    // A corner radius larger than half the ring is clamped (the path stays inside the ring).
    const clamped = endPoints(roundedSectorPath(0, 0, 40, 50, 0, -120, 30)).map((p) => Math.hypot(p.x, p.y))
    for (const r of clamped) expect(r).toBeLessThanOrEqual(50.01)
    // A pie slice (no inner radius) closes at the centre.
    expect(roundedSectorPath(0, 0, 0, 50, 0, 60, 4)).toContain("L0,0")
  })

  it("tells whether a label fits in a sector", () => {
    const box = (x: number, y: number) => ({ x: x - 10, y: y - 5, w: 20, h: 10 })
    const mid = polarPoint(100, 100, 60, 45)
    expect(boxInSector(box(mid.x, mid.y), 100, 100, 40, 80, 0, 90)).toBe(true)
    // Too close to the outer edge.
    const edge = polarPoint(100, 100, 78, 45)
    expect(boxInSector(box(edge.x, edge.y), 100, 100, 40, 80, 0, 90)).toBe(false)
    // A thin slice.
    const thin = polarPoint(100, 100, 60, 5)
    expect(boxInSector(box(thin.x, thin.y), 100, 100, 40, 80, 0, 10)).toBe(false)
  })

  it("places outside labels with leader lines, without overlaps", () => {
    const bounds = { x: 0, y: 0, w: 300, h: 300 }
    // Five labels crowded on the right.
    const items = [0, 5, 10, 15, 20].map((angle, index) => ({ index, angle, width: 30, height: 14 }))
    const labels = leaderLabels(150, 150, 80, items, bounds)
    expect(labels).toHaveLength(5)
    const boxes = labels.map((l) => ({ x: l.x, y: l.y - l.height / 2, w: l.width, h: l.height }))
    expect(nonOverlapping(boxes, 0)).toHaveLength(5)
    for (const l of labels) {
      expect(l.side).toBe(1)
      expect(l.x).toBeGreaterThan(150 + 80)
      expect(Math.hypot(l.from.x - 150, l.from.y - 150)).toBeCloseTo(80)
    }
    // A label that cannot fit in the bounds is dropped.
    expect(leaderLabels(150, 150, 80, [{ index: 0, angle: 0, width: 200, height: 14 }], bounds)).toHaveLength(0)
    // Left side labels extend to the left.
    expect(leaderLabels(150, 150, 80, [{ index: 0, angle: 180, width: 20, height: 14 }], bounds)[0]!.side).toBe(-1)
  })

  it("builds polygons, domains and upright tangent text", () => {
    expect(polygonPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }])).toBe("M0,0L10,0L5,5Z")
    expect(polygonPath([])).toBe("")
    expect(parseDomain("0 auto")).toEqual([0, null])
    expect(parseDomain("auto 150")).toEqual([null, 150])
    expect(parseDomain("")).toEqual([null, null])
    // At 12 o'clock the text is horizontal; clockwise (towards 3 o'clock) is forwards.
    expect(tangentText(90, 0)).toEqual({ rotate: -0, forward: true })
    // At 6 o'clock it is horizontal too, reading left to right: counter-clockwise is forwards.
    const bottom = tangentText(270, 0)
    expect(Math.abs(bottom.rotate) % 180).toBeCloseTo(0)
    expect(bottom.forward).toBe(true)
    // At 3 o'clock it reads bottom to top (rotated by -90°).
    expect(tangentText(0, 90).rotate).toBeCloseTo(-90)
  })
})
