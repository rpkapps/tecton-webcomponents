import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil, nextFrame } from "../../internal/test-utils.js"
import type { TecChart, TecChartLegend, TecChartTooltip } from "./chart.js"
import "./define.js"

const data = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]
const config = {
  desktop: { label: "Desktop", color: "var(--tec-chart-1)" },
  mobile: { label: "Mobile", color: "var(--tec-chart-2)" },
}

const shadow = (el: Element) => el.shadowRoot!
const plot = (el: TecChart) => shadow(el).querySelector(".plot") as HTMLElement
const bars = (el: TecChart) => [...shadow(el).querySelectorAll<SVGPathElement>(".bar")]

async function barChart(extra = html``, options: { dir?: "ltr" | "rtl" } = {}) {
  const el = await fixture<TecChart>(
    html`<tec-chart style="width: 600px; height: 300px" label="Visitors by month" .data=${data} .config=${config}>
      <tec-chart-grid></tec-chart-grid>
      <tec-chart-x-axis key="month"></tec-chart-x-axis>
      ${extra}
      <tec-chart-bar key="desktop" radius="4"></tec-chart-bar>
      <tec-chart-bar key="mobile" radius="4"></tec-chart-bar>
    </tec-chart>`,
    options
  )
  await waitUntil(() => shadow(el).querySelector("svg"), "chart measured")
  await el.updateComplete
  return el
}

function resolveColor(el: Element, value: string): string {
  const probe = document.createElement("span")
  probe.style.color = value
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe("tec-chart", () => {
  it("draws one bar per category and series, coloured from the config", async () => {
    const el = await barChart()
    const drawn = bars(el)
    expect(drawn).toHaveLength(12)
    expect(drawn[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-desktop)")
    expect(drawn[6]!.getAttribute("fill")).toBe("var(--tec-chart-color-mobile)")
    // The config colours are exposed as custom properties.
    const base = shadow(el).querySelector(".base")!
    expect(resolveColor(base, "var(--tec-chart-color-desktop)")).toBe(resolveColor(document.body, "var(--tec-chart-1)"))
    expect(getComputedStyle(drawn[0]!).fill).toBe(resolveColor(document.body, "var(--tec-chart-1)"))
    // February (305) is the tallest desktop bar; the value axis runs to 320.
    const heights = drawn.slice(0, 6).map((b) => b.getBBox().height)
    expect(Math.max(...heights)).toBe(heights[1])
    expect(heights[1]! / heights[0]!).toBeCloseTo(305 / 186, 1)
  })

  it("skips series hidden with the hidden attribute", async () => {
    const el = await barChart()
    el.querySelector("tec-chart-bar")!.hidden = true
    await waitUntil(() => bars(el).length === 6, "one series left")
    expect(bars(el)[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-mobile)")
  })

  it("draws the grid at the nice value ticks and the category labels", async () => {
    const el = await barChart()
    expect(shadow(el).querySelectorAll(".grid line")).toHaveLength(5)
    const labels = [...shadow(el).querySelectorAll(".x-axis text")].map((t) => t.textContent)
    expect(labels).toEqual(["January", "February", "March", "April", "May", "June"])
  })

  it("formats ticks and follows the size of its box", async () => {
    const el = await barChart()
    const axis = el.querySelector("tec-chart-x-axis")!
    axis.tickFormatter = (value) => String(value).slice(0, 3)
    await el.updateComplete
    await nextFrame()
    expect(shadow(el).querySelector(".x-axis text")!.textContent).toBe("Jan")
    const before = bars(el)[0]!.getBBox().width
    el.style.width = "300px"
    await waitUntil(() => bars(el)[0]!.getBBox().width < before, "resize")
  })

  it("stacks series with the same stack id", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 600px; height: 300px" .data=${data} .config=${config}>
        <tec-chart-bar key="desktop" stack="a"></tec-chart-bar>
        <tec-chart-bar key="mobile" stack="a"></tec-chart-bar>
      </tec-chart>`
    )
    await waitUntil(() => bars(el).length === 12)
    const [jan] = bars(el)
    const janMobile = bars(el)[6]!
    // The mobile segment sits right on top of the desktop one, at the same x.
    expect(janMobile.getBBox().x).toBeCloseTo(jan!.getBBox().x, 3)
    expect(janMobile.getBBox().y + janMobile.getBBox().height).toBeCloseTo(jan!.getBBox().y, 1)
  })

  it("is a focusable, labelled chart with a data table", async () => {
    const el = await barChart(html`<tec-chart-tooltip></tec-chart-tooltip>`)
    expect(await axNode(plot(el))).toMatchObject({
      role: "application",
      name: "Visitors by month",
      description: "Use the arrow keys to move between data points.",
      roledescription: "chart",
    })
    expect(shadow(el).querySelector("svg")!.getAttribute("aria-hidden")).toBe("true")
    const table = shadow(el).querySelector("table")!
    expect(table.querySelector("caption")!.textContent).toBe("Visitors by month")
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["month", "Desktop", "Mobile"])
    expect([...table.querySelectorAll("tbody tr")[1]!.children].map((c) => c.textContent)).toEqual(["February", "305", "200"])
    await expectAccessible(el)
  })

  it("moves between data points with the keyboard and announces them", async () => {
    const el = await barChart(html`<tec-chart-tooltip></tec-chart-tooltip>`)
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0, "first point on focus")
    await waitUntil(() => tooltip.matches(":state(active)"), "tooltip shown")
    expect(tooltip.shadowRoot!.querySelector(".label")!.textContent).toBe("January")
    const live = shadow(el).querySelector("[aria-live]")!
    await waitUntil(() => live.textContent === "January, Desktop 186, Mobile 80", "announcement")

    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => el.activeIndex === 1)
    await waitUntil(() => live.textContent === "February, Desktop 305, Mobile 200", "announcement")
    // The cursor highlights the active band.
    expect(shadow(el).querySelector(".cursor-band")).not.toBeNull()

    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(5)
    await userEvent.keyboard("{ArrowRight}")
    expect(el.activeIndex).toBe(5)
    await userEvent.keyboard("{Home}")
    expect(el.activeIndex).toBe(0)
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.activeIndex).toBe(0)
    await userEvent.keyboard("{Escape}")
    expect(el.activeIndex).toBe(-1)
    await el.updateComplete
    await tooltip.updateComplete
    expect(tooltip.matches(":state(active)")).toBe(false)
    await userEvent.keyboard("{ArrowRight}")
    expect(el.activeIndex).toBe(0)
  })

  it("maps the arrow keys to the reading direction in RTL", async () => {
    const el = await barChart(html`<tec-chart-tooltip></tec-chart-tooltip>`, { dir: "rtl" })
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.activeIndex).toBe(1)
    // The first category is drawn on the right.
    const [jan] = bars(el)
    const feb = bars(el)[1]!
    expect(jan!.getBoundingClientRect().left).toBeGreaterThan(feb.getBoundingClientRect().left)
  })

  it("shows the tooltip for the category under the pointer", async () => {
    const el = await barChart(html`<tec-chart-tooltip indicator="line"></tec-chart-tooltip>`)
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.hover(bars(el)[2]!)
    await waitUntil(() => el.activeIndex === 2, "hovered March")
    await tooltip.updateComplete
    expect(tooltip.payload.map((item) => item.value)).toEqual([237, 120])
    const names = [...tooltip.shadowRoot!.querySelectorAll(".name")].map((n) => n.textContent)
    expect(names).toEqual(["Desktop", "Mobile"])
    await waitUntil(() => tooltip.style.translate !== "", "positioned")
    await userEvent.unhover(bars(el)[2]!)
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
    await waitUntil(() => el.activeIndex === -1, "left")
  })

  it("renders a legend from the config", async () => {
    const el = await barChart(html`<tec-chart-legend></tec-chart-legend>`)
    const legend = el.querySelector("tec-chart-legend") as TecChartLegend
    await legend.updateComplete
    const labels = [...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)
    expect(labels).toEqual(["Desktop", "Mobile"])
    const swatch = legend.shadowRoot!.querySelector<HTMLElement>(".swatch")!
    expect(getComputedStyle(swatch).backgroundColor).toBe(resolveColor(document.body, "var(--tec-chart-1)"))
    // The legend sits below the plot.
    expect(legend.getBoundingClientRect().top).toBeGreaterThan(plot(el).getBoundingClientRect().bottom - 1)
  })

  it("draws lines and areas on a point scale", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 600px; height: 300px" .data=${data} .config=${config}>
        <tec-chart-tooltip></tec-chart-tooltip>
        <tec-chart-line key="desktop" curve="natural" dots></tec-chart-line>
        <tec-chart-area key="mobile" gradient></tec-chart-area>
      </tec-chart>`
    )
    await waitUntil(() => shadow(el).querySelector(".series-path"))
    expect(shadow(el).querySelectorAll(".dot")).toHaveLength(6)
    expect(shadow(el).querySelector("linearGradient")).not.toBeNull()
    const dots = [...shadow(el).querySelectorAll<SVGCircleElement>(".dot")]
    // First and last points sit on the edges of the plot (5px margin).
    expect(Number(dots[0]!.getAttribute("cx"))).toBe(5)
    expect(Number(dots[5]!.getAttribute("cx"))).toBe(595)
    await userEvent.tab()
    await waitUntil(() => shadow(el).querySelector(".cursor-line") && shadow(el).querySelectorAll(".active-dot").length === 2)
  })

  it("draws a donut with names and colours from the config", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart
        style="width: 300px; height: 300px"
        label="Browsers"
        .data=${[
          { browser: "chrome", visitors: 275 },
          { browser: "safari", visitors: 200, fill: "var(--tec-chart-5)" },
        ]}
        .config=${{ visitors: { label: "Visitors" }, chrome: { label: "Chrome", color: "var(--tec-chart-1)" }, safari: { label: "Safari" } }}
      >
        <tec-chart-tooltip hide-label></tec-chart-tooltip>
        <tec-chart-legend></tec-chart-legend>
        <tec-chart-pie key="visitors" name-key="browser" inner-radius="60"></tec-chart-pie>
      </tec-chart>`
    )
    await waitUntil(() => shadow(el).querySelectorAll(".sector").length === 2)
    const [chrome, safari] = shadow(el).querySelectorAll(".sector")
    expect(chrome!.getAttribute("fill")).toBe("var(--tec-chart-color-chrome)")
    expect(safari!.getAttribute("fill")).toBe("var(--tec-chart-5)")
    const legend = el.querySelector("tec-chart-legend")!
    await legend.updateComplete
    expect([...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)).toEqual(["Chrome", "Safari"])
    await userEvent.tab()
    await userEvent.keyboard("{ArrowRight}")
    const tooltip = el.querySelector("tec-chart-tooltip")!
    await waitUntil(() => tooltip.shadowRoot!.querySelector(".name")?.textContent === "Safari")
    expect(tooltip.shadowRoot!.querySelector(".label")).toBeNull()
    expect([...shadow(el).querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Chrome", "Safari"])
    await expectAccessible(el)
  })

  it("draws a series per coloured config key with the type shortcut", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 600px; height: 300px" type="bar" stacked category-key="month" .data=${data} .config=${config}></tec-chart>`
    )
    await waitUntil(() => bars(el).length === 12)
    expect(shadow(el).querySelector(".plot")!.getAttribute("aria-label")).toBe("Bar chart")
  })

  it("lays bars out horizontally", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart orientation="horizontal" style="width: 600px; height: 300px" .data=${data} .config=${config}>
        <tec-chart-y-axis key="month"></tec-chart-y-axis>
        <tec-chart-bar key="desktop"></tec-chart-bar>
      </tec-chart>`
    )
    await waitUntil(() => bars(el).length === 6)
    const [jan, feb] = bars(el).map((b) => b.getBBox())
    expect(feb!.y).toBeGreaterThan(jan!.y)
    expect(feb!.width).toBeGreaterThan(jan!.width)
    expect(shadow(el).querySelectorAll(".y-axis text")).toHaveLength(6)
  })
})

describe("tec-chart-tooltip", () => {
  const payload = [
    { name: "Desktop", value: 1286, color: "var(--tec-chart-1)" },
    { name: "Mobile", value: 80, color: "var(--tec-chart-2)" },
  ]

  it("renders a standalone tooltip with label, indicators and formatted values", async () => {
    const el = await fixture<TecChartTooltip>(html`<tec-chart-tooltip standalone label="Page Views" .payload=${payload}></tec-chart-tooltip>`)
    const root = el.shadowRoot!
    expect(root.querySelector(".label")!.textContent).toBe("Page Views")
    expect([...root.querySelectorAll(".value")].map((v) => v.textContent)).toEqual([(1286).toLocaleString(), "80"])
    const indicator = root.querySelector<HTMLElement>(".indicator")!
    expect(indicator.getBoundingClientRect().width).toBe(10)
    expect(getComputedStyle(root.querySelector(".base")!).borderTopLeftRadius).not.toBe("0px")
    await expectAccessible(el)
  })

  it("nests the label next to a single line indicator and hides parts on request", async () => {
    const el = await fixture<TecChartTooltip>(
      html`<tec-chart-tooltip standalone label="Page Views" indicator="line" .payload=${payload.slice(0, 1)}></tec-chart-tooltip>`
    )
    expect(el.shadowRoot!.querySelector(".names .label")!.textContent).toBe("Page Views")
    // The line indicator is a bar as tall as the row, beside the text (also in a narrow tooltip).
    el.style.width = "9rem"
    await el.updateComplete
    const line = el.shadowRoot!.querySelector(".indicator")!.getBoundingClientRect()
    const text = el.shadowRoot!.querySelector(".text")!.getBoundingClientRect()
    expect(line.width).toBe(4)
    expect(line.height).toBeCloseTo(text.height, 0)
    expect(line.top).toBeCloseTo(text.top, 0)
    el.indicator = "dashed"
    el.hideLabel = true
    el.payload = payload
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".label")).toBeNull()
    expect(getComputedStyle(el.shadowRoot!.querySelector(".indicator")!).borderTopStyle).toBe("dashed")
    el.hideIndicator = true
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".indicator")).toBeNull()
  })

  it("resolves names and labels through the config, label-key and name-key", async () => {
    const el = await fixture<TecChartTooltip>(
      html`<tec-chart-tooltip
        standalone
        label-key="visitors"
        name-key="browser"
        .config=${{ visitors: { label: "Total Visitors" }, chrome: { label: "Chrome" } }}
        .payload=${[{ dataKey: "visitors", name: "visitors", value: 187, row: { browser: "chrome", visitors: 187 } }]}
      ></tec-chart-tooltip>`
    )
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("Total Visitors")
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Chrome")
    el.labelFormatter = (label) => `→ ${label}`
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("→ Total Visitors")
  })
})
