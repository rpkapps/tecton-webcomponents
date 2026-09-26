/**
 * @module background/effects
 * The SVG/CSS drawing of every `<tec-background>` effect, as Lit templates. The geometry comes from
 * `geometry.ts` (built once per page); these functions only lay it out and colour it with the ink
 * variables the host defines (`--bg-ink`, `--bg-ink-soft`, `--bg-ink-strong`, `--bg-tone`,
 * `--bg-alpha`, `--bg-duration`).
 *
 * Ids (`clipPath`, `pattern`, `mask`, gradients) are plain names: every element renders into its own
 * shadow root, so they never collide between instances.
 *
 * @internal
 */
import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from "lit"
import {
  CONTOUR_H,
  CONTOUR_W,
  FLOW_HUB,
  FLOW_PULSE,
  GRID,
  HEX_H,
  HEX_R,
  HEX_W,
  SECTION_H,
  SECTION_W,
  SEIS_FAULT_X,
  SEIS_RING,
  SEIS_SOURCE,
  SEIS_SURFACE,
  SEIS_TRACE_Y,
  TERRAIN_FAR_NODE,
  TERRAIN_H,
  TERRAIN_HORIZON,
  TERRAIN_W,
  WELL_SURFACE,
  contourLevels,
  flowStreams,
  flowTree,
  gridNodes,
  hexClip,
  hexPath,
  hexagonsLit,
  rampColor,
  seismicGeometry,
  strataGeometry,
  terrainGeometry,
  wellLogGeometry,
} from "./geometry.js"

/** The names of the effects, in gallery order. */
export const backgroundEffects = [
  "seismic",
  "contour",
  "strata",
  "grid",
  "flow",
  "well-log",
  "drill",
  "hexagons",
  "pressure",
  "horizon",
  "terrain-grid",
] as const

export type BackgroundEffectName = (typeof backgroundEffects)[number]

/** Effects that take the `interactive` pointer reveal. */
export const interactiveEffects: readonly BackgroundEffectName[] = ["grid", "hexagons", "terrain-grid"]

/** Options of an effect's template, taken from the element's attributes. */
export interface EffectOptions {
  /** Contour only: `map` colours by elevation, `tone` uses the single tone. */
  palette: "map" | "tone"
  /** Contour only: survey grid under the isolines. */
  grid: boolean
  /** Grid, hexagons and terrain grid: render the pointer-reveal layer. */
  interactive: boolean
}

const NSS = "non-scaling-stroke"

/* -------------------------------------------------------------------------------------------------
 * Shared drawing
 * ---------------------------------------------------------------------------------------------- */

/**
 * A full-size SVG whose content is a repeating pixel-scale pattern. `tile` is the pattern content;
 * the group around the filled rect is what the effects animate (translating it by a whole tile is
 * seamless). The rect overshoots by one tile on every side to leave room for that motion.
 */
function patternSvg(id: string, tile: SVGTemplateResult, { width = SECTION_W, height = SECTION_H, style = "" } = {}): TemplateResult {
  return html`<svg class="fill" xmlns="http://www.w3.org/2000/svg" style="--bg-tile-w: ${width}px">
    <defs>
      <pattern id=${id} width=${width} height=${height} patternUnits="userSpaceOnUse">${tile}</pattern>
    </defs>
    <g style=${style}>
      <rect
        x=${-width}
        y=${-height}
        width="calc(100% + ${2 * width}px)"
        height="calc(100% + ${2 * height}px)"
        fill="url(#${id})"
      />
    </g>
  </svg>`
}

/** The layer that shows through a soft circle around the pointer (see `interactive`). */
function reveal(content: TemplateResult, radius = 180): TemplateResult {
  return html`<div
    class="reveal"
    style="mask-image: radial-gradient(${radius}px circle at var(--bg-x, -9999px) var(--bg-y, -9999px), black, transparent); -webkit-mask-image: radial-gradient(${radius}px circle at var(--bg-x, -9999px) var(--bg-y, -9999px), black, transparent)"
  >
    ${content}
  </div>`
}

/**
 * Faint survey grid in soft ink: verticals every `step` px down to `verticalsTo`, plus either a
 * matching set of horizontals (`"grid"`) or the given rows. Every fifth vertical can be stronger.
 */
function surveyGrid({
  width,
  height,
  step = 120,
  verticalsTo = height,
  horizontals,
  weak = 0.5,
  strong = weak,
  horizontalOpacity = weak,
}: {
  width: number
  height: number
  step?: number
  verticalsTo?: number
  horizontals?: "grid" | number[]
  weak?: number
  strong?: number
  horizontalOpacity?: number
}): SVGTemplateResult {
  const rows = horizontals === "grid" ? Array.from({ length: height / step + 1 }, (_, i) => i * step) : (horizontals ?? [])
  return svg`<g stroke="var(--bg-ink-soft)" fill="none">
    ${Array.from(
      { length: width / step + 1 },
      (_, i) =>
        svg`<line x1=${i * step} x2=${i * step} y1="0" y2=${verticalsTo} stroke-opacity=${i % 5 === 0 ? strong : weak} vector-effect=${NSS} />`
    )}
    ${rows.map(
      (y, i) =>
        svg`<line x1="0" x2=${width} y1=${y} y2=${y} stroke-opacity=${horizontals === "grid" && i % 5 === 0 ? strong : horizontalOpacity} vector-effect=${NSS} />`
    )}
  </g>`
}

/** Concentric rings that breathe in turn, fading outwards. */
function pulseRings(cx: number, cy: number, radii: number[], opacity = 1): SVGTemplateResult {
  return svg`<g fill="none" stroke="var(--bg-ink)">
    ${radii.map(
      (r, i) =>
        svg`<circle cx=${cx} cy=${cy} r=${r} stroke-opacity=${opacity - i * 0.3} vector-effect=${NSS}
          style="animation: tecton-bg-pulse ${(6 + i * 2).toFixed(0)}s ease-in-out infinite; animation-delay: ${(-i * 2).toFixed(0)}s" />`
    )}
  </g>`
}

/* -------------------------------------------------------------------------------------------------
 * 1. Seismic — a survey in section: the seismogram with its main event, the surface line, faulted
 *    strata below, and the source with wavefront rings rippling out, joined up to the trace.
 * ---------------------------------------------------------------------------------------------- */

function seismic(): TemplateResult {
  const [sx, sy] = SEIS_SOURCE
  const { trace, lines, layers } = seismicGeometry()
  const rings = 8
  return html`<svg class="fill" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SECTION_W} ${SECTION_H}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <clipPath id="below"><rect x="0" y=${SEIS_SURFACE} width=${SECTION_W} height=${SECTION_H} /></clipPath>
    </defs>
    ${surveyGrid({ width: SECTION_W, height: SECTION_H, verticalsTo: SEIS_SURFACE, horizontals: [SEIS_TRACE_Y - 100, SEIS_TRACE_Y + 100] })}
    <g clip-path="url(#below)">
      ${layers.map((d, i) => svg`<path d=${d} fill=${i % 3 === 1 ? "var(--bg-ink-soft)" : "none"} />`)}
      <g fill="none" stroke="var(--bg-ink)">
        ${lines.map(
          (d, i) =>
            svg`<path d=${d} stroke-opacity=${i % 2 ? 0.55 : 1} stroke-dasharray=${i % 3 === 2 ? "6 8" : nothing} vector-effect=${NSS} />`
        )}
        <line
          x1=${SEIS_FAULT_X - 30}
          x2=${SEIS_FAULT_X + 90}
          y1=${SEIS_SURFACE}
          y2=${SECTION_H}
          stroke="var(--bg-ink-strong)"
          stroke-opacity="0.7"
          vector-effect=${NSS}
        />
      </g>
      <g fill="none" stroke="var(--bg-ink)">
        ${Array.from(
          { length: rings },
          (_, i) =>
            svg`<circle cx=${sx} cy=${sy} r=${SEIS_RING} stroke-dasharray=${i % 2 ? "4 8" : nothing} vector-effect=${NSS}
              style="transform-origin: ${sx}px ${sy}px; animation: tecton-bg-ripple calc(var(--bg-duration) / 3) linear infinite; animation-delay: calc(var(--bg-duration) / 3 * ${(-i / rings).toFixed(3)})" />`
        )}
      </g>
    </g>
    <line x1="0" x2=${SECTION_W} y1=${SEIS_SURFACE} y2=${SEIS_SURFACE} stroke="var(--bg-ink-strong)" stroke-width="1.5" vector-effect=${NSS} />
    <line x1=${sx} x2=${sx} y1=${SEIS_TRACE_Y} y2=${sy} stroke="var(--bg-ink)" stroke-opacity="0.7" vector-effect=${NSS} />
    <circle cx=${sx} cy=${sy} r="10" fill="var(--bg-ink-strong)" />
    <circle cx=${sx} cy=${sy} r="20" fill="none" stroke="var(--bg-ink-strong)" vector-effect=${NSS} />
    <path d=${trace} fill="none" stroke="var(--bg-ink-strong)" stroke-width="1.2" stroke-linejoin="round" vector-effect=${NSS} />
  </svg>`
}

/* -------------------------------------------------------------------------------------------------
 * 2. Contour — a continuous structure map, coloured by elevation over stepped flat tints.
 *    Plain vector paths, not a pattern: a pattern is rasterised and goes soft when the wander moves
 *    it by a fraction of a pixel.
 * ---------------------------------------------------------------------------------------------- */

function contour({ palette, grid }: EffectOptions): TemplateResult {
  const levels = contourLevels().map((level) => ({
    ...level,
    color: palette === "map" ? rampColor(level.ramp) : "var(--bg-tone)",
  }))
  return html`<svg class="contour" xmlns="http://www.w3.org/2000/svg">
    <g style="animation: tecton-bg-wander var(--bg-duration) ease-in-out infinite">
      <g shape-rendering="crispEdges">
        ${levels.map(({ fill, color }) => svg`<path d=${fill} fill=${color} fill-opacity="calc(var(--bg-alpha) * 0.16)" />`)}
      </g>
      ${grid ? surveyGrid({ width: CONTOUR_W, height: CONTOUR_H, horizontals: "grid", weak: 0.5, strong: 1 }) : nothing}
      <g fill="none" stroke-linejoin="round" stroke-linecap="round">
        ${levels.map(
          ({ d, color, index }) =>
            svg`<path d=${d} stroke=${color} stroke-opacity="calc(var(--bg-alpha) * ${index ? 1.6 : 1})" stroke-width=${index ? 1.5 : 1} />`
        )}
      </g>
    </g>
  </svg>`
}

/* -------------------------------------------------------------------------------------------------
 * 3. Strata — a geological cross-section panning very slowly along the section.
 * ---------------------------------------------------------------------------------------------- */

/** Fill of every third layer, top to bottom. */
const STRATA_TINTS = [
  { fill: "var(--bg-ink-soft)", opacity: 1 },
  { fill: "var(--bg-ink)", opacity: 0.5 },
  { fill: "none", opacity: 1 },
]

function strata(): TemplateResult {
  const { lines, layers } = strataGeometry()
  const tile = svg`
    ${layers.map((d, i) => svg`<path d=${d} fill=${STRATA_TINTS[i % 3].fill} fill-opacity=${STRATA_TINTS[i % 3].opacity} />`)}
    <g fill="none" stroke="var(--bg-ink)" stroke-width="1">
      ${lines.slice(0, -1).map((d, i) => svg`<path d=${d} stroke-opacity=${i % 2 ? 0.6 : 1} />`)}
    </g>`
  return patternSvg("strata", tile, { style: "animation: tecton-bg-drift-x calc(var(--bg-duration) * 5) linear infinite" })
}

/* -------------------------------------------------------------------------------------------------
 * 4. Grid — orthogonal lines with nodes lighting up; optional pointer reveal.
 * ---------------------------------------------------------------------------------------------- */

function gridLines(ink: string) {
  return `background-image: linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px); background-size: ${GRID}px ${GRID}px; background-position: -1px -1px`
}

function grid({ interactive }: EffectOptions): TemplateResult {
  return html`<div class="fill pointer" style=${gridLines("var(--bg-ink)")}>
    ${interactive ? reveal(html`<div class="fill" style=${gridLines("var(--bg-ink-strong)")}></div>`) : nothing}
    ${gridNodes().map(
      (node) =>
        html`<span
          class="grid-node"
          style="left: ${node.x}px; top: ${node.y}px; animation: tecton-bg-pulse ${node.duration}s ease-in-out infinite; animation-delay: ${node.delay}s"
        ></span>`
    )}
  </div>`
}

/* -------------------------------------------------------------------------------------------------
 * 5. Flow — streams converge from the left into a hub, then branch out to the right through
 *    rounded junctions with nodes, pulses travelling along all of it over a faint grid.
 * ---------------------------------------------------------------------------------------------- */

function flow(): TemplateResult {
  const [hx, hy] = FLOW_HUB
  const streams = flowStreams()
  const { trunkEnd, branches, nodes } = flowTree()
  const pulse = (speed: number, delay: number) =>
    `animation: tecton-bg-flow calc(var(--bg-duration) * ${speed.toFixed(2)} / 3) linear infinite; animation-delay: ${delay.toFixed(1)}s`
  return html`<svg
    class="fill"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${SECTION_W} ${SECTION_H}"
    preserveAspectRatio="xMidYMid slice"
    style="--bg-dash: ${FLOW_PULSE}px"
  >
    ${surveyGrid({ width: SECTION_W, height: SECTION_H, horizontals: "grid" })}
    <g fill="none" stroke-linecap="round">
      ${streams.map(({ d, strong }) => svg`<path d=${d} stroke=${strong ? "var(--bg-ink)" : "var(--bg-ink-soft)"} vector-effect=${NSS} />`)}
      ${streams
        .filter((st) => st.pulse)
        .map(
          ({ d, speed, delay }) =>
            svg`<path d=${d} stroke="var(--bg-ink-strong)" stroke-width="2" stroke-dasharray="${FLOW_PULSE * 0.06} ${FLOW_PULSE * 0.94}" vector-effect=${NSS} style=${pulse(speed, delay)} />`
        )}
    </g>
    <g fill="none" stroke="var(--bg-ink-soft)">
      <line x1=${hx} x2=${hx} y1="0" y2=${SECTION_H} vector-effect=${NSS} />
      <line x1="0" x2=${SECTION_W} y1=${hy} y2=${hy} vector-effect=${NSS} />
    </g>
    ${pulseRings(hx, hy, [60, 110, 170])}
    <circle cx=${hx} cy=${hy} r="16" fill="var(--bg-ink-strong)" />
    <circle cx=${hx} cy=${hy} r="28" fill="none" stroke="var(--bg-ink-strong)" vector-effect=${NSS} />
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1=${hx} x2=${trunkEnd} y1=${hy} y2=${hy} stroke="var(--bg-ink)" stroke-width="2" vector-effect=${NSS} />
      ${branches.map(
        (b, i) => svg`
          <path d=${b.d} stroke="var(--bg-ink)" stroke-width="1.5" vector-effect=${NSS} />
          <path d=${b.d} stroke="var(--bg-ink-strong)" stroke-width="2" stroke-dasharray="${FLOW_PULSE * 0.08} ${FLOW_PULSE * 0.92}" vector-effect=${NSS} style=${pulse(1 + i * 0.15, -i * 3)} />
          ${b.leaves.map(
            (l) =>
              svg`<path d=${l.d} stroke=${l.dashed ? "var(--bg-ink-soft)" : "var(--bg-ink)"} stroke-dasharray=${l.dashed ? "6 8" : nothing} vector-effect=${NSS} />`
          )}`
      )}
    </g>
    <g stroke="var(--bg-ink-strong)" fill="var(--tec-background)">
      ${nodes.map(
        ({ x, y, r }) => svg`
          <circle cx=${x} cy=${y} r=${r + 8} fill="none" stroke="var(--bg-ink-soft)" vector-effect=${NSS} />
          <circle cx=${x} cy=${y} r=${r} stroke-width="1.5" vector-effect=${NSS} />
          <circle cx=${x} cy=${y} r=${r * 0.45} fill="var(--bg-ink-strong)" stroke="none" />`
      )}
    </g>
  </svg>`
}

/* -------------------------------------------------------------------------------------------------
 * 6. Well log — a cross-section around a wellbore: bedding planes with textures behind, log tracks
 *    either side of the hole, the casing with the tool string running down it, the surface above.
 * ---------------------------------------------------------------------------------------------- */

function wellLog(): TemplateResult {
  const cx = SECTION_W / 2
  const { lines, layers, tracks } = wellLogGeometry()
  // Fill of every fourth layer: plain, soft, plain, dotted.
  const fills = ["none", "var(--bg-ink-soft)", "none", "url(#dots)"]
  return html`<svg
    class="fill"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${SECTION_W} ${SECTION_H}"
    preserveAspectRatio="xMidYMid slice"
    style="--bg-dash: 48px"
  >
    <defs>
      <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="7" cy="7" r="1.6" fill="var(--bg-ink)" />
      </pattern>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset="0.12" stop-color="#fff" stop-opacity="1" />
        <stop offset="0.88" stop-color="#fff" stop-opacity="1" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <mask id="mask"><rect width=${SECTION_W} height=${SECTION_H} fill="url(#fade)" /></mask>
    </defs>
    <g mask="url(#mask)">
      ${layers.map((d, i) => svg`<path d=${d} fill=${fills[i % 4]} />`)}
      <g fill="none" stroke="var(--bg-ink)">
        ${lines.map(
          (d, i) =>
            svg`<path d=${d} stroke-opacity=${i % 2 ? 0.55 : 1} stroke-dasharray=${i % 3 === 2 ? "6 8" : nothing} vector-effect=${NSS} />`
        )}
      </g>
    </g>
    ${surveyGrid({ width: SECTION_W, height: SECTION_H, horizontals: [40, 80], weak: 0.35, strong: 0.8, horizontalOpacity: 0.5 })}
    <line x1="0" x2=${SECTION_W} y1=${WELL_SURFACE} y2=${WELL_SURFACE} stroke="var(--bg-ink-strong)" stroke-width="1.5" vector-effect=${NSS} />
    <g fill="none">
      ${tracks.map(
        ({ x, d }, i) => svg`
          <line x1=${x} x2=${x} y1=${WELL_SURFACE} y2=${SECTION_H} stroke="var(--bg-ink-soft)" stroke-dasharray="2 6" vector-effect=${NSS} />
          <path d="${d}L${x} ${SECTION_H}Z" fill="var(--bg-ink-soft)" stroke="none" />
          <path d=${d} stroke="var(--bg-ink-strong)" stroke-width=${i % 2 === 0 ? 1 : 1.3} vector-effect=${NSS} />`
      )}
    </g>
    <g fill="none">
      ${[-14, 14].map(
        (dx) =>
          svg`<line x1=${cx + dx} x2=${cx + dx} y1=${WELL_SURFACE - 20} y2=${SECTION_H} stroke="var(--bg-ink-strong)" stroke-width="1.5" vector-effect=${NSS} />`
      )}
      <line
        x1=${cx}
        x2=${cx}
        y1=${WELL_SURFACE - 20}
        y2=${SECTION_H}
        stroke="var(--bg-ink-strong)"
        stroke-width="3"
        stroke-dasharray="20 28"
        vector-effect=${NSS}
        style="animation: tecton-bg-flow calc(var(--bg-duration) / 6) linear infinite"
      />
    </g>
    ${pulseRings(cx, SECTION_H * 0.52, [40, 70, 100], 0.9)}
  </svg>`
}

/* -------------------------------------------------------------------------------------------------
 * 7. Drill — a bit seen from above, turning slowly, centred in the container.
 * ---------------------------------------------------------------------------------------------- */

function drill(): TemplateResult {
  const spokes = 24
  const rings = [40, 90, 150, 220, 300, 400, 520, 660]
  const reach = 900
  return html`<svg class="drill" xmlns="http://www.w3.org/2000/svg" viewBox="-1000 -1000 2000 2000">
    <g
      fill="none"
      stroke="var(--bg-ink)"
      stroke-width="1"
      style="transform-origin: 0 0; animation: tecton-bg-rotate calc(var(--bg-duration) * 6) linear infinite"
    >
      ${rings.map(
        (r, i) => svg`<circle r=${r} stroke-opacity=${i % 2 === 0 ? 1 : 0.5} stroke-dasharray=${i % 2 === 0 ? nothing : "4 10"} />`
      )}
      ${Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2
        const inner = i % 3 === 0 ? 40 : 150
        return svg`<line x1=${Math.cos(a) * inner} y1=${Math.sin(a) * inner} x2=${Math.cos(a) * reach} y2=${Math.sin(a) * reach} stroke-opacity=${i % 3 === 0 ? 0.9 : 0.35} />`
      })}
      ${[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return svg`<path d="M0 0 A 150 150 0 0 1 ${(Math.cos(a) * 150).toFixed(1)} ${(Math.sin(a) * 150).toFixed(1)}" stroke="var(--bg-ink-strong)" stroke-width="1.5" />`
      })}
    </g>
  </svg>`
}

/* -------------------------------------------------------------------------------------------------
 * 8. Hexagons — a simulation mesh with cells lighting up in turn; optional pointer reveal.
 * ---------------------------------------------------------------------------------------------- */

/** The five hexagon outlines of one repeating tile (two rows, the second offset by half a cell). */
function hexTile(stroke: string, strokeWidth: number): SVGTemplateResult {
  const tileW = HEX_W
  const tileH = HEX_H * 2
  return svg`<g fill="none" stroke=${stroke} stroke-width=${strokeWidth}>
    <path d=${hexPath(0, 0)} />
    <path d=${hexPath(tileW, 0)} />
    <path d=${hexPath(tileW / 2, HEX_H)} />
    <path d=${hexPath(0, tileH)} />
    <path d=${hexPath(tileW, tileH)} />
  </g>`
}

function hexagons({ interactive }: EffectOptions): TemplateResult {
  const size = { width: HEX_W, height: HEX_H * 2 }
  const clip = hexClip(1.5)
  return html`<div class="fill pointer">
      ${patternSvg("hex", hexTile("var(--bg-ink)", 1), size)}
      ${interactive ? reveal(patternSvg("hex-reveal", hexTile("var(--bg-ink-strong)", 1.5), size)) : nothing}
    </div>
    ${hexagonsLit().map(
      (cell) =>
        html`<span
          class="hex-cell"
          style="left: ${cell.x}px; top: ${cell.y}px; width: ${HEX_R * 2}px; height: ${HEX_R * 2}px; clip-path: ${clip}; animation: tecton-bg-pulse ${cell.duration}s ease-in-out infinite; animation-delay: ${cell.delay}s"
        ></span>`
    )}`
}

/* -------------------------------------------------------------------------------------------------
 * 9. Pressure — soft gradient blobs, the most abstract and the calmest.
 * ---------------------------------------------------------------------------------------------- */

const PRESSURE_BLOBS = [
  { left: "5%", top: "-10%", size: "55%", duration: 1, delay: 0 },
  { left: "50%", top: "30%", size: "60%", duration: 1.4, delay: -12 },
  { left: "70%", top: "-25%", size: "45%", duration: 1.2, delay: -25 },
  { left: "20%", top: "55%", size: "50%", duration: 1.7, delay: -40 },
]

function pressure(): TemplateResult {
  return html`${PRESSURE_BLOBS.map(
    (blob) =>
      html`<div
        class="blob"
        style="left: ${blob.left}; top: ${blob.top}; width: ${blob.size}; animation: tecton-bg-migrate calc(var(--bg-duration) * ${blob.duration}) ease-in-out infinite; animation-delay: ${blob.delay}s"
      ></div>`
  )}`
}

/* -------------------------------------------------------------------------------------------------
 * 10. Horizon — a ground line with atmospheric layers, almost static.
 * ---------------------------------------------------------------------------------------------- */

function horizon(): TemplateResult {
  return html`<div class="horizon-sky"></div>
    <div class="horizon-line"></div>
    <div class="horizon-ground"></div>`
}

/* -------------------------------------------------------------------------------------------------
 * 11. Terrain grid — a wireframe surface in perspective: a wavy plane of squares receding to a
 *     horizon, nodes glowing on the near rows; optional pointer reveal.
 * ---------------------------------------------------------------------------------------------- */

function terrainLines(rows: string[], cols: string[], stroke: string, strokeWidth = 1, mask?: string): SVGTemplateResult {
  return svg`<g mask=${mask ?? nothing} fill="none" stroke=${stroke} stroke-width=${strokeWidth}>
    ${rows.map((d) => svg`<path d=${d} vector-effect=${NSS} />`)}
    ${cols.map((d) => svg`<path d=${d} vector-effect=${NSS} />`)}
  </g>`
}

function terrainGrid({ interactive }: EffectOptions): TemplateResult {
  const { rows, cols, nodes } = terrainGeometry()
  return html`<div class="fill pointer">
    <svg class="fill" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TERRAIN_W} ${TERRAIN_H}" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset=${TERRAIN_HORIZON / TERRAIN_H} stop-color="#fff" stop-opacity="0" />
          <stop offset=${(TERRAIN_HORIZON + 160) / TERRAIN_H} stop-color="#fff" stop-opacity="1" />
        </linearGradient>
        <mask id="mask"><rect width=${TERRAIN_W} height=${TERRAIN_H} fill="url(#fade)" /></mask>
        <radialGradient id="glow">
          <stop offset="0%" stop-color="var(--bg-tone)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--bg-tone)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx=${TERRAIN_W / 2}
        cy=${TERRAIN_HORIZON + 20}
        rx="700"
        ry="120"
        fill="url(#glow)"
        style="opacity: calc(var(--bg-alpha) * 0.8)"
      />
      ${terrainLines(rows, cols, "var(--bg-ink)", 1, "url(#mask)")}
      <g fill="var(--bg-ink-strong)">
        ${nodes.map(
          ({ p, r, d }, i) =>
            svg`<circle cx=${p[0].toFixed(0)} cy=${p[1].toFixed(0)} r=${r.toFixed(1)} fill-opacity=${d > TERRAIN_FAR_NODE ? 0.5 : nothing}
              style="animation: tecton-bg-pulse ${(4 + (i % 5)).toFixed(0)}s ease-in-out infinite; animation-delay: ${(-(i * 0.7) % 9).toFixed(1)}s" />`
        )}
      </g>
    </svg>
    ${interactive
      ? reveal(
          html`<svg class="fill" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TERRAIN_W} ${TERRAIN_H}" preserveAspectRatio="xMidYMax slice">
            ${terrainLines(rows, cols, "var(--bg-ink-strong)", 1.5)}
          </svg>`,
          240
        )
      : nothing}
  </div>`
}

/* ---------------------------------------------------------------------------------------------- */

const renderers: Record<BackgroundEffectName, (options: EffectOptions) => TemplateResult> = {
  seismic,
  contour,
  strata,
  grid,
  flow,
  "well-log": wellLog,
  drill,
  hexagons,
  pressure,
  horizon,
  "terrain-grid": terrainGrid,
}

/** Whether `name` is one of the {@link backgroundEffects}. */
export function isBackgroundEffect(name: string | null | undefined): name is BackgroundEffectName {
  return !!name && Object.prototype.hasOwnProperty.call(renderers, name)
}

/** The template of effect `name`, or `nothing` for an unknown name (the plain layer). */
export function renderEffect(name: string | null | undefined, options: EffectOptions): TemplateResult | typeof nothing {
  return isBackgroundEffect(name) ? renderers[name](options) : nothing
}
