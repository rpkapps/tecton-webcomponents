/**
 * @module chart-kind
 * The contract between `<tec-chart>` and the chart families it draws. The element owns sizing,
 * focus, the pointer and keyboard, the live region, the tooltip and the legend; a kind turns the
 * data and the chart's parts into a model and draws it. Kinds are tried in order and the first one
 * that `claims` the chart draws it (see `KINDS` in `chart-kinds.ts`).
 */
import type { nothing, SVGTemplateResult, TemplateResult } from "lit"
import type { ChartConfig, ChartLegendItem, ChartRow, ChartTooltipItem } from "./chart-config.js"
import type { Point } from "./chart-engine.js"
import type { TecChartTooltip } from "./chart-tooltip.js"

/** A rectangle in the chart's logical coordinates (`x` from the inline start). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** The part of every model the element reads. */
export interface ChartModelBase {
  /** The kind's `id`. */
  kind: string
  /** The plot area: the tooltip is kept inside it. */
  plot: Rect
  /** How many items the keyboard moves between (categories, points, slices, nodes…). */
  count: number
}

/** The tooltip's content for one item. */
export interface ChartPayload {
  label: unknown
  items: ChartTooltipItem[]
}

/** The logical sides of the space around the plot, in pixels. */
export interface ChartInsets {
  top: number
  end: number
  bottom: number
  start: number
}

/** Something a chart part class can be checked against. */
export type PartClass<T extends Element> = abstract new (...args: never[]) => T

/** What a kind knows about the chart it draws. Rebuilt for every render. */
export interface ChartContext {
  /** The `<tec-chart>` element. */
  host: HTMLElement & {
    type?: string
    orientation: "vertical" | "horizontal"
    stacked: boolean
    barGap: number
    barCategoryGap: number
    categoryKey?: string
  }
  width: number
  height: number
  rows: ChartRow[]
  config: ChartConfig
  /** The chart's `margin`, with the defaults applied. */
  margin: ChartInsets
  /** The chart's locale (`undefined`: the browser's). */
  locale: string | undefined
  /** Whether the chart reads right to left. */
  rtl: boolean
  /** The active (highlighted) item, or -1. */
  active: number
  /** Whether the active item was reached with the keyboard. */
  keyboard: boolean
  /** The chart's `tec-chart-tooltip`, if any. */
  tooltip?: TecChartTooltip
  /** The CSS font of the chart (`"<weight> <size> <family>"`), for measuring text. */
  font: string
  fontSize: number
  /** Width of `text` in the chart's font, in pixels. */
  measure(text: string): number
  /** The chart's direct children of a part class, without the `hidden` ones, in document order. */
  parts<T extends Element>(ctor: PartClass<T>): T[]
  /** The children of `parent` of a part class, without the `hidden` ones (e.g. a series' label list). */
  childParts<T extends Element>(parent: Element, ctor: PartClass<T>): T[]
  /**
   * The colour of a series: `explicit`, else the config entry's colour
   * (`var(--tec-chart-color-<key>)`), else the palette in series order.
   */
  seriesColor(key: string, index: number, explicit?: string): string
  /**
   * The colour of one row of a per-row chart (pie, funnel, treemap…): the row's `fill`, else the
   * config entry of its name, else the palette in row order.
   */
  rowColor(row: ChartRow | undefined, name: string, index: number): string
  /** The palette colour for an index (`var(--tec-chart-1)` … `var(--tec-chart-5)`, repeating). */
  palette(index: number): string
  /** A category's (or name's) text: its config label, else the value formatted for the locale. */
  text(value: unknown): string
  /** The chart's accessible name. */
  name(): string
  /** Asks the element to render again (e.g. after a part inside the SVG changed its own state). */
  requestUpdate(): void
}

/** A chart family: bar/line/area, pie, radar… */
export interface ChartKind<M extends ChartModelBase = ChartModelBase> {
  /** Stored in `model.kind`. */
  id: string
  /** Whether this kind draws the chart (the first kind that claims it wins). */
  claims(ctx: ChartContext): boolean
  /** The chart's default accessible name, e.g. "Radar chart". */
  label(ctx: ChartContext): string
  /** The geometry, or `undefined` when there is nothing to draw. */
  model(ctx: ChartContext): M | undefined
  /** The marks, inside the `<svg>`. */
  render(model: M, ctx: ChartContext): SVGTemplateResult
  /** Whether the geometry is mirrored in right-to-left (the render is wrapped in `.mirror`). */
  mirrored?: boolean
  /** The tooltip content of an item. */
  payload(model: M, index: number, ctx: ChartContext): ChartPayload
  /** Where the tooltip points for an item reached with the keyboard (logical coordinates). */
  anchor(model: M, index: number, ctx: ChartContext): Point | undefined
  /**
   * The item under the pointer (-1 for none). `point` is in logical coordinates (mirrored in RTL
   * when the kind is `mirrored`); `target` is the SVG element under the pointer that carries a
   * `data-index` attribute (the mark, when marks are rendered with `data-index`).
   */
  hit(model: M, point: Point, target: Element | undefined, ctx: ChartContext): number
  /** The visually hidden data table (the text alternative). */
  table(model: M, ctx: ChartContext): TemplateResult | typeof nothing
  /** The legend entries. */
  legend(model: M, ctx: ChartContext): ChartLegendItem[]
  /** HTML drawn after the plot, inside the chart (e.g. a brush's range controls). */
  overlay?(model: M, ctx: ChartContext): TemplateResult | typeof nothing
  /** A pointer press on the plot; return `true` when handled (no item activation). */
  pointerDown?(model: M, point: Point, event: PointerEvent, ctx: ChartContext): boolean
  /**
   * A key press on the plot, before the element's own arrow/Home/End/Escape handling. Return the
   * item to make active (-1 for none) when the kind handled the key — it is looked up in the model
   * rendered next, so a kind that changes what it draws (e.g. zooms) returns an index in its new
   * model — or `undefined` to let the element handle the key.
   */
  keyDown?(model: M, event: KeyboardEvent, ctx: ChartContext): number | undefined
}

/** Parses a number from a data value (`null` for missing or non-numeric values). */
export function numeric(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}
