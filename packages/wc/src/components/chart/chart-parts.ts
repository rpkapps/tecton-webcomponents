/**
 * @module chart-parts
 * The declarative parts of a `<tec-chart>`: series (`tec-chart-bar`, `tec-chart-line`,
 * `tec-chart-area`, `tec-chart-pie`), axes (`tec-chart-x-axis`, `tec-chart-y-axis`) and the grid
 * (`tec-chart-grid`). They render nothing themselves: the parent chart reads their properties and
 * draws them in its own SVG, and re-draws whenever one of them changes.
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
    ;(this.parentElement as PartHost | null)?.partChanged?.()
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

/**
 * @summary A pie (or, with `inner-radius`, donut) series of a `tec-chart`: one slice per data row.
 *
 * Slice colours come from the row's `fill` field, then from the config entry named by the row's
 * `name-key` value, then from the chart palette.
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

// ------------------------------------------------------------------------------------------ axes

/**
 * Base class of the axes.
 * @internal
 */
export class TecChartAxis extends TecChartPart {
  /** The data field of the category axis (the x axis of vertical charts, the y axis of horizontal ones). */
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

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-bar": TecChartBar
    "tec-chart-line": TecChartLine
    "tec-chart-area": TecChartArea
    "tec-chart-pie": TecChartPie
    "tec-chart-x-axis": TecChartXAxis
    "tec-chart-y-axis": TecChartYAxis
    "tec-chart-grid": TecChartGrid
  }
}
