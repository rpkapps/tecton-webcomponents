import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartLegend, TecChartTooltip } from "./chart.js"
import { funnelStages, stageWidthAt, textAnchor, trapezoidPath } from "./chart-funnel.js"
import "./define.js"

describe("funnel layout", () => {
  it("narrows each stage to the next value", () => {
    const stages = funnelStages([100, 60, 20], 0, 304, 2)
    expect(stages.map((s) => [s.start, s.end])).toEqual([
      [0, 100],
      [102, 202],
      [204, 304],
    ])
    expect(stages.map((s) => [s.from, s.to])).toEqual([
      [100, 60],
      [60, 20],
      [20, 0],
    ])
    expect(funnelStages([100, 60], 0, 100, 0, "rectangle")[1]).toMatchObject({ from: 60, to: 60 })
    expect(stageWidthAt(stages[0]!, 0.5)).toBe(80)
  })

  it("flips the funnel when reversed and ignores negative values", () => {
    const stages = funnelStages([100, -5, 20], 0, 300, 0, "triangle", true)
    expect(stages[0]).toMatchObject({ start: 200, end: 300, from: 0, to: 100 })
    expect(stages[1]).toMatchObject({ value: 0, start: 100, from: 20, to: 0 })
    expect(stages[2]).toMatchObject({ start: 0, from: 0, to: 20 })
    expect(funnelStages([], 0, 100, 2)).toEqual([])
  })

  it("draws trapezoids across either axis", () => {
    const [stage] = funnelStages([100, 50], 0, 100, 0)
    expect(trapezoidPath(stage!, 200, 2)).toBe("M100,0L300,0L250,50L150,50Z")
    expect(trapezoidPath(stage!, 200, 2, true)).toBe("M0,100L0,300L50,250L50,150Z")
  })

  it("swaps label anchors for right-to-left text", () => {
    expect(textAnchor("start", false)).toBe("start")
    expect(textAnchor("start", true)).toBe("end")
    expect(textAnchor("end", true)).toBe("start")
    expect(textAnchor("middle", true)).toBe("middle")
  })
})

const data = [
  { stage: "visits", visitors: 12400 },
  { stage: "signups", visitors: 5230 },
  { stage: "trials", visitors: 2870 },
  { stage: "subscriptions", visitors: 1150 },
  { stage: "renewals", visitors: 640, fill: "var(--tec-chart-5)" },
]
const config = {
  visitors: { label: "Visitors" },
  visits: { label: "Visited", color: "var(--tec-chart-1)" },
  signups: { label: "Signed up", color: "var(--tec-chart-2)" },
  trials: { label: "Started a trial" },
  subscriptions: { label: "Subscribed" },
  renewals: { label: "Renewed" },
}

const shadow = (el: Element) => el.shadowRoot!
const stagePaths = (el: TecChart) => [...shadow(el).querySelectorAll<SVGPathElement>(".stage")]
const labels = (el: TecChart) => [...shadow(el).querySelectorAll<SVGTextElement>(".funnel-label")]

async function funnelChart(inner: unknown = html``, options: { dir?: "ltr" | "rtl"; width?: number; orientation?: string; attrs?: string } = {}) {
  const el = await fixture<TecChart>(
    html`<tec-chart
      style="width: ${options.width ?? 480}px; height: 360px"
      label="Subscription funnel"
      orientation=${options.orientation ?? "vertical"}
      .data=${data}
      .config=${config}
    >
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-funnel key="visitors" name-key="stage" conversion>${inner}</tec-chart-funnel>
    </tec-chart>`,
    { dir: options.dir }
  )
  await waitUntil(() => stagePaths(el).length === 5, "funnel drawn")
  await el.updateComplete
  return el
}

describe("tec-chart-funnel", () => {
  it("draws one stage per row, as wide as its value", async () => {
    const el = await funnelChart()
    expect(shadow(el).querySelector(".plot")!.getAttribute("data-kind")).toBe("funnel")
    const paths = stagePaths(el)
    expect(paths.map((p) => p.getAttribute("fill"))).toEqual([
      "var(--tec-chart-color-visits)",
      "var(--tec-chart-color-signups)",
      "var(--tec-chart-3)",
      "var(--tec-chart-4)",
      "var(--tec-chart-5)",
    ])
    const boxes = paths.map((p) => p.getBBox())
    // The first stage spans the plot (5px margins); the next ones are narrower and below it.
    expect(boxes[0]!.x).toBeCloseTo(5, 0)
    expect(boxes[0]!.width).toBeCloseTo(470, 0)
    expect(boxes[1]!.width / boxes[0]!.width).toBeCloseTo(5230 / 12400, 2)
    // A 2px gap separates the stages; the last one ends in a point.
    expect(boxes[1]!.y - (boxes[0]!.y + boxes[0]!.height)).toBeCloseTo(2, 1)
    expect(paths[4]!.getAttribute("d")).toMatch(/L240,355L240,355Z$/)
  })

  it("labels stages inside when the label fits, else beside them, never past the chart", async () => {
    const el = await funnelChart(html`<tec-chart-label-list position="center"></tec-chart-label-list>`, { width: 360 })
    const texts = labels(el)
    const inside = texts.filter((t) => t.hasAttribute("data-inside"))
    expect(inside.map((t) => t.textContent)).toContain((12400).toLocaleString())
    // The narrow last stage can't hold "640": its label sits beside it.
    const last = texts.find((t) => t.textContent === "640")!
    expect(last.hasAttribute("data-inside")).toBe(false)
    expect(last.getBoundingClientRect().left).toBeGreaterThan(stagePaths(el)[4]!.getBoundingClientRect().right - 1)
    // Inside labels fit their stage; none leaves the chart.
    const chartBox = el.getBoundingClientRect()
    for (const t of texts) {
      const b = t.getBoundingClientRect()
      expect(b.left).toBeGreaterThanOrEqual(chartBox.left)
      expect(b.right).toBeLessThanOrEqual(chartBox.right)
    }
    const first = inside.find((t) => t.textContent === (12400).toLocaleString())!.getBoundingClientRect()
    const stage = stagePaths(el)[0]!.getBoundingClientRect()
    expect(first.left).toBeGreaterThan(stage.left)
    expect(first.right).toBeLessThan(stage.right)
  })

  it("narrows the funnel to make room for labels beside it", async () => {
    const el = await funnelChart(html`<tec-chart-label-list position="end" key="stage"></tec-chart-label-list>`, { width: 300 })
    const texts = labels(el)
    expect(texts.map((t) => t.textContent)).toEqual(["Visited", "Signed up", "Started a trial", "Subscribed", "Renewed"])
    expect(stagePaths(el)[0]!.getBBox().width).toBeLessThan(280)
    const chartBox = el.getBoundingClientRect()
    texts.forEach((t, i) => {
      const b = t.getBoundingClientRect()
      expect(b.right).toBeLessThanOrEqual(chartBox.right)
      expect(b.left).toBeGreaterThan(stagePaths(el)[i]!.getBoundingClientRect().left + stagePaths(el)[i]!.getBoundingClientRect().width / 2)
    })
    // A formatter replaces the text.
    el.querySelector("tec-chart-label-list")!.formatter = (value, row, index) => `${index + 1}. ${value}`
    await waitUntil(() => labels(el)[0]?.textContent === "1. visits")
  })

  it("moves between stages with the keyboard, with the conversion rate", async () => {
    const el = await funnelChart()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await waitUntil(() => tooltip.matches(":state(active)"))
    expect(tooltip.shadowRoot!.querySelector(".label")!.textContent).toBe("Visitors")
    expect([...tooltip.shadowRoot!.querySelectorAll(".name")].map((n) => n.textContent)).toEqual(["Visited"])
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => el.activeIndex === 1)
    await tooltip.updateComplete
    expect([...tooltip.shadowRoot!.querySelectorAll(".name")].map((n) => n.textContent)).toEqual(["Signed up", "Conversion"])
    const rate = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(5230 / 12400)
    expect(tooltip.shadowRoot!.querySelectorAll(".value")[1]!.textContent).toBe(rate)
    const live = shadow(el).querySelector("[aria-live]")!
    await waitUntil(() => live.textContent === `Visitors, Signed up ${(5230).toLocaleString()}, Conversion ${rate}`, "announcement")
    // The active stage stands out.
    expect(stagePaths(el)[1]!.hasAttribute("data-active")).toBe(true)
    expect(shadow(el).querySelector(".funnel")!.hasAttribute("data-has-active")).toBe(true)
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(4)
  })

  it("shows the stage under the pointer, also near a narrow stage", async () => {
    const el = await funnelChart()
    await userEvent.hover(stagePaths(el)[1]!)
    await waitUntil(() => el.activeIndex === 1)
    // Beside the tip of the last stage (a few pixels wide there), within the 24px target.
    const last = stagePaths(el)[4]!.getBoundingClientRect()
    const plot = shadow(el).querySelector(".plot")!
    await userEvent.hover(plot, { position: { x: last.left + last.width / 2 - plot.getBoundingClientRect().left + 10, y: last.bottom - plot.getBoundingClientRect().top - 8 } })
    await waitUntil(() => el.activeIndex === 4, "last stage")
  })

  it("has a data table with the conversion rates, a legend and no axe violations", async () => {
    const el = await funnelChart(html``)
    const table = shadow(el).querySelector("table")!
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["stage", "Visitors", "Conversion"])
    const rows = [...table.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))
    expect(rows[0]).toEqual(["Visited", (12400).toLocaleString(), ""])
    expect(rows[4]![0]).toBe("Renewed")
    expect(rows[4]![2]).toMatch(/%/)
    const legend = document.createElement("tec-chart-legend") as TecChartLegend
    el.append(legend)
    await waitUntil(() => legend.shadowRoot?.querySelectorAll("[part=label]").length === 5)
    expect([...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)).toEqual(["Visited", "Signed up", "Started a trial", "Subscribed", "Renewed"])
    await expectAccessible(el)
  })

  it("lays the stages out horizontally, reversed, with a rectangular last stage", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 600px; height: 240px" orientation="horizontal" .data=${data} .config=${config}>
        <tec-chart-funnel key="visitors" name-key="stage" reversed last-shape="rectangle"></tec-chart-funnel>
      </tec-chart>`
    )
    await waitUntil(() => stagePaths(el).length === 5)
    const boxes = stagePaths(el).map((p) => p.getBBox())
    // Reversed: the first row is at the end, and the stages grow towards it.
    expect(boxes[0]!.x).toBeGreaterThan(boxes[4]!.x)
    expect(boxes[0]!.height).toBeCloseTo(230, 0)
    expect(boxes[4]!.height).toBeCloseTo((640 / 12400) * 230, 0)
    expect(shadow(el).querySelector("svg")!.getAttribute("data-orientation")).toBe("horizontal")
  })

  it("mirrors in RTL: labels beside the stages go to the inline end", async () => {
    const el = await funnelChart(html`<tec-chart-label-list position="end" key="stage"></tec-chart-label-list>`, { dir: "rtl" })
    const texts = labels(el)
    texts.forEach((t, i) => {
      const stage = stagePaths(el)[i]!.getBoundingClientRect()
      expect(t.getBoundingClientRect().right).toBeLessThan(stage.left + stage.width / 2)
      expect(t.getBoundingClientRect().left).toBeGreaterThanOrEqual(el.getBoundingClientRect().left)
    })
  })

  it("draws a funnel of the first numeric field with the type shortcut", async () => {
    const el = await fixture<TecChart>(html`<tec-chart style="width: 400px; height: 300px" type="funnel" .data=${data} .config=${config}></tec-chart>`)
    await waitUntil(() => stagePaths(el).length === 5)
    expect(shadow(el).querySelector(".plot")!.getAttribute("aria-label")).toBe("Funnel chart")
    expect(shadow(el).querySelector("tbody th")!.textContent).toBe("Visited")
  })
})
