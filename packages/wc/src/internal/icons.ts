/**
 * @module icons
 * Renders a [lucide](https://lucide.dev) icon node (the `lucide` package's framework-free data) as a
 * Lit template, for the icons components draw themselves (chevrons, checks, close buttons):
 *
 * ```ts
 * import { ChevronDown, Check } from "lucide"
 * import { icon } from "../../internal/icons.js"
 * render() { return html`<span part="indicator">${icon(Check, { size: 14 })}</span>` }
 * ```
 *
 * The SVG is decorative (`aria-hidden="true"`, `focusable="false"`) unless `label` is given, and uses
 * `currentColor`. Size it with `size` (px, sets width/height attributes) or CSS (`width`/`height` on
 * the `svg`, e.g. `var(--tec-icon-size)`), which wins over the attributes.
 *
 * For icons that authors choose (slotted), use `<tec-icon name="…">` or any inline SVG instead.
 */
import { html, type TemplateResult } from "lit"
import { ifDefined } from "lit/directives/if-defined.js"
import { unsafeSVG } from "lit/directives/unsafe-svg.js"
import type { IconNode } from "lucide"

export type { IconNode }

/** Options of {@link icon}. */
export interface IconOptions {
  /** Width and height in px. Default 24 (override with CSS). */
  size?: number
  /** Stroke width. Default 2 (lucide). */
  strokeWidth?: number
  /** Keep the stroke width constant in px across sizes (lucide `absoluteStrokeWidth`). */
  absoluteStrokeWidth?: boolean
  /** Accessible label; makes the SVG `role="img"`. Omit for decorative icons. */
  label?: string
  /** `class` attribute of the `<svg>`. */
  class?: string
  /** `part` attribute of the `<svg>`. */
  part?: string
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const markupCache = new WeakMap<IconNode, string>()

/** Serializes the child elements of a lucide icon node (cached per node). */
export function iconNodeMarkup(node: IconNode): string {
  let markup = markupCache.get(node)
  if (markup === undefined) {
    markup = node
      .map(([tag, attrs]) => {
        const a = Object.entries(attrs)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
          .join(" ")
        return `<${tag} ${a}></${tag}>`
      })
      .join("")
    markupCache.set(node, markup)
  }
  return markup
}

/** Renders `node` as an `<svg>` Lit template (see the module docs). */
export function icon(node: IconNode, options: IconOptions = {}): TemplateResult {
  const size = options.size ?? 24
  const stroke = options.strokeWidth ?? 2
  const strokeWidth = options.absoluteStrokeWidth ? (stroke * 24) / size : stroke
  return html`<svg
    xmlns="http://www.w3.org/2000/svg"
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width=${strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class=${ifDefined(options.class)}
    part=${ifDefined(options.part)}
    role=${ifDefined(options.label ? "img" : undefined)}
    aria-label=${ifDefined(options.label)}
    aria-hidden=${ifDefined(options.label ? undefined : "true")}
    focusable="false"
  >${unsafeSVG(iconNodeMarkup(node))}</svg>`
}
