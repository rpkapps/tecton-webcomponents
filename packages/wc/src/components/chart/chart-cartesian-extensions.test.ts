import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartBrush, TecChartTooltip } from "./chart.js"
import "./define.js"

const months = [
  { month: "January", oil: 186, gas: 80, sd: 12 },
  { month: "February", oil: 305, gas: 200, sd: [10, 30] },
  { month: "March", oil: 237, gas: 120, sd: 8 },
  { month: "April", oil: 73, gas: 190, sd: 5 },
  { month: "May", oil: 209, gas: 130, sd: 9 },
  { month: "June", oil: 214, gas: 140, sd: 11 },
]
const config = {
  oil: { label: "Oil", color: "var(--tec-chart-1)" },
  gas: { label: "Gas", color: "var(--tec-chart-2)" },
  sd: { label: "Deviation" },
}

const wells = [
  { depth: 1250, onshore: 420, size: 10 },
  { depth: 1480, onshore: 510, size: 40 },
  { depth: 2150, offshore: 880, size: 20 },
  { depth: 1480, offshore: 700, size: 30 },
  { depth: 2630, offshore: 1040, size: 50 },
]
const wellConfig = {
  depth: { label: "Depth" },
  onshore: { label: "Onshore", color: "var(--tec-chart-1)" },
  offshore: { label: "Offshore", color: "var(--tec-chart-2)" },
  size: { label: "Size" },
}

const shadow = (el: Element) => el.shadowRoot!
const $ = (el: Element, selector: string) => shadow(el).querySelector(selector)
const $$ = <T extends Element = SVGElement>(el: Element, selector: string) => [...shadow(el).querySelectorAll<T>(selector)]
const plot = (el: TecChart) => $(el, ".plot") as HTMLElement
const box = (el: Element) => el.getBoundingClientRect()
const num = (el: Element, attr: string) => Number(el.getAttribute(attr))

async function chart(template: ReturnType<typeof html>, options: { dir?: "ltr" | "rtl"; theme?: "light" | "dark" } = {}) {
  const el = await fixture<TecChart>(template, options)
  await waitUntil(() => $(el, "svg"), "chart measured")
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

/** Presses (and optionally drags) with pointer events at page coordinates. */
function press(target: Element, from: { x: number; y: number }, to?: { x: number; y: number }) {
  const opts = { bubbles: true, composed: true, pointerId: 1, button: 0, buttons: 1, isPrimary: true, pointerType: "mouse" }
  target.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: from.x, clientY: from.y }))
  if (to) target.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: to.x, clientY: to.y }))
  const end = to ?? from
  target.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0, clientX: end.x, clientY: end.y }))
}

describe("number axis", () => {
  it("places rows by value with nice ticks and a domain", async () => {
    const data = [
      { months: 0, rate: 1200 },
      { months: 3, rate: 810 },
      { months: 12, rate: 430 },
      { months: 36, rate: 205 },
    ]
    const el = await chart(html`<tec-chart style="width: 400px; height: 240px" .data=${data} .margin=${{ start: 0, end: 0 }}>
      <tec-chart-x-axis key="months" type="number" domain="0,36" tick-count="7"></tec-chart-x-axis>
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-line key="rate" dots></tec-chart-line>
    </tec-chart>`)
    const dots = $$(el, ".dot")
    const xs = dots.map((d) => num(d, "cx"))
    // 0 → 0, 36 → 400: 3 months is 1/12 of the width, 12 months 1/3.
    expect(xs[0]).toBeCloseTo(0, 3)
    expect(xs[1]).toBeCloseTo(400 / 12, 3)
    expect(xs[2]).toBeCloseTo(400 / 3, 3)
    expect(xs[3]).toBeCloseTo(400, 3)
    expect($$(el, ".x-axis text").map((t) => t.textContent)).toEqual(["0", "6", "12", "18", "24", "30", "36"])
    // The pointer picks the nearest row; the keyboard moves row by row.
    const rect = box(plot(el))
    await userEvent.hover(plot(el), { position: { x: 120, y: rect.height / 2 } })
    await waitUntil(() => el.activeIndex === 2, "nearest row")
    await userEvent.tab()
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(3)
    // The table's row headers are the numbers.
    expect($$(el, "tbody th").map((th) => th.textContent)).toEqual(["0", "3", "12", "36"])
  })

  it("draws bars on a number axis with half a bar of room at the ends", async () => {
    const data = [
      { year: 2020, oil: 10 },
      { year: 2021, oil: 20 },
      { year: 2023, oil: 15 },
    ]
    const el = await chart(html`<tec-chart style="width: 400px; height: 240px" .data=${data}>
      <tec-chart-x-axis key="year" type="number"></tec-chart-x-axis>
      <tec-chart-bar key="oil"></tec-chart-bar>
    </tec-chart>`)
    const bars = $$<SVGPathElement>(el, ".bar").map((b) => b.getBBox())
    expect(bars).toHaveLength(3)
    const plotBox = { x: 5, w: 390 }
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(plotBox.x - 0.5)
      expect(b.x + b.width).toBeLessThanOrEqual(plotBox.x + plotBox.w + 0.5)
    }
    // Same thickness everywhere; 2021 → 2023 is twice the 2020 → 2021 gap.
    expect(bars[0]!.width).toBeCloseTo(bars[2]!.width, 3)
    const c = bars.map((b) => b.x + b.width / 2)
    expect((c[2]! - c[1]!) / (c[1]! - c[0]!)).toBeCloseTo(2, 3)
  })
})

describe("tec-chart-scatter", () => {
  async function scatter(extra = html``, options: { dir?: "ltr" | "rtl" } = {}) {
    return chart(
      html`<tec-chart style="width: 500px; height: 300px" label="Rate by depth" .data=${wells} .config=${wellConfig}>
        <tec-chart-x-axis key="depth" type="number" domain="auto"></tec-chart-x-axis>
        <tec-chart-y-axis domain="auto"></tec-chart-y-axis>
        <tec-chart-tooltip></tec-chart-tooltip>
        ${extra}
        <tec-chart-scatter key="onshore"></tec-chart-scatter>
        <tec-chart-scatter key="offshore" shape="triangle"></tec-chart-scatter>
      </tec-chart>`,
      options
    )
  }

  it("draws a mark per row with a value, in the series colour", async () => {
    const el = await scatter()
    const marks = $$(el, ".symbol")
    expect(marks).toHaveLength(5)
    expect(marks.filter((m) => m.getAttribute("fill") === "var(--tec-chart-color-onshore)")).toHaveLength(2)
    expect(plot(el).getAttribute("aria-label")).toBe("Rate by depth")
    // The triangle is not a circle path.
    const triangle = marks.find((m) => m.getAttribute("fill") === "var(--tec-chart-color-offshore)")!
    expect(triangle.getAttribute("d")).not.toContain("A")
  })

  it("moves between points in x order, then series, and announces x and y", async () => {
    const el = await scatter()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await tooltip.updateComplete
    // depth 1250 (onshore), then 1480 onshore, 1480 offshore, 2150, 2630.
    expect(tooltip.payload.map((i) => i.value)).toEqual([1250, 420])
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => el.activeIndex === 2)
    await tooltip.updateComplete
    expect(tooltip.payload.map((i) => i.value)).toEqual([1480, 700])
    const live = $(el, "[aria-live]")!
    await waitUntil(() => live.textContent === "Offshore, Depth 1,480, Offshore 700", "announcement")
    // A crosshair and an outline mark the active point.
    expect($$(el, ".cursor-cross line")).toHaveLength(2)
    expect($(el, ".active-symbol")).not.toBeNull()
  })

  it("hits the nearest point within 24px", async () => {
    const el = await scatter()
    const marks = $$(el, ".symbol")
    const target = marks.find((m) => m.dataset.index === "4")!
    const b = box(target)
    const p = box(plot(el))
    await userEvent.hover(plot(el), { position: { x: b.left + b.width / 2 - p.left - 18, y: b.top + b.height / 2 - p.top } })
    await waitUntil(() => el.activeIndex === 4, "nearest point")
    await userEvent.hover(plot(el), { position: { x: 5, y: p.height - 40 } })
    await waitUntil(() => el.activeIndex === -1, "no point nearby")
  })

  it("sizes bubbles with a z axis and lists x, y and z in the table", async () => {
    const el = await scatter(html`<tec-chart-z-axis key="size" range="4,20"></tec-chart-z-axis>`)
    const sizes = $$<SVGPathElement>(el, ".symbol").map((m) => m.getBBox().height)
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes) * 3)
    const table = $(el, "table")!
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Series", "Depth", "y", "Size"])
    expect([...table.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent))).toEqual([
      ["Onshore", "1,250", "420", "10"],
      ["Onshore", "1,480", "510", "40"],
      ["Offshore", "1,480", "700", "30"],
      ["Offshore", "2,150", "880", "20"],
      ["Offshore", "2,630", "1,040", "50"],
    ])
    await expectAccessible(el)
  })

  it("names points with name-key in the tooltip and the table", async () => {
    const data = [
      { field: "Alder", cut: 12, rate: 48 },
      { field: "Birch", cut: 27, rate: 36 },
    ]
    const el = await chart(html`<tec-chart style="width: 400px; height: 240px" .data=${data} .config=${{ field: { label: "Field" } }}>
      <tec-chart-x-axis key="cut" type="number"></tec-chart-x-axis>
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-scatter key="rate" name-key="field"></tec-chart-scatter>
    </tec-chart>`)
    await userEvent.tab()
    await userEvent.keyboard("{ArrowRight}")
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await waitUntil(() => tooltip.shadowRoot!.querySelector(".label")?.textContent === "Birch", "named tooltip")
    expect($$(el, "thead th").map((th) => th.textContent)).toEqual(["Field", "cut", "rate"])
    expect($$(el, "tbody th").map((th) => th.textContent)).toEqual(["Alder", "Birch"])
  })

  it("mirrors the x axis in RTL", async () => {
    const el = await scatter(html``, { dir: "rtl" })
    const marks = $$(el, ".symbol")
    const first = marks.find((m) => m.dataset.index === "0")!
    const last = marks.find((m) => m.dataset.index === "4")!
    expect(box(first).left).toBeGreaterThan(box(last).left)
  })
})

describe("reference elements", () => {
  it("draws lines, areas and dots, extends the domain and labels them in the text colour", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months} .config=${config}>
      <tec-chart-grid></tec-chart-grid>
      <tec-chart-x-axis key="month"></tec-chart-x-axis>
      <tec-chart-y-axis></tec-chart-y-axis>
      <tec-chart-reference-area x1="March" x2="April" label="Turnaround"></tec-chart-reference-area>
      <tec-chart-bar key="oil"></tec-chart-bar>
      <tec-chart-reference-line y="500" label="Capacity" dashed></tec-chart-reference-line>
      <tec-chart-reference-line x="May" stroke="var(--tec-chart-3)"></tec-chart-reference-line>
      <tec-chart-reference-dot x="February" y="305" r="6" label="Peak"></tec-chart-reference-dot>
      <tec-chart-reference-line y="900" if-overflow="discard"></tec-chart-reference-line>
    </tec-chart>`)
    // The value axis grows to 500 (not to the discarded 900).
    const ticks = $$(el, ".y-axis text").map((t) => Number(t.textContent))
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(500)
    expect(Math.max(...ticks)).toBeLessThan(900)
    const lines = $$(el, ".reference-line")
    expect(lines).toHaveLength(2)
    expect(lines[0]!.getAttribute("stroke-dasharray")).toBe("4 4")
    // The area covers the March and April bands, under the bars.
    const area = $(el, ".reference-area") as SVGRectElement
    const bars = $$<SVGPathElement>(el, ".bar")
    const [march, april] = [bars[2]!.getBBox(), bars[3]!.getBBox()]
    expect(area.getBBox().x).toBeLessThan(march.x)
    expect(area.getBBox().x + area.getBBox().width).toBeGreaterThan(april.x + april.width)
    expect(area.compareDocumentPosition(bars[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(lines[0]!.compareDocumentPosition(bars[0]!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    // The dot sits on the February bar's top.
    const dot = $(el, ".reference-dot")!
    expect(num(dot, "cy")).toBeCloseTo(bars[1]!.getBBox().y, 0)
    expect(num(dot, "cx")).toBeCloseTo(bars[1]!.getBBox().x + bars[1]!.getBBox().width / 2, 0)
    const labels = $$(el, ".reference-label")
    expect(labels.map((l) => l.textContent)).toEqual(["Turnaround", "Capacity", "Peak"])
    expect(getComputedStyle(labels[0]!).fill).toBe(resolveColor(document.body, "var(--tec-foreground)"))
    expect(getComputedStyle(lines[1]!).stroke).toBe(resolveColor(document.body, "var(--tec-chart-3)"))
  })

  it("extends a reference area to the plot edge on an omitted side", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months}>
      <tec-chart-x-axis key="month"></tec-chart-x-axis>
      <tec-chart-line key="oil"></tec-chart-line>
      <tec-chart-reference-area y1="200"></tec-chart-reference-area>
    </tec-chart>`)
    const area = ($(el, ".reference-area") as SVGRectElement).getBBox()
    expect(area.x).toBeCloseTo(5, 3)
    expect(area.width).toBeCloseTo(490, 3)
    expect(area.y).toBeCloseTo(5, 3)
  })

  it("keeps labels and tick labels on their side in RTL", async () => {
    const el = await chart(
      html`<tec-chart style="width: 400px; height: 260px" .data=${months}>
        <tec-chart-grid></tec-chart-grid>
        <tec-chart-x-axis key="month"></tec-chart-x-axis>
        <tec-chart-y-axis label="Oil"></tec-chart-y-axis>
        <tec-chart-bar key="oil"></tec-chart-bar>
        <tec-chart-reference-line y="100" label="Start label" label-position="start"></tec-chart-reference-line>
        <tec-chart-reference-line y="200" label="End label" label-position="end"></tec-chart-reference-line>
      </tec-chart>`,
      { dir: "rtl" }
    )
    const grid = box($(el, ".grid line")!)
    // The value axis is on the right: its labels are right of the plot, 14px away (tick 6 + margin 8).
    for (const tick of $$(el, ".y-axis .tick")) expect(box(tick).left).toBeCloseTo(grid.right + 14, 0)
    const title = box($(el, ".axis-label")!)
    expect(title.left).toBeGreaterThan(Math.max(...$$(el, ".y-axis .tick").map((t) => box(t).right)))
    const [start, end] = $$(el, ".reference-label").map(box)
    // `start` is the inline start (the right in RTL), 4px inside the plot; `end` the left.
    expect(start!.right).toBeCloseTo(grid.right - 4, 0)
    expect(end!.left).toBeCloseTo(grid.left + 4, 0)
  })
})

describe("tec-chart-label-list", () => {
  it("labels bars above their value end, in the text colour", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months} .config=${config} .margin=${{ top: 24 }}>
      <tec-chart-bar key="oil"><tec-chart-label-list position="top"></tec-chart-label-list></tec-chart-bar>
    </tec-chart>`)
    const labels = $$<SVGTextElement>(el, ".value-label")
    expect(labels.map((l) => l.textContent)).toEqual(["186", "305", "237", "73", "209", "214"])
    const bars = $$<SVGPathElement>(el, ".bar")
    labels.forEach((label, i) => {
      const l = label.getBBox()
      const b = bars[i]!.getBBox()
      expect(l.y + l.height).toBeLessThanOrEqual(b.y)
      expect(l.x + l.width / 2).toBeCloseTo(b.x + b.width / 2, 0)
    })
    expect(getComputedStyle(labels[0]!).fill).toBe(resolveColor(document.body, "var(--tec-foreground)"))
  })

  it("puts a label inside a bar only when it fits, and never overlaps two labels", async () => {
    const data = [
      { field: "Alder", oil: 305 },
      { field: "Fir", oil: 12 },
    ]
    const el = await chart(html`<tec-chart orientation="horizontal" category-key="field" style="width: 400px; height: 160px" .data=${data} .margin=${{ end: 40 }}>
      <tec-chart-bar key="oil">
        <tec-chart-label-list key="field" position="inside-start"></tec-chart-label-list>
        <tec-chart-label-list position="end"></tec-chart-label-list>
      </tec-chart-bar>
    </tec-chart>`)
    const labels = $$<SVGTextElement>(el, ".value-label")
    // "Fir" does not fit in its 12-unit bar: it would move outside, onto "12", so it is left out.
    expect(labels.map((l) => l.textContent)).toEqual(["Alder", "305", "12"])
    const alder = labels[0]!
    expect(alder.hasAttribute("data-inside")).toBe(true)
    const bar = $$<SVGPathElement>(el, ".bar")[0]!.getBBox()
    const a = alder.getBBox()
    expect(a.x).toBeGreaterThanOrEqual(bar.x)
    expect(a.x + a.width).toBeLessThanOrEqual(bar.x + bar.width)
    await expectAccessible(el)
  })

  it("keeps label text readable (not mirrored) and on its bar in RTL", async () => {
    const el = await chart(
      html`<tec-chart style="width: 400px; height: 240px" .data=${months} .margin=${{ top: 24 }}>
        <tec-chart-bar key="oil"><tec-chart-label-list position="top"></tec-chart-label-list></tec-chart-bar>
      </tec-chart>`,
      { dir: "rtl" }
    )
    const label = $$<SVGTextElement>(el, ".value-label")[0]!
    const bar = $$<SVGPathElement>(el, ".bar")[0]!
    // The first category is on the right, and its label is centred over it.
    expect(box(label).left + box(label).width / 2).toBeCloseTo(box(bar).left + box(bar).width / 2, 0)
    expect(box(bar).left).toBeGreaterThan(200)
    // Two flips (the mirrored group, the text's own) cancel: the glyphs are not mirrored.
    const group = new DOMMatrix(getComputedStyle(label.closest(".mirror")!).transform)
    const own = new DOMMatrix(getComputedStyle(label).transform)
    expect(group.a * own.a).toBe(1)
  })

  it("labels line points and flips a label that would leave the chart", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 200px" .data=${months}>
      <tec-chart-line key="oil"><tec-chart-label-list position="top"></tec-chart-label-list></tec-chart-line>
    </tec-chart>`)
    const labels = $$<SVGTextElement>(el, ".value-label")
    expect(labels).toHaveLength(6)
    // February (the maximum, at the top edge) is labelled below its point.
    expect(num(labels[1]!, "y")).toBeGreaterThan(num(labels[0]!, "y") - 50)
    for (const l of labels) expect(l.getBBox().y).toBeGreaterThanOrEqual(0)
  })
})

describe("tec-chart-error-bar", () => {
  it("draws error bars, grows the value axis and lists the errors in the table", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months} .config=${config}>
      <tec-chart-x-axis key="month"></tec-chart-x-axis>
      <tec-chart-y-axis></tec-chart-y-axis>
      <tec-chart-bar key="oil"><tec-chart-error-bar key="sd" width="8"></tec-chart-error-bar></tec-chart-bar>
    </tec-chart>`)
    const errors = $$<SVGPathElement>(el, ".error-bar")
    expect(errors).toHaveLength(6)
    // February: 305 − 10 … 305 + 30 = 335, beyond the 320 tick of the bars alone.
    const ticks = $$(el, ".y-axis text").map((t) => Number(t.textContent))
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(335)
    const feb = errors[1]!.getBBox()
    const bar = $$<SVGPathElement>(el, ".bar")[1]!.getBBox()
    expect(feb.width).toBeCloseTo(8, 0)
    expect(feb.x + feb.width / 2).toBeCloseTo(bar.x + bar.width / 2, 0)
    expect(feb.y).toBeLessThan(bar.y)
    expect(feb.y + feb.height).toBeGreaterThan(bar.y)
    const rows = $$(el, "tbody tr").map((tr) => [...tr.children].map((c) => c.textContent))
    expect($$(el, "thead th").map((th) => th.textContent)).toEqual(["month", "Oil", "Deviation"])
    expect(rows[0]).toEqual(["January", "186", "±12"])
    expect(rows[1]).toEqual(["February", "305", "−10 / +30"])
  })

  it("draws x and y error bars on scatter points", async () => {
    const data = [
      { x: 10, y: 20, ex: 2, ey: [1, 4] },
      { x: 30, y: 40, ex: 3, ey: 5 },
    ]
    const el = await chart(html`<tec-chart style="width: 400px; height: 300px" .data=${data}>
      <tec-chart-x-axis key="x" type="number"></tec-chart-x-axis>
      <tec-chart-scatter key="y">
        <tec-chart-error-bar key="ex" direction="x"></tec-chart-error-bar>
        <tec-chart-error-bar key="ey"></tec-chart-error-bar>
      </tec-chart-scatter>
    </tec-chart>`)
    const errors = $$<SVGPathElement>(el, ".error-bar").map((e) => e.getBBox())
    expect(errors).toHaveLength(4)
    expect(errors.filter((b) => b.width > b.height)).toHaveLength(2)
    expect($$(el, "thead th").map((th) => th.textContent)).toEqual(["#", "x", "y", "ex", "ey"])
    expect($$(el, "tbody tr")[0]!.textContent).toContain("±2")
  })
})

describe("axis labels", () => {
  it("reserves space for the titles beside the tick labels", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months}>
      <tec-chart-x-axis key="month" label="Month"></tec-chart-x-axis>
      <tec-chart-y-axis width="20" label="Oil production (kbbl)"></tec-chart-y-axis>
      <tec-chart-bar key="oil"></tec-chart-bar>
    </tec-chart>`)
    const [x, y] = $$(el, ".axis-label")
    expect(x!.textContent).toBe("Month")
    const yBox = box(y!)
    // Rotated: taller than wide, and clear of every tick label.
    expect(yBox.height).toBeGreaterThan(yBox.width)
    const ticks = $$(el, ".y-axis .tick").map(box)
    for (const t of ticks) expect(yBox.right).toBeLessThanOrEqual(t.left)
    expect(yBox.left).toBeGreaterThanOrEqual(box(el).left)
    // The x title sits below the category labels.
    const xBox = box(x!)
    for (const t of $$(el, ".x-axis .tick").map(box)) expect(xBox.top).toBeGreaterThanOrEqual(t.bottom)
    expect(xBox.bottom).toBeLessThanOrEqual(box(el).bottom + 0.5)
  })
})

describe("tec-chart-brush", () => {
  async function brushed(options: { dir?: "ltr" | "rtl" } = {}) {
    const el = await chart(
      html`<tec-chart style="width: 500px; height: 320px" label="Oil by month" .data=${months} .config=${config}>
        <tec-chart-x-axis key="month"></tec-chart-x-axis>
        <tec-chart-tooltip></tec-chart-tooltip>
        <tec-chart-bar key="oil"></tec-chart-bar>
        <tec-chart-brush start-index="1" end-index="3" preview></tec-chart-brush>
      </tec-chart>`,
      options
    )
    await waitUntil(() => $(el, ".brush"), "brush")
    return el
  }
  const handles = (el: TecChart) => $$<HTMLElement>(el, "[data-brush]")
  const brushOf = (el: TecChart) => el.querySelector("tec-chart-brush") as TecChartBrush

  it("draws only the window and keeps every row in the table", async () => {
    const el = await brushed()
    expect($$(el, ".bar")).toHaveLength(3)
    expect($$(el, ".x-axis text").map((t) => t.textContent)).toEqual(["February", "March", "April"])
    expect($$(el, "tbody tr")).toHaveLength(6)
    // The brush sits under the x axis, aligned with the plot, inside the chart's box.
    const brush = box($(el, ".brush-track")!)
    for (const t of $$(el, ".x-axis text")) expect(brush.top).toBeGreaterThan(box(t).bottom)
    expect(brush.bottom).toBeLessThanOrEqual(box(plot(el)).bottom)
    const grid = $$<SVGPathElement>(el, ".bar")
    expect(brush.left).toBeLessThan(box(grid[0]!).left)
    expect($(el, ".brush-preview path")).not.toBeNull()
    // Tooltip and keyboard indexes refer to the window.
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    plot(el).focus({ focusVisible: true } as FocusOptions)
    await userEvent.keyboard("{Home}")
    await waitUntil(() => el.activeIndex === 0)
    await tooltip.updateComplete
    expect(tooltip.label).toBe("February")
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(2)
  })

  it("has two labelled slider handles and a window slider", async () => {
    const el = await brushed()
    const [start, band, end] = handles(el)
    expect(await axNode(start!)).toMatchObject({ role: "slider", name: "Start", valuetext: "February", valuemin: "0", valuemax: "3" })
    expect(await axNode(end!)).toMatchObject({ role: "slider", name: "End", valuetext: "April", valuemin: "1", valuemax: "5" })
    expect(await axNode(band!)).toMatchObject({ role: "slider", name: "Window", valuetext: "February – April" })
    await expectAccessible(el)
  })

  it("moves a handle by one category with the arrow keys and fires tec-range-change", async () => {
    const el = await brushed()
    const brush = brushOf(el)
    const events = recordEvents<CustomEvent<{ startIndex: number; endIndex: number }>>(brush, "tec-range-change")
    const [start, , end] = handles(el)
    start!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(events.events.at(-1)!.detail).toEqual({ startIndex: 2, endIndex: 3 })
    await waitUntil(() => $$(el, ".bar").length === 2, "window shrank")
    expect(deepActiveElement()).toBe(handles(el)[0])
    // The start handle cannot pass the end handle.
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    expect(brush.startIndex).toBe(3)
    end!.focus()
    await userEvent.keyboard("{End}")
    expect(brush.endIndex).toBe(5)
    // The band pans the whole window.
    handles(el)[1]!.focus()
    await userEvent.keyboard("{Home}")
    expect([brush.startIndex, brush.endIndex]).toEqual([0, 2])
    await userEvent.keyboard("{ArrowRight}")
    expect([brush.startIndex, brush.endIndex]).toEqual([1, 3])
    events.stop()
  })

  it("follows the reading direction in RTL", async () => {
    const el = await brushed({ dir: "rtl" })
    const brush = brushOf(el)
    const [start, , end] = handles(el)
    // The first row is on the right: the start handle is right of the end handle.
    expect(box(start!).left).toBeGreaterThan(box(end!).left)
    start!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(brush.startIndex).toBe(2)
  })

  it("drags a handle and the band with the pointer", async () => {
    const el = await brushed()
    const brush = brushOf(el)
    const track = box($(el, ".brush-track")!)
    const at = (index: number) => ({ x: track.left + (index / 5) * track.width, y: track.top + track.height / 2 })
    const [, band, end] = handles(el)
    press(end!, at(3), at(5))
    expect([brush.startIndex, brush.endIndex]).toEqual([1, 5])
    await el.updateComplete
    press(band!, at(3), at(2))
    expect([brush.startIndex, brush.endIndex]).toEqual([0, 4])
    await waitUntil(() => $$(el, ".bar").length === 5)
  })
})

describe("composed charts", () => {
  it("mixes areas, bars and lines on one category axis", async () => {
    const el = await chart(html`<tec-chart style="width: 500px; height: 300px" .data=${months} .config=${config}>
      <tec-chart-x-axis key="month"></tec-chart-x-axis>
      <tec-chart-legend></tec-chart-legend>
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-area key="gas"></tec-chart-area>
      <tec-chart-bar key="oil"></tec-chart-bar>
      <tec-chart-line key="gas" dots></tec-chart-line>
    </tec-chart>`)
    expect($$(el, ".bar")).toHaveLength(6)
    expect($$(el, ".area")).toHaveLength(1)
    // Line points sit at the band centres.
    const bar = $$<SVGPathElement>(el, ".bar")[0]!.getBBox()
    expect(num($$(el, ".dot")[0]!, "cx")).toBeCloseTo(bar.x + bar.width / 2, 0)
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await tooltip.updateComplete
    expect(tooltip.payload.map((i) => i.value)).toEqual([80, 186, 80])
    expect($$(el, "thead th").map((th) => th.textContent)).toEqual(["month", "Gas", "Oil", "Gas"])
  })

  it("renders in dark mode with token colours", async () => {
    const el = await chart(
      html`<tec-chart style="width: 400px; height: 240px" .data=${months} .margin=${{ top: 24 }}>
        <tec-chart-bar key="oil"><tec-chart-label-list></tec-chart-label-list></tec-chart-bar>
        <tec-chart-reference-line y="100" label="Target"></tec-chart-reference-line>
      </tec-chart>`,
      { theme: "dark" }
    )
    const label = $(el, ".value-label")!
    expect(getComputedStyle(label).fill).toBe(resolveColor(el, "var(--tec-foreground)"))
    expect(getComputedStyle($(el, ".reference-line")!).stroke).toBe(resolveColor(el, "var(--tec-muted-foreground)"))
  })
})
