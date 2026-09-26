/**
 * The icon registry `<tec-icon name="…">` reads from. The 18 Tecton domain icons are registered by
 * default; register any [Lucide](https://lucide.dev) icon (the framework-free `lucide` package) or
 * your own SVG markup under a name:
 *
 * ```ts
 * import { ChevronDown, Search } from "lucide"
 * import { registerIcons } from "@tecton/wc/icon/registry.js"
 * registerIcons({ ChevronDown, Search })          // → <tec-icon name="chevron-down">, name="search"
 * registerIcons({ logo: { viewBox: "0 0 24 24", svg: "<path d='…'/>" } })
 * ```
 *
 * Names are case-insensitive kebab-case (`ChevronDown` is stored as `chevron-down`). Elements already
 * on the page re-render when an icon they show is (re-)registered.
 */
import type { IconNode } from "lucide"
import { tectonIcons, type TectonIconData } from "../../icons/index.js"

/** Custom SVG markup (drawn with `currentColor` fills unless the markup says otherwise). */
export interface SvgIconDefinition {
  viewBox: string
  svg: string
  /** `"fill"` (default) paints with `fill="currentColor"`; `"stroke"` with a lucide-style stroke. */
  paint?: "fill" | "stroke"
}

/** Anything `<tec-icon>` can draw. */
export type IconDefinition = IconNode | TectonIconData | SvgIconDefinition

const registry = new Map<string, IconDefinition>()
const listeners = new Set<(name: string) => void>()

/** `ChevronDown` / `chevronDown` / `chevron_down` → `chevron-down`. */
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

/** Registers (or replaces) one icon. */
export function registerIcon(name: string, definition: IconDefinition): void {
  const key = normalizeIconName(name)
  registry.set(key, definition)
  for (const listener of listeners) listener(key)
}

/** Registers several icons, e.g. `registerIcons({ ChevronDown, Search })` with Lucide's exports. */
export function registerIcons(icons: Record<string, IconDefinition>): void {
  for (const [name, definition] of Object.entries(icons)) registerIcon(name, definition)
}

/** The definition registered under `name`, if any. */
export function getIcon(name: string): IconDefinition | undefined {
  return registry.get(normalizeIconName(name))
}

/** Every registered icon name. */
export function iconNames(): string[] {
  return [...registry.keys()]
}

/** Subscribes to registrations; returns the unsubscribe function. */
export function onIconRegistered(listener: (name: string) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether a definition is a Tecton icon (outlined + filled markup). */
export function isTectonIcon(definition: IconDefinition): definition is TectonIconData {
  return !Array.isArray(definition) && "outlined" in definition
}

/** Whether a definition is a Lucide icon node. */
export function isIconNode(definition: IconDefinition): definition is IconNode {
  return Array.isArray(definition)
}

for (const icon of tectonIcons) registry.set(icon.name, icon)
