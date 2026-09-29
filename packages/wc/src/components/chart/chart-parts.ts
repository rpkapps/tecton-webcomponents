/**
 * @module chart-parts
 * The declarative parts of a cartesian `<tec-chart>`: series (`tec-chart-bar`, `tec-chart-line`,
 * `tec-chart-area`), axes (`tec-chart-x-axis`, `tec-chart-y-axis`) and the grid
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


// ------------------------------------------------------------------------------------------ cartesian extensions

/**
 * @summary TODO
 *
 * @tag tec-chart-scatter
 */
export class TecChartScatter extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-z-axis
 */
export class TecChartZAxis extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-reference-line
 */
export class TecChartReferenceLine extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-reference-area
 */
export class TecChartReferenceArea extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-reference-dot
 */
export class TecChartReferenceDot extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-error-bar
 */
export class TecChartErrorBar extends TecChartPart {}

/**
 * @summary TODO
 *
 * @tag tec-chart-brush
 */
export class TecChartBrush extends TecChartPart {}

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
   * Where the label sits relative to its mark: `top`, `bottom`, `start`, `end`, `inside`, `outside`,
   * `center`, `inside-start`, `inside-end` (not every position applies to every mark).
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
