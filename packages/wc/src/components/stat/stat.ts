import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { statGroupStyles, statStyles } from "./stat.styles.js"

export { TecStatDelta, TecStatHelp, TecStatLabel, TecStatValue } from "./stat-parts.js"
export type { StatTone, StatTrend } from "./stat-parts.js"

/** Value size 14 / 20 / 28 px. */
export type StatSize = "sm" | "md" | "lg"
/** Alignment of the parts. */
export type StatAlign = "start" | "center" | "end"

/**
 * Compose `tec-stat-label`, `tec-stat-value` (with its `unit`), `tec-stat-delta` and
 * `tec-stat-help` inside it. The value is set in the mono face with tabular numbers, so a row of
 * stats lines up. The element itself is the flex column, so layout classes on it (`gap-1`,
 * `items-center`) apply.
 *
 * @summary A KPI readout: label, value with unit, trend delta and helper text.
 *
 * @tag tec-stat
 *
 * @slot - The parts: `tec-stat-label`, `tec-stat-value`, `tec-stat-delta`, `tec-stat-help`.
 *
 * @cssstate align-center - `align="center"`.
 * @cssstate align-end - `align="end"`.
 */
export class TecStat extends TectonElement {
  static styles = [hostStyles, statStyles]

  /** Scales the value: 14 / 20 / 28 px. */
  @property({ reflect: true }) size: StatSize = "md"

  /** Aligns the parts (logical: `end` is the right edge in LTR). Not reflected (an `align` attribute is a legacy presentational hint). */
  @property() align: StatAlign = "start"

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("align-center", this.align === "center")
    this.toggleState("align-end", this.align === "end")
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * The element itself is the grid, so layout classes on it (`gap-8`, `grid-cols-2`) apply.
 *
 * @summary Lays out several `tec-stat`s in a responsive grid (as many columns of at least 7rem as fit).
 *
 * @tag tec-stat-group
 *
 * @slot - `tec-stat` elements.
 *
 * @cssprop --tec-stat-group-min-width - Minimum column width (default 7rem).
 */
export class TecStatGroup extends TectonElement {
  static styles = [hostStyles, statGroupStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-stat": TecStat
    "tec-stat-group": TecStatGroup
  }
}
