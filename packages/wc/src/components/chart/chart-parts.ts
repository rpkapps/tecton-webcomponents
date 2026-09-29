/**
 * @module chart-parts
 * The declarative parts of a cartesian `<tec-chart>`: series (`tec-chart-bar`, `tec-chart-line`,
 * `tec-chart-area`, `tec-chart-scatter`), axes (`tec-chart-x-axis`, `tec-chart-y-axis`,
 * `tec-chart-z-axis`), the grid (`tec-chart-grid`), annotations (`tec-chart-reference-line`,
 * `tec-chart-reference-area`, `tec-chart-reference-dot`), parts placed inside a series
 * (`tec-chart-label-list`, `tec-chart-error-bar`) and the brush (`tec-chart-brush`). They render
 * nothing themselves: the parent chart reads their properties and draws them in its own SVG, and
 * re-draws whenever one of them changes.
 */
import { css, nothing } from "lit"
import { property } from "lit/decorators.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ChartCurve } from "./chart-engine.js"

/** Receives change notifications from its parts (implemented by `TecChart`). */
interface PartHost {
  partChanged?: () => void
}

/**
 * Base class of the configuration parts: hidden, and notifies the parent chart after every update.
 * @internal
 */
export class TecChartPart extends TectonElement {
  static styles = css`
    :host {
      display: none !important;
    }
  `

  protected render() {
    return nothing
  }

  protected updated(): void {
    // The nearest ancestor that draws parts: the chart, also for parts nested in a series.
    let el = this.parentElement as (HTMLElement & PartHost) | null
    while (el && !el.partChanged) el = el.parentElement
    el?.partChanged?.()
  }
}

/** Formats an axis tick: `(value, index) => string`. */
export type ChartTickFormatter = (value: unknown, index: number) => string

// ------------------------------------------------------------------------------------------ series

/**
 * Base class of cartesian series.
 * @internal
 */
export class TecChartSeries extends TecChartPart {
  /** The data field this series plots (also the key of its entry in the chart `config`). */
  @property({ reflect: true }) key = ""

  /**
   * The series colour. Defaults to the config entry's colour (`var(--tec-chart-color-<key>)`), then
   * to the chart palette (`--tec-chart-1` … `--tec-chart-5` in series order).
   */
  @property() color?: string

  /** Series with the same `stack` id are stacked on top of each other. */
  @property({ reflect: true }) stack?: string
}

/**
 * @summary A bar series of a `tec-chart`: one bar per category (horizontal bars with
 * `orientation="horizontal"` on the chart).
 *
 * @tag tec-chart-bar
 */
export class TecChartBar extends TecChartSeries {
  /**
   * Corner radius in pixels: one value for every corner (`"4"`) or four values
   * `"top-left top-right bottom-right bottom-left"` (`"0 0 4 4"` for the bottom segment of a stack).
   */
  @property() radius = "0"

  /** Maximum bar thickness in pixels. */
  @property({ type: Number, attribute: "max-bar-size" }) maxBarSize?: number
}

/**
 * @summary A line series of a `tec-chart`.
 *
 * @tag tec-chart-line
 */
export class TecChartLine extends TecChartSeries {
  /** Interpolation between points. */
  @property({ reflect: true }) curve: ChartCurve = "linear"

  /** Stroke width in pixels. */
  @property({ type: Number, attribute: "stroke-width" }) strokeWidth = 2

  /** Draws a dot on every data point. */
  @property({ type: Boolean }) dots = false

  /** Draws a dashed line. */
  @property({ type: Boolean }) dashed = false
}

/**
 * @summary An area series of a `tec-chart` (stack several with the same `stack` id).
 *
 * @tag tec-chart-area
 */
export class TecChartArea extends TecChartSeries {
  /** Interpolation between points. */
  @property({ reflect: true }) curve: ChartCurve = "linear"

  /** Opacity of the fill (0–1). */
  @property({ type: Number, attribute: "fill-opacity" }) fillOpacity = 0.4

  /** Fills with a vertical gradient (from 80% opacity at the top to 10% at the base) instead of a flat tint. */
  @property({ type: Boolean }) gradient = false

  /** Stroke width of the outline in pixels. */
  @property({ type: Number, attribute: "stroke-width" }) strokeWidth = 1

  /** Draws a dot on every data point. */
  @property({ type: Boolean }) dots = false
}

// ------------------------------------------------------------------------------------------ axes

/**
 * Base class of the axes.
 * @internal
 */
export class TecChartAxis extends TecChartPart {
  /**
   * The data field of the category axis (the x axis of vertical charts, the y axis of horizontal
   * ones); on the x axis of a scatter chart, the field of the x values.
   */
  @property({ reflect: true }) key?: string

  /** Space between the tick mark position and its label, in pixels. */
  @property({ type: Number, attribute: "tick-margin" }) tickMargin = 8

  /** Draws the small tick marks. */
  @property({ type: Boolean, attribute: "tick-line" }) tickLine = false

  /** Draws the axis line. */
  @property({ type: Boolean, attribute: "axis-line" }) axisLine = false

  /** Minimum gap between tick labels, in pixels; labels that would come closer are skipped. */
  @property({ type: Number, attribute: "min-tick-gap" }) minTickGap = 5

  /** Number of ticks of a value axis. */
  @property({ type: Number, attribute: "tick-count" }) tickCount = 5

  /** Formats the tick labels: `axis.tickFormatter = (value) => String(value).slice(0, 3)`. */
  @property({ attribute: false }) tickFormatter?: ChartTickFormatter

  /**
   * `number` places the rows of the category axis on a linear scale by the numeric value of `key`
   * (with nice ticks) instead of one slot per row. A scatter chart's x axis is always a number axis.
   */
  @property() type: "category" | "number" = "category"

  /**
   * The range of a number axis (or of the value axis): `"min,max"`, where each side is a number,
   * `auto` (a nice round value around the data) or `dataMin`/`dataMax` (the data's own extent).
   * `"auto"` alone is `"auto,auto"`. A domain that does not cover the data (or the reference
   * elements) is widened to include it. By default a value axis starts at zero and a number category
   * axis is `auto`.
   */
  @property() domain?: string

  /** The axis title, drawn beside the tick labels (rotated on the y axis) in space reserved for it. */
  @property() label?: string
}

/**
 * @summary The horizontal axis of a `tec-chart`: category labels (or values, in a horizontal chart)
 * along the bottom.
 *
 * @tag tec-chart-x-axis
 */
export class TecChartXAxis extends TecChartAxis {
  /** Height reserved for the axis, in pixels. */
  @property({ type: Number }) height = 30
}

/**
 * @summary The vertical axis of a `tec-chart`: values (or categories, in a horizontal chart) along
 * the start edge.
 *
 * @tag tec-chart-y-axis
 */
export class TecChartYAxis extends TecChartAxis {
  /** Width reserved for the axis, in pixels. */
  @property({ type: Number }) width = 60
}

/**
 * @summary The background grid of a `tec-chart`. Without attributes it draws lines at the value
 * ticks (horizontal lines in a vertical chart).
 *
 * @tag tec-chart-grid
 */
export class TecChartGrid extends TecChartPart {
  /** Draws horizontal lines. */
  @property({ type: Boolean }) horizontal = false

  /** Draws vertical lines. */
  @property({ type: Boolean }) vertical = false

  /** Draws dashed (`3 3`) lines. */
  @property({ type: Boolean }) dashed = false
}


// ------------------------------------------------------------------------------------------ cartesian extensions

/** The mark of a scatter series. */
export type ChartScatterShape = "circle" | "square" | "triangle" | "diamond" | "cross" | "star"

/**
 * The x value of every point comes from the `key` of the `tec-chart-x-axis`, which a scatter chart
 * treats as a number axis (`type="number"`); the y value comes from the series' own `key`. Rows
 * without a numeric x or y value have no point in the series, so several series can share one
 * `data` array. Add a `tec-chart-z-axis` to size the points by a third value (a bubble chart).
 *
 * The arrow keys move between the points in x order (series by series at equal x); the pointer
 * picks the nearest point within 24px.
 *
 * @summary A scatter series of a `tec-chart`: one mark per data row, placed by two numbers.
 *
 * @tag tec-chart-scatter
 */
export class TecChartScatter extends TecChartPart {
  /** The data field of the y values (also the key of the series' entry in the chart `config`). */
  @property({ reflect: true }) key = ""

  /**
   * The series colour. Defaults to the config entry's colour (`var(--tec-chart-color-<key>)`), then
   * to the chart palette in series order.
   */
  @property() color?: string

  /** The mark drawn at every point. */
  @property({ reflect: true }) shape: ChartScatterShape = "circle"

  /** Connects the points of the series (in x order) with a line. */
  @property({ type: Boolean }) line = false

  /** Opacity of the marks' fill (0–1): lower it where bubbles overlap. */
  @property({ type: Number, attribute: "fill-opacity" }) fillOpacity = 1

  /**
   * The data field that names each point (a well, a field…): the tooltip label and the data table's
   * row header. Without it the tooltip is labelled with the series name.
   */
  @property({ attribute: "name-key" }) nameKey?: string
}

/**
 * Without a z axis every point has the smallest radius of `range`. The mark's area grows linearly
 * with the value, so a bubble twice the value covers twice the area.
 *
 * @summary The size dimension of a scatter `tec-chart`: sizes every point by a third data field
 * (a bubble chart).
 *
 * @tag tec-chart-z-axis
 */
export class TecChartZAxis extends TecChartPart {
  /** The data field that sizes the points (its config entry names it in the tooltip and table). */
  @property({ reflect: true }) key?: string

  /** The smallest and largest mark radius in pixels, `"min,max"`. */
  @property() range = "4,4"
}

/**
 * How a reference element treats a value outside the axis domain: `extend-domain` widens the domain
 * to include it, `discard` does not draw it, `hidden` draws it clipped to the plot.
 */
export type ChartReferenceOverflow = "extend-domain" | "discard" | "hidden"

/**
 * Base class of the reference elements.
 * @internal
 */
export class TecChartReference extends TecChartPart {
  /** A text drawn with the reference (in the chart's text colour). */
  @property() label?: string

  /** What happens when the reference lies outside the axis domain. */
  @property({ attribute: "if-overflow" }) ifOverflow: ChartReferenceOverflow = "extend-domain"
}

/**
 * `y` draws a line across the plot at a value (a target, a threshold); `x` draws a line at a
 * category (the category's value, e.g. `x="March"`) or, on a number axis, at a number. In a
 * horizontal chart `x` is the value and `y` the category. Lines are drawn over the series.
 *
 * @summary A horizontal or vertical line marking a value or a category in a cartesian `tec-chart`.
 *
 * @tag tec-chart-reference-line
 */
export class TecChartReferenceLine extends TecChartReference {
  /** The x position: a category of the x axis, or a number on a number axis. */
  @property() x?: string

  /** The y position: a value (a category of the y axis in a horizontal chart). */
  @property() y?: string

  /** The line colour (any CSS colour). Defaults to the muted text colour. */
  @property() stroke?: string

  /** Draws a dashed line. */
  @property({ type: Boolean }) dashed = false

  /**
   * Where the label sits along the line: `start`, `center` or `end` (the inline start and end of a
   * horizontal line, the top and bottom of a vertical one).
   */
  @property({ attribute: "label-position" }) labelPosition: "start" | "center" | "end" = "end"
}

/**
 * Leave a side out to extend the area to that edge of the plot: `y1="200"` alone shades everything
 * above 200. On a category axis the area covers the categories from `x1` to `x2` inclusive. Areas are
 * drawn under the series.
 *
 * @summary A shaded rectangle marking a range of values or categories in a cartesian `tec-chart`.
 *
 * @tag tec-chart-reference-area
 */
export class TecChartReferenceArea extends TecChartReference {
  /** The start of the area along x (a category, or a number on a number axis). */
  @property() x1?: string

  /** The end of the area along x. */
  @property() x2?: string

  /** The start of the area along y (a value). */
  @property() y1?: string

  /** The end of the area along y. */
  @property() y2?: string

  /** The fill (any CSS colour). Defaults to a light tint of the muted text colour. */
  @property() fill?: string

  /** The opacity of the fill (0–1). */
  @property({ type: Number, attribute: "fill-opacity" }) fillOpacity = 0.12
}

/**
 * @summary A dot marking one (x, y) position in a cartesian `tec-chart`, with an optional label.
 *
 * @tag tec-chart-reference-dot
 */
export class TecChartReferenceDot extends TecChartReference {
  /** The x position: a category of the x axis, or a number on a number axis. */
  @property() x?: string

  /** The y position: a value (a category of the y axis in a horizontal chart). */
  @property() y?: string

  /** The radius in pixels. */
  @property({ type: Number }) r = 5

  /** The fill (any CSS colour). Defaults to the background colour, with a text-coloured ring. */
  @property() fill?: string

  /** The ring colour (any CSS colour). */
  @property() stroke?: string
}

/**
 * The error field of a row holds either one number (the bar spans value ± error) or a
 * `[below, above]` pair of distances. The value axis grows to include the whole bar, and the data
 * table lists the errors.
 *
 * @summary Error bars on the points of the series it is placed in (`tec-chart-bar`,
 * `tec-chart-line`, `tec-chart-scatter`).
 *
 * @tag tec-chart-error-bar
 */
export class TecChartErrorBar extends TecChartPart {
  /** The data field holding the error: a number (±) or a `[below, above]` array. */
  @property({ reflect: true }) key = ""

  /**
   * The axis the error runs along: `y` (vertical bars, lines, scatter) or `x` (horizontal bars,
   * scatter). Defaults to the value axis.
   */
  @property() direction?: "x" | "y"

  /** The width of the whiskers (the caps), in pixels. */
  @property({ type: Number }) width = 6

  /** The stroke colour (any CSS colour). Defaults to the text colour. */
  @property() stroke?: string
}

/**
 * The brush draws under the plot. The chart's series, axes, tooltip and keyboard navigation then
 * cover only the selected window of rows (indexes refer to the window); the visually hidden data
 * table keeps listing every row.
 *
 * Its two handles are sliders (`role="slider"`): Tab reaches them, the arrow keys move a handle by
 * one category (Page Up/Down by a tenth, Home/End to the ends), and the selected band between them
 * is a third slider that moves the whole window. With a pointer, drag a handle, or drag the band to
 * pan.
 *
 * @summary A range selector under a cartesian `tec-chart` that shows a window of the data.
 *
 * @tag tec-chart-brush
 *
 * @fires tec-range-change - The window changed by user interaction. `detail: { startIndex, endIndex }`.
 */
export class TecChartBrush extends TecChartPart {
  /** The index of the first row in the window. */
  @property({ type: Number, attribute: "start-index" }) startIndex = 0

  /** The index of the last row in the window (defaults to the last row). */
  @property({ type: Number, attribute: "end-index" }) endIndex?: number

  /** The height of the brush, in pixels. */
  @property({ type: Number }) height = 40

  /** Draws the first series of the chart, over every row, inside the brush. */
  @property({ type: Boolean }) preview = false

  /** The accessible name of the start handle. */
  @property({ attribute: "start-label" }) startLabel = "Start"

  /** The accessible name of the end handle. */
  @property({ attribute: "end-label" }) endLabel = "End"

  /** The accessible name of the band between the handles (moves the whole window). */
  @property({ attribute: "window-label" }) windowLabel = "Window"

  /** Sets the window and fires `tec-range-change`. @internal */
  select(startIndex: number, endIndex: number): void {
    if (startIndex === this.startIndex && endIndex === this.endIndex) return
    this.startIndex = startIndex
    this.endIndex = endIndex
    this.emit("tec-range-change", { detail: { startIndex, endIndex } })
  }
}

// ------------------------------------------------------------------------------------------ labels

/** Formats a label: `(value, row, index) => string`. */
export type ChartLabelListFormatter = (value: unknown, row: Record<string, unknown> | undefined, index: number) => string

/**
 * Place it inside a series element (`tec-chart-bar`, `tec-chart-line`, `tec-chart-area`,
 * `tec-chart-scatter`, `tec-chart-pie`, `tec-chart-radar`, `tec-chart-radial-bar`, `tec-chart-funnel`…).
 * Label sparingly: the axes, the tooltip and the data table carry the values that are not labelled.
 *
 * @summary Value labels drawn next to (or inside) the marks of the series it is placed in.
 *
 * @tag tec-chart-label-list
 */
export class TecChartLabelList extends TecChartPart {
  /** The data field to show. Defaults to the series' own value. */
  @property({ reflect: true }) key?: string

  /**
   * Where the label sits relative to its mark: `top`, `bottom`, `start`, `end` (outside the mark on
   * that side), `outside` (past the value end of a bar), `inside`/`center` (centred on the mark),
   * `inside-start`, `inside-end`, `inside-top`, `inside-bottom` (inside a bar, against that side).
   * `start` and `end` follow the reading direction. A label that does not fit inside its bar moves
   * outside, past the bar's value end, or is left out when there is no room there either (the value
   * stays in the tooltip and the data table).
   */
  @property({ reflect: true }) position = "top"

  /** Distance between the label and its mark, in pixels. */
  @property({ type: Number }) offset = 5

  /** Formats each label. */
  @property({ attribute: false }) formatter?: ChartLabelListFormatter
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-bar": TecChartBar
    "tec-chart-line": TecChartLine
    "tec-chart-area": TecChartArea
    "tec-chart-x-axis": TecChartXAxis
    "tec-chart-y-axis": TecChartYAxis
    "tec-chart-grid": TecChartGrid
    "tec-chart-scatter": TecChartScatter
    "tec-chart-z-axis": TecChartZAxis
    "tec-chart-reference-line": TecChartReferenceLine
    "tec-chart-reference-area": TecChartReferenceArea
    "tec-chart-reference-dot": TecChartReferenceDot
    "tec-chart-error-bar": TecChartErrorBar
    "tec-chart-brush": TecChartBrush
    "tec-chart-label-list": TecChartLabelList
  }
}
