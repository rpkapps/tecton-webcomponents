/**
 * @module locale
 * Locale helpers for `Intl` formatting. The language of an element is the closest `lang` attribute
 * on it or an ancestor, crossing shadow roots (like the `:lang()` selector); `undefined` lets `Intl`
 * use the browser's default.
 */

/** The language of `el` (closest `lang`, crossing shadow roots), for `Intl` formatting. */
export function localeOf(el: Element): string | undefined {
  let node: Node | null = el
  while (node) {
    if (node instanceof Element) {
      const lang = node.getAttribute("lang")
      if (lang) return lang
    }
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
  }
  return undefined
}

/**
 * Formats `value` in the range `min`–`max` like React Aria's progress bar / meter value text: a
 * percentage of the range by default, or the clamped value formatted with `options`.
 */
export function formatRangeValue(
  el: Element,
  value: number,
  min: number,
  max: number,
  options: Intl.NumberFormatOptions | null | undefined
): string {
  const opts = options ?? { style: "percent" }
  const clamped = Math.min(max, Math.max(min, value))
  const range = max - min
  const share = range > 0 ? (clamped - min) / range : 0
  return new Intl.NumberFormat(localeOf(el), opts).format(opts.style === "percent" ? share : clamped)
}
