/**
 * @module chart-cartesian-marks
 * The annotations of the cartesian kind: reference lines, areas and dots, error bars and value
 * labels (`tec-chart-label-list`). Geometry is computed in logical coordinates (`x` from the inline
 * start) and drawn inside the cartesian kind's mirrored group.
 */
import { nothing, svg, type SVGTemplateResult } from "lit"
import { placePointLabel } from "./chart-cartesian-engine.js"
import type { CategorySlot } from "./chart-engine.js"
import type { ChartContext, Rect } from "./chart-kind.js"
import { TecChartReferenceArea, TecChartReferenceDot, TecChartReferenceLine, type TecChartReference } from "./chart-parts.js"

/** What the annotations need to know about the cartesian geometry. */
export interface CartesianFrame {
  horizontal: boolean
  plot: Rect
  /** The value axis scale and domain. */
  scale: (value: number) => number
  valueDomain: [number, number]
  /** Whether the category axis is a number axis (then `baseScale`/`baseDomain` are set). */
  numeric: boolean
  baseScale?: (value: number) => number
  baseDomain?: [number, number]
  /** The drawn rows' slots and their indexes in the chart's rows. */
  slots: CategorySlot[]
  indexes: number[]
  /** Index of a category value in the chart's rows (-1 when absent). */
  categoryIndex(value: string): number
}

/** A text drawn by the chart (reference labels, value labels, axis titles). */
export interface TextDraw {
  x: number
  y: number
  text: string
  anchor: "start" | "middle" | "end"
  /** Drawn over a filled mark: gets a surface-coloured halo. */
  inside?: boolean
}

export interface ReferenceDraw {
  type: "line" | "area" | "dot"
  element: TecChartReference
  /** Clipped to the plot (`if-overflow="hidden"`). */
  clip: boolean
  line?: { x1: number; y1: number; x2: number; y2: number; stroke?: string; dashed: boolean }
  rect?: Rect & { fill?: string; fillOpacity: number }
  dot?: { cx: number; cy: number; r: number; fill?: string; stroke?: string }
  label?: TextDraw
}

type Attr = "x" | "y"

/** Whether an attribute (`x`/`y`) addresses the value axis or the category axis. */
function roleOf(attr: Attr, horizontal: boolean): "value" | "base" {
  return (attr === "y") !== horizontal ? "value" : "base"
}

const numberOf = (raw: string | undefined): number | null => {
  if (raw == null || raw.trim() === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * The numbers the reference elements add to the value and category (number) domains
 * (`if-overflow="extend-domain"`, the default).
 */
export function referenceExtents(ctx: ChartContext, horizontal: boolean, numericBase: boolean): { value: number[]; base: number[] } {
  const value: number[] = []
  const base: number[] = []
  const add = (attr: Attr, raw: string | undefined) => {
    const n = numberOf(raw)
    if (n == null) return
    const role = roleOf(attr, horizontal)
    if (role === "value") value.push(n)
    else if (numericBase) base.push(n)
  }
  for (const el of references(ctx)) {
    if (el.ifOverflow !== "extend-domain") continue
    if (el instanceof TecChartReferenceArea) {
      add("x", el.x1)
      add("x", el.x2)
      add("y", el.y1)
      add("y", el.y2)
    } else if (el instanceof TecChartReferenceLine || el instanceof TecChartReferenceDot) {
      add("x", el.x)
      add("y", el.y)
    }
  }
  return { value, base }
}

function references(ctx: ChartContext): TecChartReference[] {
  const out: TecChartReference[] = []
  for (const el of ctx.host.children) {
    if (el.hasAttribute("hidden")) continue
    if (el instanceof TecChartReferenceLine || el instanceof TecChartReferenceArea || el instanceof TecChartReferenceDot) out.push(el)
  }
  return out
}

/** The physical coordinate of a reference position along the axis `attr` addresses. */
function position(frame: CartesianFrame, attr: Attr, raw: string, edge: "start" | "center" | "end"): { pos: number; inside: boolean } | undefined {
  const role = roleOf(attr, frame.horizontal)
  if (role === "value" || frame.numeric) {
    const n = numberOf(raw)
    if (n == null) return undefined
    const [d0, d1] = role === "value" ? frame.valueDomain : frame.baseDomain!
    const scale = role === "value" ? frame.scale : frame.baseScale!
    return { pos: scale(n), inside: n >= Math.min(d0, d1) - 1e-9 && n <= Math.max(d0, d1) + 1e-9 }
  }
  const full = frame.categoryIndex(raw)
  if (full < 0) return undefined
  const drawn = frame.indexes.indexOf(full)
  if (drawn < 0) return { pos: full < (frame.indexes[0] ?? 0) ? -Infinity : Infinity, inside: false }
  const slot = frame.slots[drawn]!
  const pos = edge === "start" ? slot.start : edge === "end" ? slot.start + slot.size : slot.center
  return { pos, inside: true }
}

/** The pixel extent of the plot along the physical axis of `attr`. */
function extent(frame: CartesianFrame, attr: Attr): [number, number] {
  const { plot } = frame
  return attr === "x" ? [plot.x, plot.x + plot.w] : [plot.y, plot.y + plot.h]
}

/** The pixel position of the low end (the domain's start) of the axis `attr` addresses. */
function axisEnd(frame: CartesianFrame, attr: Attr, high: boolean): number {
  const role = roleOf(attr, frame.horizontal)
  if (role === "value") return frame.scale(frame.valueDomain[high ? 1 : 0])
  if (frame.numeric) return frame.baseScale!(frame.baseDomain![high ? 1 : 0])
  const [a, b] = extent(frame, attr)
  return high ? b : a
}

const clampTo = (value: number, [a, b]: [number, number]) => Math.min(Math.max(value, Math.min(a, b)), Math.max(a, b))

/** Resolves every reference element to its geometry. */
export function layoutReferences(frame: CartesianFrame, ctx: ChartContext): ReferenceDraw[] {
  const out: ReferenceDraw[] = []
  const { plot } = frame
  const fontSize = ctx.fontSize
  const gap = 4
  for (const el of references(ctx)) {
    const discard = el.ifOverflow === "discard"
    const clip = el.ifOverflow === "hidden"
    const label = el.label ?? ""
    if (el instanceof TecChartReferenceLine) {
      const attr: Attr | undefined = el.y != null && el.y !== "" ? "y" : el.x != null && el.x !== "" ? "x" : undefined
      if (!attr) continue
      const at = position(frame, attr, (attr === "y" ? el.y : el.x)!, "center")
      if (!at || !Number.isFinite(at.pos) || (discard && !at.inside)) continue
      const across = attr === "y" // a horizontal line
      const line = across
        ? { x1: plot.x, x2: plot.x + plot.w, y1: at.pos, y2: at.pos }
        : { x1: at.pos, x2: at.pos, y1: plot.y, y2: plot.y + plot.h }
      let text: TextDraw | undefined
      if (label) {
        const width = ctx.measure(label)
        const where = el.labelPosition
        if (across) {
          const x = where === "start" ? plot.x + gap : where === "center" ? plot.x + plot.w / 2 : plot.x + plot.w - gap
          const anchor = where === "start" ? "start" : where === "center" ? "middle" : "end"
          // Above the line, or below it when there is no room above.
          const above = at.pos - gap - fontSize / 2
          const y = above - fontSize / 2 >= 0 ? above : at.pos + gap + fontSize / 2
          text = { x, y, text: label, anchor }
        } else {
          const y = where === "start" ? plot.y + fontSize / 2 + gap : where === "center" ? plot.y + plot.h / 2 : plot.y + plot.h - fontSize / 2 - gap
          // On the end side of the line, or the start side when it would leave the plot.
          const after = at.pos + gap + width <= plot.x + plot.w
          text = { x: after ? at.pos + gap : at.pos - gap, y, text: label, anchor: after ? "start" : "end" }
        }
      }
      out.push({ type: "line", element: el, clip, line: { ...line, stroke: el.stroke || undefined, dashed: el.dashed }, label: text })
    } else if (el instanceof TecChartReferenceArea) {
      const side = (attr: Attr, raw: string | undefined, high: boolean) => {
        if (raw == null || raw === "") return { pos: axisEnd(frame, attr, high), inside: true }
        return position(frame, attr, raw, high ? "end" : "start")
      }
      const x1 = side("x", el.x1, false)
      const x2 = side("x", el.x2, true)
      const y1 = side("y", el.y1, false)
      const y2 = side("y", el.y2, true)
      if (!x1 || !x2 || !y1 || !y2) continue
      if (discard && ![x1, x2, y1, y2].every((s) => s.inside)) continue
      // Categories outside the brush window clamp to the plot edge; an area entirely outside is skipped.
      if ((x1.pos === x2.pos && !Number.isFinite(x1.pos)) || (y1.pos === y2.pos && !Number.isFinite(y1.pos))) continue
      const xs = [clampTo(x1.pos, extent(frame, "x")), clampTo(x2.pos, extent(frame, "x"))]
      const ys = [clampTo(y1.pos, extent(frame, "y")), clampTo(y2.pos, extent(frame, "y"))]
      const rect = { x: Math.min(xs[0]!, xs[1]!), y: Math.min(ys[0]!, ys[1]!), w: Math.abs(xs[1]! - xs[0]!), h: Math.abs(ys[1]! - ys[0]!) }
      const text = label ? { x: rect.x + rect.w / 2, y: rect.y + gap + fontSize / 2, text: label, anchor: "middle" as const } : undefined
      out.push({ type: "area", element: el, clip, rect: { ...rect, fill: el.fill || undefined, fillOpacity: el.fillOpacity }, label: text })
    } else if (el instanceof TecChartReferenceDot) {
      if (el.x == null || el.y == null) continue
      const x = position(frame, "x", el.x, "center")
      const y = position(frame, "y", el.y, "center")
      if (!x || !y || !Number.isFinite(x.pos) || !Number.isFinite(y.pos) || (discard && !(x.inside && y.inside))) continue
      const r = Math.max(0, el.r)
      let text: TextDraw | undefined
      if (label) {
        const placed = placePointLabel("top", { x: x.pos, y: y.pos }, r, ctx.measure(label), fontSize, gap, { x: 0, y: 0, w: ctx.width, h: ctx.height })
        if (placed) text = { x: placed.x, y: placed.y, text: label, anchor: "middle" }
      }
      out.push({ type: "dot", element: el, clip, dot: { cx: x.pos, cy: y.pos, r, fill: el.fill || undefined, stroke: el.stroke || undefined }, label: text })
    }
  }
  return out
}

/**
 * The `text-anchor` for a logical anchor. Text inside the mirrored group inherits `direction: rtl`
 * in a right-to-left chart, where `start` and `end` name the opposite sides of the text: swapping
 * them keeps the text on its logical side (and its bidi reading order right).
 */
export function textAnchor(anchor: TextDraw["anchor"], rtl: boolean): TextDraw["anchor"] {
  if (!rtl || anchor === "middle") return anchor
  return anchor === "start" ? "end" : "start"
}

/** A text element; `dy` centres the glyphs vertically on `y`. */
export function renderText(t: TextDraw, cls: string, rtl: boolean): SVGTemplateResult {
  return svg`<text class=${cls} x=${t.x} y=${t.y} dy="0.355em" text-anchor=${textAnchor(t.anchor, rtl)} ?data-inside=${t.inside}>${t.text}</text>`
}

/** Reference areas: drawn under the series. */
export function renderReferenceAreas(refs: ReferenceDraw[], rtl: boolean): SVGTemplateResult {
  return svg`${refs.map((r) =>
    r.type === "area" && r.rect
      ? svg`<g class="reference" clip-path=${r.clip ? "url(#plot-clip)" : nothing}>
          <rect class="reference-area" x=${r.rect.x} y=${r.rect.y} width=${r.rect.w} height=${r.rect.h}
            style=${r.rect.fill ? `fill: ${r.rect.fill}` : nothing} fill-opacity=${r.rect.fillOpacity}></rect>
          ${r.label ? renderText(r.label, "reference-label", rtl) : nothing}
        </g>`
      : nothing
  )}`
}

/** Reference lines and dots: drawn over the series. */
export function renderReferenceMarks(refs: ReferenceDraw[], rtl: boolean): SVGTemplateResult {
  return svg`${refs.map((r) => {
    if (r.type === "line" && r.line) {
      const l = r.line
      return svg`<g class="reference" clip-path=${r.clip ? "url(#plot-clip)" : nothing}>
        <line class="reference-line" x1=${l.x1} y1=${l.y1} x2=${l.x2} y2=${l.y2}
          style=${l.stroke ? `stroke: ${l.stroke}` : nothing} stroke-dasharray=${l.dashed ? "4 4" : nothing}></line>
        ${r.label ? renderText(r.label, "reference-label", rtl) : nothing}
      </g>`
    }
    if (r.type === "dot" && r.dot) {
      const d = r.dot
      return svg`<g class="reference" clip-path=${r.clip ? "url(#plot-clip)" : nothing}>
        <circle class="reference-dot" cx=${d.cx} cy=${d.cy} r=${d.r}
          style=${[d.fill ? `fill: ${d.fill}` : "", d.stroke ? `stroke: ${d.stroke}` : ""].filter(Boolean).join(";") || nothing}></circle>
        ${r.label ? renderText(r.label, "reference-label", rtl) : nothing}
      </g>`
    }
    return nothing
  })}`
}

// ------------------------------------------------------------------------------------------ error bars

/** One error bar: the bar from `(x1, y1)` to `(x2, y2)` with caps of `width`. */
export interface ErrorDraw {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  stroke?: string
}

/** The path of an error bar and its two caps. */
export function errorPath(e: ErrorDraw): string {
  const h = e.width / 2
  const vertical = e.x1 === e.x2
  const r = (n: number) => Math.round(n * 100) / 100
  const cap = (x: number, y: number) => (vertical ? `M${r(x - h)},${r(y)}H${r(x + h)}` : `M${r(x)},${r(y - h)}V${r(y + h)}`)
  return `M${r(e.x1)},${r(e.y1)}L${r(e.x2)},${r(e.y2)}${cap(e.x1, e.y1)}${cap(e.x2, e.y2)}`
}

export function renderErrors(errors: ErrorDraw[]): SVGTemplateResult {
  return svg`${errors.map((e) => svg`<path class="error-bar" d=${errorPath(e)} style=${e.stroke ? `stroke: ${e.stroke}` : nothing}></path>`)}`
}
