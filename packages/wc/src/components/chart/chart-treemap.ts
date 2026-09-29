/**
 * @module chart-treemap
 * The treemap kind (`tec-chart-treemap`): nested data rows drawn as nested rectangles, their areas
 * proportional to the values (the squarified layout), with an optional drill-down (`nest`).
 */
import { css, html, nothing, svg, type SVGTemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { repeat } from "lit/directives/repeat.js"
import { focusRing, motionSafe } from "../../internal/styles.js"
import { formatValue } from "./chart-config.js"
import type { Point } from "./chart-engine.js"
import {
  ancestry,
  buildHierarchy,
  contrastLabelStyles,
  GOLDEN_RATIO,
  hierarchyLegend,
  hierarchyPayload,
  hierarchyTable,
  targetIndex,
  treemapLayout,
  type Hierarchy,
  type HierarchyFields,
  type HierarchyNode,
  type TreemapBox,
} from "./chart-hierarchy.js"
import type { ChartContext, ChartKind, ChartModelBase } from "./chart-kind.js"
import { TecChartPart } from "./chart-parts.js"

/**
 * The data is an array of nodes, each with a name, a value (on the leaves) and optionally
 * children: `{ name: "Energy", children: [{ name: "Oil", size: 120 }, …] }`. A parent's value is the
 * sum of its children. Siblings are laid out largest first with the squarified algorithm, which
 * keeps the cells close to `aspect-ratio`.
 *
 * Colours come from the top-level nodes — the row's `fill`, else the config entry named by its
 * name, else the chart palette in data order — and every descendant keeps the colour of its
 * top-level ancestor (unless its own row has a `fill`). Cells are separated by a 2px gap of the
 * chart surface. A cell shows its name and value only when they fit inside it; the tooltip and the
 * data table carry every value. `padding` draws the parent groups as tinted frames with their name
 * in a header band.
 *
 * The arrow keys move over every node in depth-first order (a parent before its children).
 *
 * With `nest`, the treemap drills down one level at a time, like a file browser: it shows the
 * top-level nodes (each sized by its total); click a cell (or press Enter on it) to zoom into its
 * children, and go back up with the breadcrumb below the chart, Escape or Backspace. The arrow keys
 * then move over the cells of the level shown.
 *
 * In right-to-left the layout is mirrored: it starts from the inline-start (right) edge.
 *
 * @summary A treemap series of a `tec-chart`: a hierarchy drawn as nested rectangles sized by value,
 * with an optional zoom into the groups.
 *
 * @tag tec-chart-treemap
 */
export class TecChartTreemap extends TecChartPart {
  /** The data field holding the values of the leaves. */
  @property({ reflect: true }) key = "size"

  /** The data field holding the node names (also the config keys of the nodes). */
  @property({ attribute: "name-key", reflect: true }) nameKey = "name"

  /** The data field holding a node's children. */
  @property({ attribute: "children-key", reflect: true }) childrenKey = "children"

  /** The target aspect ratio (long side : short side) of the cells. The golden ratio by default. */
  @property({ type: Number, attribute: "aspect-ratio" }) aspectRatio = GOLDEN_RATIO

  /**
   * Space in pixels between a parent group's edge and its children. Above 0, parent groups are drawn
   * as tinted frames with their name in a header band; at 0 (the default) only the leaves show.
   * Not used by a `nest` treemap, which shows one level.
   */
  @property({ type: Number }) padding = 0

  /**
   * Drill-down: shows one level at a time. Clicking a cell with children (or pressing Enter on it)
   * zooms into them; the breadcrumb, Escape or Backspace go back up.
   */
  @property({ type: Boolean, reflect: true }) nest = false

  /** The name of the top level in the breadcrumb of a `nest` treemap. */
  @property({ attribute: "root-label" }) rootLabel = "All"
}

type TreemapSpec = HierarchyFields & Pick<TecChartTreemap, "aspectRatio" | "padding" | "nest" | "rootLabel">

/** One node of the level shown. */
export interface TreemapCell {
  node: HierarchyNode
  box: TreemapBox
  /** A parent drawn as a frame (with `padding`). */
  frame: boolean
  /** Drawn as a filled cell: a leaf, or any node of the level shown by `nest`. */
  solid: boolean
  /** The label lines that fit (name, then value), with their widths. */
  lines: { text: string; width: number }[]
}

export interface TreemapModel extends ChartModelBase {
  kind: "treemap"
  spec: TreemapSpec
  tree: Hierarchy
  /** The zoomed-in group (`nest`), or undefined at the top level. */
  root?: HierarchyNode
  /** The nodes shown (every node depth-first, or the level shown by \`nest\`): the keyboard items. */
  cells: TreemapCell[]
}

/** The zoomed-in group per treemap part (its node id). */
const zoomed = new WeakMap<TecChartTreemap, string>()

/** Label inset from a cell's edge, in pixels. */
const INSET = 6
/** Font weight 500 is a little wider than the measuring font. */
const BOLD = 1.06

function specOf(ctx: ChartContext): TreemapSpec | undefined {
  const part = ctx.parts(TecChartTreemap)[0]
  if (!part) return undefined
  return {
    key: part.key || "size",
    nameKey: part.nameKey || "name",
    childrenKey: part.childrenKey || "children",
    aspectRatio: part.aspectRatio,
    padding: Number.isFinite(part.padding) ? Math.max(0, part.padding) : 0,
    nest: part.nest,
    rootLabel: part.rootLabel,
  }
}

/** The group a click (or Enter) on `node` zooms into: the node itself, else its group below `root`. */
export function zoomTarget(node: HierarchyNode, root: HierarchyNode | undefined): HierarchyNode | undefined {
  if (node.children.length) return node
  let n = node
  while (n.parent && n.parent !== root) n = n.parent
  return n !== node && n.children.length ? n : undefined
}

function setZoom(ctx: ChartContext, node: HierarchyNode | undefined) {
  const part = ctx.parts(TecChartTreemap)[0]
  if (!part) return
  if (node) zoomed.set(part, node.id)
  else zoomed.delete(part)
  ctx.requestUpdate()
}

/** A breadcrumb button: zooms, then moves the focus to the plot (the button goes away). */
function crumb(ctx: ChartContext, node: HierarchyNode | undefined) {
  return (event: Event) => {
    const plot = ((event.currentTarget as Element).getRootNode() as ParentNode).querySelector<HTMLElement>(".plot")
    setZoom(ctx, node)
    plot?.focus()
  }
}

function computeModel(ctx: ChartContext): TreemapModel | undefined {
  const spec = specOf(ctx)
  if (!spec) return undefined
  const { margin: m, width: W, height: H } = ctx
  const plot = { x: m.start, y: m.top, w: Math.max(0, W - m.start - m.end), h: Math.max(0, H - m.top - m.bottom) }
  const tree = buildHierarchy(ctx.rows, spec, { sort: true, color: (row, name, i) => ctx.rowColor(row, name, i) })
  const part = ctx.parts(TecChartTreemap)[0]!
  const id = spec.nest ? zoomed.get(part) : undefined
  // The zoomed group, or its nearest ancestor that still exists (and has children) after a data change.
  let root: HierarchyNode | undefined
  if (id) {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]))
    for (let path = id; path && !root; path = path.slice(0, Math.max(0, path.lastIndexOf(".")))) {
      const node = byId.get(path)
      if (node?.children.length) root = node
      if (!path.includes(".")) break
    }
  }
  // `nest` shows one level (the children of the zoomed group); otherwise every node.
  const level = root ? root.children : tree.roots
  const fontSize = ctx.fontSize
  const padding = spec.nest ? 0 : spec.padding
  const boxes = treemapLayout(level, plot, {
    ratio: spec.aspectRatio,
    padding,
    header: Math.round(fontSize + 8),
    levels: spec.nest ? 1 : Infinity,
  })
  const lineHeight = Math.round(fontSize * 1.35)
  const cells: TreemapCell[] = (spec.nest ? level : tree.nodes).map((node) => {
    const box = boxes.get(node)!
    const frame = padding > 0 && node.children.length > 0
    const solid = !frame && (spec.nest || !node.children.length)
    const lines: TreemapCell["lines"] = []
    if (frame) {
      // A parent's name in its header band.
      const inset = Math.max(padding, INSET)
      const width = ctx.measure(ctx.text(node.name)) * BOLD
      if (box.header && width + 2 * inset <= box.w) lines.push({ text: ctx.text(node.name), width })
    } else if (solid) {
      // Name, then value, as far as they fit.
      const name = ctx.text(node.name)
      const value = formatValue(node.value, ctx.locale)
      const nameWidth = ctx.measure(name) * BOLD
      const valueWidth = ctx.measure(value)
      if (nameWidth + 2 * INSET <= box.w && fontSize + 2 * INSET <= box.h) {
        lines.push({ text: name, width: nameWidth })
        if (valueWidth + 2 * INSET <= box.w && fontSize + lineHeight + 2 * INSET <= box.h) lines.push({ text: value, width: valueWidth })
      }
    }
    return { node, box, frame, solid, lines }
  })
  return { kind: "treemap", plot, spec, tree, root, cells, count: cells.length }
}

/** The tinted fill of a parent frame: its colour mixed into the surface, a little stronger per level. */
function tint(color: string, depth: number): string {
  return `color-mix(in oklab, ${color} ${Math.min(40, 14 + 8 * (depth - 1))}%, var(--tec-background))`
}

function renderTreemap(model: TreemapModel, ctx: ChartContext): SVGTemplateResult {
  const { cells, spec } = model
  const fontSize = ctx.fontSize
  const lineHeight = Math.round(fontSize * 1.35)
  // Parents are covered by their children unless they are drawn as frames.
  const drawn = cells.map((cell, i) => ({ cell, i })).filter(({ cell }) => cell.frame || cell.solid)
  const active = cells[ctx.active]
  const level = model.root?.id ?? ""
  const zoomable = spec.nest
  // Labels start at the cell's inline-start edge. The geometry is mirrored in right-to-left and each
  // label flipped back around its own box, so a label runs rightwards from \`x\` in both directions:
  // that is the text's end in right-to-left (\`text-anchor\` follows the inherited \`direction\`).
  const anchor = ctx.rtl ? "end" : "start"
  const content = svg`<g class="treemap" ?data-nest=${zoomable}>
    <g class="cells">
      ${drawn.map(({ cell, i }) => {
        const { box, node } = cell
        return svg`<rect class="cell" ?data-frame=${cell.frame} ?data-zoomable=${zoomable && !!zoomTarget(node, model.root)}
          x=${box.x} y=${box.y} width=${Math.max(0, box.w)} height=${Math.max(0, box.h)}
          fill=${cell.frame ? tint(node.color, node.depth - (model.root?.depth ?? 0)) : node.color} data-index=${i}></rect>`
      })}
    </g>
    <g class="headers">
      ${cells.map(({ box, frame, lines }) => {
        const line = lines[0]
        if (!frame || !line) return nothing
        const inset = Math.max(spec.padding, INSET)
        return svg`<text class="header" x=${box.x + inset} y=${box.y + (spec.padding + box.header) / 2} dy="0.35em" text-anchor=${anchor}>${line.text}</text>`
      })}
    </g>
    <g class="contrast-labels">
      ${cells.map(({ box, frame, lines, node }) =>
        frame
          ? nothing
          : lines.map(
              (line, n) => svg`<text class=${n ? "cell-value" : "cell-name"} style=${`--tec-chart-cell: ${node.color}`}
                x=${box.x + INSET} y=${box.y + INSET + n * lineHeight} dy="0.8em" text-anchor=${anchor}>${line.text}</text>`
            )
      )}
    </g>
  </g>`
  return svg`
    ${repeat([level], (key) => key, () => content)}
    ${active
      ? svg`<g class="cell-outline">
          <rect x=${active.box.x} y=${active.box.y} width=${Math.max(0, active.box.w)} height=${Math.max(0, active.box.h)}></rect>
          <rect class="inner" x=${active.box.x + 1.5} y=${active.box.y + 1.5} width=${Math.max(0, active.box.w - 3)} height=${Math.max(0, active.box.h - 3)}></rect>
        </g>`
      : nothing}
  `
}

function renderBreadcrumb(model: TreemapModel, ctx: ChartContext) {
  const trail = model.root ? ancestry(model.root) : []
  const current = trail.length ? trail.map((n) => ctx.text(n.name)).join(" › ") : model.spec.rootLabel
  return html`<nav class="treemap-breadcrumb" aria-label="Treemap levels">
      <ol>
        <li>
          ${trail.length
            ? html`<button type="button" class="crumb" @click=${crumb(ctx, undefined)}>${model.spec.rootLabel}</button>`
            : html`<span class="crumb" aria-current="location">${model.spec.rootLabel}</span>`}
        </li>
        ${trail.map((node, i) =>
          html`<li>
            ${i < trail.length - 1
              ? html`<button type="button" class="crumb" @click=${crumb(ctx, node)}>${ctx.text(node.name)}</button>`
              : html`<span class="crumb" aria-current="location">${ctx.text(node.name)}</span>`}
          </li>`
        )}
      </ol>
    </nav>
    <div class="sr-only" aria-live="polite">${trail.length ? `${model.spec.rootLabel} › ${current}` : model.spec.rootLabel}</div>`
}

export const treemapKind: ChartKind<TreemapModel> = {
  id: "treemap",
  mirrored: true,
  claims: (ctx) => ctx.parts(TecChartTreemap).length > 0,
  label: () => "Treemap",
  model: computeModel,
  render: renderTreemap,
  payload(model, index, ctx) {
    return hierarchyPayload(model.cells[index]?.node, model.spec, ctx)
  },
  anchor(model, index) {
    const box = model.cells[index]?.box
    if (!box) return undefined
    // A frame's anchor is its header; a cell's, its centre.
    if (model.cells[index]!.frame && box.header) return { x: box.x + box.w / 2, y: box.y + (model.spec.padding + box.header) / 2 }
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  },
  hit(model, point, target) {
    const index = targetIndex(target)
    if (index != null && model.cells[index]) return index
    return cellAt(model, point)
  },
  table(model, ctx) {
    return hierarchyTable(model.tree, model.spec, ctx)
  },
  legend(model) {
    return hierarchyLegend(model.tree)
  },
  overlay(model, ctx) {
    return model.spec.nest ? renderBreadcrumb(model, ctx) : nothing
  },
  pointerDown(model, point, event, ctx) {
    if (!model.spec.nest || event.button !== 0) return false
    const path = event.composedPath()
    const target = path.find((el): el is SVGElement => el instanceof SVGElement && el.dataset.index != null)
    const index = targetIndex(target) ?? cellAt(model, point)
    const node = model.cells[index]?.node
    const zoom = node && zoomTarget(node, model.root)
    if (!zoom) return false
    setZoom(ctx, zoom)
    // What is under the pointer changed: hit-test again once the new level is drawn.
    const plot = event.currentTarget as HTMLElement | null
    const { clientX, clientY, pointerId, pointerType } = event
    void (ctx.host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete?.then(() => {
      const root = plot?.getRootNode() as ShadowRoot | Document | undefined
      const under = root?.elementFromPoint(clientX, clientY) ?? plot
      under?.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY, pointerId, pointerType, bubbles: true, composed: true }))
    })
    return true
  },
  keyDown(model, event, ctx) {
    if (!model.spec.nest || event.altKey || event.ctrlKey || event.metaKey) return undefined
    if (event.key === "Enter") {
      const node = model.cells[ctx.active]?.node
      const zoom = node && zoomTarget(node, model.root)
      if (!zoom) return undefined
      setZoom(ctx, zoom)
      // The first child of the new level.
      return 0
    }
    if ((event.key === "Escape" || event.key === "Backspace") && model.root) {
      const from = model.root
      const up = from.parent
      setZoom(ctx, up)
      // The group we came from, in the level above.
      return (up ? up.children : model.tree.roots).indexOf(from)
    }
    return undefined
  },
}

/** The deepest cell containing `point`, or -1. */
function cellAt(model: TreemapModel, point: Point): number {
  for (let i = model.cells.length - 1; i >= 0; i--) {
    const { box } = model.cells[i]!
    if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return i
  }
  return -1
}

/** Styles of the marks of this module, added to `<tec-chart>`'s shadow root. */
export const treemapStyles = css`
  ${contrastLabelStyles}
  .treemap .cell {
    stroke: var(--tec-background);
    stroke-width: 2px;
  }
  .treemap[data-nest] .cell[data-zoomable] {
    cursor: zoom-in;
  }
  .treemap .header {
    fill: var(--tec-foreground);
    font-weight: 500;
    pointer-events: none;
  }
  .treemap .cell-name {
    font-weight: 500;
  }
  /* The active cell: a foreground ring over the surface gap, and a surface ring inside it, so it
     shows on any fill. */
  .cell-outline {
    fill: none;
    stroke: var(--tec-foreground);
    stroke-width: 2px;
    pointer-events: none;
  }
  .cell-outline .inner {
    stroke: var(--tec-background);
    stroke-width: 1px;
  }
  .treemap-breadcrumb ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    padding: 0.5rem 0 0;
    list-style: none;
    color: var(--tec-muted-foreground);
  }
  .treemap-breadcrumb li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .treemap-breadcrumb li + li::before {
    content: "›";
    content: "›" / "";
  }
  .crumb {
    padding: 0.125rem 0.25rem;
    border: 0;
    border-radius: var(--tec-radius-sm);
    background: none;
    color: inherit;
  }
  button.crumb {
    cursor: pointer;
  }
  button.crumb:hover {
    color: var(--tec-foreground);
    text-decoration: underline;
  }
  .crumb[aria-current] {
    color: var(--tec-foreground);
    font-weight: 500;
  }
  ${focusRing("button.crumb")}
  ${motionSafe(css`
    .treemap {
      animation: tec-chart-treemap-in 300ms var(--tec-ease-out, ease-out) both;
    }
    @keyframes tec-chart-treemap-in {
      from {
        opacity: 0;
      }
    }
  `)}
  @media (forced-colors: active) {
    .treemap .cell {
      forced-color-adjust: none;
      stroke: Canvas;
    }
    .treemap .cell[data-frame] {
      fill: Canvas;
      stroke: CanvasText;
    }
    .treemap .header {
      fill: CanvasText;
    }
    .cell-outline {
      stroke: Highlight;
    }
    .cell-outline .inner {
      stroke: Canvas;
    }
  }
`

declare global {
  interface HTMLElementTagNameMap {
    "tec-chart-treemap": TecChartTreemap
  }
}
