import { html, nothing, svg, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { formatRangeValue } from "../../internal/locale.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { circularProgressStyles } from "./circular-progress.styles.js"

/** Diameter 16 / 24 / 40 / 64 / 96 px. */
export type CircularProgressSize = "xs" | "sm" | "md" | "lg" | "xl"
/** Ring colour; `default` is the shared `progress` token. */
export type CircularProgressColor = "default" | "foreground" | "success" | "warning" | "error" | "info"

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The host is the `progressbar` (ElementInternals): `aria-valuenow`/`min`/`max` and an
 * `aria-valuetext` equal to the text in the centre. It has no visible label, so give it an
 * `aria-label`. The value is formatted with `Intl.NumberFormat` in the element's language (`lang` on
 * any ancestor): a percentage by default, or `formatOptions`.
 *
 * @summary A determinate progress ring with an optional centred value, or an indeterminate spinner.
 *
 * @tag tec-circular-progress
 *
 * @slot - Custom centre content (e.g. `7/12` or an icon); replaces the value label.
 *
 * @csspart svg - The ring.
 * @csspart track - The background circle.
 * @csspart indicator - The value arc.
 * @csspart value - The centre label.
 *
 * @cssprop --tec-circular-progress-stroke - Stroke width in viewBox units (the ring is 48 units wide; defaults per size).
 */
export class TecCircularProgress extends TectonElement {
  static styles = [hostStyles, circularProgressStyles]

  /** The current value, between `min` and `max`. */
  @property({ type: Number }) value = 0

  /** The lowest value. */
  @property({ type: Number }) min = 0

  /** The highest value. */
  @property({ type: Number }) max = 100

  /** Unknown amount of work: a spinning arc, no value. */
  @property({ type: Boolean, reflect: true }) indeterminate = false

  /** Shows the formatted value in the centre (determinate only). */
  @property({ type: Boolean, attribute: "show-value" }) showValue = false

  /** Text shown (with `show-value`) and announced instead of the formatted value (e.g. "7 of 12"). */
  @property({ attribute: "value-label" }) valueLabel?: string

  /** `Intl.NumberFormat` options for the value (JSON as an attribute). Default `{ "style": "percent" }`, which shows the value as a share of the range. */
  @property({ attribute: "format-options", type: Object }) formatOptions: Intl.NumberFormatOptions = { style: "percent" }

  /** Diameter: `xs` 16px … `xl` 96px. Stroke and label size scale with it. */
  @property({ reflect: true }) size: CircularProgressSize = "md"

  /** Ring colour. */
  @property({ reflect: true }) color: CircularProgressColor = "default"

  #slots = new HasSlotController(this, "[default]")

  /** The value as a percentage of the range (0–100), clamped. */
  get percentage(): number {
    const range = this.max - this.min
    if (!(range > 0)) return 0
    return Math.min(100, Math.max(0, ((this.value - this.min) / range) * 100))
  }

  /** The formatted value (what the centre shows and `aria-valuetext` announces). */
  get valueText(): string {
    return this.valueLabel ?? formatRangeValue(this, this.value, this.min, this.max, this.formatOptions)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const i = this.internals
    i.role = "progressbar"
    if (this.indeterminate) {
      i.ariaValueNow = i.ariaValueMin = i.ariaValueMax = i.ariaValueText = null
    } else {
      i.ariaValueMin = String(this.min)
      i.ariaValueMax = String(this.max)
      i.ariaValueNow = String(Math.min(this.max, Math.max(this.min, this.value)))
      i.ariaValueText = this.valueText
    }
  }

  protected override render() {
    const pct = this.indeterminate ? 25 : this.percentage
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
    const custom = this.#slots.test("[default]")
    const showLabel = custom || (this.showValue && !this.indeterminate)
    return html`<svg part="svg" viewBox="0 0 48 48" aria-hidden="true">
        ${svg`<circle class="track" part="track" cx="24" cy="24" r=${RADIUS}></circle><circle class="indicator" part="indicator" cx="24" cy="24" r=${RADIUS} stroke-linecap="round" stroke-dasharray=${CIRCUMFERENCE} stroke-dashoffset=${offset}></circle>`}</svg
      ><span class="value" part="value" aria-hidden=${custom ? nothing : "true"} ?hidden=${!showLabel}
        ><slot>${showLabel && !custom ? this.valueText : nothing}</slot></span
      >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-circular-progress": TecCircularProgress
  }
}
