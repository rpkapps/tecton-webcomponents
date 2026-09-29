import { html } from "lit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartSankey, TecChartTooltip } from "./chart.js"
import { fitText } from "./chart-sankey.js"
import { findCyclicLinks, sankeyLayout, sankeyLinkPath, sankeyLinkY, type SankeyOptions } from "./chart-sankey-engine.js"
import "./define.js"

const box: SankeyOptions = { x0: 0, y0: 0, x1: 300, y1: 200, nodeWidth: 10, nodePadding: 10, iterations: 32, align: "justify" }

describe("sankey layout", () => {
  it("drops the links that close a cycle", () => {
    // 0 → 1 → 2 → 0, and 2 → 3.
    const links = [
      { source: 0, target: 1, value: 1 },
      { source: 1, target: 2, value: 1 },
      { source: 2, target: 0, value: 1 },
      { source: 2, target: 3, value: 1 },
    ]
    expect(findCyclicLinks(4, links)).toEqual([2])
    const layout = sankeyLayout(4, links, box)
    expect(layout.cyclic).toEqual([2])
    expect(layout.dropped).toEqual([2])
    expect(layout.links.map((l) => l.index)).toEqual([0, 1, 3])
    expect(layout.nodes.map((n) => n.column)).toEqual([0, 1, 2, 3])
  })

  it("leaves out invalid links", () => {
    const layout = sankeyLayout(
      2,
      [
        { source: 0, target: 1, value: 5 },
        { source: 0, target: 0, value: 5 },
        { source: 0, target: 7, value: 5 },
        { source: 0, target: 1, value: 0 },
        { source: -1, target: 1, value: 3 },
      ],
      box
    )
    expect(layout.dropped).toEqual([1, 2, 3, 4])
    expect(layout.cyclic).toEqual([])
    expect(layout.links).toHaveLength(1)
  })

  it("places nodes in columns by their longest path from a source", () => {
    // 0 → 1 → 2, 0 → 2 (2 is two steps away), 0 → 3 (a sink, justified to the last column).
    const links = [
      { source: 0, target: 1, value: 10 },
      { source: 1, target: 2, value: 10 },
      { source: 0, target: 2, value: 5 },
      { source: 0, target: 3, value: 5 },
    ]
    const justify = sankeyLayout(4, links, box)
    expect(justify.columns).toBe(3)
    expect(justify.nodes.map((n) => n.depth)).toEqual([0, 1, 2, 1])
    expect(justify.nodes.map((n) => n.column)).toEqual([0, 1, 2, 2])
    expect(justify.nodes.map((n) => n.x0)).toEqual([0, 145, 290, 290])
    const start = sankeyLayout(4, links, { ...box, align: "start" })
    expect(start.nodes.map((n) => n.column)).toEqual([0, 1, 2, 1])
    const end = sankeyLayout(5, [...links, { source: 4, target: 1, value: 1 }], { ...box, align: "end" })
    expect(end.nodes[4]!.column).toBe(0)
    expect(end.nodes[3]!.column).toBe(2)
  })

  it("sizes nodes by their flow and stacks links inside them", () => {
    const links = [
      { source: 0, target: 2, value: 30 },
      { source: 1, target: 2, value: 10 },
      { source: 2, target: 3, value: 25 },
    ]
    const layout = sankeyLayout(4, links, box)
    const [a, b, c, d] = layout.nodes
    expect(c!.in).toBe(40)
    expect(c!.out).toBe(25)
    expect(c!.value).toBe(40)
    // The fullest column (the sources: 40 + one gap) fills the height.
    const ky = (200 - 10) / 40
    expect(a!.y1 - a!.y0).toBeCloseTo(30 * ky)
    expect(b!.y1 - b!.y0).toBeCloseTo(10 * ky)
    expect(d!.y1 - d!.y0).toBeCloseTo(25 * ky)
    expect(b!.y0 - a!.y1).toBeGreaterThanOrEqual(10 - 1e-6)
    for (const node of layout.nodes) {
      expect(node.y0).toBeGreaterThanOrEqual(-1e-6)
      expect(node.y1).toBeLessThanOrEqual(200 + 1e-6)
    }
    // Incoming links of c stack from its top without gaps.
    const [first, second] = c!.targetLinks.map((i) => layout.links[i]!)
    expect(first!.y1 - first!.width / 2).toBeCloseTo(c!.y0)
    expect(second!.y1 - second!.width / 2).toBeCloseTo(first!.y1 + first!.width / 2)
    expect(layout.links[0]!.width).toBeCloseTo(30 * ky)
  })

  it("relaxes the node order to remove crossings", () => {
    // Data order puts the targets the wrong way round: 0 → 3 and 1 → 2.
    const links = [
      { source: 0, target: 3, value: 10 },
      { source: 1, target: 2, value: 10 },
    ]
    // Whether the two links cross: their sources and targets are in opposite orders.
    const crosses = (layout: ReturnType<typeof sankeyLayout>) => {
      const [a, b, c, d] = layout.nodes
      return a!.y0 < b!.y0 !== d!.y0 < c!.y0
    }
    expect(crosses(sankeyLayout(4, links, { ...box, iterations: 0 }))).toBe(true)
    const relaxed = sankeyLayout(4, links, box)
    expect(crosses(relaxed)).toBe(false)
    // Each link runs level.
    expect(relaxed.links[0]!.y0).toBeCloseTo(relaxed.links[0]!.y1, 0)
    expect(relaxed.links[1]!.y0).toBeCloseTo(relaxed.links[1]!.y1, 0)
  })

  it("draws link ribbons as S curves", () => {
    expect(sankeyLinkPath(0, 10, 100, 50, 4)).toBe("M0,8C50,8 50,48 100,48L100,52C50,52 50,12 0,12Z")
    expect(sankeyLinkY(0, 10, 100, 50, 0)).toBeCloseTo(10)
    expect(sankeyLinkY(0, 10, 100, 50, 100)).toBeCloseTo(50)
    expect(sankeyLinkY(0, 10, 100, 50, 50)).toBeCloseTo(30)
    expect(sankeyLinkY(0, 10, 100, 50, 25)).toBeLessThan(30)
  })

  it("shortens text with an ellipsis", () => {
    const measure = (t: string) => t.length * 10
    expect(fitText("Refinery", 80, measure)).toBe("Refinery")
    expect(fitText("Refinery", 50, measure)).toBe("Refi…")
    expect(fitText("Refinery", 5, measure)).toBe("")
  })
})

const nodes = [{ name: "north" }, { name: "permian" }, { name: "refinery" }, { name: "terminal" }, { name: "gasoline" }, { name: "exports" }]
const links = [
  { source: "north", target: "refinery", value: 120 },
  { source: "north", target: "terminal", value: 60 },
  { source: "permian", target: "refinery", value: 160 },
  { source: 1, target: 3, value: 40 },
  { source: "refinery", target: "gasoline", value: 280 },
  { source: "terminal", target: "exports", value: 100 },
]
const config = {
  value: { label: "kbbl/d" },
  north: { label: "North Sea", color: "var(--tec-chart-1)" },
  permian: { label: "Permian", color: "var(--tec-chart-2)" },
  refinery: { label: "Refinery" },
  terminal: { label: "Export terminal" },
  gasoline: { label: "Gasoline" },
  exports: { label: "Crude exports" },
}

const shadow = (el: Element) => el.shadowRoot!
const nodeRects = (el: TecChart) => [...shadow(el).querySelectorAll<SVGRectElement>(".node")]
const linkPaths = (el: TecChart) => [...shadow(el).querySelectorAll<SVGPathElement>(".link")]
const labelTexts = (el: TecChart) => [...shadow(el).querySelectorAll<SVGTextElement>(".node-label")]

async function sankeyChart(options: { dir?: "ltr" | "rtl"; width?: number; extra?: unknown; attrs?: Partial<TecChartSankey> } = {}) {
  const el = await fixture<TecChart>(
    html`<tec-chart style="width: ${options.width ?? 600}px; height: 300px" label="Crude flows" .data=${nodes} .config=${config}>
      <tec-chart-tooltip></tec-chart-tooltip>
      ${options.extra ?? ""}
      <tec-chart-sankey .links=${links} link-color=${options.attrs?.linkColor ?? "source"}></tec-chart-sankey>
    </tec-chart>`,
    { dir: options.dir }
  )
  await waitUntil(() => nodeRects(el).length === 6, "sankey drawn")
  await el.updateComplete
  return el
}

describe("tec-chart-sankey", () => {
  afterEach(() => vi.restoreAllMocks())

  it("draws the nodes in columns and the links as thick as their value", async () => {
    const el = await sankeyChart()
    expect(shadow(el).querySelector(".plot")!.getAttribute("data-kind")).toBe("sankey")
    expect(shadow(el).querySelector(".plot")!.getAttribute("aria-label")).toBe("Crude flows")
    const rects = nodeRects(el)
    // Keyboard order: column by column, top to bottom.
    const x = rects.map((r) => Number(r.getAttribute("x")))
    expect(x[0]).toBe(x[1])
    expect(x[2]).toBe(x[3])
    expect(x[4]).toBe(x[5])
    expect(x[0]).toBeLessThan(x[2]!)
    expect(x[2]).toBeLessThan(x[4]!)
    // Colours: config colour, else the palette by node index.
    expect(rects[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-north)")
    expect(rects.find((r) => r.getAttribute("fill") === "var(--tec-chart-3)")).toBeTruthy()
    // Links take their source's colour; widths follow the values (280 vs 100 into the last column).
    const paths = linkPaths(el)
    expect(paths).toHaveLength(6)
    expect(paths[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-north)")
    const heights = rects.map((r) => Number(r.getAttribute("height")))
    const [top, bottom] = [heights[4]!, heights[5]!].sort((a, b) => b - a)
    expect(top! / bottom!).toBeCloseTo(280 / 100, 1)
    // Links stop 2px short of the nodes (the surface gap).
    const first = paths[0]!.getBBox()
    expect(first.x).toBeCloseTo(x[0]! + 10 + 2, 0)
  })

  it("labels nodes towards the next column and keeps the labels inside the chart", async () => {
    const el = await sankeyChart({ width: 360 })
    const labels = labelTexts(el)
    expect(labels.length).toBeGreaterThanOrEqual(4)
    const chartBox = el.getBoundingClientRect()
    for (const label of labels) {
      const b = label.getBoundingClientRect()
      expect(b.left).toBeGreaterThanOrEqual(chartBox.left)
      expect(b.right).toBeLessThanOrEqual(chartBox.right)
    }
    const rects = nodeRects(el)
    const byText = (t: string) => labels.find((l) => l.textContent!.startsWith(t))!
    // First column: to the right of the node; last column: to its left.
    expect(byText("North").getBoundingClientRect().left).toBeGreaterThan(rects[0]!.getBoundingClientRect().right)
    expect(byText("Gasoline").getBoundingClientRect().right).toBeLessThan(rects[4]!.getBoundingClientRect().left)
    // No two labels overlap.
    const boxes = labels.map((l) => l.getBoundingClientRect())
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
        expect(overlap).toBe(false)
      })
    )
  })

  it("moves over the nodes and then the links with the keyboard", async () => {
    const el = await sankeyChart()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0, "first node on focus")
    await tooltip.updateComplete
    await waitUntil(() => tooltip.matches(":state(active)"))
    expect(tooltip.shadowRoot!.querySelector(".label")!.textContent).toBe("North Sea")
    expect([...tooltip.shadowRoot!.querySelectorAll(".name")].map((n) => n.textContent)).toEqual(["Outgoing"])
    expect(tooltip.shadowRoot!.querySelector(".value")!.textContent).toBe("180")
    // The node and its links are highlighted.
    expect(nodeRects(el)[0]!.hasAttribute("data-active")).toBe(true)
    expect(linkPaths(el).filter((p) => p.hasAttribute("data-highlight"))).toHaveLength(2)
    const live = shadow(el).querySelector("[aria-live]")!
    await waitUntil(() => live.textContent === "North Sea, Outgoing 180", "announcement")

    // The refinery (second column): incoming and outgoing.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    await waitUntil(() => el.activeIndex === 2)
    const refineryFirst = tooltip.shadowRoot!.querySelector(".label")!.textContent
    expect(["Refinery", "Export terminal"]).toContain(refineryFirst)
    await waitUntil(() => tooltip.shadowRoot!.querySelectorAll(".name").length === 2)

    // After the six nodes come the links.
    await userEvent.keyboard("{Home}")
    for (let i = 0; i < 6; i++) await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => el.activeIndex === 6)
    await tooltip.updateComplete
    expect(tooltip.shadowRoot!.querySelector(".label")!.textContent).toBe("kbbl/d")
    expect(tooltip.shadowRoot!.querySelector(".name")!.textContent).toBe("⁨North Sea⁩ → ⁨Refinery⁩")
    expect(tooltip.shadowRoot!.querySelector(".value")!.textContent).toBe("120")
    expect(linkPaths(el).filter((p) => p.hasAttribute("data-highlight"))).toHaveLength(1)
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(11)
  })

  it("lists every link and the node totals in the data table", async () => {
    const el = await sankeyChart()
    const [flows, totals] = shadow(el).querySelectorAll("table")
    expect(flows!.querySelector("caption")!.textContent).toBe("Crude flows")
    expect([...flows!.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Source", "Target", "kbbl/d"])
    const rows = [...flows!.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))
    expect(rows).toHaveLength(6)
    expect(rows).toContainEqual(["Permian", "Export terminal", "40"])
    expect(totals!.querySelector("caption")!.textContent).toBe("Crude flows: Node totals")
    const refinery = [...totals!.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))[2]
    expect(refinery).toEqual(["Refinery", "280", "280"])
    await expectAccessible(el)
  })

  it("shows the tooltip of the link or node under the pointer", async () => {
    const el = await sankeyChart()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    const link = linkPaths(el).find((p) => p.dataset.index === "9")!
    await userEvent.hover(link, { position: { x: link.getBBox().width / 2, y: link.getBBox().height / 2 } })
    await waitUntil(() => el.activeIndex >= 6, "a link under the pointer")
    await tooltip.updateComplete
    expect(tooltip.payload[0]!.name).toContain("→")
    await userEvent.hover(nodeRects(el)[5]!)
    await waitUntil(() => el.activeIndex === 5, "the node under the pointer")
  })

  it("colours links with a gradient from source to target", async () => {
    const el = await sankeyChart({ attrs: { linkColor: "gradient" } })
    const path = linkPaths(el)[0]!
    expect(path.getAttribute("fill")).toBe("url(#sankey-link-6)")
    const gradient = shadow(el).querySelector("#sankey-link-6")!
    expect([...gradient.querySelectorAll("stop")].map((s) => s.getAttribute("stop-color"))).toEqual(["var(--tec-chart-color-north)", nodeRects(el).find((r) => r.dataset.index === "2")!.getAttribute("fill")])
  })

  it("flows from the right in RTL and keeps its labels readable", async () => {
    const el = await sankeyChart({ dir: "rtl" })
    const rects = nodeRects(el)
    expect(rects[0]!.getBoundingClientRect().left).toBeGreaterThan(rects[4]!.getBoundingClientRect().left)
    const north = labelTexts(el).find((l) => l.textContent === "North Sea")!
    // The first column's labels sit to the left of their node (towards the next column).
    expect(north.getBoundingClientRect().right).toBeLessThan(rects[0]!.getBoundingClientRect().left)
    await userEvent.tab()
    await userEvent.keyboard("{End}")
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await waitUntil(() => tooltip.payload[0]?.name.includes("←"), "arrow in reading direction")
  })

  it("leaves out the links that would close a cycle, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 400px; height: 200px" .data=${[{ name: "a" }, { name: "b" }, { name: "c" }]}>
        <tec-chart-sankey
          .links=${[
            { source: "a", target: "b", value: 2 },
            { source: "b", target: "c", value: 2 },
            { source: "c", target: "a", value: 1 },
          ]}
        ></tec-chart-sankey>
      </tec-chart>`
    )
    await waitUntil(() => nodeRects(el).length === 3)
    expect(linkPaths(el)).toHaveLength(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("would close a cycle"))
    expect(shadow(el).querySelectorAll("table")[0]!.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("redraws when the links change", async () => {
    const el = await sankeyChart()
    const sankey = el.querySelector("tec-chart-sankey")!
    sankey.links = links.slice(0, 2)
    await waitUntil(() => linkPaths(el).length === 2)
    expect(nodeRects(el)).toHaveLength(3)
    sankey.hideLabels = true
    await waitUntil(() => labelTexts(el).length === 0)
  })
})
