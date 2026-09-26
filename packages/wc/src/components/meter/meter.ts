import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { formatRangeValue } from "../circular-progress/circular-progress.js"
import { meterStyles } from "./meter.styles.js"

/** Track height 4 / 6 / 10 px. */
export type MeterSize = "sm" | "md" | "lg"
/** Fill colour. `auto` picks success / warning / error from the value; `custom` reads `--tec-meter-fill`. */
export type MeterColor = "default" | "success" | "warning" | "error" | "info" | "auto" | "custom"

/** The colour `color="auto"` picks for a percentage: ≥ 67 error, ≥ 34 warning, else success. */
export function meterAutoColor(percentage: number): "success" | "warning" | "error" {
  if (percentage >= 67) return "error"
  if (percentage >= 34) return "warning"
  return "success"
}

/**
 * The host is the `meter` (ElementInternals) with `aria-valuenow`/`min`/`max` and an
 * `aria-valuetext`: the `value-label` when set (so the announced value matches the one on screen),
 * else the formatted value. It is named by `label` (or the `label` slot, or `aria-label`).
 *
 * @summary A segmented gauge for risk, complexity or confidence readouts, with automatic colour by value.
 *
 * @tag tec-meter
 *
 * @slot label - A rich label (instead of the `label` attribute); it names the meter.
 *
 * @csspart base - The column holding the label row and the track.
 * @csspart header - The label row.
 * @csspart label - The label.
 * @csspart value - The value text at the end of the label row.
 * @csspart track - The row of segments.
 * @csspart segment - One segment (its background is the empty part).
 * @csspart fill - The filled part of a segment.
 *
 * @cssprop --tec-meter-fill - Fill colour with `color="custom"` (e.g. `var(--tec-chart-2)`).
 * @cssprop --tec-meter-height - Track height (defaults per size).
 *
 * @cssstate success - The resolved fill colour (also `warning`, `error`, `info`, `default`, `custom`); useful with `color="auto"`.
 */
export class TecMeter extends TectonElement {
  static styles = [hostStyles, meterStyles]

  /** The current value, between `min` and `max`. */
  @property({ type: Number }) value = 0

  /** The lowest value. */
  @property({ type: Number }) min = 0

  /** The highest value. State it whenever the scale is not 0–100. */
  @property({ type: Number }) max = 100

  /** Visible label (also the accessible name). */
  @property() label = ""

  /** Number of segments; `1` renders a continuous bar. */
  @property({ type: Number }) segments = 5

  /** Fill colour. */
  @property({ reflect: true }) color: MeterColor = "default"

  /** Track height and text size. */
  @property({ reflect: true }) size: MeterSize = "md"

  /** Shows the formatted value at the end of the label row. */
  @property({ type: Boolean, attribute: "show-value" }) showValue = false

  /** Custom value text (e.g. "High"), shown at the end of the label row and announced as `aria-valuetext`. */
  @property({ attribute: "value-label" }) valueLabel?: string

  /** `Intl.NumberFormat` options for the value (JSON as an attribute). Default `{ "style": "percent" }`. */
  @property({ attribute: "format-options", type: Object }) formatOptions: Intl.NumberFormatOptions = { style: "percent" }

  #slots = new HasSlotController(this, "label")
  #lastColor = ""

  /** The value as a percentage of the range (0–100), clamped. */
  get percentage(): number {
    const range = this.max - this.min
    if (!(range > 0)) return 0
    return Math.min(100, Math.max(0, ((this.value - this.min) / range) * 100))
  }

  /** The formatted value. */
  get valueText(): string {
    return formatRangeValue(this, this.value, this.min, this.max, this.formatOptions)
  }

  /** The fill colour after resolving `auto`. */
  get resolvedColor(): Exclude<MeterColor, "auto"> {
    return this.color === "auto" ? meterAutoColor(this.percentage) : this.color
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const i = this.internals
    i.role = "meter"
    i.ariaValueMin = String(this.min)
    i.ariaValueMax = String(this.max)
    i.ariaValueNow = String(Math.min(this.max, Math.max(this.min, this.value)))
    i.ariaValueText = this.valueLabel || this.valueText
    const slotted = this.querySelector(":scope > [slot='label']")
    i.ariaLabelledByElements = slotted ? [slotted] : null
    i.ariaLabel = !slotted && this.label ? this.label : null
    const color = this.resolvedColor
    if (color !== this.#lastColor) {
      if (this.#lastColor) this.toggleState(this.#lastColor, false)
      this.toggleState(color, true)
      this.#lastColor = color
    }
  }

  protected override render() {
    const count = Math.max(1, Math.floor(Number(this.segments) || 1))
    const filled = (this.percentage / 100) * count
    const hasLabel = !!this.label || this.#slots.test("label")
    const showValue = this.showValue || !!this.valueLabel
    return html`<div class="base" part="base">
      <div class="header" part="header" ?hidden=${!hasLabel && !showValue}>
        <span class="label" part="label" ?hidden=${!hasLabel}><slot name="label">${this.label}</slot></span>
        ${showValue ? html`<span class="value" part="value">${this.valueLabel || this.valueText}</span>` : nothing}
      </div>
      <div class="track" part="track" data-color=${this.resolvedColor}>
        ${Array.from({ length: count }, (_, index) => {
          const fill = Math.min(1, Math.max(0, filled - index))
          return html`<span class="segment" part="segment"><span class="fill" part="fill" style=${styleMap({ width: `${fill * 100}%` })}></span></span>`
        })}
      </div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-meter": TecMeter
  }
}
