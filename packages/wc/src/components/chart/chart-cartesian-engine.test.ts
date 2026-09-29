import { describe, expect, it } from "vitest"
import {
  avoidOverlaps,
  brushIndexAt,
  brushPosition,
  bubbleRadius,
  clampWindow,
  errorExtent,
  nearestIndex,
  nearestPoint,
  numericSlots,
  panWindow,
  parseDomain,
  parseRange,
  placeBarLabel,
  placePointLabel,
  resolveDomain,
  smallestStep,
  symbolPath,
} from "./chart-cartesian-engine.js"

const bounds = { x: 0, y: 0, w: 400, h: 300 }

describe("cartesian engine", () => {
  it("parses axis domains", () => {
    expect(parseDomain("0,100")).toEqual([0, 100])
    expect(parseDomain("auto")).toEqual(["auto", "auto"])
    expect(parseDomain("dataMin, dataMax")).toEqual(["data", "data"])
    expect(parseDomain("0, auto")).toEqual([0, "auto"])
    expect(parseDomain("")).toBeUndefined()
    expect(parseDomain("zero,1")).toBeUndefined()
  })

  it("resolves domains: zero-based by default, nice with auto, widened for the data", () => {
    // The value axis default includes zero (the chart's historic behaviour).
    expect(resolveDomain(undefined, 186, 305, 5, true)).toEqual({ ticks: [0, 80, 160, 240, 320], domain: [0, 320] })
    // auto: nice around the data only.
    const auto = resolveDomain("auto", 1250, 3780)
    expect(auto.domain[0]).toBeLessThanOrEqual(1250)
    expect(auto.domain[0]).toBeGreaterThan(0)
    expect(auto.domain[1]).toBeGreaterThanOrEqual(3780)
    // Fixed sides are kept, and widened when the data (or a reference) lies outside.
    expect(resolveDomain("0,100", 12, 86)).toEqual({ ticks: [0, 25, 50, 75, 100], domain: [0, 100] })
    expect(resolveDomain("0,100", 12, 130).domain).toEqual([0, 130])
    // dataMin/dataMax: the data's own extent, ticks inside it.
    const exact = resolveDomain("dataMin,dataMax", 3.2, 9.7)
    expect(exact.domain).toEqual([3.2, 9.7])
    expect(exact.ticks.every((t) => t >= 3.2 && t <= 9.7)).toBe(true)
    expect(exact.ticks.length).toBeGreaterThanOrEqual(2)
    // One fixed side, one nice side.
    expect(resolveDomain("0,auto", 10, 305)).toEqual({ ticks: [0, 80, 160, 240, 320], domain: [0, 320] })
  })

  it("places rows on a number axis", () => {
    expect(numericSlots([0, 50, 150], false, 10).map((s) => s.size)).toEqual([0, 0, 0])
    const bands = numericSlots([0, 50, 150], true, 10)
    expect(bands[0]).toEqual({ start: -25, center: 0, size: 50 })
    expect(numericSlots([20], true, 10)[0]!.size).toBe(10)
    expect(smallestStep([3, 1, 7, 1])).toBe(2)
    expect(nearestIndex([0, 50, 150], 110)).toBe(2)
  })

  it("finds the nearest point within 24px of its edge", () => {
    const marks = [
      { x: 10, y: 10, r: 4 },
      { x: 100, y: 10, r: 4 },
    ]
    expect(nearestPoint(marks, { x: 30, y: 12 })).toBe(0)
    expect(nearestPoint(marks, { x: 75, y: 10 })).toBe(1)
    expect(nearestPoint(marks, { x: 55, y: 10 })).toBe(-1)
    expect(nearestPoint(marks, { x: 10, y: 37 })).toBe(0)
    expect(nearestPoint(marks, { x: 10, y: 39 })).toBe(-1)
  })

  it("sizes bubbles by area", () => {
    expect(parseRange("6,26", [4, 4])).toEqual([6, 26])
    expect(parseRange("x", [4, 4])).toEqual([4, 4])
    expect(bubbleRadius(0, 0, 100, 10, 20)).toBe(10)
    expect(bubbleRadius(100, 0, 100, 10, 20)).toBe(20)
    // Half the value range → half the area range.
    const r = bubbleRadius(50, 0, 100, 10, 20)
    expect(Math.PI * r * r).toBeCloseTo((Math.PI * 100 + Math.PI * 400) / 2, 6)
    expect(bubbleRadius(null, 0, 100, 10, 20)).toBe(10)
  })

  it("draws closed symbols centred on the point", () => {
    expect(symbolPath("circle", 50, 50, 5)).toBe("M45,50A5,5,0,1,0,55,50A5,5,0,1,0,45,50Z")
    for (const shape of ["square", "triangle", "diamond", "cross", "star"]) {
      const d = symbolPath(shape, 50, 50, 5)
      expect(d.startsWith("M")).toBe(true)
      expect(d.endsWith("Z")).toBe(true)
      const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      for (const n of numbers) expect(Math.abs(n - 50)).toBeLessThan(10)
    }
    expect(symbolPath("square", 0, 0, 1)).toMatch(/^M-0\.886,-0\.886L/)
  })

  it("computes error extents from a number or a pair", () => {
    expect(errorExtent(10, 2)).toEqual([8, 12])
    expect(errorExtent(10, [1, 3])).toEqual([9, 13])
    expect(errorExtent(10, -2)).toEqual([8, 12])
    expect(errorExtent(10, undefined)).toBeNull()
    expect(errorExtent(null, 2)).toBeNull()
    expect(errorExtent(10, "")).toBeNull()
  })

  it("places bar labels inside only when they fit, else outside or not at all", () => {
    const bar = { x: 100, y: 100, w: 40, h: 200 }
    expect(placeBarLabel("top", bar, 20, 12, 5, false, false, bounds)).toEqual({ x: 120, y: 89, inside: false, moved: false })
    expect(placeBarLabel("inside", bar, 20, 12, 5, false, false, bounds)).toEqual({ x: 120, y: 200, inside: true })
    // Too wide for the bar: past the value end.
    expect(placeBarLabel("inside", bar, 60, 12, 5, false, false, bounds)).toMatchObject({ x: 120, y: 89, inside: false, moved: true })
    // `outside` of a negative bar is below it.
    expect(placeBarLabel("outside", bar, 20, 12, 5, false, true, { x: 0, y: 0, w: 400, h: 400 })).toMatchObject({ y: 311 })
    // … and inside at its value end when there is no room below it.
    expect(placeBarLabel("outside", bar, 20, 12, 5, false, true, bounds)).toMatchObject({ y: 289, inside: true })
    // Horizontal bars: `end` is past the bar, and falls back inside at the end when it would leave the chart.
    const row = { x: 0, y: 10, w: 380, h: 20 }
    expect(placeBarLabel("end", row, 30, 12, 5, true, false, bounds)).toEqual({ x: 360, y: 20, inside: true, moved: true })
    expect(placeBarLabel("inside-start", row, 30, 12, 5, true, false, bounds)).toEqual({ x: 20, y: 20, inside: true })
    // No room anywhere.
    expect(placeBarLabel("end", { x: 0, y: 10, w: 395, h: 8 }, 30, 12, 5, true, false, bounds)).toBeNull()
  })

  it("places point labels and flips them at the edges", () => {
    expect(placePointLabel("top", { x: 50, y: 50 }, 3, 20, 12, 5, bounds)).toEqual({ x: 50, y: 36, inside: false, moved: false })
    expect(placePointLabel("top", { x: 50, y: 5 }, 3, 20, 12, 5, bounds)).toMatchObject({ y: 19, moved: true })
    expect(placePointLabel("end", { x: 395, y: 50 }, 0, 20, 12, 5, bounds)).toMatchObject({ x: 380, moved: true })
    expect(placePointLabel("center", { x: 50, y: 50 }, 3, 20, 12, 5, bounds)).toMatchObject({ x: 50, y: 50 })
  })

  it("keeps labels from overlapping, the ones that moved yielding", () => {
    const labels = [
      { x: 10, y: 10, width: 20, height: 12, moved: true },
      { x: 15, y: 12, width: 20, height: 12 },
      { x: 100, y: 10, width: 20, height: 12 },
    ]
    expect(avoidOverlaps(labels)).toEqual([1, 2])
  })

  it("clamps, pans and maps the brush window", () => {
    expect(clampWindow(-3, undefined, 10)).toEqual([0, 9])
    expect(clampWindow(7, 2, 10)).toEqual([2, 7])
    expect(clampWindow(0, 0, 0)).toEqual([0, -1])
    expect(panWindow(2, 5, 3, 10)).toEqual([5, 8])
    expect(panWindow(2, 5, 30, 10)).toEqual([6, 9])
    expect(panWindow(2, 5, -30, 10)).toEqual([0, 3])
    expect(brushPosition(5, 11, 200)).toBe(100)
    expect(brushIndexAt(104, 11, 200)).toBe(5)
    expect(brushIndexAt(-50, 11, 200)).toBe(0)
    expect(brushIndexAt(500, 11, 200)).toBe(10)
  })
})
