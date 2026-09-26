// Reads the generated theme of @tecton/wc (src/styles/*.css) at build time, for the
// token and palette tables on the Theming page.
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const wcDir = () => {
  const candidates = [resolve(process.cwd(), "node_modules/@tecton/wc"), resolve(process.cwd(), "../../packages/wc")]
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0]
}

function read(relative: string) {
  const file = resolve(wcDir(), relative)
  return existsSync(file) ? readFileSync(file, "utf8") : ""
}

export interface CssBlock {
  selectors: string[]
  vars: Map<string, string>
}

/** Flat `selector { --a: b; }` blocks (comments stripped, nested at-rules ignored). */
export function parseBlocks(css: string): CssBlock[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const blocks: CssBlock[] = []
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((s) => s.trim()).filter(Boolean)
    const vars = new Map<string, string>()
    for (const decl of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(decl[1], decl[2].trim())
    blocks.push({ selectors, vars })
  }
  return blocks
}

type Mode = "light" | "dark"

function modeVars(blocks: CssBlock[], mode: Mode) {
  const vars = new Map<string, string>()
  for (const block of blocks) {
    const isRoot = block.selectors.includes(":root")
    const isMode = block.selectors.some((s) => s === `.${mode}` || s === `[data-theme="${mode}"]`)
    if (isRoot || isMode) for (const [k, v] of block.vars) vars.set(k, v)
  }
  return vars
}

let cache: ReturnType<typeof build> | undefined

function build() {
  const tokens = parseBlocks(read("src/styles/tokens.css"))
  const palette = parseBlocks(read("src/styles/palette.css"))
  const theme = parseBlocks(read("src/styles/theme.css"))
  const all = [...tokens, ...palette, ...theme]
  const vars = { light: modeVars(all, "light"), dark: modeVars(all, "dark") }

  /** A value with its var() references resolved for one mode. */
  const resolveValue = (value: string, mode: Mode, depth = 0): string => {
    if (depth > 10) return value
    return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/g, (_, name: string, fallback?: string) => {
      const next = vars[mode].get(name) ?? fallback
      return next === undefined ? `var(${name})` : resolveValue(next, mode, depth + 1)
    })
  }

  // --tec-* in declaration order (the :root blocks of theme.css).
  const themeVars = new Map<string, string>()
  for (const block of theme) {
    if (!block.selectors.includes(":root")) continue
    for (const [k, v] of block.vars) if (k.startsWith("--tec-")) themeVars.set(k, v)
  }

  // Palette ramps.
  const paletteVars = [...(palette.find((b) => b.selectors.includes(":root"))?.vars.keys() ?? [])].filter((k) =>
    k.startsWith("--tecton-palette-"),
  )
  const families: string[] = []
  const steps: string[] = []
  const shades: string[] = []
  for (const key of paletteVars) {
    const name = key.slice("--tecton-palette-".length)
    const m = /^(.*)-(\d+)$/.exec(name)
    if (!m) {
      shades.push(name)
      continue
    }
    if (!families.includes(m[1])) families.push(m[1])
    if (m[1] === families[0]) steps.push(m[2])
  }

  return { vars, resolveValue, themeVars, families, steps, shades }
}

export function getTheme() {
  cache ??= build()
  return cache
}

export interface TokenMapping {
  confidence?: string
  note?: string
  token?: string
}

/** Notes and confidence of the Tecton token mapping (tokens/tecton.map.json). */
export function getTokenNotes(): Map<string, TokenMapping> {
  const notes = new Map<string, TokenMapping>()
  const raw = read("tokens/tecton.map.json")
  if (!raw) return notes
  try {
    const map = JSON.parse(raw) as Record<string, Record<string, { dark?: string; confidence?: string; note?: string }>>
    for (const group of ["shadcn", "extra"]) {
      for (const [name, entry] of Object.entries(map[group] ?? {})) {
        notes.set(`--tec-${name}`, { confidence: entry.confidence, note: entry.note, token: entry.dark })
      }
    }
  } catch {
    // no notes
  }
  return notes
}

export const isColor = (value: string) => /^(#|rgb|hsl|oklch|oklab|color\(|light-dark)/i.test(value.trim())
