import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartLegend, TecChartTooltip } from "./chart.js"
import { angleWithin, boxInSector, buildHierarchy, inSector, polarOf, sunburstLayout } from "./chart-hierarchy.js"
import "./define.js"

const data = [
  {
    name: "oil",
    children: [
      { name: "Permian", size: 540 },
      { name: "Gulf of Mexico", size: 180 },
      { name: "Bakken", size: 120 },
    ],
  },
  {
    name: "gas",
    children: [
      { name: "Appalachia", size: 350 },
      { name: "Haynesville", size: 160, children: [{ name: "Louisiana", size: 100 }, { name: "Texas", size: 60 }] },
    ],
  },
  { name: "ngl", size: 90 },
  { name: "tiny", size: 1 },
]
const config = {
  size: { label: "Production" },
  oil: { label: "Oil", color: "var(--tec-chart-1)" },
  gas: { label: "Natural gas", color: "var(--tec-chart-2)" },
}
const fields = { key: "size", nameKey: "name", childrenKey: "children" }

const shadow = (el: Element) => el.shadowRoot!
const sectors = (el: TecChart) => [...shadow(el).querySelectorAll<SVGPathElement>(".sunburst-sector")]
const live = (el: TecChart) => shadow(el).querySelector(".base > [aria-live][aria-atomic]")!
const centre = (el: TecChart) => [...shadow(el).querySelectorAll(".sunburst-center text")].map((t) => t.textContent)

async function sunburst(attrs = "", extra = "", options: { dir?: "ltr" | "rtl"; theme?: "light" | "dark" } = {}) {
  const el = await fixture<TecChart>(
    `<tec-chart style="width: 400px; height: 400px" label="Production">
      <tec-chart-tooltip></tec-chart-tooltip>
      ${extra}
      <tec-chart-sunburst ${attrs}></tec-chart-sunburst>
    </tec-chart>`,
    options
  )
  el.config = config
  el.data = data
  await waitUntil(() => sectors(el).length > 0, "sunburst drawn")
  await el.updateComplete
  return el
}

describe("sunburst geometry", () => {
  const tree = buildHierarchy(data, fields)
  const layout = sunburstLayout(tree.roots, { inner: 40, outer: 190, depth: tree.depth, startAngle: 90, endAngle: -270 })

  it("gives each ring an equal share of the radius and each node an angle proportional to its value", () => {
    expect(tree.depth).toBe(3)
    const oil = layout.get(tree.nodes[0]!)!
    expect(oil).toMatchObject({ inner: 40, outer: 90, startAngle: 90 })
    expect(Math.abs(oil.endAngle - oil.startAngle)).toBeCloseTo((840 / tree.total) * 360, 6)
    const permian = layout.get(tree.nodes[1]!)!
    expect(permian).toMatchObject({ inner: 90, outer: 140, startAngle: 90 })
    expect(Math.abs(permian.endAngle - permian.startAngle)).toBeCloseTo((540 / tree.total) * 360, 6)
    const louisiana = layout.get(tree.nodes.find((n) => n.name === "Louisiana")!)!
    expect(louisiana).toMatchObject({ inner: 140, outer: 190 })
    // Children share their parent's angle exactly.
    const bakken = layout.get(tree.nodes[3]!)!
    expect(bakken.endAngle).toBeCloseTo(oil.endAngle, 9)
    // The whole circle is used, clockwise from 12 o'clock.
    expect(layout.get(tree.roots.at(-1)!)!.endAngle).toBeCloseTo(-270, 9)
  })

  it("separates siblings by the padding angle and rings by the ring padding", () => {
    const padded = sunburstLayout(tree.roots, { inner: 40, outer: 190, depth: 3, paddingAngle: 2, ringPadding: 4 })
    const [a, b] = tree.roots.map((n) => padded.get(n)!)
    expect(b!.startAngle - a!.endAngle).toBeCloseTo(2, 9)
    expect(padded.get(tree.nodes[0]!)!.outer).toBe(88)
    expect(padded.get(tree.nodes[1]!)!.inner).toBe(92)
  })

  it("finds angles and points inside sectors", () => {
    expect(angleWithin(10, 0, 90)).toBe(true)
    expect(angleWithin(-350, 0, 90)).toBe(true)
    expect(angleWithin(100, 0, 90)).toBe(false)
    expect(angleWithin(45, 90, -270)).toBe(true)
    expect(angleWithin(350, 30, -30)).toBe(true)
    expect(polarOf(0, 0, { x: 0, y: -10 })).toEqual({ angle: 90, radius: 10 })
    const sector = { startAngle: 0, endAngle: 90, inner: 50, outer: 100 }
    expect(inSector(0, 0, sector, { x: 50, y: -50 })).toBe(true)
    expect(inSector(0, 0, sector, { x: 50, y: 50 })).toBe(false)
    expect(inSector(0, 0, sector, { x: 30, y: -1 }, 0)).toBe(false)
    // 1px from the radial edge is inside, but not with a 2px inset.
    expect(inSector(0, 0, sector, { x: 75, y: -1 }, 0)).toBe(true)
    expect(inSector(0, 0, sector, { x: 75, y: -1 }, 2)).toBe(false)
  })

  it("fits a label box only when all of it lies inside the sector", () => {
    const sector = { startAngle: 0, endAngle: 90, inner: 50, outer: 150 }
    expect(boxInSector(0, 0, sector, { x: 70, y: -70 }, 40, 14)).toBe(true)
    expect(boxInSector(0, 0, sector, { x: 70, y: -70 }, 160, 14)).toBe(false)
    // Clear of the corners, but its lower edge dips into the hole.
    expect(boxInSector(0, 0, { startAngle: 60, endAngle: 120, inner: 50, outer: 150 }, { x: 0, y: -55 }, 30, 14)).toBe(false)
    // A thin sector cannot hold a label.
    expect(boxInSector(0, 0, { startAngle: 0, endAngle: 3, inner: 50, outer: 150 }, { x: 100, y: -3 }, 20, 14)).toBe(false)
  })
})

describe("tec-chart-sunburst", () => {
  it("draws a sector per node, coloured by its top-level node", async () => {
    const el = await sunburst()
    const drawn = sectors(el)
    expect(drawn).toHaveLength(11)
    expect(drawn.map((s) => s.getAttribute("fill"))).toEqual([
      ...Array(4).fill("var(--tec-chart-color-oil)"),
      ...Array(5).fill("var(--tec-chart-color-gas)"),
      "var(--tec-chart-3)",
      "var(--tec-chart-4)",
    ])
    expect(drawn.map((s) => s.dataset.index)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
    expect(getComputedStyle(drawn[0]!).strokeWidth).toBe("2px")
  })

  it("labels the sectors a name fits in and shows the total in the centre", async () => {
    const el = await sunburst()
    const labels = [...shadow(el).querySelectorAll(".contrast-labels text")].map((t) => t.textContent)
    expect(labels).toContain("Oil")
    expect(labels).toContain("Permian")
    expect(labels).not.toContain("tiny")
    for (const text of shadow(el).querySelectorAll<SVGTextElement>(".contrast-labels text")) {
      // Every corner of the label (horizontal or along the arc) is painted by one sector.
      const box = text.getBBox()
      const matrix = text.getScreenCTM()!
      const corners = [
        [box.x + 1, box.y + 1],
        [box.x + box.width - 1, box.y + 1],
        [box.x + 1, box.y + box.height - 1],
        [box.x + box.width - 1, box.y + box.height - 1],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix))
      const index = sectors(el).findIndex((s) => corners.every((p) => shadow(el).elementsFromPoint(p.x, p.y).includes(s)))
      expect(index, text.textContent!).toBeGreaterThanOrEqual(0)
    }
    expect(centre(el)).toEqual(["1,441", "Total"])
  })

  it("moves over the nodes with the keyboard and shows the path in the tooltip and the centre", async () => {
    const el = await sunburst()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => live(el).textContent === "Oil › Permian, Production 540", "announcement")
    await tooltip.updateComplete
    expect(tooltip.label).toBe("Oil › Permian")
    expect(centre(el)).toEqual(["540", "Oil › Permian"])
    expect(shadow(el).querySelector(".sector-outline")!.getAttribute("d")).toBe(sectors(el)[1]!.getAttribute("d"))
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(10)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => centre(el)[1] === "Total", "centre back to the total")
  })

  it("hit-tests the sector under the pointer, and the nearest one in a gap", async () => {
    const el = await sunburst(`padding-angle="4"`)
    await userEvent.hover(sectors(el)[4]!)
    await waitUntil(() => el.activeIndex === 4, "hovered gas")
    // In the 4° gap between Oil and Natural gas, in the inner ring (400px chart, 5px margins:
    // radius 195, hole 58.5, rings 45.5 wide), 1.5° past Oil's end: Oil is the nearest.
    const oilEnd = (344 * 840) / 1441
    const angle = ((oilEnd + 1.5) * Math.PI) / 180
    const r = 58.5 + 45.5 / 2
    const plot = shadow(el).querySelector<HTMLElement>(".plot")!
    await userEvent.hover(plot, { position: { x: 200 + r * Math.cos(-angle), y: 200 + r * Math.sin(-angle) } })
    await waitUntil(() => el.activeIndex === 0, "nearest sector in the gap")
    // The hole is not a node.
    await userEvent.hover(plot, { position: { x: 200, y: 199 } })
    await waitUntil(() => el.activeIndex === -1, "the hole")
  })

  it("has a data table, a legend and passes axe", async () => {
    const el = await sunburst("", "<tec-chart-legend></tec-chart-legend>")
    const rows = [...shadow(el).querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))
    expect(rows).toHaveLength(11)
    expect(rows[6]).toEqual(["Natural gas › Haynesville", "160", "31.4%"])
    expect(rows[7]).toEqual(["Natural gas › Haynesville › Louisiana", "100", "62.5%"])
    const legend = el.querySelector("tec-chart-legend") as TecChartLegend
    await legend.updateComplete
    expect([...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)).toEqual(["Oil", "Natural gas", "ngl", "tiny"])
    await expectAccessible(el)
  })

  it("fills the centre without an inner radius, and keeps its angles in right-to-left", async () => {
    const ltr = await sunburst(`inner-radius="0"`)
    expect(shadow(ltr).querySelector(".sunburst-center")).toBeNull()
    const d = sectors(ltr)[0]!.getAttribute("d")
    const rtl = await sunburst(`inner-radius="0"`, "", { dir: "rtl" })
    expect(sectors(rtl)[0]!.getAttribute("d")).toBe(d)
    expect(shadow(rtl).querySelector(".mirror")).toBeNull()
  })
})
