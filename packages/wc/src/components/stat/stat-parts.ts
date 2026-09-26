import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { Minus, TrendingDown, TrendingUp } from "lucide"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { statDeltaStyles, statHelpStyles, statLabelStyles, statValueStyles } from "./stat.styles.js"

/** Which way the number moved (picks the icon). */
export type StatTrend = "up" | "down" | "flat"
/** Whether the move is good news (picks the colour). */
export type StatTone = "positive" | "negative" | "neutral"

const toneOfTrend: Record<StatTrend, StatTone> = { up: "positive", down: "negative", flat: "neutral" }

/**
 * @summary The label of a stat (small, muted, truncated to one line).
 *
 * @tag tec-stat-label
 *
 * @slot - The label text.
 *
 * @csspart base - The truncating text box.
 */
export class TecStatLabel extends TectonElement {
  static styles = [hostStyles, statLabelStyles]

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

/**
 * @summary The value of a stat, in the mono face with tabular numbers, with an optional unit.
 *
 * @tag tec-stat-value
 *
 * @slot - The number.
 * @slot unit - A rich unit (instead of the `unit` attribute).
 *
 * @csspart base - The baseline-aligned row of value and unit.
 * @csspart unit - The unit (sans, 0.6em, muted).
 *
 * @cssprop --tec-stat-value-size - Font size of the value (set by the parent `tec-stat`'s `size`).
 */
export class TecStatValue extends TectonElement {
  static styles = [hostStyles, statValueStyles]

  /** The unit rendered after the value ("USD", "MSm³"). Keep it out of the number. */
  @property() unit = ""

  #slots = new HasSlotController(this, "unit")

  protected override render() {
    const hasUnit = !!this.unit || this.#slots.test("unit")
    return html`<span class="base" part="base"
      ><slot></slot>${hasUnit ? html`<span class="unit" part="unit"><slot name="unit">${this.unit}</slot></span>` : nothing}</span
    >`
  }
}

/**
 * The icon follows `trend`; the colour follows `tone`, which says whether the change is good news
 * rather than which way it went. It defaults to the trend's (up positive, down negative, flat
 * neutral): set `tone="positive"` on a falling cost, CAPEX, downtime or risk.
 *
 * @summary The change of a stat against a baseline: trend icon and coloured text.
 *
 * @tag tec-stat-delta
 *
 * @slot - The change ("+3.4%", "-6 d vs. plan").
 *
 * @csspart base - The row of icon and text.
 * @csspart icon - The trend icon.
 *
 * @cssstate positive - The resolved tone is positive (success colour).
 * @cssstate negative - The resolved tone is negative (destructive colour).
 * @cssstate neutral - The resolved tone is neutral (muted colour).
 */
export class TecStatDelta extends TectonElement {
  static styles = [hostStyles, statDeltaStyles]

  /** Which way the number moved: picks the icon. */
  @property({ reflect: true }) trend: StatTrend = "flat"

  /** Whether the move is good or bad: picks the colour. Defaults to the trend's. */
  @property({ reflect: true }) tone?: StatTone

  /** The tone after applying the trend's default. */
  get resolvedTone(): StatTone {
    return this.tone ?? toneOfTrend[this.trend] ?? "neutral"
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const tone = this.resolvedTone
    for (const t of ["positive", "negative", "neutral"] as const) this.toggleState(t, t === tone)
  }

  protected override render() {
    const node = this.trend === "up" ? TrendingUp : this.trend === "down" ? TrendingDown : Minus
    return html`<span class="base" part="base">${icon(node, { size: 12, part: "icon" })}<slot></slot></span>`
  }
}

/**
 * @summary Helper text under a stat (baseline, scenario, period).
 *
 * @tag tec-stat-help
 *
 * @slot - The text.
 */
export class TecStatHelp extends TectonElement {
  static styles = [hostStyles, statHelpStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-stat-label": TecStatLabel
    "tec-stat-value": TecStatValue
    "tec-stat-delta": TecStatDelta
    "tec-stat-help": TecStatHelp
  }
}
