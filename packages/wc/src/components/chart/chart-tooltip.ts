import { html, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { formatValue, itemConfig, localeOf, renderIcon, type ChartConfig, type ChartConfigEntry, type ChartTooltipItem } from "./chart-config.js"
import { tooltipStyles } from "./chart.styles.js"

export type ChartTooltipIndicator = "dot" | "line" | "dashed"

/** Formats the tooltip label: receives the label value and the tooltip items. */
export type ChartLabelFormatter = (label: unknown, items: ChartTooltipItem[]) => string | TemplateResult

/** Renders one tooltip row instead of the default indicator + name + value. */
export type ChartValueFormatter = (
  value: unknown,
  name: string,
  item: ChartTooltipItem,
  index: number,
  row: ChartTooltipItem["row"]
) => unknown

/** The options that decide what a tooltip shows (the tooltip's own properties). */
export interface TooltipResolveOptions {
  config: ChartConfig
  items: ChartTooltipItem[]
  label: unknown
  hideLabel?: boolean
  labelKey?: string
  nameKey?: string
  labelFormatter?: ChartLabelFormatter
}

/** A tooltip row, resolved against the config. */
export interface ResolvedTooltipItem {
  item: ChartTooltipItem
  entry: ChartConfigEntry | undefined
  name: string
}

/**
 * Resolves the tooltip label and row names against the config, the way the tooltip renders them.
 * The label is `undefined` when there is none to show.
 */
export function resolveTooltip(options: TooltipResolveOptions): { label: unknown; items: ResolvedTooltipItem[] } {
  const { config = {}, items, label, hideLabel, labelKey, nameKey, labelFormatter } = options
  let resolvedLabel: unknown
  const first = items[0]
  if (!hideLabel && first) {
    const key = `${labelKey ?? first.dataKey ?? first.name ?? "value"}`
    const entry = itemConfig(config, first, key)
    const value = !labelKey && typeof label === "string" ? (config[label]?.label ?? label) : entry?.label
    resolvedLabel = labelFormatter ? labelFormatter(value, items) : value || undefined
  }
  return {
    label: resolvedLabel,
    items: items.map((item) => {
      const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`
      const entry = itemConfig(config, item, key)
      return { item, entry, name: entry?.label ?? item.name }
    }),
  }
}

/**
 * Size the tooltip with classes on the element (`class="w-[150px]"`); the box fills it.
 *
 * @summary The tooltip of a `tec-chart`: the active category's label and one row per series with
 * an indicator, the series name and its value. Place it inside the chart; it follows the pointer and
 * the keyboard. With `standalone` it renders in place (for documentation and custom layouts).
 *
 * @tag tec-chart-tooltip
 *
 * @csspart base - The tooltip box (border, background, padding, shadow).
 * @csspart label - The label (the category name).
 * @csspart items - The list of rows.
 * @csspart item - One row.
 * @csspart indicator - The colour indicator of a row.
 * @csspart name - The series name of a row.
 * @csspart value - The value of a row.
 *
 * @cssstate active - The tooltip is shown.
 */
export class TecChartTooltip extends TectonElement {
  static styles = [hostStyles, tooltipStyles]

  /** Indicator style of each row. */
  @property({ reflect: true }) indicator: ChartTooltipIndicator = "dot"

  /** Hides the label. */
  @property({ type: Boolean, attribute: "hide-label" }) hideLabel = false

  /** Hides the colour indicators. */
  @property({ type: Boolean, attribute: "hide-indicator" }) hideIndicator = false

  /** Hides the cursor (the highlighted band or line under the pointer). */
  @property({ type: Boolean, attribute: "hide-cursor" }) hideCursor = false

  /** The config (or data) key whose label is the tooltip label, instead of the category. */
  @property({ attribute: "label-key" }) labelKey?: string

  /** The config (or data) key whose label names each row, instead of the series key. */
  @property({ attribute: "name-key" }) nameKey?: string

  /** Overrides the indicator colour of every row. */
  @property() color?: string

  /** Renders in place (not positioned, always visible) — for a tooltip outside a chart. */
  @property({ type: Boolean, reflect: true }) standalone = false

  /**
   * The label. Inside a chart it is set to the active category's value; set it yourself on a
   * `standalone` tooltip.
   */
  @property() label?: unknown

  /** The rows. Inside a chart they are set to the active category's values. */
  @property({ attribute: false }) payload: ChartTooltipItem[] = []

  /** The chart config (set by the chart). */
  @property({ attribute: false }) config: ChartConfig = {}

  /** Formats the label: `(label, items) => string`. */
  @property({ attribute: false }) labelFormatter?: ChartLabelFormatter

  /** Renders a row's content: `(value, name, item, index, row) => string | TemplateResult`. */
  @property({ attribute: false }) formatter?: ChartValueFormatter

  /** Whether the chart shows the tooltip (set by the chart). @internal */
  @property({ attribute: false }) active = false

  #shown = false

  /** Moves the tooltip to `(x, y)` (pixels from the chart's top-left corner). @internal */
  place(x: number, y: number): void {
    const animate = this.#shown
    this.toggleState("moving", animate)
    this.style.translate = `${Math.round(x)}px ${Math.round(y)}px`
    this.#shown = true
  }

  /** The plain-text content (what a screen reader announces for the active point). @internal */
  describe(): string {
    const { label, items } = this.#resolve()
    const locale = localeOf(this)
    const labelText = typeof label === "string" || typeof label === "number" ? String(label) : ""
    const rows = items.map(({ item, name }) => `${name} ${formatValue(item.value, locale)}`.trim())
    return [labelText, ...rows].filter(Boolean).join(", ")
  }

  #resolve() {
    return resolveTooltip({
      config: this.config,
      items: this.payload ?? [],
      label: this.label,
      hideLabel: this.hideLabel,
      labelKey: this.labelKey,
      nameKey: this.nameKey,
      labelFormatter: this.labelFormatter,
    })
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    const visible = (this.standalone || this.active) && (this.payload?.length ?? 0) > 0
    this.toggleState("active", visible)
    if (!visible) {
      this.#shown = false
      this.toggleState("moving", false)
    }
    if (changed.has("hideCursor") && this.hasUpdated) {
      ;(this.parentElement as { partChanged?: () => void } | null)?.partChanged?.()
    }
  }

  protected render() {
    const payload = this.payload ?? []
    if (!payload.length) return nothing
    const { label, items } = this.#resolve()
    const nestLabel = payload.length === 1 && this.indicator !== "dot"
    const labelTemplate = label == null || label === "" ? nothing : html`<div part="label" class="label">${label}</div>`
    const locale = localeOf(this)
    return html`
      <div part="base" class="base" aria-hidden=${this.standalone ? nothing : "true"}>
        ${nestLabel ? nothing : labelTemplate}
        <div part="items" class="items">
          ${items.map(({ item, entry, name }, index) => {
            const color = this.color ?? (item.row?.fill as string | undefined) ?? item.color
            return html`
              <div part="item" class="item" data-indicator=${this.indicator} ?data-formatted=${!!(this.formatter && item.value !== undefined && item.name)}>
                ${this.formatter && item.value !== undefined && item.name
                  ? this.formatter(item.value, item.name, item, index, item.row)
                  : html`
                      ${entry?.icon
                        ? html`<span class="icon">${renderIcon(entry.icon)}</span>`
                        : this.hideIndicator
                          ? nothing
                          : html`<span
                              part="indicator"
                              class="indicator"
                              data-nested=${nestLabel ? "" : nothing}
                              style=${styleMap({ "--tec-chart-indicator": color })}
                            ></span>`}
                      <div class="text" data-nested=${nestLabel ? "" : nothing}>
                        <div class="names">
                          ${nestLabel ? labelTemplate : nothing}
                          <span part="name" class="name">${name}</span>
                        </div>
                        ${item.value != null ? html`<span part="value" class="value">${formatValue(item.value, locale)}</span>` : nothing}
                      </div>
                    `}
              </div>
            `
          })}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-tooltip": TecChartTooltip
  }
}
