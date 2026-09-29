/**
 * @module chart-polar-labels
 * Text shared by the polar kinds (pie, radial bar, radar): value labels from a
 * `tec-chart-label-list`, the centre label of a donut or radial chart, and the text anchors that
 * keep a label on the intended side of its point in both directions.
 */
import { nothing, svg, type SVGTemplateResult } from "lit"
import type { ChartRow } from "./chart-config.js"
import type { UnitBounds } from "./chart-polar-engine.js"
import type { ChartContext } from "./chart-kind.js"
import { TecChartLabelList } from "./chart-parts.js"

/**
 * The `text-anchor` that makes a label extend towards `side` (1: right / forwards along its
 * baseline, -1: left / backwards, 0: centred) from its point. SVG anchors are logical (`start` is
 * the right end of right-to-left text), so they swap in RTL.
 */
export function anchorFor(side: -1 | 0 | 1, rtl: boolean): "start" | "middle" | "end" {
  if (side === 0) return "middle"
  return side === 1 !== rtl ? "start" : "end"
}

/** The label lists of a series element. */
export function labelListsOf(ctx: ChartContext, series: Element | undefined): TecChartLabelList[] {
  return series ? ctx.childParts(series, TecChartLabelList) : []
}

/** Whether a label list is the centre label (`position="center"`). */
export const isCenter = (list: TecChartLabelList) => list.position === "center"

/** The text of one label: the list's `formatter`, else the value as the chart shows it (config label or locale number). */
export function labelText(ctx: ChartContext, list: TecChartLabelList, value: unknown, row: ChartRow | undefined, index: number): string {
  if (list.formatter) return String(list.formatter(value, row, index) ?? "")
  if (value == null) return ""
  return ctx.text(value)
}

/** Width of `text` at `size` pixels (and a bold weight when `bold`), from the chart's measure. */
export function measureAt(ctx: ChartContext, text: string, size: number, bold = false): number {
  return (ctx.measure(text) * size) / (ctx.fontSize || 12) * (bold ? 1.08 : 1)
}

/** `text` shortened with an ellipsis so that it is at most `width` pixels wide ("" when nothing fits). */
export function truncate(ctx: ChartContext, text: string, width: number): string {
  if (ctx.measure(text) <= width) return text
  const chars = [...text]
  for (let n = chars.length - 1; n > 0; n--) {
    const candidate = chars.slice(0, n).join("").trimEnd() + "…"
    if (ctx.measure(candidate) <= width) return candidate
  }
  return ""
}

/**
 * The centre label of a donut or radial chart: a large value and, under it, a caption (the config
 * label of the series key). It is sized to fit the hole (`inner` radius) and dropped when even a
 * 12px value would not fit. On an arc that stays above (or below) the centre, the text sits on
 * that side of it.
 */
export function centerLabel(
  ctx: ChartContext,
  options: { cx: number; cy: number; inner: number; bounds: UnitBounds; value: string; caption?: string }
): SVGTemplateResult | typeof nothing {
  const { cx, cy, inner, value, caption, bounds } = options
  if (!value || inner <= 0) return nothing
  const above = bounds.maxY <= 1e-6
  const below = bounds.minY >= -1e-6
  const captionSize = ctx.fontSize || 12
  const captionHeight = caption ? captionSize * 1.3 : 0
  const gap = 4
  // The largest value size (30px down to 12px) whose text block fits the chord of the hole at its
  // edge farthest from the centre.
  for (let size = 30; size >= 12; size--) {
    const total = size * 1.1 + captionHeight
    const far = above || below ? total + gap : total / 2
    if (far >= inner - 2) continue
    const halfWidth = Math.sqrt(inner * inner - far * far) - 6
    if (measureAt(ctx, value, size, true) / 2 > halfWidth) continue
    const shownCaption = caption ? truncate(ctx, caption, 2 * halfWidth) : ""
    const top = above ? cy - gap - total : below ? cy + gap : cy - total / 2
    return render(size, top, shownCaption)
  }
  return nothing

  function render(size: number, top: number, shownCaption: string) {
    return svg`<g class="center-label">
      <text class="center-value" x=${cx} y=${top + size * 0.9} text-anchor="middle" style=${`font-size: ${size}px`}>${value}</text>
      ${shownCaption ? svg`<text class="center-caption" x=${cx} y=${top + size * 1.1 + captionSize * 1.05} text-anchor="middle">${shownCaption}</text>` : nothing}
    </g>`
  }
}
