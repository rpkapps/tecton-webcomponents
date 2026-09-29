/**
 * @module chart-sankey-engine
 * The geometry of a sankey diagram: cycle removal, node columns, node heights proportional to their
 * flow, iterative relaxation that pulls connected nodes level with each other (fewer crossings), and
 * link ribbons. Pure functions over numbers — no DOM — so they are cheap to test.
 *
 * The layout follows d3-sankey (the algorithm behind the sankey diagrams of the charting libraries
 * the Tecton charts are modelled on): columns by longest path from the sources, `justify` alignment
 * by default, relaxation with a decaying `alpha` that moves each node to the weighted position its
 * links ask for, then collision resolution that keeps `nodePadding` between the nodes of a column.
 */

/** A link between two nodes, by node index. */
export interface SankeyInputLink {
  source: number
  target: number
  value: number
}

/** How nodes are assigned to columns. */
export type SankeyAlign = "justify" | "start" | "end" | "center"

export interface SankeyOptions {
  /** The rectangle the nodes are laid out in (links run between the nodes, inside it too). */
  x0: number
  y0: number
  x1: number
  y1: number
  /** Width of a node, in pixels. */
  nodeWidth: number
  /** Minimum vertical gap between two nodes of a column, in pixels. */
  nodePadding: number
  /** Relaxation passes (0: nodes stay stacked in data order). */
  iterations: number
  align: SankeyAlign
}

export interface SankeyNodeLayout {
  /** Index in the input nodes. */
  index: number
  /** Longest path (in links) from a source. */
  depth: number
  /** Longest path (in links) to a sink. */
  height: number
  /** The column the node is drawn in. */
  column: number
  x0: number
  x1: number
  y0: number
  y1: number
  /** Sum of the incoming links. */
  in: number
  /** Sum of the outgoing links. */
  out: number
  /** `max(in, out)`: the node's height is proportional to it. */
  value: number
  /** Outgoing links (indexes into `links`), from top to bottom. */
  sourceLinks: number[]
  /** Incoming links (indexes into `links`), from top to bottom. */
  targetLinks: number[]
}

export interface SankeyLinkLayout {
  /** Index in the input links. */
  index: number
  source: number
  target: number
  value: number
  /** Thickness of the ribbon, in pixels (proportional to `value`). */
  width: number
  /** Vertical centre of the ribbon where it leaves the source node. */
  y0: number
  /** Vertical centre of the ribbon where it enters the target node. */
  y1: number
}

export interface SankeyLayout {
  /** One entry per input node (nodes without links have `value` 0 and no height). */
  nodes: SankeyNodeLayout[]
  /** The links that were laid out (valid, positive and not closing a cycle), in input order. */
  links: SankeyLinkLayout[]
  /** Indexes of input links left out: unknown nodes, self-links, non-positive values or cycles. */
  dropped: number[]
  /** The links left out because they would close a cycle (a subset of `dropped`). */
  cyclic: number[]
  /** Number of columns. */
  columns: number
}

/**
 * Removes the links that would close a cycle: a depth-first walk in node order drops every link
 * back to a node that is still on the walk's stack. The remaining graph is acyclic. Returns the
 * indexes of the dropped links.
 */
export function findCyclicLinks(nodeCount: number, links: SankeyInputLink[]): number[] {
  const out: number[][] = Array.from({ length: nodeCount }, () => [])
  links.forEach((link, i) => out[link.source]?.push(i))
  const state = new Uint8Array(nodeCount) // 0 new, 1 on stack, 2 done
  const dropped: number[] = []
  for (let start = 0; start < nodeCount; start++) {
    if (state[start]) continue
    // Iterative DFS: a stack of (node, next outgoing link position).
    const stack: [number, number][] = [[start, 0]]
    state[start] = 1
    while (stack.length) {
      const top = stack[stack.length - 1]!
      const [node, position] = top
      const edges = out[node]!
      if (position >= edges.length) {
        state[node] = 2
        stack.pop()
        continue
      }
      top[1]++
      const linkIndex = edges[position]!
      const target = links[linkIndex]!.target
      if (state[target] === 1) dropped.push(linkIndex)
      else if (state[target] === 0) {
        state[target] = 1
        stack.push([target, 0])
      }
    }
  }
  return dropped.sort((a, b) => a - b)
}

/**
 * Lays out a sankey diagram. Links to unknown nodes, self-links, links with a non-positive value and
 * links that would close a cycle are left out (listed in `dropped`).
 */
export function sankeyLayout(nodeCount: number, input: SankeyInputLink[], options: SankeyOptions): SankeyLayout {
  const { x0, y0, x1, y1, nodeWidth: dx, iterations, align } = options
  const dropped: number[] = []
  const candidates: { link: SankeyInputLink; index: number }[] = []
  input.forEach((link, index) => {
    const ok =
      Number.isInteger(link.source) &&
      Number.isInteger(link.target) &&
      link.source >= 0 &&
      link.source < nodeCount &&
      link.target >= 0 &&
      link.target < nodeCount &&
      link.source !== link.target &&
      Number.isFinite(link.value) &&
      link.value > 0
    if (ok) candidates.push({ link, index })
    else dropped.push(index)
  })
  const cyclicLocal = new Set(
    findCyclicLinks(
      nodeCount,
      candidates.map((c) => c.link)
    )
  )
  const cyclic = candidates.filter((_, i) => cyclicLocal.has(i)).map((c) => c.index)
  dropped.push(...cyclic)
  dropped.sort((a, b) => a - b)
  const kept = candidates.filter((_, i) => !cyclicLocal.has(i))

  const nodes: SankeyNodeLayout[] = Array.from({ length: nodeCount }, (_, index) => ({
    index,
    depth: 0,
    height: 0,
    column: 0,
    x0: 0,
    x1: 0,
    y0: 0,
    y1: 0,
    in: 0,
    out: 0,
    value: 0,
    sourceLinks: [],
    targetLinks: [],
  }))
  const links: SankeyLinkLayout[] = kept.map(({ link, index }) => ({
    index,
    source: link.source,
    target: link.target,
    value: link.value,
    width: 0,
    y0: 0,
    y1: 0,
  }))
  links.forEach((link, i) => {
    nodes[link.source]!.sourceLinks.push(i)
    nodes[link.target]!.targetLinks.push(i)
    nodes[link.source]!.out += link.value
    nodes[link.target]!.in += link.value
  })
  for (const node of nodes) node.value = Math.max(node.in, node.out)

  // Depths and heights: longest paths in a topological order (the graph is acyclic).
  const order = topologicalOrder(nodes, links)
  for (const n of order) for (const l of nodes[n]!.sourceLinks) nodes[links[l]!.target]!.depth = Math.max(nodes[links[l]!.target]!.depth, nodes[n]!.depth + 1)
  for (let i = order.length - 1; i >= 0; i--) {
    const node = nodes[order[i]!]!
    for (const l of node.targetLinks) nodes[links[l]!.source]!.height = Math.max(nodes[links[l]!.source]!.height, node.height + 1)
  }

  // Columns.
  const linked = nodes.filter((n) => n.value > 0)
  const maxDepth = linked.reduce((m, n) => Math.max(m, n.depth), 0)
  const columnCount = linked.length ? maxDepth + 1 : 0
  for (const node of nodes) {
    let column: number
    if (align === "start") column = node.depth
    else if (align === "end") column = maxDepth - node.height
    else if (align === "center") {
      if (node.targetLinks.length) column = node.depth
      else if (node.sourceLinks.length) column = Math.min(...node.sourceLinks.map((l) => nodes[links[l]!.target]!.depth)) - 1
      else column = 0
    } else column = node.sourceLinks.length ? node.depth : maxDepth
    node.column = Math.max(0, Math.min(maxDepth, column))
  }
  const columns: SankeyNodeLayout[][] = Array.from({ length: columnCount }, () => [])
  for (const node of linked) columns[node.column]!.push(node)
  const kx = columnCount > 1 ? (x1 - x0 - dx) / (columnCount - 1) : 0
  for (const node of nodes) {
    node.x0 = columnCount > 1 ? x0 + node.column * kx : (x0 + x1 - dx) / 2
    node.x1 = node.x0 + dx
  }

  // Vertical scale: the fullest column fills the height; padding shrinks when a column is crowded.
  const tallest = columns.reduce((m, c) => Math.max(m, c.length), 0)
  const py = tallest > 1 ? Math.min(options.nodePadding, ((y1 - y0) * 0.5) / (tallest - 1)) : options.nodePadding
  let ky = Infinity
  for (const column of columns) {
    const total = column.reduce((s, n) => s + n.value, 0)
    if (total > 0) ky = Math.min(ky, (y1 - y0 - (column.length - 1) * py) / total)
  }
  if (!Number.isFinite(ky)) ky = 0
  for (const link of links) link.width = link.value * ky

  const breadth = (a: SankeyNodeLayout, b: SankeyNodeLayout) => a.y0 - b.y0
  const bySource = (a: number, b: number) => breadth(nodes[links[a]!.source]!, nodes[links[b]!.source]!) || a - b
  const byTarget = (a: number, b: number) => breadth(nodes[links[a]!.target]!, nodes[links[b]!.target]!) || a - b
  const reorderLinks = (list: SankeyNodeLayout[]) => {
    for (const node of list) {
      node.sourceLinks.sort(byTarget)
      node.targetLinks.sort(bySource)
    }
  }
  const reorderNodeLinks = (node: SankeyNodeLayout) => {
    for (const l of node.targetLinks) nodes[links[l]!.source]!.sourceLinks.sort(byTarget)
    for (const l of node.sourceLinks) nodes[links[l]!.target]!.targetLinks.sort(bySource)
  }

  // Initial positions: stacked in data order, the spare height spread evenly.
  for (const column of columns) {
    let y = y0
    for (const node of column) {
      node.y0 = y
      node.y1 = y + node.value * ky
      y = node.y1 + py
    }
    const spare = (y1 - y + py) / (column.length + 1)
    column.forEach((node, i) => {
      node.y0 += spare * (i + 1)
      node.y1 += spare * (i + 1)
    })
    reorderLinks(column)
  }

  // The y0 of `target` that would make the link from `source` level.
  const targetTop = (source: SankeyNodeLayout, target: SankeyNodeLayout) => {
    let y = source.y0 - ((source.sourceLinks.length - 1) * py) / 2
    for (const l of source.sourceLinks) {
      const link = links[l]!
      if (link.target === target.index) break
      y += link.width + py
    }
    for (const l of target.targetLinks) {
      const link = links[l]!
      if (link.source === source.index) break
      y -= link.width
    }
    return y
  }
  const sourceTop = (source: SankeyNodeLayout, target: SankeyNodeLayout) => {
    let y = target.y0 - ((target.targetLinks.length - 1) * py) / 2
    for (const l of target.targetLinks) {
      const link = links[l]!
      if (link.source === source.index) break
      y += link.width + py
    }
    for (const l of source.sourceLinks) {
      const link = links[l]!
      if (link.target === target.index) break
      y -= link.width
    }
    return y
  }

  const pushDown = (column: SankeyNodeLayout[], y: number, from: number, alpha: number) => {
    for (let i = from; i < column.length; i++) {
      const node = column[i]!
      const dy = (y - node.y0) * alpha
      if (dy > 1e-6) {
        node.y0 += dy
        node.y1 += dy
      }
      y = node.y1 + py
    }
  }
  const pushUp = (column: SankeyNodeLayout[], y: number, from: number, alpha: number) => {
    for (let i = from; i >= 0; i--) {
      const node = column[i]!
      const dy = (node.y1 - y) * alpha
      if (dy > 1e-6) {
        node.y0 -= dy
        node.y1 -= dy
      }
      y = node.y0 - py
    }
  }
  const resolveCollisions = (column: SankeyNodeLayout[], alpha: number) => {
    const i = column.length >> 1
    const subject = column[i]
    if (!subject) return
    pushUp(column, subject.y0 - py, i - 1, alpha)
    pushDown(column, subject.y1 + py, i + 1, alpha)
    pushUp(column, y1, column.length - 1, alpha)
    pushDown(column, y0, 0, alpha)
  }

  for (let i = 0; i < iterations; i++) {
    const alpha = 0.99 ** i
    const beta = Math.max(1 - alpha, (i + 1) / iterations)
    // Right to left: each source moves towards its targets.
    for (let c = columns.length - 2; c >= 0; c--) {
      const column = columns[c]!
      for (const source of column) {
        let y = 0
        let w = 0
        for (const l of source.sourceLinks) {
          const link = links[l]!
          const target = nodes[link.target]!
          const v = link.value * (target.column - source.column)
          y += sourceTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        const dy = (y / w - source.y0) * alpha
        source.y0 += dy
        source.y1 += dy
        reorderNodeLinks(source)
      }
      column.sort(breadth)
      resolveCollisions(column, beta)
    }
    // Left to right: each target moves towards its sources.
    for (let c = 1; c < columns.length; c++) {
      const column = columns[c]!
      for (const target of column) {
        let y = 0
        let w = 0
        for (const l of target.targetLinks) {
          const link = links[l]!
          const source = nodes[link.source]!
          const v = link.value * (target.column - source.column)
          y += targetTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        const dy = (y / w - target.y0) * alpha
        target.y0 += dy
        target.y1 += dy
        reorderNodeLinks(target)
      }
      column.sort(breadth)
      resolveCollisions(column, beta)
    }
  }
  for (const column of columns) column.sort(breadth)
  reorderLinks(linked)

  // Where each link leaves its source and enters its target.
  for (const node of linked) {
    let a = node.y0
    let b = node.y0
    for (const l of node.sourceLinks) {
      const link = links[l]!
      link.y0 = a + link.width / 2
      a += link.width
    }
    for (const l of node.targetLinks) {
      const link = links[l]!
      link.y1 = b + link.width / 2
      b += link.width
    }
  }
  return { nodes, links, dropped, cyclic, columns: columnCount }
}

function topologicalOrder(nodes: SankeyNodeLayout[], links: SankeyLinkLayout[]): number[] {
  const indegree = nodes.map((n) => n.targetLinks.length)
  const queue = nodes.filter((_, i) => indegree[i] === 0).map((n) => n.index)
  const order: number[] = []
  while (queue.length) {
    const n = queue.shift()!
    order.push(n)
    for (const l of nodes[n]!.sourceLinks) {
      const t = links[l]!.target
      if (--indegree[t]! === 0) queue.push(t)
    }
  }
  return order
}

/**
 * The ribbon of a link: a band of constant vertical thickness `width` from `(sx, sy)` (centre at the
 * source) to `(tx, ty)`, its edges cubic curves whose control points sit `curvature` of the way
 * along (0.5: a symmetric S).
 */
export function sankeyLinkPath(sx: number, sy: number, tx: number, ty: number, width: number, curvature = 0.5): string {
  const h = width / 2
  const c0 = sx + (tx - sx) * curvature
  const c1 = tx - (tx - sx) * curvature
  const f = (v: number) => Math.round(v * 100) / 100
  return (
    `M${f(sx)},${f(sy - h)}C${f(c0)},${f(sy - h)} ${f(c1)},${f(ty - h)} ${f(tx)},${f(ty - h)}` +
    `L${f(tx)},${f(ty + h)}C${f(c1)},${f(ty + h)} ${f(c0)},${f(sy + h)} ${f(sx)},${f(sy + h)}Z`
  )
}

/**
 * The centre line of a link ribbon at `x` (between `sx` and `tx`): the curve's `y` there, found by
 * bisection on the curve parameter (x grows monotonically along the curve for curvatures in [0, 1]).
 */
export function sankeyLinkY(sx: number, sy: number, tx: number, ty: number, x: number, curvature = 0.5): number {
  const c0 = sx + (tx - sx) * curvature
  const c1 = tx - (tx - sx) * curvature
  const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const u = 1 - t
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  }
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (bezier(sx, c0, c1, tx, mid) < x) lo = mid
    else hi = mid
  }
  return bezier(sy, sy, ty, ty, (lo + hi) / 2)
}
