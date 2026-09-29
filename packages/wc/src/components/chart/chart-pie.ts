/**
 * @module chart-pie
 * The pie kind (`tec-chart-pie`): pie and donut charts, one slice per data row.
 */
import { html, nothing, svg } from "lit"
import { property } from "lit/decorators.js"
import { formatValue } from "./chart-config.js"
import { pieLayout, polarPoint, resolveRadius, sectorPath } from "./chart-engine.js"
import { numeric, type ChartContext, type ChartKind, type ChartModelBase } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * Slice colours come from the row's `fill` field, then from the config entry named by the row's
 * `name-key` value, then from the chart palette.
 *
 * @summary A pie (or, with `inner-radius`, donut) series of a `tec-chart`: one slice per data row.
 *
 * @tag tec-chart-pie
 */
export class TecChartPie extends TecChartPart {
  /** The data field holding the slice values. */
  @property({ reflect: true }) key = ""

  /** The data field holding the slice names (also the config keys of the slices). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** Inner radius: pixels (`60`) or a percentage of the available radius (`"50%"`). 0 = pie. */
  @property({ attribute: "inner-radius" }) innerRadius = "0"

  /** Outer radius: pixels or a percentage of the available radius. */
  @property({ attribute: "outer-radius" }) outerRadius = "80%"

  /** Gap between slices in degrees. */
  @property({ type: Number, attribute: "padding-angle" }) paddingAngle = 0

  /** Angle of the first slice's start, in degrees counter-clockwise from 3 o'clock. */
  @property({ type: Number, attribute: "start-angle" }) startAngle = 0

  /** Angle of the last slice's end. `start-angle` + 360 is a full circle. */
  @property({ type: Number, attribute: "end-angle" }) endAngle = 360
}

type PieSpec = Pick<TecChartPie, "key" | "nameKey" | "innerRadius" | "outerRadius" | "paddingAngle" | "startAngle" | "endAngle">

export interface PieModel extends ChartModelBase {
  kind: "pie"
  cx: number
  cy: number
  inner: number
  outer: number
  pie: PieSpec
  slices: { index: number; d: string; color: string; name: string; mid: number; value: number }[]
}

function pieSpec(ctx: ChartContext): PieSpec | undefined {
  const pie = ctx.parts(TecChartPie)[0]
  if (pie) return pie
  if (ctx.host.type !== "pie") return undefined
  // The `type="pie"` shortcut: the first numeric field, named by the category key.
  const row = ctx.rows[0]
  if (!row) return undefined
  const key = Object.keys(row).find((k) => typeof row[k] === "number")
  if (!key) return undefined
  return {
    key,
    nameKey: ctx.host.categoryKey ?? Object.keys(row).find((k) => typeof row[k] === "string") ?? "name",
    innerRadius: "0",
    outerRadius: "80%",
    paddingAngle: 0,
    startAngle: 0,
    endAngle: 360,
  }
}

export const pieKind: ChartKind<PieModel> = {
  id: "pie",
  claims: (ctx) => ctx.parts(TecChartPie).length > 0 || ctx.host.type === "pie",
  label: () => "Pie chart",
  model(ctx) {
    const pie = pieSpec(ctx)
    if (!pie) return undefined
    const { rows, margin: m, width: W, height: H } = ctx
    const plot = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
    const maxRadius = Math.min(plot.w, plot.h) / 2
    const outer = resolveRadius(pie.outerRadius, maxRadius, maxRadius * 0.8)
    const inner = resolveRadius(pie.innerRadius, maxRadius, 0)
    const cx = plot.x + plot.w / 2
    const cy = plot.y + plot.h / 2
    const values = rows.map((row) => numeric(row?.[pie.key]) ?? 0)
    const layout = pieLayout(values, pie.startAngle, pie.endAngle, pie.paddingAngle)
    const slices = layout.map((slice, i) => {
      const row = rows[i]
      const name = String(row?.[pie.nameKey] ?? i)
      return {
        index: i,
        d: slice.value > 0 ? sectorPath(cx, cy, inner, outer, slice.startAngle, slice.endAngle) : "",
        color: ctx.rowColor(row, name, i),
        name,
        mid: slice.midAngle,
        value: slice.value,
      }
    })
    return { kind: "pie", plot, cx, cy, inner, outer, pie, slices, count: rows.length }
  },
  render(model, ctx) {
    return svg`<g class="pie" style=${`transform-origin: ${model.cx}px ${model.cy}px`}>
      ${model.slices.map((slice) =>
        slice.d
          ? svg`<path class="sector" d=${slice.d} fill=${slice.color} data-index=${slice.index} ?data-active=${ctx.active === slice.index && ctx.keyboard}></path>`
          : nothing
      )}
    </g>`
  },
  payload(model, index, ctx) {
    const row = ctx.rows[index]
    const slice = model.slices[index]
    if (!row || !slice) return { label: undefined, items: [] }
    return { label: undefined, items: [{ dataKey: model.pie.key, name: slice.name, value: row[model.pie.key], color: slice.color, row }] }
  },
  anchor(model, index) {
    const slice = model.slices[index]
    return polarPoint(model.cx, model.cy, (model.inner + model.outer) / 2, slice?.mid ?? 0)
  },
  hit(_model, _point, target) {
    const index = (target as SVGElement | undefined)?.dataset?.index
    return index != null ? Number(index) : -1
  },
  table(model, ctx) {
    if (!ctx.rows.length) return nothing
    const { pie } = model
    const config = ctx.config
    return html`<table part="table" class="sr-only">
      <caption>${ctx.name()}</caption>
      <thead>
        <tr>
          <th scope="col">${config[pie.nameKey]?.label ?? pie.nameKey}</th>
          <th scope="col">${config[pie.key]?.label ?? pie.key}</th>
        </tr>
      </thead>
      <tbody>
        ${model.slices.map(
          (slice) => html`<tr>
            <th scope="row">${config[slice.name]?.label ?? slice.name}</th>
            <td>${formatValue(ctx.rows[slice.index]?.[pie.key], ctx.locale)}</td>
          </tr>`
        )}
      </tbody>
    </table>`
  },
  legend(model, ctx) {
    return model.slices.map((s) => ({ dataKey: s.name, color: s.color, row: ctx.rows[s.index] }))
  },
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-pie": TecChartPie
  }
}
