/**
 * Pure layout arithmetic of `tec-resizable-group`. A layout is one size per panel, in percent of the
 * space the panels share (the group minus its handles), summing to 100.
 */

/** Resolved constraints of one panel, in percent. */
export interface PanelConstraints {
  minSize: number
  maxSize: number
  collapsible: boolean
  collapsedSize: number
  /** `undefined` when the panel has no `default-size`. */
  defaultSize?: number
}

/** What caused a resize. Keyboard steps snap collapsible panels open/closed across their minimum. */
export type ResizeTrigger = "keyboard" | "pointer" | "api"

const PRECISION = 10
const EPSILON = 1e-9

/** `a - b` with a tolerance: -1, 0 or 1. */
export function compare(a: number, b: number, precision = PRECISION): number {
  const x = Number(a.toFixed(precision))
  const y = Number(b.toFixed(precision))
  const d = x - y
  return Math.abs(d) < EPSILON ? 0 : d > 0 ? 1 : -1
}

export const equal = (a: number, b: number, precision = PRECISION) => compare(a, b, precision) === 0

export const layoutsEqual = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((size, i) => equal(size, b[i]!))

/**
 * Parses a size (`"25%"`, `"25"` = percent, `"320px"`, `"20rem"`, `"2em"`) into percent of
 * `available` px. Returns `undefined` for empty or invalid input.
 */
export function parseSize(value: string | number | null | undefined, available: number, fontSize = 16, rootFontSize = 16): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  if (typeof value === "number") return value
  const match = /^\s*(-?\d*\.?\d+)\s*(%|px|rem|em)?\s*$/.exec(value)
  if (!match) return undefined
  const n = Number(match[1])
  switch (match[2]) {
    case "px":
      return available > 0 ? (n / available) * 100 : undefined
    case "rem":
      return available > 0 ? ((n * rootFontSize) / available) * 100 : undefined
    case "em":
      return available > 0 ? ((n * fontSize) / available) * 100 : undefined
    default:
      return n
  }
}

/** Clamps `size` to the panel's constraints; collapsible panels snap closed below halfway to their minimum. */
export function constrainSize(c: PanelConstraints, size: number): number {
  if (compare(size, c.minSize) < 0) {
    if (c.collapsible) {
      const halfway = (c.collapsedSize + c.minSize) / 2
      size = compare(size, halfway) < 0 ? c.collapsedSize : c.minSize
    } else {
      size = c.minSize
    }
  }
  size = Math.min(c.maxSize, size)
  return Number(size.toFixed(PRECISION))
}

/** Normalises a layout to sum 100 and fits every panel into its constraints. */
export function validateLayout(layout: readonly number[], constraints: readonly PanelConstraints[]): number[] {
  let next = [...layout]
  const total = next.reduce((a, b) => a + b, 0)
  if (next.length && total > 0 && !equal(total, 100)) next = next.map((s) => (s / total) * 100)
  let remaining = 0
  for (let i = 0; i < next.length; i++) {
    const unsafe = next[i]!
    const safe = constrainSize(constraints[i]!, unsafe)
    if (unsafe !== safe) {
      remaining += unsafe - safe
      next[i] = safe
    }
  }
  if (!equal(remaining, 0)) {
    for (let i = 0; i < next.length; i++) {
      const prev = next[i]!
      const safe = constrainSize(constraints[i]!, prev + remaining)
      if (prev !== safe) {
        remaining -= safe - prev
        next[i] = safe
        if (equal(remaining, 0)) break
      }
    }
  }
  return next
}

/**
 * The initial layout: panels with a `defaultSize` get it, the others share the rest equally; then
 * validated against the constraints.
 */
export function initialLayout(constraints: readonly PanelConstraints[]): number[] {
  const fixed = constraints.reduce((sum, c) => sum + (c.defaultSize ?? 0), 0)
  const flexible = constraints.filter((c) => c.defaultSize === undefined).length
  const share = flexible ? Math.max(0, 100 - fixed) / flexible : 0
  return validateLayout(
    constraints.map((c) => c.defaultSize ?? share),
    constraints
  )
}

export interface AdjustOptions {
  /** Percent. Positive grows the panel before the handle (`pivot[0]`). */
  delta: number
  /** The layout the delta is relative to (the layout at drag start). */
  initialLayout: readonly number[]
  /** The current layout (returned unchanged when nothing can move). */
  prevLayout: readonly number[]
  constraints: readonly PanelConstraints[]
  /** Indices of the panels before and after the handle. */
  pivot: readonly [number, number]
  trigger: ResizeTrigger
}

/**
 * Moves a handle by `delta` percent: the panel on the growing side takes what the panels on the
 * shrinking side give up (nearest first, each down to its minimum or collapsed size). Keyboard steps
 * snap a collapsible panel between collapsed and its minimum.
 */
export function adjustLayout(options: AdjustOptions): number[] {
  const { initialLayout: initial, prevLayout, constraints, pivot, trigger } = options
  let delta = options.delta
  if (equal(delta, 0)) return [...initial]
  const [first, second] = pivot
  const next = [...initial]

  if (trigger === "keyboard") {
    // Expanding a collapsed panel jumps to its minimum.
    {
      const index = delta < 0 ? second : first
      const c = constraints[index]!
      if (c.collapsible && equal(initial[index]!, c.collapsedSize)) {
        const local = c.minSize - initial[index]!
        if (compare(local, Math.abs(delta)) > 0) delta = delta < 0 ? -local : local
      }
    }
    // Shrinking a panel at its minimum collapses it.
    {
      const index = delta < 0 ? first : second
      const c = constraints[index]!
      if (c.collapsible && equal(initial[index]!, c.minSize)) {
        const local = initial[index]! - c.collapsedSize
        if (compare(local, Math.abs(delta)) > 0) delta = delta < 0 ? -local : local
      }
    }
  }

  // The most the growing side can take.
  {
    const step = delta < 0 ? 1 : -1
    let index = delta < 0 ? second : first
    let available = 0
    while (index >= 0 && index < constraints.length) {
      available += constrainSize(constraints[index]!, 100) - initial[index]!
      index += step
    }
    const abs = Math.min(Math.abs(delta), Math.abs(available))
    delta = delta < 0 ? -abs : abs
  }

  // Take the delta from the shrinking side, nearest panel first.
  let applied = 0
  {
    let index = delta < 0 ? first : second
    while (index >= 0 && index < constraints.length) {
      const remaining = Math.abs(delta) - Math.abs(applied)
      const prev = initial[index]!
      const safe = constrainSize(constraints[index]!, prev - remaining)
      if (!equal(prev, safe)) {
        applied += prev - safe
        next[index] = safe
        if (compare(applied, Math.abs(delta), 3) >= 0) break
      }
      index += delta < 0 ? -1 : 1
    }
  }
  if (layoutsEqual(prevLayout, next)) return [...prevLayout]

  // Give it to the growing side, nearest panel first.
  {
    const pivotIndex = delta < 0 ? second : first
    const unsafe = initial[pivotIndex]! + applied
    const safe = constrainSize(constraints[pivotIndex]!, unsafe)
    next[pivotIndex] = safe
    if (!equal(safe, unsafe)) {
      let remaining = unsafe - safe
      let index = pivotIndex
      while (index >= 0 && index < constraints.length) {
        const prev = next[index]!
        const s = constrainSize(constraints[index]!, prev + remaining)
        if (!equal(prev, s)) {
          remaining -= s - prev
          next[index] = s
        }
        if (equal(remaining, 0)) break
        index += delta > 0 ? -1 : 1
      }
    }
  }
  const total = next.reduce((a, b) => a + b, 0)
  if (!equal(total, 100, 6)) return [...prevLayout]
  return next
}
