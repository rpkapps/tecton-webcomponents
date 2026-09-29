import { html, nothing, svg, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { horizontalStep, isRtl } from "../../internal/direction.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { colorProperty, configStyles, entryColor, formatValue, localeOf, type ChartConfig, type ChartRow } from "./chart-config.js"
import type { Point } from "./chart-engine.js"
import type { ChartContext, ChartKind, ChartModelBase, PartClass } from "./chart-kind.js"
import { KINDS } from "./chart-kinds.js"
import { TecChartLegend } from "./chart-legend.js"
import { TecChartTooltip, resolveTooltip } from "./chart-tooltip.js"
import { chartStyles } from "./chart.styles.js"

export * from "./chart-config.js"
export * from "./chart-parts.js"
export * from "./chart-pie.js"
export * from "./chart-polar.js"
export * from "./chart-funnel.js"
export * from "./chart-treemap.js"
export * from "./chart-sunburst.js"
export * from "./chart-sankey.js"
export type { ChartContext, ChartKind, ChartModelBase, ChartPayload, Rect } from "./chart-kind.js"
export { TecChartLegend } from "./chart-legend.js"
export { TecChartTooltip, resolveTooltip } from "./chart-tooltip.js"
export type { ChartTooltipIndicator, ChartLabelFormatter, ChartValueFormatter } from "./chart-tooltip.js"
export type { ChartCurve } from "./chart-engine.js"

/** The series type drawn for every numeric config key when the chart has no series elements. */
export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "radial-bar" | "funnel"

/** `vertical`: categories along the x axis (vertical bars). `horizontal`: categories along the y axis. */
export type ChartOrientation = "vertical" | "horizontal"

/** Space around the plot, in pixels (logical sides: `start` is the left edge in LTR). */
export interface ChartMargin {
  top?: number
  end?: number
  bottom?: number
  start?: number
}

const TOOLTIP_OFFSET = 10
const PALETTE = ["var(--tec-chart-1)", "var(--tec-chart-2)", "var(--tec-chart-3)", "var(--tec-chart-4)", "var(--tec-chart-5)"]

/**
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
 *
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

  /**
   * The accessible name of the chart (and the caption of its data table). An `aria-label` on the
   * host is used when it is not set.
   */
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

  #model?: ChartModelBase
  #kind?: ChartKind
  #context?: ChartContext
  #observer?: ResizeObserver
  #mutations?: MutationObserver
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
    // Parts shown or hidden with the `hidden` attribute (e.g. a series toggled from a legend).
    this.#mutations ??= new MutationObserver(() => this.requestUpdate())
    this.#mutations.observe(this, { attributes: true, attributeFilter: ["hidden"], subtree: true })
    // Tick labels are measured to thin them out: measure again once web fonts have loaded.
    document.fonts?.addEventListener("loadingdone", this.#onFontsLoaded)
    void document.fonts?.ready.then(this.#onFontsLoaded)
  }

  #onFontsLoaded = () => {
    this.#font = ""
    this.requestUpdate()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#mutations?.disconnect()
    document.fonts?.removeEventListener("loadingdone", this.#onFontsLoaded)
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

  // ---------------------------------------------------------------------------------------- context

  #parts<T extends Element>(parent: Element, ctor: PartClass<T>): T[] {
    return [...parent.children].filter((el): el is T => el instanceof ctor && !el.hasAttribute("hidden"))
  }

  get #tooltip(): TecChartTooltip | undefined {
    return this.#parts(this, TecChartTooltip)[0]
  }

  get #legend(): TecChartLegend | undefined {
    return this.#parts(this, TecChartLegend)[0]
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

  #buildContext(): ChartContext {
    const m = this.margin ?? {}
    const config = this.config ?? {}
    const locale = localeOf(this)
    const palette = (index: number) => PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!
    const context: ChartContext = {
      host: this,
      width: this._width,
      height: this._height,
      rows: this.data ?? [],
      config,
      margin: { top: m.top ?? 5, end: m.end ?? 5, bottom: m.bottom ?? 5, start: m.start ?? 5 },
      locale,
      rtl: isRtl(this),
      active: this._active,
      keyboard: this.#keyboard,
      tooltip: this.#tooltip,
      font: this.#font,
      fontSize: Number.parseFloat(this.#font.split(" ")[1] ?? "12") || 12,
      measure: (text) => this.#measure(text),
      parts: (ctor) => this.#parts(this, ctor),
      childParts: (parent, ctor) => this.#parts(parent, ctor),
      palette,
      seriesColor: (key, index, explicit) => {
        if (explicit) return explicit
        if (entryColor(config[key])) return `var(${colorProperty(key)})`
        return palette(index)
      },
      rowColor: (row: ChartRow | undefined, name, index) => {
        if (typeof row?.fill === "string" && row.fill) return row.fill
        if (entryColor(config[name])) return `var(${colorProperty(name)})`
        return palette(index)
      },
      text: (value) => {
        if (typeof value === "string") return config[value]?.label ?? value
        return formatValue(value, locale)
      },
      name: () => this.#name(),
      requestUpdate: () => this.requestUpdate(),
    }
    return context
  }

  // ---------------------------------------------------------------------------------------- render

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("data") || changed.has("orientation") || changed.has("type")) {
      if (this._active >= (this.data?.length ?? 0)) this._active = -1
    }
  }

  protected render() {
    if (!this.#font || this.#resized) {
      const style = getComputedStyle(this)
      this.#font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    }
    const ctx = (this.#context = this.#buildContext())
    const kind = (this.#kind = KINDS.find((k) => k.claims(ctx)))
    const model = (this.#model = ctx.width && ctx.height ? kind?.model(ctx) : undefined)
    if (model && this._active >= model.count) {
      this._active = -1
      ctx.active = -1
    }
    const transition = !this.#resized && this.hasUpdated
    this.#resized = false
    const W = this._width
    const H = this._height
    const marks = model && kind ? kind.render(model, ctx) : nothing
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
          data-kind=${kind?.id ?? nothing}
          @pointerdown=${this.#onPointerDown}
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
                data-orientation=${(model as { horizontal?: boolean }).horizontal ? "horizontal" : "vertical"}
                ?data-transition=${transition}
              >
                ${kind?.mirrored ? svg`<g class="mirror">${marks}</g>` : marks}
              </svg>`
            : nothing}
        </div>
        ${model && kind?.overlay ? kind.overlay(model, ctx) : nothing}
        <slot @slotchange=${() => this.requestUpdate()}></slot>
        <div id="description" class="sr-only">${this.description}</div>
        <div class="sr-only" aria-live="polite" aria-atomic="true">${this._announcement}</div>
        ${model && kind && ctx.rows.length ? kind.table(model, ctx) : nothing}
      </div>
    `
  }

  #name(): string {
    if (this.label) return this.label
    const hostLabel = this.getAttribute("aria-label")
    if (hostLabel) return hostLabel
    const ctx = this.#context
    const kind = this.#kind ?? (ctx ? KINDS.find((k) => k.claims(ctx)) : undefined)
    return kind && ctx ? kind.label(ctx) : "Chart"
  }

  // ---------------------------------------------------------------------------------------- tooltip & legend

  #payload(index: number) {
    const model = this.#model
    const kind = this.#kind
    const ctx = this.#context
    if (!model || !kind || !ctx) return { label: undefined, items: [] }
    return kind.payload(model, index, ctx)
  }

  protected updated(): void {
    const model = this.#model
    const kind = this.#kind
    const ctx = this.#context
    const legend = this.#legend
    if (legend) {
      legend.config = this.config ?? {}
      legend.items = model && kind && ctx ? kind.legend(model, ctx) : []
    }
    const tooltip = this.#tooltip
    if (tooltip) {
      const { label, items } = this._active >= 0 ? this.#payload(this._active) : { label: undefined, items: [] }
      tooltip.config = this.config ?? {}
      tooltip.label = label
      tooltip.payload = items
      tooltip.active = this._active >= 0 && items.length > 0
      if (this._active >= 0) void this.#placeTooltip(tooltip)
    }
  }

  async #placeTooltip(tooltip: TecChartTooltip): Promise<void> {
    await tooltip.updateComplete
    const model = this.#model
    const kind = this.#kind
    const ctx = this.#context
    const plotEl = this._plot
    if (!model || !kind || !ctx || !plotEl || this._active < 0) return
    const rtl = isRtl(this)
    const mirror = rtl && kind.mirrored
    const W = this._width
    const offsetX = plotEl.offsetLeft
    const offsetY = plotEl.offsetTop
    // The plot rectangle in physical pixels, relative to the chart container.
    const box = {
      x: offsetX + (mirror ? W - model.plot.x - model.plot.w : model.plot.x),
      y: offsetY + model.plot.y,
      w: model.plot.w,
      h: model.plot.h,
    }
    let point: Point
    if (this.#pointer && !this.#keyboard) {
      point = { x: offsetX + this.#pointer.x, y: offsetY + this.#pointer.y }
    } else {
      const logical = kind.anchor(model, this._active, ctx)
      if (!logical) return
      point = { x: offsetX + (mirror ? W - logical.x : logical.x), y: offsetY + logical.y }
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
      // Same item: only the tooltip moves with the pointer.
      const tooltip = this.#tooltip
      if (tooltip && index >= 0) void this.#placeTooltip(tooltip)
      return
    }
    this._active = index
    if (keyboard && index >= 0 && !this.#tooltip) this._announcement = this.#describe(index)
  }

  /** The pointer in physical (`x`, `y`) and logical (`logical`) plot coordinates. */
  #pointerPoint(event: PointerEvent) {
    const rect = this._plot.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const logical = { x: isRtl(this) && this.#kind?.mirrored ? this._width - x : x, y }
    const target = event
      .composedPath()
      .find((el): el is SVGElement => el instanceof SVGElement && (el as SVGElement).dataset.index != null)
    return { x, y, logical, target }
  }

  #onPointerDown = (event: PointerEvent) => {
    const model = this.#model
    const kind = this.#kind
    const ctx = this.#context
    if (!model || !kind?.pointerDown || !ctx) return
    kind.pointerDown(model, this.#pointerPoint(event).logical, event, ctx)
  }

  #onPointerMove = (event: PointerEvent) => {
    const model = this.#model
    const kind = this.#kind
    const ctx = this.#context
    if (!model || !kind || !ctx || !model.count) return
    const { x, y, logical, target } = this.#pointerPoint(event)
    const index = kind.hit(model, logical, target, ctx)
    this.#activate(index, index >= 0 ? { x, y } : null, false)
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
