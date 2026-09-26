import { html, nothing, svg, type PropertyValues, type SVGTemplateResult } from "lit"
import { property, query, state } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { horizontalStep, isRtl } from "../../internal/direction.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  colorProperty,
  configStyles,
  entryColor,
  formatValue,
  localeOf,
  type ChartConfig,
  type ChartLegendItem,
  type ChartRow,
  type ChartTooltipItem,
} from "./chart-config.js"
import {
  areaPath,
  barPositions,
  categoryAt,
  categoryScale,
  linePath,
  linearScale,
  niceTicks,
  pieLayout,
  polarPoint,
  resolveRadius,
  roundedRect,
  sectorPath,
  thinTicks,
  type CategorySlot,
  type ChartCurve,
  type Point,
} from "./chart-engine.js"
import { TecChartLegend } from "./chart-legend.js"
import {
  TecChartArea,
  TecChartAxis,
  TecChartBar,
  TecChartGrid,
  TecChartLine,
  TecChartPie,
  TecChartXAxis,
  TecChartYAxis,
} from "./chart-parts.js"
import { TecChartTooltip, resolveTooltip } from "./chart-tooltip.js"
import { chartStyles } from "./chart.styles.js"

export * from "./chart-config.js"
export * from "./chart-parts.js"
export { TecChartLegend } from "./chart-legend.js"
export { TecChartTooltip, resolveTooltip } from "./chart-tooltip.js"
export type { ChartTooltipIndicator, ChartLabelFormatter, ChartValueFormatter } from "./chart-tooltip.js"
export type { ChartCurve } from "./chart-engine.js"

/** The series type drawn for every numeric config key when the chart has no series elements. */
export type ChartType = "bar" | "line" | "area" | "pie"

/** `vertical`: categories along the x axis (vertical bars). `horizontal`: categories along the y axis. */
export type ChartOrientation = "vertical" | "horizontal"

/** Space around the plot, in pixels (logical sides: `start` is the left edge in LTR). */
export interface ChartMargin {
  top?: number
  end?: number
  bottom?: number
  start?: number
}

interface SeriesSpec {
  kind: "bar" | "line" | "area"
  key: string
  color?: string
  stack?: string
  radius: [number, number, number, number]
  maxBarSize?: number
  curve: ChartCurve
  strokeWidth: number
  dots: boolean
  dashed: boolean
  fillOpacity: number
  gradient: boolean
}

type PieSpec = Pick<TecChartPie, "key" | "nameKey" | "innerRadius" | "outerRadius" | "paddingAngle" | "startAngle" | "endAngle">

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface SeriesDraw {
  spec: SeriesSpec
  color: string
  bars: { index: number; d: string; fill: string; negative: boolean }[]
  /** Line/area points per category (null where the value is missing). */
  points: (Point | null)[]
  bases: (Point | null)[]
}

interface CartesianModel {
  kind: "cartesian"
  horizontal: boolean
  plot: Rect
  slots: CategorySlot[]
  hasBars: boolean
  series: SeriesDraw[]
  valueTicks: { value: number; pos: number }[]
  count: number
}

interface PieModel {
  kind: "pie"
  plot: Rect
  cx: number
  cy: number
  inner: number
  outer: number
  pie: PieSpec
  slices: { index: number; d: string; color: string; name: string; mid: number; value: number }[]
  count: number
}

type Model = CartesianModel | PieModel

const TOOLTIP_OFFSET = 10
const TICK_SIZE = 6
const PALETTE = ["var(--tec-chart-1)", "var(--tec-chart-2)", "var(--tec-chart-3)", "var(--tec-chart-4)", "var(--tec-chart-5)"]

function parseRadius(value: string | undefined): [number, number, number, number] {
  const parts = String(value ?? "0")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((v) => Number.parseFloat(v) || 0)
  if (parts.length >= 4) return [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
  const r = parts[0] ?? 0
  return [r, r, r, r]
}

function numeric(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * @summary Beautiful, accessible charts: bar (grouped, stacked, horizontal), line, area (stacked,
 * gradient) and pie/donut, drawn as SVG and themed with the Tecton chart palette.
 *
 * @tag tec-chart
 *
 * @slot - The chart parts: series (`tec-chart-bar`, `tec-chart-line`, `tec-chart-area`,
 *   `tec-chart-pie`), axes (`tec-chart-x-axis`, `tec-chart-y-axis`), `tec-chart-grid`,
 *   `tec-chart-tooltip` and `tec-chart-legend`.
 *
 * @csspart base - The container of the plot, the legend and the tooltip.
 * @csspart plot - The focusable plot area (`role="application"`, `aria-roledescription="chart"`).
 * @csspart surface - The `<svg>`.
 * @csspart table - The visually hidden data table (the text alternative of the chart).
 *
 * @cssprop --tec-chart-color-<key> - Set by the chart for every `config` entry with a colour; use it
 *   in data rows (`fill: "var(--tec-chart-color-chrome)"`) and in your own CSS.
 * @cssprop --tec-chart-1 - Chart palette (theme), `--tec-chart-1` … `--tec-chart-5`.
 *
 * The chart engine is a small built-in SVG renderer (nice ticks, band/point scales, linear,
 * monotone, natural and step curves, pie sectors) rather than a charting library: the charting
 * libraries the Tecton design is based on are framework-bound, and a dependency-free renderer of the
 * chart types the design system documents keeps the element small, SSR-safe and fully themeable
 * with CSS. Size the chart with CSS (`class="min-h-[200px] w-full"`, `class="h-64 w-full"`); it
 * follows its box with a `ResizeObserver`.
 *
 * **Accessibility.** The plot is focusable (`role="application"` with `aria-roledescription="chart"`
 * and the `label` as its name): the arrow keys move between data points (Home/End jump to the ends,
 * Escape hides the tooltip) and each point is announced in a polite live region. A visually hidden
 * data table lists every value for screen reader users who browse the page. Motion (bars growing,
 * lines revealing, value changes) only runs without `prefers-reduced-motion: reduce`.
 */
export class TecChart extends TectonElement {
  static styles = [hostStyles, srOnly, chartStyles]

  /** The data: one object per category (per slice for a pie). Assign a new array to update the chart. */
  @property({ attribute: false }) data: ChartRow[] = []

  /** Labels, colours and icons per series key (or per category name of a pie). */
  @property({ attribute: false }) config: ChartConfig = {}

  /**
   * Draws one series of this type for every config key with a colour (or every numeric field)
   * when the chart has no series elements — a shortcut for simple charts.
   */
  @property({ reflect: true }) type?: ChartType

  /**
   * The data field of the categories (the tooltip label, the table's row headers). Defaults to the
   * `key` of the category axis.
   */
  @property({ attribute: "category-key" }) categoryKey?: string

  /** `horizontal` lays the categories out along the y axis (horizontal bars). */
  @property({ reflect: true }) orientation: ChartOrientation = "vertical"

  /** With `type`: stacks the generated series. */
  @property({ type: Boolean }) stacked = false

  /** The accessible name of the chart (and the caption of its data table). */
  @property() label = ""

  /** The accessible description of the plot (the keyboard hint by default). */
  @property() description = "Use the arrow keys to move between data points."

  /** Space around the plot in pixels, `{ top, end, bottom, start }` (5 on every side by default). */
  @property({ attribute: false }) margin: ChartMargin = {}

  /** Gap between the bars of one category, in pixels. */
  @property({ type: Number, attribute: "bar-gap" }) barGap = 4

  /** Gap on each side of a category's bars, as a fraction of the band (0.1 = 10%). */
  @property({ type: Number, attribute: "bar-category-gap" }) barCategoryGap = 0.1

  @state() private _width = 0
  @state() private _height = 0
  @state() private _active = -1
  @state() private _announcement = ""

  @query(".plot") private _plot!: HTMLElement

  #model?: Model
  #observer?: ResizeObserver
  #pointer: Point | null = null
  #keyboard = false
  #resized = false
  #measureContext?: CanvasRenderingContext2D | null
  #font = ""

  /** Index of the active (highlighted) data point, or -1. */
  get activeIndex(): number {
    return this._active
  }

  /** Re-renders after a part changed. @internal */
  partChanged(): void {
    this.requestUpdate()
  }

  connectedCallback(): void {
    super.connectedCallback()
    if (this.hasUpdated && this._plot) this.#observe()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
  }

  protected firstUpdated(): void {
    this.#observe()
  }

  #observe() {
    this.#observer?.disconnect()
    this.#observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      const width = Math.round(box.width)
      const height = Math.round(box.height)
      if (width === this._width && height === this._height) return
      this.#resized = true
      this._width = width
      this._height = height
    })
    this.#observer.observe(this._plot)
  }

  // ---------------------------------------------------------------------------------------- parts

  #parts<T extends Element>(ctor: abstract new (...args: never[]) => T): T[] {
    return [...this.children].filter((el): el is T => el instanceof ctor && !el.hasAttribute("hidden"))
  }

  get #tooltip(): TecChartTooltip | undefined {
    return this.#parts(TecChartTooltip)[0]
  }

  get #legend(): TecChartLegend | undefined {
    return this.#parts(TecChartLegend)[0]
  }

  #seriesSpecs(): SeriesSpec[] {
    const specs: SeriesSpec[] = []
    for (const el of this.children) {
      if (el.hasAttribute("hidden")) continue
      if (el instanceof TecChartBar || el instanceof TecChartLine || el instanceof TecChartArea) {
        if (!el.key) continue
        specs.push({
          kind: el instanceof TecChartBar ? "bar" : el instanceof TecChartLine ? "line" : "area",
          key: el.key,
          color: el.color || undefined,
          stack: el.stack || undefined,
          radius: el instanceof TecChartBar ? parseRadius(el.radius) : [0, 0, 0, 0],
          maxBarSize: el instanceof TecChartBar ? el.maxBarSize : undefined,
          curve: el instanceof TecChartBar ? "linear" : el.curve,
          strokeWidth: el instanceof TecChartBar ? 0 : el.strokeWidth,
          dots: el instanceof TecChartBar ? false : el.dots,
          dashed: el instanceof TecChartLine ? el.dashed : false,
          fillOpacity: el instanceof TecChartArea ? el.fillOpacity : 1,
          gradient: el instanceof TecChartArea ? el.gradient : false,
        })
      }
    }
    if (specs.length || !this.type || this.type === "pie" || this.#parts(TecChartPie).length) return specs
    // The `type` shortcut: one series per coloured config key (or per numeric field).
    const rows = this.data ?? []
    const isNumeric = (key: string) => rows.some((row) => typeof row?.[key] === "number")
    let keys = Object.entries(this.config ?? {})
      .filter(([key, entry]) => entryColor(entry) && isNumeric(key))
      .map(([key]) => key)
    if (!keys.length && rows[0]) keys = Object.keys(rows[0]).filter((key) => key !== this.#categoryKey() && isNumeric(key))
    const kind = this.type
    return keys.map((key) => ({
      kind,
      key,
      stack: this.stacked ? "stack" : undefined,
      radius: kind === "bar" && !this.stacked ? [4, 4, 4, 4] : [0, 0, 0, 0],
      curve: "natural",
      strokeWidth: kind === "line" ? 2 : 1,
      dots: false,
      dashed: false,
      fillOpacity: 0.4,
      gradient: false,
    }))
  }

  #pieSpec(): PieSpec | undefined {
    const pie = this.#parts(TecChartPie)[0]
    if (pie) return pie
    if (this.type !== "pie" || this.#seriesSpecsCache.length) return undefined
    // The `type="pie"` shortcut: the first numeric field, named by the category key.
    const row = this.data?.[0]
    if (!row) return undefined
    const key = Object.keys(row).find((k) => typeof row[k] === "number")
    if (!key) return undefined
    return {
      key,
      nameKey: this.#categoryKey() ?? Object.keys(row).find((k) => typeof row[k] === "string") ?? "name",
      innerRadius: "0",
      outerRadius: "80%",
      paddingAngle: 0,
      startAngle: 0,
      endAngle: 360,
    }
  }

  #seriesSpecsCache: SeriesSpec[] = []

  #xAxis(): TecChartXAxis | undefined {
    return this.#parts(TecChartXAxis)[0]
  }

  #yAxis(): TecChartYAxis | undefined {
    return this.#parts(TecChartYAxis)[0]
  }

  #categoryKey(): string | undefined {
    if (this.categoryKey) return this.categoryKey
    const x = this.#xAxis()?.key
    const y = this.#yAxis()?.key
    return this.orientation === "horizontal" ? (y ?? x) : (x ?? y)
  }

  #seriesColor(spec: SeriesSpec, index: number): string {
    if (spec.color) return spec.color
    if (entryColor(this.config?.[spec.key])) return `var(${colorProperty(spec.key)})`
    return PALETTE[index % PALETTE.length]!
  }

  // ---------------------------------------------------------------------------------------- model

  #margin() {
    const m = this.margin ?? {}
    return { top: m.top ?? 5, end: m.end ?? 5, bottom: m.bottom ?? 5, start: m.start ?? 5 }
  }

  #measure(text: string): number {
    if (this.#measureContext === undefined) {
      this.#measureContext = document.createElement("canvas").getContext("2d")
    }
    const ctx = this.#measureContext
    if (!ctx) return text.length * 7
    ctx.font = this.#font
    return ctx.measureText(text).width
  }

  #computeModel(): Model | undefined {
    const W = this._width
    const H = this._height
    if (!W || !H) return undefined
    const rows = this.data ?? []
    const m = this.#margin()
    const specs = (this.#seriesSpecsCache = this.#seriesSpecs())
    const pie = this.#pieSpec()
    if (pie && !specs.length) {
      const plot = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
      const maxRadius = Math.min(plot.w, plot.h) / 2
      const outer = resolveRadius(pie.outerRadius, maxRadius, maxRadius * 0.8)
      const inner = resolveRadius(pie.innerRadius, maxRadius, 0)
      const cx = plot.x + plot.w / 2
      const cy = plot.y + plot.h / 2
      const values = rows.map((row) => numeric(row?.[pie.key]) ?? 0)
      const layout = pieLayout(values, pie.startAngle, pie.endAngle, pie.paddingAngle)
      const slices = layout.map((slice, i) => {
        const row = rows[i] ?? {}
        const name = String(row[pie.nameKey] ?? i)
        const color =
          (typeof row.fill === "string" && row.fill) ||
          (entryColor(this.config?.[name]) ? `var(${colorProperty(name)})` : PALETTE[i % PALETTE.length]!)
        return {
          index: i,
          d: slice.value > 0 ? sectorPath(cx, cy, inner, outer, slice.startAngle, slice.endAngle) : "",
          color,
          name,
          mid: slice.midAngle,
          value: slice.value,
        }
      })
      return { kind: "pie", plot, cx, cy, inner, outer, pie, slices, count: rows.length }
    }

    const horizontal = this.orientation === "horizontal"
    const xAxis = this.#xAxis()
    const yAxis = this.#yAxis()
    const plot: Rect = {
      x: m.start + (yAxis ? yAxis.width : 0),
      y: m.top,
      w: 0,
      h: 0,
    }
    plot.w = Math.max(0, W - m.end - plot.x)
    plot.h = Math.max(0, H - m.bottom - (xAxis ? xAxis.height : 0) - plot.y)

    const hasBars = specs.some((s) => s.kind === "bar")
    const count = rows.length
    const slots = horizontal
      ? categoryScale(count, plot.y, plot.y + plot.h, hasBars ? "band" : "point")
      : categoryScale(count, plot.x, plot.x + plot.w, hasBars ? "band" : "point")

    // Stacking: cumulative positive and negative sums per stack id and category.
    const stacks = new Map<string, { pos: number[]; neg: number[] }>()
    const ranges = specs.map((spec) =>
      rows.map((row, i) => {
        const value = numeric(row?.[spec.key])
        if (value == null) return null
        if (!spec.stack) return { base: 0, top: value }
        let stack = stacks.get(`${spec.kind === "bar" ? "b" : "a"}:${spec.stack}`)
        if (!stack) stacks.set(`${spec.kind === "bar" ? "b" : "a"}:${spec.stack}`, (stack = { pos: [], neg: [] }))
        const sums = value >= 0 ? stack.pos : stack.neg
        const base = sums[i] ?? 0
        sums[i] = base + value
        return { base, top: base + value }
      })
    )
    let min = 0
    let max = 0
    for (const series of ranges)
      for (const r of series) {
        if (!r) continue
        min = Math.min(min, r.base, r.top)
        max = Math.max(max, r.base, r.top)
      }
    const valueAxis = horizontal ? xAxis : yAxis
    const ticks = niceTicks(min, max === min ? min + 1 : max, valueAxis?.tickCount ?? 5)
    const domain: [number, number] = [ticks[0]!, ticks[ticks.length - 1]!]
    const scale = horizontal ? linearScale(domain, [plot.x, plot.x + plot.w]) : linearScale(domain, [plot.y + plot.h, plot.y])
    const zero = scale(Math.min(Math.max(0, domain[0]), domain[1]))

    // Bar groups: one per stack id, one per unstacked bar series.
    const groups: string[] = []
    specs.forEach((spec, i) => {
      if (spec.kind !== "bar") return
      const id = spec.stack ? `stack:${spec.stack}` : `bar:${i}`
      if (!groups.includes(id)) groups.push(id)
    })
    const bandSize = slots[0]?.size ?? 0
    const maxBarSize = specs.find((s) => s.kind === "bar" && s.maxBarSize != null)?.maxBarSize
    const positions = barPositions(bandSize, groups.length, this.barCategoryGap, this.barGap, maxBarSize)

    const series: SeriesDraw[] = specs.map((spec, si) => {
      const color = this.#seriesColor(spec, si)
      const draw: SeriesDraw = { spec, color, bars: [], points: [], bases: [] }
      const range = ranges[si]!
      if (spec.kind === "bar") {
        const group = groups.indexOf(spec.stack ? `stack:${spec.stack}` : `bar:${si}`)
        const position = positions[group]
        range.forEach((r, i) => {
          const slot = slots[i]
          if (!r || !slot || !position) return
          const a = scale(r.base)
          const b = scale(r.top)
          const row = rows[i] ?? {}
          const fill = spec.color ?? ((typeof row.fill === "string" && row.fill) || color)
          const negative = r.top < r.base
          const d = horizontal
            ? roundedRect(Math.min(a, b), slot.start + position.offset, Math.abs(b - a), position.size, spec.radius)
            : roundedRect(slot.start + position.offset, Math.min(a, b), position.size, Math.abs(b - a), spec.radius)
          draw.bars.push({ index: i, d, fill, negative })
        })
      } else {
        range.forEach((r, i) => {
          const slot = slots[i]
          if (!r || !slot) {
            draw.points.push(null)
            draw.bases.push(null)
            return
          }
          const top = scale(r.top)
          const base = spec.stack ? scale(r.base) : zero
          draw.points.push(horizontal ? { x: top, y: slot.center } : { x: slot.center, y: top })
          draw.bases.push(horizontal ? { x: base, y: slot.center } : { x: slot.center, y: base })
        })
      }
      return draw
    })

    return {
      kind: "cartesian",
      horizontal,
      plot,
      slots,
      hasBars,
      series,
      valueTicks: ticks.map((value) => ({ value, pos: scale(value) })),
      count,
    }
  }

  // ---------------------------------------------------------------------------------------- render

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("data") || changed.has("orientation") || changed.has("type")) {
      if (this._active >= (this.data?.length ?? 0)) this._active = -1
    }
  }

  protected render() {
    const style = getComputedStyle(this)
    this.#font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const model = (this.#model = this.#computeModel())
    const transition = !this.#resized && this.hasUpdated
    this.#resized = false
    const W = this._width
    const H = this._height
    return html`
      <div part="base" class="base" style=${styleMap(configStyles(this.config ?? {}))}>
        <div
          part="plot"
          class="plot"
          role="application"
          aria-roledescription="chart"
          aria-label=${this.#name()}
          aria-describedby="description"
          tabindex="0"
          @pointermove=${this.#onPointerMove}
          @pointerleave=${this.#onPointerLeave}
          @keydown=${this.#onKeyDown}
          @focus=${this.#onFocus}
          @blur=${this.#onBlur}
        >
          ${model
            ? html`<svg
                part="surface"
                width=${W}
                height=${H}
                viewBox="0 0 ${W} ${H}"
                aria-hidden="true"
                focusable="false"
                data-orientation=${model.kind === "cartesian" && model.horizontal ? "horizontal" : "vertical"}
                ?data-transition=${transition}
              >
                ${model.kind === "pie" ? this.#renderPie(model) : this.#renderCartesian(model)}
              </svg>`
            : nothing}
        </div>
        <slot @slotchange=${() => this.requestUpdate()}></slot>
        <div id="description" class="sr-only">${this.description}</div>
        <div class="sr-only" aria-live="polite" aria-atomic="true">${this._announcement}</div>
        ${this.#renderTable(model)}
      </div>
    `
  }

  #name(): string {
    if (this.label) return this.label
    const kind = this.#seriesSpecsCache[0]?.kind ?? (this.#parts(TecChartPie).length ? "pie" : this.type)
    return kind ? `${kind[0]!.toUpperCase()}${kind.slice(1)} chart` : "Chart"
  }

  #renderCartesian(model: CartesianModel): SVGTemplateResult {
    const { plot, horizontal, slots, series } = model
    const grid = this.#parts(TecChartGrid)[0]
    const tooltip = this.#tooltip
    const active = this._active
    const activeSlot = active >= 0 ? slots[active] : undefined
    const showCursor = tooltip && !tooltip.hideCursor && activeSlot

    let gridLines: SVGTemplateResult | typeof nothing = nothing
    if (grid) {
      const both = grid.horizontal || grid.vertical
      const drawHorizontal = both ? grid.horizontal : !horizontal
      const drawVertical = both ? grid.vertical : horizontal
      const valuePositions = model.valueTicks.map((t) => t.pos)
      const categoryPositions = slots.map((s) => s.center)
      const hPositions = horizontal ? categoryPositions : valuePositions
      const vPositions = horizontal ? valuePositions : categoryPositions
      gridLines = svg`<g class="grid" ?data-dashed=${grid.dashed}>
        ${drawHorizontal ? hPositions.map((y) => svg`<line x1=${plot.x} x2=${plot.x + plot.w} y1=${y} y2=${y}></line>`) : nothing}
        ${drawVertical ? vPositions.map((x) => svg`<line x1=${x} x2=${x} y1=${plot.y} y2=${plot.y + plot.h}></line>`) : nothing}
      </g>`
    }

    let cursor: SVGTemplateResult | typeof nothing = nothing
    if (showCursor) {
      if (model.hasBars) {
        cursor = horizontal
          ? svg`<rect class="cursor-band" x=${plot.x} y=${activeSlot.start} width=${plot.w} height=${activeSlot.size}></rect>`
          : svg`<rect class="cursor-band" x=${activeSlot.start} y=${plot.y} width=${activeSlot.size} height=${plot.h}></rect>`
      } else {
        cursor = horizontal
          ? svg`<line class="cursor-line" x1=${plot.x} x2=${plot.x + plot.w} y1=${activeSlot.center} y2=${activeSlot.center}></line>`
          : svg`<line class="cursor-line" x1=${activeSlot.center} x2=${activeSlot.center} y1=${plot.y} y2=${plot.y + plot.h}></line>`
      }
    }

    const segments = (points: (Point | null)[]) => {
      const out: number[][] = []
      let current: number[] = []
      points.forEach((p, i) => {
        if (p) current.push(i)
        else if (current.length) {
          out.push(current)
          current = []
        }
      })
      if (current.length) out.push(current)
      return out
    }

    const gradients = series
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.spec.kind === "area" && s.spec.gradient)
      .map(
        ({ s, i }) => svg`<linearGradient id="fill-${i}" x1="0" y1="0" x2=${horizontal ? "1" : "0"} y2=${horizontal ? "0" : "1"}>
          <stop offset="5%" stop-color=${s.color} stop-opacity="0.8"></stop>
          <stop offset="95%" stop-color=${s.color} stop-opacity="0.1"></stop>
        </linearGradient>`
      )

    const areas = series.map((s, i) => {
      if (s.spec.kind !== "area") return nothing
      const parts = segments(s.points)
      return svg`<g class="reveal">
        ${parts.map((idx) => {
          const top = idx.map((j) => s.points[j]!)
          const base = idx.map((j) => s.bases[j]!)
          return svg`
            <path class="area series-path" d=${areaPath(top, base, s.spec.curve)} style=${`d: path("${areaPath(top, base, s.spec.curve)}")`}
              fill=${s.spec.gradient ? `url(#fill-${i})` : s.color} fill-opacity=${s.spec.gradient ? 1 : s.spec.fillOpacity} stroke="none"></path>
            <path class="series-path" d=${linePath(top, s.spec.curve)} style=${`d: path("${linePath(top, s.spec.curve)}")`}
              fill="none" stroke=${s.color} stroke-width=${s.spec.strokeWidth}></path>`
        })}
      </g>`
    })

    const bars = series.map((s) =>
      s.spec.kind === "bar"
        ? svg`<g class="bars">${s.bars.map(
            (bar) => svg`<path class="bar" d=${bar.d} style=${`d: path("${bar.d}")`} fill=${bar.fill} ?data-negative=${bar.negative} data-index=${bar.index}></path>`
          )}</g>`
        : nothing
    )

    const lines = series.map((s) => {
      if (s.spec.kind !== "line") return nothing
      return svg`<g class="reveal">${segments(s.points).map((idx) => {
        const d = linePath(
          idx.map((j) => s.points[j]!),
          s.spec.curve
        )
        return svg`<path class="series-path" d=${d} style=${`d: path("${d}")`} fill="none" stroke=${s.color}
          stroke-width=${s.spec.strokeWidth} stroke-dasharray=${s.spec.dashed ? "4 4" : nothing}
          stroke-linejoin="round" stroke-linecap="round"></path>`
      })}</g>`
    })

    const dots = series.map((s) => {
      if (s.spec.kind === "bar") return nothing
      return svg`
        ${s.spec.dots ? s.points.map((p) => (p ? svg`<circle class="dot" cx=${p.x} cy=${p.y} r="3" stroke=${s.color} stroke-width=${Math.max(1, s.spec.strokeWidth)}></circle>` : nothing)) : nothing}
        ${tooltip && active >= 0 && s.points[active] ? svg`<circle class="active-dot" cx=${s.points[active]!.x} cy=${s.points[active]!.y} r="4" fill=${s.color}></circle>` : nothing}
      `
    })

    return svg`
      <defs>${gradients}</defs>
      <g class="mirror">
        ${gridLines}
        ${cursor}
        ${areas}
        ${bars}
        ${lines}
        ${dots}
        ${this.#renderAxes(model)}
      </g>
    `
  }

  #tickText(axis: TecChartAxis, value: unknown, index: number): string {
    if (axis.tickFormatter) return String(axis.tickFormatter(value, index))
    return value == null ? "" : String(value)
  }

  #renderAxes(model: CartesianModel): SVGTemplateResult {
    const { plot, horizontal, slots } = model
    const rows = this.data ?? []
    const key = this.#categoryKey()
    const categories = rows.map((row, i) => (key ? row?.[key] : i))
    const xAxis = this.#xAxis()
    const yAxis = this.#yAxis()
    const out: SVGTemplateResult[] = []
    const fontSize = Number.parseFloat(this.#font.split(" ")[1] ?? "12") || 12

    if (xAxis) {
      const y = plot.y + plot.h
      const items = horizontal
        ? model.valueTicks.map((t, i) => ({ coordinate: t.pos, text: this.#tickText(xAxis, t.value, i) }))
        : slots.map((s, i) => ({ coordinate: s.center, text: this.#tickText(xAxis, categories[i], i) }))
      const shown = thinTicks(
        items.map((t) => t.coordinate),
        (i) => this.#measure(items[i]!.text),
        plot.x,
        plot.x + plot.w,
        xAxis.minTickGap
      )
      const ty = y + TICK_SIZE + xAxis.tickMargin
      out.push(svg`<g class="x-axis">
        ${xAxis.axisLine ? svg`<line class="axis-line" x1=${plot.x} x2=${plot.x + plot.w} y1=${y} y2=${y}></line>` : nothing}
        ${shown.map(
          (t) => svg`
            ${xAxis.tickLine ? svg`<line class="tick-line" x1=${t.coordinate} x2=${t.coordinate} y1=${y} y2=${y + TICK_SIZE}></line>` : nothing}
            <text class="tick" x=${t.labelCoordinate} y=${ty} dy="0.71em" text-anchor="middle">${items[t.index]!.text}</text>`
        )}
      </g>`)
    }

    if (yAxis) {
      const x = plot.x
      const items = horizontal
        ? slots.map((s, i) => ({ coordinate: s.center, text: this.#tickText(yAxis, categories[i], i) }))
        : model.valueTicks.map((t, i) => ({ coordinate: t.pos, text: this.#tickText(yAxis, t.value, i) }))
      // Keep labels from overlapping (walk from the bottom for values, from the top for categories).
      let limit = horizontal ? -Infinity : Infinity
      const visible = items.filter((t) => {
        const ok = horizontal ? t.coordinate - fontSize / 2 >= limit : t.coordinate + fontSize / 2 <= limit
        if (ok) limit = horizontal ? t.coordinate + fontSize / 2 + yAxis.minTickGap : t.coordinate - fontSize / 2 - yAxis.minTickGap
        return ok
      })
      const tx = x - TICK_SIZE - yAxis.tickMargin
      out.push(svg`<g class="y-axis">
        ${yAxis.axisLine ? svg`<line class="axis-line" x1=${x} x2=${x} y1=${plot.y} y2=${plot.y + plot.h}></line>` : nothing}
        ${visible.map(
          (t) => svg`
            ${yAxis.tickLine ? svg`<line class="tick-line" x1=${x - TICK_SIZE} x2=${x} y1=${t.coordinate} y2=${t.coordinate}></line>` : nothing}
            <text class="tick" x=${tx} y=${t.coordinate} dy="0.355em" text-anchor="end">${t.text}</text>`
        )}
      </g>`)
    }
    return svg`${out}`
  }

  #renderPie(model: PieModel): SVGTemplateResult {
    const active = this._active
    return svg`<g class="pie" style=${`transform-origin: ${model.cx}px ${model.cy}px`}>
      ${model.slices.map((slice) =>
        slice.d
          ? svg`<path class="sector" d=${slice.d} fill=${slice.color} data-index=${slice.index} ?data-active=${active === slice.index && this.#keyboard}></path>`
          : nothing
      )}
    </g>`
  }

  #renderTable(model: Model | undefined) {
    const rows = this.data ?? []
    if (!rows.length) return nothing
    const locale = localeOf(this)
    const config = this.config ?? {}
    if (model?.kind === "pie") {
      const pie = model.pie
      return html`<table part="table" class="sr-only">
        <caption>${this.#name()}</caption>
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
              <td>${formatValue(rows[slice.index]?.[pie.key], locale)}</td>
            </tr>`
          )}
        </tbody>
      </table>`
    }
    const specs = this.#seriesSpecsCache
    if (!specs.length) return nothing
    const key = this.#categoryKey()
    return html`<table part="table" class="sr-only">
      <caption>${this.#name()}</caption>
      <thead>
        <tr>
          <th scope="col">${key ? (config[key]?.label ?? key) : "#"}</th>
          ${specs.map((s) => html`<th scope="col">${config[s.key]?.label ?? s.key}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (row, i) => html`<tr>
            <th scope="row">${this.#categoryText(i)}</th>
            ${specs.map((s) => html`<td>${formatValue(row?.[s.key], locale)}</td>`)}
          </tr>`
        )}
      </tbody>
    </table>`
  }

  /** The category's name as text: the tooltip's formatted label when it is text, else the config label or raw value. */
  #categoryText(index: number): string {
    const key = this.#categoryKey()
    const raw = key ? this.data?.[index]?.[key] : index + 1
    const tooltip = this.#tooltip
    if (tooltip?.labelFormatter && key) {
      const value = typeof raw === "string" ? (this.config?.[raw]?.label ?? raw) : raw
      const formatted = tooltip.labelFormatter(value, [])
      if (typeof formatted === "string") return formatted
    }
    if (typeof raw === "string") return this.config?.[raw]?.label ?? raw
    return formatValue(raw, localeOf(this))
  }

  // ---------------------------------------------------------------------------------------- tooltip & legend

  #payload(index: number): { label: unknown; items: ChartTooltipItem[] } {
    const model = this.#model
    const row = this.data?.[index]
    if (!model || !row) return { label: undefined, items: [] }
    if (model.kind === "pie") {
      const slice = model.slices[index]!
      return { label: undefined, items: [{ dataKey: model.pie.key, name: slice.name, value: row[model.pie.key], color: slice.color, row }] }
    }
    const key = this.#categoryKey()
    return {
      label: key ? row[key] : index,
      items: model.series.map((s) => ({ dataKey: s.spec.key, name: s.spec.key, value: row[s.spec.key], color: s.color, row })),
    }
  }

  #legendItems(): ChartLegendItem[] {
    const model = this.#model
    if (!model) return []
    if (model.kind === "pie") return model.slices.map((s) => ({ dataKey: s.name, color: s.color, row: this.data?.[s.index] }))
    return model.series.map((s) => ({ dataKey: s.spec.key, color: s.color }))
  }

  protected updated(): void {
    const legend = this.#legend
    if (legend) {
      legend.config = this.config ?? {}
      legend.items = this.#legendItems()
    }
    const tooltip = this.#tooltip
    if (tooltip) {
      const { label, items } = this._active >= 0 ? this.#payload(this._active) : { label: undefined, items: [] }
      tooltip.config = this.config ?? {}
      tooltip.label = label
      tooltip.payload = items
      tooltip.active = this._active >= 0
      if (this._active >= 0) void this.#placeTooltip(tooltip)
    }
  }

  async #placeTooltip(tooltip: TecChartTooltip): Promise<void> {
    await tooltip.updateComplete
    const model = this.#model
    const plotEl = this._plot
    if (!model || !plotEl || this._active < 0) return
    const rtl = isRtl(this)
    const W = this._width
    const offsetX = plotEl.offsetLeft
    const offsetY = plotEl.offsetTop
    // The plot rectangle in physical pixels, relative to the chart container.
    const logicalX = model.plot.x
    const box = {
      x: offsetX + (rtl ? W - logicalX - model.plot.w : logicalX),
      y: offsetY + model.plot.y,
      w: model.plot.w,
      h: model.plot.h,
    }
    let point: Point
    if (this.#pointer && !this.#keyboard) {
      point = { x: offsetX + this.#pointer.x, y: offsetY + this.#pointer.y }
    } else if (model.kind === "pie") {
      const slice = model.slices[this._active]
      const p = polarPoint(model.cx, model.cy, (model.inner + model.outer) / 2, slice?.mid ?? 0)
      point = { x: offsetX + p.x, y: offsetY + p.y }
    } else {
      const slot = model.slots[this._active]
      if (!slot) return
      const logical = model.horizontal
        ? { x: model.plot.x + model.plot.w / 2, y: slot.center }
        : { x: slot.center, y: model.plot.y + model.plot.h / 2 }
      point = { x: offsetX + (rtl ? W - logical.x : logical.x), y: offsetY + logical.y }
    }
    const place = (coordinate: number, size: number, start: number, length: number, reverse: boolean) => {
      const negative = coordinate - size - TOOLTIP_OFFSET
      const positive = coordinate + TOOLTIP_OFFSET
      if (reverse || positive + size > start + length) return Math.max(negative, start)
      return Math.max(positive, start)
    }
    const x = place(point.x, tooltip.offsetWidth, box.x, box.w, rtl)
    const y = place(point.y, tooltip.offsetHeight, box.y, box.h, false)
    tooltip.place(x, y)
    if (this.#keyboard) {
      const text = tooltip.describe()
      if (text !== this._announcement) this._announcement = text
    }
  }

  #describe(index: number): string {
    const { label, items } = this.#payload(index)
    const locale = localeOf(this)
    const resolved = resolveTooltip({ config: this.config ?? {}, items, label })
    const labelText = typeof resolved.label === "string" || typeof resolved.label === "number" ? String(resolved.label) : ""
    return [labelText, ...resolved.items.map(({ item, name }) => `${name} ${formatValue(item.value, locale)}`)].filter(Boolean).join(", ")
  }

  // ---------------------------------------------------------------------------------------- interaction

  #activate(index: number, pointer: Point | null, keyboard: boolean) {
    this.#pointer = pointer
    this.#keyboard = keyboard
    if (index === this._active && !keyboard) {
      // Same category: only the tooltip moves with the pointer.
      const tooltip = this.#tooltip
      if (tooltip && index >= 0) void this.#placeTooltip(tooltip)
      return
    }
    this._active = index
    if (keyboard && index >= 0 && !this.#tooltip) this._announcement = this.#describe(index)
  }

  #onPointerMove = (event: PointerEvent) => {
    const model = this.#model
    if (!model || !model.count) return
    const rect = this._plot.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (model.kind === "pie") {
      const target = event.composedPath().find((el) => el instanceof SVGElement && (el as SVGElement).dataset.index != null) as SVGElement | undefined
      const index = target ? Number(target.dataset.index) : -1
      this.#activate(index, index >= 0 ? { x, y } : null, false)
      return
    }
    const lx = isRtl(this) ? this._width - x : x
    const { plot } = model
    if (lx < plot.x || lx > plot.x + plot.w || y < plot.y || y > plot.y + plot.h) {
      this.#activate(-1, null, false)
      return
    }
    const index = categoryAt(model.slots, model.horizontal ? y : lx)
    this.#activate(index, { x, y }, false)
  }

  #onPointerLeave = () => {
    if (!this.#keyboard || !this._plot.matches(":focus")) this.#activate(-1, null, false)
  }

  #onFocus = () => {
    if (this._active < 0 && this._plot.matches(":focus-visible") && this.#model?.count) this.#activate(0, null, true)
  }

  #onBlur = () => {
    this.#activate(-1, null, false)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const count = this.#model?.count ?? 0
    if (!count) return
    const current = this._active
    let next: number
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft":
        next = current < 0 ? 0 : current + horizontalStep(event.key, this)
        break
      case "ArrowDown":
        next = current < 0 ? 0 : current + 1
        break
      case "ArrowUp":
        next = current < 0 ? 0 : current - 1
        break
      case "Home":
        next = 0
        break
      case "End":
        next = count - 1
        break
      case "Escape":
        if (current < 0) return
        event.preventDefault()
        this.#activate(-1, null, true)
        return
      default:
        return
    }
    event.preventDefault()
    this.#activate(Math.min(count - 1, Math.max(0, next)), null, true)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart": TecChart
  }
}
