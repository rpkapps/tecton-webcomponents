/**
 * @module chart-funnel
 * The funnel kind (`tec-chart-funnel`): one trapezoid per data row, as wide as its value, narrowing
 * to the next row's value.
 */
import { css, html, nothing, svg } from "lit"
import { property } from "lit/decorators.js"
import { forcedColors, motionSafe } from "../../internal/styles.js"
import { formatValue, type ChartRow, type ChartTooltipItem } from "./chart-config.js"
import { numeric, type ChartContext, type ChartKind, type ChartModelBase, type Rect } from "./chart-kind.js"
import { TecChartLabelList, TecChartPart } from "./chart-parts.js"

/** The shape of the last stage: narrowing to a point, or keeping its width. */
export type ChartFunnelLastShape = "triangle" | "rectangle"

/**
 * Stage colours come from the row's `fill` field, then from the config entry named by the row's
 * `name-key` value, then from the chart palette. Each stage is as wide as its value at its top and
 * narrows to the next stage's value at its bottom (`last-shape` decides the end of the last one);
 * `orientation="horizontal"` on the chart lays the stages out along the inline axis.
 *
 * Put a `tec-chart-label-list` inside to label the stages: `position="center"` (or `inside`) puts
 * the label inside the stage when it fits and beside it otherwise; `start` and `end` put it beside
 * the stage (above and below it in a horizontal funnel, where `top` and `bottom` work too). The
 * funnel narrows to leave room for the labels beside it. A label list shows the funnel's value by
 * default; its `key` picks another field (`key="stage"` for the stage names, through the config
 * labels) and its `formatter` formats it.
 *
 * With `conversion`, the tooltip, the announcement and the data table add each stage's conversion
 * rate from the previous stage (its value ÷ the previous value), named by the `conversion` config
 * entry ("Conversion" by default).
 *
 * @summary A funnel series of a `tec-chart`: one stage per data row, narrowing with the values.
 *
 * @tag tec-chart-funnel
 */
export class TecChartFunnel extends TecChartPart {
  /** The data field holding the stage values. */
  @property({ reflect: true }) key = ""

  /** The data field holding the stage names (also the config keys of the stages). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** The last stage narrows to a point (`triangle`) or keeps its width (`rectangle`). */
  @property({ attribute: "last-shape", reflect: true }) lastShape: ChartFunnelLastShape = "triangle"

  /** Draws the funnel upside down (a pyramid): the first row at the bottom (at the end when horizontal). */
  @property({ type: Boolean, reflect: true }) reversed = false

  /** Gap between the stages, in pixels. */
  @property({ type: Number }) gap = 2

  /** Adds each stage's conversion rate from the previous stage to the tooltip and the data table. */
  @property({ type: Boolean }) conversion = false
}

type FunnelSpec = Pick<TecChartFunnel, "key" | "nameKey" | "lastShape" | "reversed" | "gap" | "conversion">

/** One stage along the flow of the funnel. */
export interface FunnelStage {
  /** Index of the data row. */
  index: number
  value: number
  /** Where the stage starts and ends along the flow (y of a vertical funnel, x of a horizontal one). */
  start: number
  end: number
  /** The stage's width across the flow where it starts and where it ends, in value units. */
  from: number
  to: number
}

/**
 * Places the stages of a funnel along `[start, start + length]`: equal lengths with `gap` pixels
 * between them; each stage is `values[i]` wide where it starts and `values[i + 1]` wide where it
 * ends (the last one ends at 0, or at its own value with `lastShape` `rectangle`). `reversed` puts
 * the first stage at the end and flips every stage.
 */
export function funnelStages(values: number[], start: number, length: number, gap: number, lastShape: ChartFunnelLastShape = "triangle", reversed = false): FunnelStage[] {
  const n = values.length
  if (!n) return []
  const v = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  const g = n > 1 && length - gap * (n - 1) > 0 ? gap : 0
  const size = (length - g * (n - 1)) / n
  return v.map((value, i) => {
    const next = i < n - 1 ? v[i + 1]! : lastShape === "rectangle" ? value : 0
    const position = reversed ? n - 1 - i : i
    const s = start + position * (size + g)
    return { index: i, value, start: s, end: s + size, from: reversed ? next : value, to: reversed ? value : next }
  })
}

/** The width (in value units) of a stage at `t` along it (0 = its start, 1 = its end). */
export function stageWidthAt(stage: FunnelStage, t: number): number {
  return stage.from + (stage.to - stage.from) * Math.min(1, Math.max(0, t))
}

/**
 * The outline of a stage: a trapezoid centred on `center` across the flow, `scale` pixels per value
 * unit wide. `horizontal` swaps the axes (the flow runs along x).
 */
export function trapezoidPath(stage: FunnelStage, center: number, scale: number, horizontal = false): string {
  const a = (stage.from * scale) / 2
  const b = (stage.to * scale) / 2
  const f = (v: number) => Math.round(v * 100) / 100
  const pts = [
    [stage.start, center - a],
    [stage.start, center + a],
    [stage.end, center + b],
    [stage.end, center - b],
  ].map(([main, cross]) => (horizontal ? `${f(main!)},${f(cross!)}` : `${f(cross!)},${f(main!)}`))
  return `M${pts.join("L")}Z`
}

type Side = "inside" | "start" | "end"

interface FunnelLabel {
  index: number
  text: string
  x: number
  y: number
  anchor: "start" | "middle" | "end"
  inside: boolean
  fill?: string
}

export interface FunnelModel extends ChartModelBase {
  kind: "funnel"
  horizontal: boolean
  spec: FunnelSpec
  /** Centre of the funnel across the flow. */
  center: number
  /** Pixels per value unit across the flow. */
  scale: number
  stages: (FunnelStage & { d: string; color: string; name: string })[]
  labels: FunnelLabel[]
}

/** Padding around a label inside a stage, in pixels. */
const PAD = 4

function funnelSpec(ctx: ChartContext): { spec: FunnelSpec; element?: TecChartFunnel } | undefined {
  const element = ctx.parts(TecChartFunnel)[0]
  if (element) return { spec: element, element }
  if (ctx.host.type !== "funnel") return undefined
  // The `type="funnel"` shortcut: the first numeric field, named by the category key.
  const row = ctx.rows[0]
  if (!row) return undefined
  const key = Object.keys(row).find((k) => typeof row[k] === "number")
  if (!key) return undefined
  return {
    spec: {
      key,
      nameKey: ctx.host.categoryKey ?? Object.keys(row).find((k) => typeof row[k] === "string") ?? "name",
      lastShape: "triangle",
      reversed: false,
      gap: 2,
      conversion: false,
    },
  }
}

function sideOf(position: string): Side {
  if (position === "start" || position === "top" || position === "left") return "start"
  if (position === "end" || position === "bottom" || position === "right" || position === "outside") return "end"
  return "inside"
}

function labelText(list: TecChartLabelList, row: ChartRow | undefined, index: number, spec: FunnelSpec, ctx: ChartContext): string {
  const value = row?.[list.key || spec.key]
  if (list.formatter) return String(list.formatter(value, row, index) ?? "")
  if (typeof value === "string") return ctx.text(value)
  return formatValue(value, ctx.locale)
}

function computeModel(ctx: ChartContext): FunnelModel | undefined {
  const found = funnelSpec(ctx)
  if (!found) return undefined
  const { spec, element } = found
  const { rows, margin: m, width: W, height: H } = ctx
  const horizontal = ctx.host.orientation === "horizontal"
  const plot: Rect = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const values = rows.map((row) => numeric(row?.[spec.key]) ?? 0)
  const max = Math.max(0, ...values)
  const mainStart = horizontal ? plot.x : plot.y
  const mainLength = horizontal ? plot.w : plot.h
  const crossStart = horizontal ? plot.y : plot.x
  const crossLength = horizontal ? plot.h : plot.w
  const center = crossStart + crossLength / 2
  const stages = funnelStages(values, mainStart, mainLength, Math.max(0, spec.gap), spec.lastShape, spec.reversed)
  const fs = ctx.fontSize
  const full = max > 0 ? crossLength / max : 0

  // Labels: text and requested side per label list and stage.
  const lists = element ? ctx.childParts(element, TecChartLabelList) : []
  const requests = lists.flatMap((list) =>
    stages.map((stage) => ({
      stage,
      offset: list.offset,
      text: labelText(list, rows[stage.index], stage.index, spec, ctx),
      side: sideOf(list.position),
    }))
  )
  const drafts = requests
    .filter((r) => r.text)
    .map((r) => ({ ...r, width: ctx.measure(r.text), placed: r.side as Side | "none" }))

  // The label's band along the flow, as fractions of the stage (0 = start, 1 = end).
  const band = (stage: FunnelStage, width: number): [number, number] => {
    const length = stage.end - stage.start || 1
    const extent = horizontal ? width : fs
    return [0.5 - extent / 2 / length, 0.5 + extent / 2 / length]
  }
  // Half the stage's width (value units) at the widest and narrowest point of a label's band.
  const halfWidths = (stage: FunnelStage, width: number) => {
    const [t0, t1] = band(stage, width)
    const a = stageWidthAt(stage, t0)
    const b = stageWidthAt(stage, t1)
    return { outer: Math.max(a, b) / 2, inner: Math.min(a, b) / 2 }
  }
  // The room a label beside the stage takes across the flow.
  const across = (d: { width: number; offset: number }) => (horizontal ? fs : d.width) + d.offset
  const fitsBeside = (d: (typeof drafts)[number], scale: number) => {
    // Side by side along the flow, labels keep 4px apart.
    if (horizontal && d.width + 4 > d.stage.end - d.stage.start + Math.max(0, spec.gap)) return false
    return halfWidths(d.stage, d.width).outer * scale + across(d) <= crossLength / 2 + 0.01
  }
  const fitsInside = (d: (typeof drafts)[number], scale: number) => {
    const length = d.stage.end - d.stage.start
    const inner = halfWidths(d.stage, d.width).inner * 2 * scale
    return horizontal ? d.width + 2 * PAD <= length && fs + PAD <= inner : fs + PAD <= length && d.width + 2 * PAD <= inner
  }

  // The widest funnel that leaves room for the labels beside it (at least 40% of the full width;
  // labels that still don't fit are left out). Inside labels that don't fit move beside the stage.
  let scale = full
  for (let pass = 0; pass < 4; pass++) {
    scale = full
    for (const d of drafts) {
      if (d.placed === "start" || d.placed === "end") {
        const outer = halfWidths(d.stage, d.width).outer
        if (outer > 0) scale = Math.min(scale, (crossLength / 2 - across(d)) / outer)
      }
    }
    scale = Math.max(full * 0.4, scale)
    let moved = false
    for (const d of drafts) {
      if (d.side === "inside" && d.placed === "inside" && !fitsInside(d, scale)) {
        // Beside the stage, unless another label list already labels that side.
        const taken = drafts.some((o) => o !== d && o.stage === d.stage && o.placed === "end")
        d.placed = taken ? "none" : "end"
        moved = true
      }
    }
    if (!moved) break
  }
  for (const d of drafts) {
    if (d.placed === "inside" && !fitsInside(d, scale)) d.placed = "none"
    if ((d.placed === "start" || d.placed === "end") && !fitsBeside(d, scale)) d.placed = "none"
  }

  const stageDraws = stages.map((stage) => {
    const row = rows[stage.index]
    const name = String(row?.[spec.nameKey] ?? stage.index)
    return { ...stage, name, color: ctx.rowColor(row, name, stage.index), d: trapezoidPath(stage, center, scale, horizontal) }
  })

  const labels: FunnelLabel[] = []
  for (const d of drafts) {
    if (d.placed === "none") continue
    const mid = (d.stage.start + d.stage.end) / 2
    const colour = stageDraws[d.stage.index]!.color
    if (d.placed === "inside") {
      labels.push(horizontal ? { index: d.stage.index, text: d.text, x: mid, y: center, anchor: "middle", inside: true, fill: colour } : { index: d.stage.index, text: d.text, x: center, y: mid, anchor: "middle", inside: true, fill: colour })
      continue
    }
    const sign = d.placed === "end" ? 1 : -1
    const edge = halfWidths(d.stage, d.width).outer * scale + d.offset
    if (horizontal) {
      // Above or below the stage, centred on it.
      labels.push({ index: d.stage.index, text: d.text, x: mid, y: center + sign * (edge + fs / 2), anchor: "middle", inside: false })
    } else {
      labels.push({ index: d.stage.index, text: d.text, x: center + sign * edge, y: mid, anchor: sign > 0 ? "start" : "end", inside: false })
    }
  }
  // Two lists labelling the same side of a stage: the first one wins.
  const shown: FunnelLabel[] = []
  for (const label of labels) {
    const clash = shown.some((s) => s.index === label.index && s.inside === label.inside && s.anchor === label.anchor && (s.inside || Math.abs(s.y - label.y) < 1))
    if (!clash) shown.push(label)
  }

  return { kind: "funnel", plot, horizontal, spec, center, scale, stages: stageDraws, labels: shown, count: rows.length }
}

/**
 * The SVG `text-anchor` of a label laid out in logical coordinates: in right-to-left the text runs
 * from the right (`start` is its right edge), and the mirrored geometry puts it back in place.
 */
export function textAnchor(anchor: "start" | "middle" | "end", rtl: boolean): string {
  if (!rtl || anchor === "middle") return anchor
  return anchor === "start" ? "end" : "start"
}

function conversionText(model: FunnelModel, index: number, ctx: ChartContext): string | undefined {
  if (index <= 0) return undefined
  const previous = model.stages[index - 1]?.value ?? 0
  const value = model.stages[index]?.value ?? 0
  if (!(previous > 0)) return undefined
  return new Intl.NumberFormat(ctx.locale, { style: "percent", maximumFractionDigits: 1 }).format(value / previous)
}

function conversionName(ctx: ChartContext): string {
  return ctx.config.conversion?.label ?? "Conversion"
}

export const funnelKind: ChartKind<FunnelModel> = {
  id: "funnel",
  mirrored: true,
  claims: (ctx) => ctx.parts(TecChartFunnel).length > 0 || ctx.host.type === "funnel",
  label: () => "Funnel chart",
  model: computeModel,
  render(model, ctx) {
    const active = ctx.active
    return svg`<g class="funnel" ?data-has-active=${active >= 0}>
      ${model.stages.map(
        (stage) => svg`<path class="stage" d=${stage.d} style=${`d: path("${stage.d}")`} fill=${stage.color} data-index=${stage.index}
          ?data-active=${active === stage.index}></path>`
      )}
      ${model.labels.length
        ? svg`<g class="funnel-labels">${model.labels.map(
            (label) => svg`<text class="funnel-label" x=${label.x} y=${label.y} dy="0.355em" text-anchor=${textAnchor(label.anchor, ctx.rtl)}
              ?data-inside=${label.inside} ?data-active=${active === label.index} style=${label.fill ? `--fill: ${label.fill}` : nothing}>${label.text}</text>`
          )}</g>`
        : nothing}
    </g>`
  },
  payload(model, index, ctx) {
    const row = ctx.rows[index]
    const stage = model.stages[index]
    if (!row || !stage) return { label: undefined, items: [] }
    const items: ChartTooltipItem[] = [{ dataKey: model.spec.key, name: stage.name, value: row[model.spec.key], color: stage.color, row }]
    const rate = model.spec.conversion ? conversionText(model, index, ctx) : undefined
    if (rate) items.push({ dataKey: "conversion", name: conversionName(ctx), value: rate, color: "transparent" })
    return { label: undefined, items }
  },
  anchor(model, index) {
    const stage = model.stages[index]
    if (!stage) return undefined
    const mid = (stage.start + stage.end) / 2
    return model.horizontal ? { x: mid, y: model.center } : { x: model.center, y: mid }
  },
  hit(model, point, target) {
    const index = (target as SVGElement | undefined)?.dataset?.index
    if (index != null) return Number(index)
    // Near a stage: its band along the flow (gaps split), within 12px of its outline across it.
    const main = model.horizontal ? point.x : point.y
    const cross = Math.abs((model.horizontal ? point.y : point.x) - model.center)
    const gap = model.spec.gap / 2
    for (const stage of model.stages) {
      if (main < stage.start - gap || main > stage.end + gap) continue
      const t = (main - stage.start) / (stage.end - stage.start || 1)
      const half = (stageWidthAt(stage, t) * model.scale) / 2
      return cross <= Math.max(half, 0) + 12 ? stage.index : -1
    }
    return -1
  },
  table(model, ctx) {
    const { spec } = model
    const config = ctx.config
    return html`<table part="table" class="sr-only">
      <caption>${ctx.name()}</caption>
      <thead>
        <tr>
          <th scope="col">${config[spec.nameKey]?.label ?? spec.nameKey}</th>
          <th scope="col">${config[spec.key]?.label ?? spec.key}</th>
          ${spec.conversion ? html`<th scope="col">${conversionName(ctx)}</th>` : nothing}
        </tr>
      </thead>
      <tbody>
        ${model.stages.map(
          (stage) => html`<tr>
            <th scope="row">${config[stage.name]?.label ?? stage.name}</th>
            <td>${formatValue(ctx.rows[stage.index]?.[spec.key], ctx.locale)}</td>
            ${spec.conversion ? html`<td>${conversionText(model, stage.index, ctx) ?? ""}</td>` : nothing}
          </tr>`
        )}
      </tbody>
    </table>`
  },
  legend(model, ctx) {
    return model.stages.map((s) => ({ dataKey: s.name, color: s.color, row: ctx.rows[s.index] }))
  },
}

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const funnelStyles = [
  css`
    .funnel .stage {
      cursor: default;
    }
    /* The active stage stands out: the others (and their labels) fade. */
    .funnel[data-has-active] .stage:not([data-active]),
    .funnel[data-has-active] .funnel-label:not([data-active]) {
      opacity: 0.5;
    }
    .funnel-label {
      fill: var(--tec-foreground);
      pointer-events: none;
    }
    /* Inside a stage: ink with a surface halo, or (where supported) black or white by the fill. */
    .funnel-label[data-inside] {
      stroke: var(--tec-background);
      stroke-width: 3px;
      stroke-linejoin: round;
      paint-order: stroke;
    }
    @supports (color: oklch(from red l c h)) {
      .funnel-label[data-inside] {
        --threshold: 0.623;
        fill: oklch(from var(--fill) max(0, sign(var(--threshold) - l)) 0 h);
        stroke: none;
      }
    }
    @supports (color: contrast-color(red)) {
      .funnel-label[data-inside] {
        fill: contrast-color(var(--fill));
        stroke: none;
      }
    }
  `,
  motionSafe(css`
    .funnel {
      transform-box: fill-box;
      transform-origin: center;
      animation: tec-chart-funnel-in 400ms var(--tec-ease-out, ease-out) both;
    }
    .funnel .stage,
    .funnel-label {
      transition: opacity 150ms var(--tec-ease, ease);
    }
    svg[data-transition] .funnel .stage {
      transition:
        d 300ms var(--tec-ease, ease),
        opacity 150ms var(--tec-ease, ease);
    }
    @keyframes tec-chart-funnel-in {
      from {
        opacity: 0;
        transform: scaleX(0.6);
      }
    }
    [data-orientation="horizontal"] .funnel {
      animation-name: tec-chart-funnel-in-y;
    }
    @keyframes tec-chart-funnel-in-y {
      from {
        opacity: 0;
        transform: scaleY(0.6);
      }
    }
  `),
  forcedColors(css`
    .funnel .stage,
    .funnel-label[data-inside] {
      forced-color-adjust: none;
    }
    .funnel-label:not([data-inside]) {
      fill: CanvasText;
    }
  `),
]

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-funnel": TecChartFunnel
  }
}
