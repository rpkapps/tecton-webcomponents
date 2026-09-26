import { html, nothing } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { itemConfig, renderIcon, type ChartConfig, type ChartLegendItem } from "./chart-config.js"
import { legendStyles } from "./chart.styles.js"

/**
 * @summary The legend of a `tec-chart`: a swatch (or the config icon) and the config label of every
 * series — or of every slice of a pie. Place it inside the chart.
 *
 * @tag tec-chart-legend
 *
 * @csspart base - The row of entries (centred, wrapping).
 * @csspart item - One entry.
 * @csspart swatch - The colour swatch of an entry.
 * @csspart label - The label of an entry.
 */
export class TecChartLegend extends TectonElement {
  static styles = [hostStyles, legendStyles]

  /** Places the legend above or below the plot. */
  @property({ reflect: true, attribute: "vertical-align" }) verticalAlign: "top" | "bottom" = "bottom"

  /** Shows swatches even for entries whose config has an icon. */
  @property({ type: Boolean, attribute: "hide-icon" }) hideIcon = false

  /** The config (or data) key whose label names each entry, instead of the series key. */
  @property({ attribute: "name-key" }) nameKey?: string

  /** The entries (set by the chart). */
  @property({ attribute: false }) items: ChartLegendItem[] = []

  /** The chart config (set by the chart). */
  @property({ attribute: false }) config: ChartConfig = {}

  protected render() {
    if (!this.items?.length) return nothing
    return html`<div part="base" class="base">${this.items.map((item) => {
      const key = `${this.nameKey ?? item.dataKey ?? "value"}`
      const entry = itemConfig(this.config ?? {}, item, key)
      return html`
        <div part="item" class="item">
          ${entry?.icon && !this.hideIcon
            ? html`<span class="icon">${renderIcon(entry.icon)}</span>`
            : html`<span part="swatch" class="swatch" style=${styleMap({ backgroundColor: item.color })}></span>`}
          <span part="label">${entry?.label ?? item.dataKey}</span>
        </div>
      `
    })}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-legend": TecChartLegend
  }
}
