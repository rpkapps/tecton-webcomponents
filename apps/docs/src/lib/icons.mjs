// Lucide icons as SVG strings / hast nodes for the docs chrome (server side only).
import { icons } from "lucide"

const pascal = (name) =>
  name.replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => c.toUpperCase())

/** Icon node of a lucide icon by kebab name (`arrow-right`). */
export function iconNode(name) {
  const node = icons[pascal(name)]
  if (!node) throw new Error(`Unknown lucide icon "${name}"`)
  return node
}

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")

/** `<svg>` markup of a lucide icon. */
export function iconSvg(name, { class: className = "size-4", ...attrs } = {}) {
  const children = iconNode(name)
    .map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${escape(v)}"`).join(" ")}/>`)
    .join("")
  const extra = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${escape(className)}"${extra}>${children}</svg>`
}

/** hast element of a lucide icon (for shiki transformers). */
export function iconHast(name, className = "size-4") {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ariaHidden: "true",
      className: className.split(" "),
    },
    children: iconNode(name).map(([tagName, properties]) => ({
      type: "element",
      tagName,
      properties: { ...properties },
      children: [],
    })),
  }
}
