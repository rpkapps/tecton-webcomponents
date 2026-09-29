import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartLegend, TecChartTooltip } from "./chart.js"
import { buildHierarchy, GOLDEN_RATIO, squarify, treemapLayout } from "./chart-hierarchy.js"
import type { Rect } from "./chart-kind.js"
import { zoomTarget } from "./chart-treemap.js"
import "./define.js"

const data = [
  {
    name: "oil",
    children: [
      { name: "Permian", size: 5400 },
      { name: "Gulf of Mexico", size: 1800 },
      { name: "Bakken", size: 1200 },
    ],
  },
  {
    name: "gas",
    children: [
      { name: "Appalachia", size: 3500 },
      { name: "Haynesville", size: 1600 },
    ],
  },
  { name: "ngl", size: 900 },
  { name: "tiny", children: [{ name: "Pilot", size: 5 }] },
]
const config = {
  size: { label: "Production" },
  oil: { label: "Oil", color: "var(--tec-chart-1)" },
  gas: { label: "Natural gas", color: "var(--tec-chart-2)" },
  ngl: { label: "NGL" },
}
const fields = { key: "size", nameKey: "name", childrenKey: "children" }

const shadow = (el: Element) => el.shadowRoot!
const cells = (el: TecChart) => [...shadow(el).querySelectorAll<SVGRectElement>(".treemap .cell")]
const live = (el: TecChart) => shadow(el).querySelector(".base > [aria-live][aria-atomic]")!
const box = (r: SVGRectElement): Rect => ({
  x: Number(r.getAttribute("x")),
  y: Number(r.getAttribute("y")),
  w: Number(r.getAttribute("width")),
  h: Number(r.getAttribute("height")),
})

async function treemap(attrs = "", options: { dir?: "ltr" | "rtl"; theme?: "light" | "dark" } = {}) {
  const wrapper = await fixture<HTMLElement>(
    `<div style="background: var(--tec-background)"><tec-chart style="width: 600px; height: 300px" label="Production by basin">
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-legend></tec-chart-legend>
      <tec-chart-treemap ${attrs}></tec-chart-treemap>
    </tec-chart></div>`,
    options
  )
  const el = wrapper.querySelector("tec-chart") as TecChart
  el.config = config
  el.data = data
  await waitUntil(() => cells(el).length > 0, "treemap drawn")
  await el.updateComplete
  return el
}

const area = (r: Rect) => r.w * r.h
const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6
const aspect = (r: Rect) => Math.max(r.w / r.h, r.h / r.w)

describe("squarify", () => {
  const rect = { x: 0, y: 0, w: 600, h: 400 }

  it("tiles the rectangle with areas proportional to the values", () => {
    const values = [6, 6, 4, 3, 2, 2, 1]
    const rects = squarify(values, rect)
    const total = values.reduce((a, b) => a + b, 0)
    rects.forEach((r, i) => {
      expect(area(r)).toBeCloseTo((values[i]! / total) * area(rect), 6)
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y).toBeGreaterThanOrEqual(-1e-9)
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-9)
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-9)
    })
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false)
    expect(rects.reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(area(rect), 6)
  })

  it("follows the Bruls et al. example with a square target ratio", () => {
    // The paper's example: 6, 6, 4, 3, 2, 2, 1 in a 6 × 4 rectangle.
    const rects = squarify([6, 6, 4, 3, 2, 2, 1], { x: 0, y: 0, w: 6, h: 4 }, 1)
    // First row: the two 6s stacked in a column 3 wide.
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 3, h: 2 })
    expect(rects[1]).toMatchObject({ x: 0, y: 2, w: 3, h: 2 })
    // What is left (3 × 4) is taller than wide: 4 and 3 form a row across its top, 7/3 high.
    expect(rects[2]!.x).toBeCloseTo(3)
    expect(rects[2]!.y).toBeCloseTo(0)
    expect(rects[2]!.h).toBeCloseTo(7 / 3)
    expect(rects[2]!.w).toBeCloseTo(12 / 7)
    expect(rects[3]!.y).toBeCloseTo(0)
    // Every cell of the result stays close to square.
    expect(Math.max(...rects.map(aspect))).toBeLessThan(3)
  })

  it("keeps cells closer to the golden ratio than slicing would", () => {
    const values = [30, 20, 12, 10, 8, 6, 5, 4, 3, 2]
    const rects = squarify(values, rect, GOLDEN_RATIO)
    expect(Math.max(...rects.map(aspect))).toBeLessThan(4)
  })

  it("gives zero and invalid values empty cells and handles empty input", () => {
    const rects = squarify([5, 0, Number.NaN, -3, 5], rect)
    expect(area(rects[1]!)).toBe(0)
    expect(area(rects[2]!)).toBe(0)
    expect(area(rects[3]!)).toBe(0)
    expect(area(rects[0]!)).toBeCloseTo(area(rect) / 2)
    expect(squarify([], rect)).toEqual([])
    expect(squarify([0, 0], rect).every((r) => area(r) === 0)).toBe(true)
    expect(squarify([1, 2], { x: 0, y: 0, w: 0, h: 100 }).every((r) => area(r) === 0)).toBe(true)
  })
})

describe("treemap layout", () => {
  it("builds the tree: sums, depth-first order, largest first, inherited colours", () => {
    const tree = buildHierarchy(data, fields, { sort: true, color: (_row, name) => `color-${name}` })
    expect(tree.total).toBe(5400 + 1800 + 1200 + 3500 + 1600 + 900 + 5)
    expect(tree.depth).toBe(2)
    expect(tree.roots.map((n) => n.name)).toEqual(["oil", "gas", "ngl", "tiny"])
    expect(tree.nodes.map((n) => n.name)).toEqual(["oil", "Permian", "Gulf of Mexico", "Bakken", "gas", "Appalachia", "Haynesville", "ngl", "tiny", "Pilot"])
    expect(tree.nodes.every((n, i) => n.index === i)).toBe(true)
    expect(tree.nodes[0]!.value).toBe(8400)
    expect(tree.nodes[5]!.color).toBe("color-gas")
    // Ids follow the data positions, not the sorted order.
    expect(tree.nodes[5]!.id).toBe("1.0")
    const own = buildHierarchy([{ name: "a", children: [{ name: "b", size: 1, fill: "red" }] }], fields, { color: () => "blue" })
    expect(own.nodes[1]!.color).toBe("red")
  })

  it("keeps the data order without sort and ignores malformed rows", () => {
    const tree = buildHierarchy([{ name: "a", size: 1 }, null, { name: "b", size: 5, children: [] }, 3], fields)
    expect(tree.roots.map((n) => [n.name, n.value])).toEqual([
      ["a", 1],
      ["b", 5],
    ])
  })

  it("insets children by the padding and the header band", () => {
    const tree = buildHierarchy(data, fields, { sort: true })
    const boxes = treemapLayout(tree.roots, { x: 0, y: 0, w: 600, h: 400 }, { padding: 4, header: 20 })
    const oil = boxes.get(tree.nodes[0]!)!
    expect(oil.header).toBe(20)
    for (const child of tree.nodes[0]!.children) {
      const b = boxes.get(child)!
      expect(b.x).toBeGreaterThanOrEqual(oil.x + 4 - 1e-9)
      expect(b.y).toBeGreaterThanOrEqual(oil.y + 24 - 1e-9)
      expect(b.x + b.w).toBeLessThanOrEqual(oil.x + oil.w - 4 + 1e-9)
      expect(b.y + b.h).toBeLessThanOrEqual(oil.y + oil.h - 4 + 1e-9)
    }
    // Without padding, children fill their parent.
    const flat = treemapLayout(tree.roots, { x: 0, y: 0, w: 600, h: 400 })
    const oilFlat = flat.get(tree.nodes[0]!)!
    const childArea = tree.nodes[0]!.children.reduce((sum, c) => sum + area(flat.get(c)!), 0)
    expect(childArea).toBeCloseTo(area(oilFlat), 6)
  })

  it("zooms into the group of a node", () => {
    const tree = buildHierarchy(data, fields, { sort: true })
    const [oil, permian] = tree.nodes
    expect(zoomTarget(oil!, undefined)).toBe(oil)
    expect(zoomTarget(permian!, undefined)).toBe(oil)
    expect(zoomTarget(permian!, oil)).toBeUndefined()
    expect(zoomTarget(tree.nodes[7]!, undefined)).toBeUndefined()
  })
})

describe("tec-chart-treemap", () => {
  it("draws one cell per leaf, coloured by its top-level node, with a surface gap", async () => {
    const el = await treemap()
    const drawn = cells(el)
    expect(drawn).toHaveLength(7)
    expect(drawn.map((c) => c.getAttribute("fill"))).toEqual([
      "var(--tec-chart-color-oil)",
      "var(--tec-chart-color-oil)",
      "var(--tec-chart-color-oil)",
      "var(--tec-chart-color-gas)",
      "var(--tec-chart-color-gas)",
      // No config colour: the palette in data order.
      "var(--tec-chart-3)",
      "var(--tec-chart-4)",
    ])
    const style = getComputedStyle(drawn[0]!)
    expect(style.strokeWidth).toBe("2px")
    expect(style.stroke).toBe(getComputedStyle(el.parentElement!).backgroundColor)
    // Areas proportional to the values, inside the plot (5px margin).
    const boxes = drawn.map(box)
    expect(area(boxes[0]!) / area(boxes[3]!)).toBeCloseTo(5400 / 3500, 3)
    expect(Math.min(...boxes.map((b) => b.x))).toBeCloseTo(5)
    expect(Math.max(...boxes.map((b) => b.x + b.w))).toBeCloseTo(595)
    // The largest cell starts at the top-left corner.
    expect(boxes[0]).toMatchObject({ x: 5, y: 5 })
  })

  it("labels the cells where the name and value fit, in a contrasting colour", async () => {
    const el = await treemap()
    const names = [...shadow(el).querySelectorAll(".cell-name")].map((t) => t.textContent)
    expect(names).toContain("Permian")
    expect(names).toContain("NGL")
    // The 5-unit cell is far too small for a label.
    expect(names).not.toContain("Pilot")
    expect(shadow(el).querySelector(".cell-value")!.textContent).toBe("5,400")
    // Labels never overflow their cell.
    for (const text of shadow(el).querySelectorAll<SVGTextElement>(".contrast-labels text")) {
      const label = text.getBoundingClientRect()
      const cell = cells(el).find((c) => {
        const r = c.getBoundingClientRect()
        return label.left >= r.left && label.right <= r.right && label.top >= r.top && label.bottom <= r.bottom
      })
      expect(cell, text.textContent!).toBeDefined()
    }
    const fill = getComputedStyle(shadow(el).querySelector(".cell-name")!).fill
    expect(luminance(fill)).toBeGreaterThan(0.8)
  })

  it("keeps labels readable on the lighter dark-theme fills", async () => {
    const el = await treemap("", { theme: "dark" })
    const fill = getComputedStyle(shadow(el).querySelector(".cell-name")!).fill
    expect(luminance(fill)).toBeLessThan(0.2)
  })

  it("moves over the nodes depth-first with the keyboard, showing the path", async () => {
    const el = await treemap()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0, "first node on focus")
    await tooltip.updateComplete
    expect(tooltip.label).toBe("Oil")
    expect(tooltip.payload[0]!.value).toBe(8400)
    await waitUntil(() => live(el).textContent === "Oil, Production 8,400", "announcement")
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => live(el).textContent === "Oil › Permian, Production 5,400", "child announced")
    // The active node is outlined.
    expect(shadow(el).querySelector(".cell-outline")).not.toBeNull()
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(9)
    await waitUntil(() => live(el).textContent === "tiny › Pilot, Production 5", "last node")
  })

  it("shows the tooltip of the cell under the pointer", async () => {
    const el = await treemap()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.hover(cells(el)[3]!)
    await waitUntil(() => el.activeIndex === 5, "hovered Appalachia")
    await tooltip.updateComplete
    expect(tooltip.shadowRoot!.querySelector(".label")!.textContent).toBe("Natural gas › Appalachia")
    expect(tooltip.shadowRoot!.querySelector(".name")!.textContent).toBe("Production")
    expect(tooltip.shadowRoot!.querySelector(".value")!.textContent).toBe("3,500")
  })

  it("has a data table with every node, its value and its share of the parent", async () => {
    const el = await treemap()
    const rows = [...shadow(el).querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))
    expect(rows).toHaveLength(10)
    expect(rows[0]).toEqual(["Oil", "8,400", "58.3%"])
    expect(rows[1]).toEqual(["Oil › Permian", "5,400", "64.3%"])
    expect([...shadow(el).querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["name", "Production", "Share of parent"])
    const legend = el.querySelector("tec-chart-legend") as TecChartLegend
    await legend.updateComplete
    expect([...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)).toEqual(["Oil", "Natural gas", "NGL", "tiny"])
    await expectAccessible(el)
  })

  it("draws parent groups as frames with a header when padded", async () => {
    const el = await treemap(`padding="4"`)
    const frames = [...shadow(el).querySelectorAll<SVGRectElement>(".cell[data-frame]")]
    expect(frames).toHaveLength(3)
    expect(frames[0]!.getAttribute("fill")).toContain("color-mix(")
    const headers = [...shadow(el).querySelectorAll(".header")].map((t) => t.textContent)
    expect(headers).toEqual(["Oil", "Natural gas"])
    // A frame is a keyboard item and a hit target of its own.
    await userEvent.hover(frames[0]!, { position: { x: 30, y: 8 } })
    await waitUntil(() => el.activeIndex === 0, "hovered the Oil frame")
  })

  it("mirrors the layout in right-to-left", async () => {
    const el = await treemap("", { dir: "rtl" })
    const [permian] = cells(el)
    const plot = shadow(el).querySelector(".plot")!.getBoundingClientRect()
    const r = permian!.getBoundingClientRect()
    // The largest cell starts at the inline-start (right) edge.
    expect(plot.right - r.right).toBeLessThan(8)
    // Its label sits at the right of the cell and reads normally.
    const label = shadow(el).querySelector(".cell-name")!.getBoundingClientRect()
    expect(r.right - label.right).toBeGreaterThan(3)
    expect(r.right - label.right).toBeLessThan(10)
    expect(label.left).toBeGreaterThan(r.left)
  })

  it("shows one level and zooms into a group with Enter, back up with Escape (nest)", async () => {
    const el = await treemap("nest")
    // The top-level nodes, sized by their totals and labelled with them.
    expect(cells(el)).toHaveLength(4)
    expect(area(box(cells(el)[0]!)) / area(box(cells(el)[1]!))).toBeCloseTo(8400 / 5100, 3)
    expect([...shadow(el).querySelectorAll(".cell-value")].map((t) => t.textContent)).toContain("8,400")
    const crumbs = () => [...shadow(el).querySelectorAll(".treemap-breadcrumb li")].map((li) => li.textContent!.trim())
    expect(crumbs()).toEqual(["All"])
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await userEvent.keyboard("{Enter}")
    // Only Oil's children, and the first one is active.
    await waitUntil(() => cells(el).length === 3, "zoomed into Oil")
    expect(el.activeIndex).toBe(0)
    expect(crumbs()).toEqual(["All", "Oil"])
    expect(shadow(el).querySelector(".treemap-breadcrumb [aria-current]")!.textContent).toBe("Oil")
    expect(shadow(el).querySelector(".treemap-breadcrumb + [aria-live]")!.textContent).toBe("All › Oil")
    await waitUntil(() => live(el).textContent === "Oil › Permian, Production 5,400", "first child announced")
    // The zoomed level fills the plot.
    expect(box(cells(el)[0]!)).toMatchObject({ x: 5, y: 5 })
    const total = cells(el).reduce((sum, c) => sum + area(box(c)), 0)
    const svgEl = shadow(el).querySelector("svg")!
    expect(total).toBeCloseTo((Number(svgEl.getAttribute("width")) - 10) * (Number(svgEl.getAttribute("height")) - 10), 0)
    await userEvent.keyboard("{ArrowRight}{Enter}")
    // A leaf has nothing to zoom into.
    expect(cells(el)).toHaveLength(3)
    expect(el.activeIndex).toBe(1)
    await userEvent.keyboard("{Backspace}")
    await waitUntil(() => cells(el).length === 4, "back to the top")
    // The group we came from is active.
    expect(el.activeIndex).toBe(0)
    expect(crumbs()).toEqual(["All"])
    expect(shadow(el).querySelector(".treemap-breadcrumb + [aria-live]")!.textContent).toBe("All")
    await userEvent.keyboard("{ArrowRight}{Enter}")
    await waitUntil(() => cells(el).length === 2, "zoomed into gas")
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => cells(el).length === 4, "back to the top")
    expect(el.activeIndex).toBe(1)
    // At the top, Escape hides the tooltip as usual.
    await userEvent.keyboard("{Escape}")
    expect(el.activeIndex).toBe(-1)
  })

  it("announces the new level's first cell without a tooltip", async () => {
    const el = await fixture<TecChart>(`<tec-chart style="width: 600px; height: 300px" label="Production"><tec-chart-treemap nest></tec-chart-treemap></tec-chart>`)
    el.config = config
    el.data = data
    await waitUntil(() => cells(el).length === 4, "drawn")
    await userEvent.tab()
    await waitUntil(() => live(el).textContent === "Oil, Production 8,400", "top level announced")
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => live(el).textContent === "Oil › Permian, Production 5,400", "first child announced")
  })

  it("zooms with a click and goes back with the breadcrumb", async () => {
    const el = await treemap("nest")
    await userEvent.click(cells(el)[1]!)
    await waitUntil(() => cells(el).length === 2, "zoomed into gas")
    expect(cells(el)[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-gas)")
    // The pointer is hit-tested again on the new level.
    await waitUntil(() => el.activeIndex >= 0, "hover re-evaluated")
    const button = shadow(el).querySelector<HTMLButtonElement>(".treemap-breadcrumb button")!
    expect(button.textContent).toBe("All")
    await userEvent.click(button)
    await waitUntil(() => cells(el).length === 4, "back to the top")
    expect(shadow(el).activeElement).toBe(shadow(el).querySelector(".plot"))
    await expectAccessible(el)
  })

  it("goes back to the nearest level that still exists when the data changes", async () => {
    const el = await treemap("nest")
    await userEvent.click(cells(el)[0]!)
    await waitUntil(() => cells(el).length === 3, "zoomed into oil")
    el.data = [{ name: "oil", size: 10 }, data[1]!]
    await waitUntil(() => cells(el).length === 2 && cells(el)[1]!.getAttribute("fill") === "var(--tec-chart-color-oil)", "top level")
    expect(shadow(el).querySelector(".treemap-breadcrumb [aria-current]")!.textContent).toBe("All")
  })
})

/** Relative luminance (0–1) of an `rgb()` / `color(srgb …)` / `oklch()` computed colour. */
function luminance(color: string): number {
  const probe = document.createElement("canvas").getContext("2d")!
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = [...probe.getImageData(0, 0, 1, 1).data].map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
