import { describe, expect, it } from "vitest"
import {
  areaPath,
  barPositions,
  categoryAt,
  categoryScale,
  linePath,
  niceTicks,
  pieLayout,
  resolveRadius,
  roundedRect,
  sectorPath,
  thinTicks,
} from "./chart-engine.js"

describe("chart engine", () => {
  it("computes nice ticks", () => {
    expect(niceTicks(0, 305)).toEqual([0, 80, 160, 240, 320])
    expect(niceTicks(0, 454)).toEqual([0, 150, 300, 450, 600])
    expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(niceTicks(-50, 120)).toEqual([-50, 0, 50, 100, 150])
    expect(niceTicks(0, 0)).toEqual([0, 1, 2, 3, 4])
    expect(niceTicks(0, 305, 3)).toEqual([0, 200, 400])
  })

  it("lays out band and point categories", () => {
    const band = categoryScale(4, 0, 400, "band")
    expect(band.map((s) => s.center)).toEqual([50, 150, 250, 350])
    expect(band[0]!.size).toBe(100)
    const point = categoryScale(3, 10, 210, "point")
    expect(point.map((s) => s.center)).toEqual([10, 110, 210])
    expect(categoryAt(band, 260)).toBe(2)
    expect(categoryAt(band, 500)).toBe(-1)
    expect(categoryAt(point, 170)).toBe(2)
  })

  it("splits a band into bars with a 10% category gap and 4px bar gap", () => {
    // (100 - 2 * 10 - 4) / 2 = 38
    expect(barPositions(100, 2)).toEqual([
      { offset: 10, size: 38 },
      { offset: 52, size: 38 },
    ])
    expect(barPositions(100, 1, 0.1, 4, 20)).toEqual([{ offset: 10 + 30, size: 20 }])
  })

  it("draws rounded rectangles with a stable command sequence", () => {
    const a = roundedRect(0, 0, 20, 100, [4, 4, 4, 4])
    const b = roundedRect(0, 50, 20, 50, [4, 4, 0, 0])
    expect(a.replace(/[-\d.]+/g, "n")).toBe(b.replace(/[-\d.]+/g, "n"))
    expect(a.startsWith("M4,0H16A4,4,0,0,1,20,4")).toBe(true)
    // Radii are clamped to half the smaller side.
    expect(roundedRect(0, 0, 4, 100, [10, 10, 10, 10]).startsWith("M2,0")).toBe(true)
  })

  it("interpolates curves", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]
    expect(linePath(points)).toBe("M0,10L10,0L20,10")
    expect(linePath(points, "step")).toBe("M0,10L5,10L5,0L15,0L15,10L20,10")
    expect(linePath(points, "monotone")).toMatch(/^M0,10C.*,20,10$/)
    expect(linePath(points, "natural")).toMatch(/^M0,10C.*C.*,20,10$/)
    const area = areaPath(points, points.map((p) => ({ x: p.x, y: 20 })))
    expect(area).toBe("M0,10L10,0L20,10L20,20L10,20L0,20Z")
  })

  it("lays out pie slices counter-clockwise from 3 o'clock with padding", () => {
    const slices = pieLayout([1, 1, 2])
    expect(slices.map((s) => [s.startAngle, s.endAngle])).toEqual([
      [0, 90],
      [90, 180],
      [180, 360],
    ])
    const padded = pieLayout([1, 1], 0, 360, 10)
    expect(padded[0]!.endAngle - padded[0]!.startAngle).toBe(170)
    expect(padded[1]!.startAngle).toBe(180)
    expect(sectorPath(50, 50, 0, 40, 0, 90)).toBe("M90,50A40,40,0,0,0,50,10L50,50Z")
    expect(resolveRadius("80%", 100, 0)).toBe(80)
    expect(resolveRadius("60", 100, 0)).toBe(60)
  })

  it("thins tick labels from the end", () => {
    const coordinates = [0, 20, 40, 60, 80, 100]
    const shown = thinTicks(coordinates, () => 16, -10, 110, 5)
    // Labels are 16px wide: every other one fits (≥ 21px apart), the last one is kept.
    expect(shown.map((t) => t.index)).toEqual([1, 3, 5])
    // The last label is nudged inwards when it would overflow the axis.
    const edge = thinTicks([0, 100], () => 20, 0, 100, 5)
    expect(edge.at(-1)).toMatchObject({ index: 1, labelCoordinate: 90 })
    // So is the first one, instead of being dropped.
    expect(edge[0]).toMatchObject({ index: 0, coordinate: 0, labelCoordinate: 10 })
  })
})
