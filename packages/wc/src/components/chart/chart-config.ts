/**
 * @module chart-config
 * The chart config (series key → label, colour, icon) and the helpers the chart, tooltip and legend
 * share to read it.
 */
import { html, nothing, type TemplateResult } from "lit"

/** What the tooltip, legend and data table show for one series (or one pie category). */
export interface ChartConfigEntry {
  /** Human-readable name. */
  label?: string
  /**
   * An icon shown instead of the colour swatch in the tooltip and legend: a Lit `svg`/`html`
   * template, an element (cloned for every use — e.g. lucide's `createElement(Monitor)`), or a
   * function returning either.
   */
  icon?: TemplateResult | Element | (() => TemplateResult | Element)
  /** Any CSS colour: `var(--tec-chart-1)`, `oklch(…)`, `#2563eb`. */
  color?: string
  /** Separate colours for the light and dark theme (instead of `color`). */
  theme?: { light: string; dark: string }
}

/**
 * The chart config: one entry per data key (series) or per category value (pie slices). It is
 * decoupled from the data, so one config can be shared by several charts.
 *
 * ```ts
 * chart.config = {
 *   desktop: { label: "Desktop", color: "var(--tec-chart-1)" },
 *   mobile: { label: "Mobile", theme: { light: "var(--tec-chart-2)", dark: "var(--tec-chart-5)" } },
 * }
 * ```
 */
export type ChartConfig = Record<string, ChartConfigEntry>

/** One row of chart data. Any shape: series and axes pick their fields with `key`. */
export type ChartRow = Record<string, unknown>

/** One entry of a tooltip: a series value at the active category (or the active pie slice). */
export interface ChartTooltipItem {
  /** The series' data key. */
  dataKey?: string
  /** The item name: the series key, or the category name for a pie slice. */
  name: string
  /** The value. Numbers are shown with `toLocaleString()`. */
  value: unknown
  /** Indicator colour (any CSS colour). */
  color?: string
  /** The data row the value comes from. */
  row?: ChartRow
}

/** One entry of a legend. */
export interface ChartLegendItem {
  /** The series' data key (for a pie: the category name). */
  dataKey?: string
  /** Swatch colour. */
  color: string
  /** The data row of a pie slice. */
  row?: ChartRow
}

/** The custom property a config key's colour is exposed as: `desktop` → `--tec-chart-color-desktop`. */
export function colorProperty(key: string): string {
  return `--tec-chart-color-${String(key).replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

/** The CSS colour of a config entry (`theme` becomes `light-dark(light, dark)`), if it has one. */
export function entryColor(entry: ChartConfigEntry | undefined): string | undefined {
  if (!entry) return undefined
  if (entry.theme) return `light-dark(${entry.theme.light}, ${entry.theme.dark})`
  return entry.color
}

/** `{ "--tec-chart-color-desktop": "var(--tec-chart-1)", … }` for every entry with a colour. */
export function configStyles(config: ChartConfig): Record<string, string> {
  const styles: Record<string, string> = {}
  for (const [key, entry] of Object.entries(config ?? {})) {
    const color = entryColor(entry)
    if (color) styles[colorProperty(key)] = color
  }
  return styles
}

/**
 * The config entry for a tooltip or legend item: when the item (or its data row) has a string
 * under `key`, that string is the config key (`name-key="browser"` → `row.browser` = `"chrome"` →
 * `config.chrome`); otherwise `key` itself is.
 */
export function itemConfig(config: ChartConfig, item: object | undefined, key: string): ChartConfigEntry | undefined {
  if (!item) return undefined
  let configKey = key
  const own = (item as Record<string, unknown>)[key]
  const row = (item as { row?: ChartRow }).row
  if (typeof own === "string") configKey = own
  else if (row && typeof row[key] === "string") configKey = row[key] as string
  return config[configKey] ?? config[key]
}

/** Renders a config icon (see {@link ChartConfigEntry.icon}). */
export function renderIcon(icon: ChartConfigEntry["icon"]): unknown {
  if (!icon) return nothing
  const value = typeof icon === "function" ? icon() : icon
  if (value instanceof Element) {
    const clone = value.cloneNode(true) as Element
    clone.setAttribute("aria-hidden", "true")
    return clone
  }
  return html`${value}`
}

/** Formats a value the way the tooltip and data table show it. */
export function formatValue(value: unknown, locale?: string): string {
  if (typeof value === "number") return value.toLocaleString(locale)
  if (value == null) return ""
  return String(value)
}

/** The language of `el` (nearest `lang` attribute), or undefined for the browser default. */
export { localeOf } from "../../internal/locale.js"
