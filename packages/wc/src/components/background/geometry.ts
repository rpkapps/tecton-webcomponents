/**
 * @module background/geometry
 * Framework-free geometry of the `<tec-background>` effects.
 *
 * Every effect is drawn from a fixed seed and fixed sizes, so its geometry is built once per page,
 * the first time an effect renders, and shared by every instance after that. Anything that depends
 * on attributes (colours, the contour palette) is derived from it at render.
 *
 * @internal
 */

/** Builds `build()` on first call and returns the cached value afterwards. */
export function once<T>(build: () => T): () => T {
  let cached: { value: T } | undefined
  return () => (cached ??= { value: build() }).value
}

/**
 * Deterministic pseudo-random numbers (a linear congruential generator), so the same effect always
 * looks the same, on every page load and in every browser.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Size of a section drawn by the survey effects, and the tile of the repeating patterns, in CSS
 * pixels. Large enough that a repeat only ever shows on screens wider than 2400px or taller than
 * 1200px.
 */
export const SECTION_W = 2400
export const SECTION_H = 1200

/* -------------------------------------------------------------------------------------------------
 * Bedding planes, shared by seismic, strata and well log.
 * ---------------------------------------------------------------------------------------------- */

/** A bedding plane: its base depth and the wave along it. */
export interface Plane {
  y: number
  wave: (x: number) => number
}

/** A bedding plane across the section; whole wavelengths, so a tile repeats. */
export function beddingPlane(random: () => number, amplitude: number): Plane["wave"] {
  const waves = [1, 2, 3].map((k) => ({
    k,
    amp: (amplitude / k) * (0.5 + random()),
    phase: random() * Math.PI * 2,
  }))
  return (x: number) =>
    waves.reduce((sum, w) => sum + w.amp * Math.sin((2 * Math.PI * w.k * x) / SECTION_W + w.phase), 0)
}

/**
 * Path data for a stack of bedding planes: one open line per plane and one closed layer between
 * each pair of neighbours. `depth` gives a plane's depth at x, so a caller can add a fault.
 */
export function sectionPaths<TPlane extends Plane>(
  planes: TPlane[],
  step: number,
  depth: (plane: TPlane, x: number) => number = (plane, x) => plane.y + plane.wave(x)
): { lines: string[]; layers: string[] } {
  const xs = Array.from({ length: SECTION_W / step + 1 }, (_, i) => i * step)
  const along = (plane: TPlane) => xs.map((x) => `L${x} ${Math.round(depth(plane, x))}`).join("")
  const back = (plane: TPlane) =>
    [...xs]
      .reverse()
      .map((x) => `L${x} ${Math.round(depth(plane, x))}`)
      .join("")
  const lines = planes.map((plane) => `M0 ${Math.round(depth(plane, 0))}${along(plane)}`)
  const layers = planes.slice(0, -1).map((_, i) => `${lines[i]}${back(planes[i + 1])}Z`)
  return { lines, layers }
}

/* -------------------------------------------------------------------------------------------------
 * 1. Seismic
 * ---------------------------------------------------------------------------------------------- */

export const SEIS_SURFACE = 380
export const SEIS_TRACE_Y = 190
export const SEIS_SOURCE = [820, 780] as const
export const SEIS_FAULT_X = 1420
export const SEIS_RING = 420

function seismogram(random: () => number) {
  const [sx] = SEIS_SOURCE
  const bursts = [
    { at: sx, size: 110, amp: 95 },
    ...Array.from({ length: 6 }, () => ({
      at: random() * SECTION_W,
      size: 40 + random() * 60,
      amp: 10 + random() * 26,
    })),
  ]
  const points: string[] = [`M0 ${SEIS_TRACE_Y}`]
  let phase = 0
  for (let x = 4; x <= SECTION_W; x += 4) {
    let amp = 2.2
    for (const b of bursts) {
      const d = (x - b.at) / b.size
      amp += b.amp * Math.exp(-d * d * 3)
    }
    phase += 0.9 + random() * 0.4
    points.push(`L${x} ${(SEIS_TRACE_Y + Math.sin(phase) * amp).toFixed(1)}`)
  }
  return points.join("")
}

export const seismicGeometry = once(() => {
  const random = seeded(7)
  const trace = seismogram(random)
  // Bedding planes below the surface, dropped on the far side of the fault.
  const planes: (Plane & { drop: number })[] = []
  let y = SEIS_SURFACE + 70
  while (y < SECTION_H + 80) {
    planes.push({ y, wave: beddingPlane(random, 12 + random() * 26), drop: 50 + random() * 50 })
    y += 70 + random() * 80
  }
  const { lines, layers } = sectionPaths(planes, 16, (plane, x) => {
    const t = Math.min(1, Math.max(0, (x - SEIS_FAULT_X + 30) / 60))
    return plane.y + plane.wave(x) + plane.drop * t * t * (3 - 2 * t)
  })
  return { trace, lines, layers }
})

/* -------------------------------------------------------------------------------------------------
 * 2. Contour — a periodic height field, isolines by marching squares, stepped tints.
 * ---------------------------------------------------------------------------------------------- */

export const CONTOUR_W = 3840
export const CONTOUR_H = 2160
const CONTOUR_CELL = 40
const CONTOUR_LEVELS = 14
/** Levels below this are drawn as lines only, so the ground stays neutral. */
const CONTOUR_FILL_FROM = 5

/**
 * Elevation ramp of the contour map, deep to high: blue, azure, lime, saffron. Each level mixes the
 * two nearest stops; the stops are chart accents, so both modes are covered.
 */
const CONTOUR_RAMP = ["var(--tec-chart-4)", "var(--tec-chart-1)", "var(--tec-chart-3)", "var(--tec-chart-2)"]

export function rampColor(t: number): string {
  const pos = Math.min(Math.max(t, 0), 1) * (CONTOUR_RAMP.length - 1)
  const i = Math.min(Math.floor(pos), CONTOUR_RAMP.length - 2)
  const f = Math.round((pos - i) * 100)
  return `color-mix(in oklch, ${CONTOUR_RAMP[i]}, ${CONTOUR_RAMP[i + 1]} ${f}%)`
}

interface FieldOptions {
  w?: number
  h?: number
  cell?: number
  bumps?: number
  bumpSize?: readonly [number, number]
  waveAmp?: number
}

/**
 * Height field: gentle regional waves (whole wavelengths, so the field wraps) plus anticlines and
 * troughs as Gaussian bumps measured with wrapped distances. The grid has one extra column and row
 * so the last cells close onto the first.
 */
function contourField(random: () => number, options: FieldOptions = {}) {
  const {
    w = CONTOUR_W,
    h = CONTOUR_H,
    cell = CONTOUR_CELL,
    bumps: bumpCount = 36,
    bumpSize = [120, 440],
    waveAmp = 0.4,
  } = options
  const cols = w / cell
  const rows = h / cell
  const waves = Array.from({ length: 5 }, () => ({
    kx: (1 + Math.round(random() * 3)) * (random() < 0.5 ? -1 : 1),
    ky: (1 + Math.round(random() * 3)) * (random() < 0.5 ? -1 : 1),
    amp: waveAmp * (0.6 + random() * 0.8),
    phase: random() * Math.PI * 2,
  }))
  const bumps = Array.from({ length: bumpCount }, () => ({
    x: random() * w,
    y: random() * h,
    sx: bumpSize[0] + random() * (bumpSize[1] - bumpSize[0]),
    sy: (bumpSize[0] + random() * (bumpSize[1] - bumpSize[0])) * 0.8,
    amp: (random() < 0.65 ? 1 : -1) * (0.6 + random() * 1.2),
  }))
  const wrap = (d: number, size: number) => {
    const m = Math.abs(d) % size
    return Math.min(m, size - m)
  }
  const values = new Float64Array((cols + 1) * (rows + 1))
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = i * cell
      const y = j * cell
      let v = 0
      for (const wave of waves) {
        v += wave.amp * Math.sin((2 * Math.PI * (wave.kx * x)) / w + (2 * Math.PI * (wave.ky * y)) / h + wave.phase)
      }
      for (const b of bumps) {
        const dx = wrap(x - b.x, w) / b.sx
        const dy = wrap(y - b.y, h) / b.sy
        v += b.amp * Math.exp(-(dx * dx + dy * dy))
      }
      values[j * (cols + 1) + i] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return { values, cols, rows, cell, w, h, min, max, bumps }
}

type Field = ReturnType<typeof contourField>

/** A copy of the field where a lone node above the level is pushed below (it would draw as a speck). */
function withoutSpecks(field: Field, level: number): Field {
  const { values, cols, rows } = field
  const out = new Float64Array(values)
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const n = j * (cols + 1) + i
      if (values[n] <= level) continue
      let alone = true
      for (let dj = -1; dj <= 1 && alone; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ii = i + di
          const jj = j + dj
          if (ii < 0 || jj < 0 || ii > cols || jj > rows) continue
          if (values[jj * (cols + 1) + ii] > level) {
            alone = false
            break
          }
        }
      }
      if (alone) out[n] = level - 1e-6
    }
  }
  return { ...field, values: out }
}

/** Marching squares for one level, chained end to end into as few polylines as possible. */
function isolines(field: Field, level: number): string {
  const { values, cols, rows, cell } = field
  const at = (i: number, j: number) => values[j * (cols + 1) + i]
  const key = (x: number, y: number) => `${Math.round(x * 4)},${Math.round(y * 4)}`
  const segments: [number, number, number, number][] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const tl = at(i, j)
      const tr = at(i + 1, j)
      const br = at(i + 1, j + 1)
      const bl = at(i, j + 1)
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
      if (idx === 0 || idx === 15) continue
      const x0 = i * cell
      const y0 = j * cell
      const lerp = (a: number, b: number) => (level - a) / (b - a)
      const top = [x0 + lerp(tl, tr) * cell, y0] as const
      const right = [x0 + cell, y0 + lerp(tr, br) * cell] as const
      const bottom = [x0 + lerp(bl, br) * cell, y0 + cell] as const
      const left = [x0, y0 + lerp(tl, bl) * cell] as const
      const push = (a: readonly [number, number], b: readonly [number, number]) => segments.push([a[0], a[1], b[0], b[1]])
      switch (idx) {
        case 1:
        case 14:
          push(left, bottom)
          break
        case 2:
        case 13:
          push(bottom, right)
          break
        case 3:
        case 12:
          push(left, right)
          break
        case 4:
        case 11:
          push(top, right)
          break
        case 5:
          push(top, left)
          push(bottom, right)
          break
        case 6:
        case 9:
          push(top, bottom)
          break
        case 7:
        case 8:
          push(top, left)
          break
        case 10:
          push(top, right)
          push(left, bottom)
          break
      }
    }
  }
  // Chain: every endpoint knows which segments touch it.
  const ends = new Map<string, number[]>()
  segments.forEach(([ax, ay, bx, by], n) => {
    for (const k of [key(ax, ay), key(bx, by)]) {
      const list = ends.get(k)
      if (list) list.push(n)
      else ends.set(k, [n])
    }
  })
  const used = new Uint8Array(segments.length)
  const paths: string[] = []
  const walk = (start: number) => {
    const points: [number, number][] = []
    let [ax, ay, bx, by] = segments[start]
    used[start] = 1
    points.push([ax, ay], [bx, by])
    let x = bx
    let y = by
    for (;;) {
      const next = (ends.get(key(x, y)) ?? []).find((n) => !used[n])
      if (next === undefined) break
      used[next] = 1
      ;[ax, ay, bx, by] = segments[next]
      if (key(ax, ay) === key(x, y)) {
        x = bx
        y = by
      } else {
        x = ax
        y = ay
      }
      points.push([x, y])
    }
    return points
  }
  for (let n = 0; n < segments.length; n++) {
    if (used[n]) continue
    const forward = walk(n)
    // Extend backwards from the first point too, so open lines are whole.
    const [sx, sy] = forward[0]
    const backStart = (ends.get(key(sx, sy)) ?? []).find((m) => !used[m])
    const points = backStart === undefined ? forward : [...walk(backStart).reverse(), ...forward]
    paths.push(points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`).join(""))
  }
  return paths.join("")
}

/**
 * The region above a level as one path: rows of fully-above cells merged into rects, boundary cells
 * as the marching-squares polygon of their above-level part. Drawn with `crispEdges` so shared
 * edges never show as seams.
 */
function filledAbove(field: Field, level: number): string {
  const { values, cols, rows, cell } = field
  const at = (i: number, j: number) => values[j * (cols + 1) + i]
  const out: string[] = []
  const pt = (x: number, y: number) => `${Math.round(x)} ${Math.round(y)}`
  for (let j = 0; j < rows; j++) {
    let run = -1
    const flush = (end: number) => {
      if (run < 0) return
      out.push(`M${pt(run * cell, j * cell)}h${(end - run) * cell}v${cell}h${-(end - run) * cell}z`)
      run = -1
    }
    for (let i = 0; i < cols; i++) {
      const corners = [
        [i, j, at(i, j)],
        [i + 1, j, at(i + 1, j)],
        [i + 1, j + 1, at(i + 1, j + 1)],
        [i, j + 1, at(i, j + 1)],
      ] as const
      const above = corners.map(([, , v]) => v > level)
      const count = above.filter(Boolean).length
      if (count === 4) {
        if (run < 0) run = i
        continue
      }
      flush(i)
      if (count === 0) continue
      const poly: string[] = []
      for (let c = 0; c < 4; c++) {
        const [cx, cy, cv] = corners[c]
        const [nx, ny, nv] = corners[(c + 1) % 4]
        if (above[c]) poly.push(pt(cx * cell, cy * cell))
        if (above[c] !== above[(c + 1) % 4]) {
          const t = (level - cv) / (nv - cv)
          poly.push(pt((cx + (nx - cx) * t) * cell, (cy + (ny - cy) * t) * cell))
        }
      }
      out.push(`M${poly.join("L")}z`)
    }
    flush(cols)
  }
  return out.join("")
}

/** The isolines and filled bands of the contour map; the colours follow `palette` at render. */
export const contourLevels = once(() => {
  const field = contourField(seeded(11))
  return Array.from({ length: CONTOUR_LEVELS }, (_, i) => {
    const t = (i + 0.5) / CONTOUR_LEVELS
    const level = field.min + (field.max - field.min) * t
    const clean = withoutSpecks(field, level)
    return {
      d: isolines(clean, level),
      fill: i < CONTOUR_FILL_FROM ? "" : filledAbove(clean, level),
      // The ramp runs over the filled levels; the lower lines stay blue.
      ramp: Math.max(0, (i - CONTOUR_FILL_FROM) / (CONTOUR_LEVELS - 1 - CONTOUR_FILL_FROM)),
      index: i % 4 === 1,
    }
  })
})

/* -------------------------------------------------------------------------------------------------
 * 3. Strata
 * ---------------------------------------------------------------------------------------------- */

export const strataGeometry = once(() => {
  const random = seeded(3)
  // Layer boundaries from the top of the tile to the bottom; the last plane reuses the first one's
  // wave so the tile also repeats vertically.
  const first = beddingPlane(random, 14)
  const planes: Plane[] = [{ y: 0, wave: first }]
  let y = 0
  while (y < SECTION_H - 70) {
    y += 26 + random() * 44
    planes.push({ y, wave: beddingPlane(random, 8 + random() * 12) })
  }
  planes.push({ y: SECTION_H, wave: first })
  return sectionPaths(planes, 12)
})

/* -------------------------------------------------------------------------------------------------
 * 4. Grid
 * ---------------------------------------------------------------------------------------------- */

export const GRID = 48

export const gridNodes = once(() => {
  const random = seeded(19)
  return Array.from({ length: 40 }, () => ({
    x: Math.round(random() * 40) * GRID,
    y: Math.round(random() * 22) * GRID,
    delay: -random() * 30,
    duration: 4 + random() * 6,
  }))
})

/* -------------------------------------------------------------------------------------------------
 * 5. Flow
 * ---------------------------------------------------------------------------------------------- */

export const FLOW_HUB = [SECTION_W / 2, SECTION_H / 2] as const
export const FLOW_PULSE = 220

export const flowStreams = once(() => {
  const [hx, hy] = FLOW_HUB
  const random = seeded(23)
  return Array.from({ length: 26 }, (_, i) => {
    const y = hy - 520 + (i / 25) * 1040 + (random() - 0.5) * 30
    const c1 = 380 + random() * 220
    return {
      d: `M-20 ${y.toFixed(0)} C ${c1.toFixed(0)} ${y.toFixed(0)}, ${(hx - 420).toFixed(0)} ${hy}, ${hx} ${hy}`,
      pulse: i % 2 === 0,
      speed: 0.7 + random() * 0.8,
      delay: -random() * 30,
      strong: i % 4 === 0,
    }
  })
})

/** Outbound tree of the flow effect: trunk, three branches, each splitting in two, and the nodes. */
export const flowTree = once(() => {
  const [hx, hy] = FLOW_HUB
  const trunkEnd = hx + 300
  const branchX = hx + 620
  const leafX = hx + 980
  const branches = [-230, 0, 230].map((dy) => ({
    y: hy + dy,
    d: `M${trunkEnd} ${hy} C ${trunkEnd + 160} ${hy}, ${trunkEnd + 160} ${hy + dy}, ${branchX} ${hy + dy}`,
    leaves: [-95, 95].map((ly) => ({
      y: hy + dy + ly,
      d: `M${branchX} ${hy + dy} C ${branchX + 180} ${hy + dy}, ${branchX + 180} ${hy + dy + ly}, ${leafX} ${hy + dy + ly} L ${SECTION_W + 20} ${hy + dy + ly}`,
      dashed: ly > 0,
    })),
  }))
  const nodes = [
    { x: hx - 300, y: hy, r: 7 },
    { x: trunkEnd, y: hy, r: 9 },
    ...branches.map((b) => ({ x: branchX, y: b.y, r: 9 })),
    ...branches.flatMap((b) => b.leaves.map((l) => ({ x: leafX, y: l.y, r: 7 }))),
  ]
  return { trunkEnd, branches, nodes }
})

/* -------------------------------------------------------------------------------------------------
 * 6. Well log
 * ---------------------------------------------------------------------------------------------- */

export const WELL_SURFACE = 140
const WELL_TRACKS = [-420, -300, 300, 420]

function wellLogTrace(random: () => number, x: number, top: number, bottom: number, amplitude: number) {
  const points: string[] = [`M${x} ${top}`]
  let value = 0
  for (let y = top + 5; y <= bottom; y += 5) {
    value += (random() - 0.5) * amplitude
    value *= 0.88
    const spike = random() > 0.985 ? (random() - 0.5) * amplitude * 3 : 0
    points.push(`L${(x + value + spike).toFixed(1)} ${y}`)
  }
  return points.join(" ")
}

export const wellLogGeometry = once(() => {
  const cx = SECTION_W / 2
  const random = seeded(31)
  // Bedding planes from just below the surface to the bottom of the section.
  const planes: Plane[] = []
  let y = WELL_SURFACE + 50
  while (y < SECTION_H + 60) {
    planes.push({ y, wave: beddingPlane(random, 10 + random() * 22) })
    y += 56 + random() * 90
  }
  const tracks = WELL_TRACKS.map((offset) => ({
    x: cx + offset,
    d: wellLogTrace(random, cx + offset, WELL_SURFACE, SECTION_H, 15),
  }))
  return { ...sectionPaths(planes, 16), tracks }
})

/* -------------------------------------------------------------------------------------------------
 * 8. Hexagons
 *
 * Pointy-top hexagons on an integer grid: 38px wide, rows 33px apart. A true regular hexagon of this
 * height is 38.1px wide, and a pattern tile with a fractional size drifts by a fraction of a pixel
 * per repeat, which would put the lit cells off their mesh; the 0.3% squash is invisible.
 * ---------------------------------------------------------------------------------------------- */

export const HEX_R = 22
export const HEX_W = 38
export const HEX_H = 33

function hexPoints(cx: number, cy: number, scale = 1) {
  const hw = (HEX_W / 2) * scale
  const r = HEX_R * scale
  const half = (HEX_R / 2) * scale
  return [
    [cx + hw, cy + half],
    [cx, cy + r],
    [cx - hw, cy + half],
    [cx - hw, cy - half],
    [cx, cy - r],
    [cx + hw, cy - half],
  ] as const
}

export function hexPath(cx: number, cy: number): string {
  return (
    hexPoints(cx, cy)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ") + " Z"
  )
}

export function hexClip(inset: number): string {
  return `polygon(${hexPoints(HEX_R, HEX_R, (HEX_R - inset) / HEX_R)
    .map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`)
    .join(", ")})`
}

export const hexagonsLit = once(() => {
  const random = seeded(41)
  return Array.from({ length: 36 }, () => {
    const row = Math.floor(random() * 24)
    const col = Math.floor(random() * 44)
    return {
      x: col * HEX_W + (row % 2 ? HEX_W / 2 : 0),
      y: row * HEX_H,
      duration: 5 + random() * 7,
      delay: -random() * 30,
    }
  })
})

/* -------------------------------------------------------------------------------------------------
 * 11. Terrain grid — a wavy wireframe plane in perspective.
 * ---------------------------------------------------------------------------------------------- */

export const TERRAIN_W = 1600
export const TERRAIN_H = 900
export const TERRAIN_HORIZON = 300
const TERRAIN_FOCAL = 720
const TERRAIN_EYE = 2
/** Depth past which a surface node is dimmed (the back half of the 18 nearest depth rows). */
export const TERRAIN_FAR_NODE = 3.5

function terrainHeight(x: number, d: number) {
  return 0.34 * Math.sin(x * 0.55 + d * 0.4) * Math.cos(d * 0.3) + 0.2 * Math.sin(x * 1.1 - d * 0.6) + 0.14 * Math.sin(d * 1.1 + x * 0.2)
}

function terrainProject(x: number, d: number) {
  const z = terrainHeight(x, d)
  return [TERRAIN_W / 2 + (x * TERRAIN_FOCAL) / d, TERRAIN_HORIZON + ((TERRAIN_EYE - z) * TERRAIN_FOCAL) / d] as const
}

export const terrainGeometry = once(() => {
  const columns = Array.from({ length: 67 }, (_, i) => -9.9 + i * 0.3)
  // Depth rows spaced geometrically so they look evenly spaced on screen.
  const depths = Array.from({ length: 44 }, (_, i) => 2 * Math.pow(22 / 2, i / 43))
  const line = (points: (readonly [number, number])[]) =>
    points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(0)} ${y.toFixed(0)}`).join("")
  const rows = depths.map((d) => line(columns.map((x) => terrainProject(x, d))))
  const cols = columns.map((x) => line(depths.map((d) => terrainProject(x, d))))
  const nodes = depths
    .slice(0, 18)
    .flatMap((d, j) => columns.filter((_, i) => (i + j) % 4 === 0).map((x) => ({ p: terrainProject(x, d), r: 0.8 + 3.2 / d, d })))
    .filter(({ p }) => p[0] > -40 && p[0] < TERRAIN_W + 40 && p[1] < TERRAIN_H + 40)
  return { rows, cols, nodes }
})
