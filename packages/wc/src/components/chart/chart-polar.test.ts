import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart, TecChartTooltip } from "./chart.js"
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
const browsers = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
]
const browserConfig = {
  visitors: { label: "Visitors" },
  chrome: { label: "Chrome", color: "var(--tec-chart-1)" },
  safari: { label: "Safari", color: "var(--tec-chart-2)" },
  firefox: { label: "Firefox", color: "var(--tec-chart-3)" },
  edge: { label: "Edge", color: "var(--tec-chart-4)" },
  other: { label: "Other", color: "var(--tec-chart-5)" },
}

const shadow = (el: Element) => el.shadowRoot!
const all = <T extends Element = SVGElement>(el: Element, selector: string) => [...shadow(el).querySelectorAll<T>(selector)]
const plot = (el: TecChart) => shadow(el).querySelector(".plot") as HTMLElement
const live = (el: TecChart) => shadow(el).querySelector("[aria-live]")!

async function drawn(el: TecChart, selector: string) {
  await waitUntil(() => shadow(el).querySelector(selector), `${selector} drawn`)
  await el.updateComplete
  return el
}

/** Moves the pointer to a point of the plot (plot coordinates). */
function pointAt(el: TecChart, x: number, y: number) {
  const rect = plot(el).getBoundingClientRect()
  plot(el).dispatchEvent(new PointerEvent("pointermove", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, composed: true }))
}

/** The centre of an SVG element's box, in plot coordinates. */
function centerOf(el: TecChart, mark: Element) {
  const rect = plot(el).getBoundingClientRect()
  const box = mark.getBoundingClientRect()
  return { x: box.left + box.width / 2 - rect.left, y: box.top + box.height / 2 - rect.top }
}

/** Every text box lies inside the chart's box. */
function expectTextInside(el: TecChart, selector = "text") {
  const box = el.getBoundingClientRect()
  for (const text of all(el, selector)) {
    const r = text.getBoundingClientRect()
    expect(r.left, text.textContent!).toBeGreaterThanOrEqual(box.left - 0.5)
    expect(r.right, text.textContent!).toBeLessThanOrEqual(box.right + 0.5)
    expect(r.top, text.textContent!).toBeGreaterThanOrEqual(box.top - 0.5)
    expect(r.bottom, text.textContent!).toBeLessThanOrEqual(box.bottom + 0.5)
  }
}

async function radar(extra = html``, options: { dir?: "ltr" | "rtl"; width?: number } = {}) {
  const el = await fixture<TecChart>(
    html`<tec-chart style="width: ${options.width ?? 320}px; height: ${options.width ?? 320}px" label="Visitors by month" .data=${data} .config=${config}>
      <tec-chart-tooltip></tec-chart-tooltip>
      <tec-chart-polar-grid></tec-chart-polar-grid>
      <tec-chart-polar-angle-axis key="month"></tec-chart-polar-angle-axis>
      ${extra}
      <tec-chart-radar key="desktop" dots></tec-chart-radar>
      <tec-chart-radar key="mobile"></tec-chart-radar>
    </tec-chart>`,
    options
  )
  return drawn(el, ".radar-shape")
}

describe("tec-chart-radar", () => {
  it("draws a shape per series over one axis per category, with the web and the labels", async () => {
    const el = await radar()
    expect(plot(el).dataset.kind).toBe("radar")
    expect(plot(el).getAttribute("aria-label")).toBe("Visitors by month")
    const shapes = all(el, ".radar-shape")
    expect(shapes).toHaveLength(2)
    expect(shapes[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-desktop)")
    expect(shapes[0]!.getAttribute("fill-opacity")).toBe("0.6")
    // Dots on the series with `dots` only.
    expect(all(el, ".radar-dot:not(.active-dot)")).toHaveLength(6)
    // Rings at the nice radius ticks (0 … 320: four rings), one radial line per category.
    expect(all(el, ".polar-grid path")).toHaveLength(4)
    expect(all(el, ".polar-grid line")).toHaveLength(6)
    // The category labels: text tokens, never the series colour, around the web and inside the chart.
    const labels = all(el, ".polar-angle-axis text")
    expect(labels.map((t) => t.textContent)).toEqual(data.map((d) => d.month))
    expect(getComputedStyle(labels[0]!).fill).toBe(getComputedStyle(shadow(el).querySelector(".tick")!).fill)
    expectTextInside(el)
    // The first category is at 12 o'clock, the second on the right (clockwise).
    const [jan, feb] = labels.map((t) => centerOf(el, t))
    const cx = el.getBoundingClientRect().width / 2
    expect(Math.abs(jan!.x - cx)).toBeLessThan(1)
    expect(feb!.x).toBeGreaterThan(cx)
    // February (305) reaches farther than January (186).
    const vertex = (i: number) => all(el, ".radar-dot")[i]!
    const r = (p: { x: number; y: number }) => Math.hypot(p.x - cx, p.y - cx)
    expect(r(centerOf(el, vertex(1))) / r(centerOf(el, vertex(0)))).toBeCloseTo(305 / 186, 1)
  })

  it("shrinks the web so long labels stay inside a narrow chart", async () => {
    const el = await radar(html``, { width: 180 })
    expectTextInside(el, ".polar-angle-axis text")
    const labels = all(el, ".polar-angle-axis text")
    const boxes = labels.map((t) => t.getBoundingClientRect())
    // No two labels overlap.
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true))
    )
  })

  it("moves between categories with the keyboard, showing every series", async () => {
    const el = await radar()
    const tooltip = el.querySelector("tec-chart-tooltip") as TecChartTooltip
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0, "first category")
    await waitUntil(() => live(el).textContent === "January, Desktop 186, Mobile 80", "announcement")
    expect(tooltip.payload.map((i) => i.value)).toEqual([186, 80])
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => live(el).textContent === "February, Desktop 305, Mobile 200", "announcement")
    // The active category: a spoke, a dot per series and an emphasised label.
    expect(all(el, ".cursor-line")).toHaveLength(1)
    expect(all(el, ".active-dot")).toHaveLength(2)
    expect(shadow(el).querySelector(".polar-angle-axis [data-active]")!.textContent).toBe("February")
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(5)
  })

  it("activates the category nearest to the pointer", async () => {
    const el = await radar()
    const box = el.getBoundingClientRect()
    const cx = box.width / 2
    // Just below the centre, towards April (6 o'clock).
    pointAt(el, cx + 3, cx + 30)
    await waitUntil(() => el.activeIndex === 3, "April")
    // Far outside the web: nothing.
    pointAt(el, 2, 2)
    await waitUntil(() => el.activeIndex === -1, "outside")
  })

  it("runs counter-clockwise in RTL, following the arrow keys", async () => {
    const el = await radar(html``, { dir: "rtl" })
    const labels = all(el, ".polar-angle-axis text")
    const cx = el.getBoundingClientRect().width / 2
    expect(centerOf(el, labels[1]!).x).toBeLessThan(cx)
    expectTextInside(el)
    await userEvent.tab()
    await waitUntil(() => el.activeIndex === 0)
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.activeIndex).toBe(1)
  })

  it("has a data table of categories by series and passes axe", async () => {
    const el = await radar()
    const table = shadow(el).querySelector("table")!
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["month", "Desktop", "Mobile"])
    expect([...table.querySelectorAll("tbody tr")[1]!.children].map((c) => c.textContent)).toEqual(["February", "305", "200"])
    await expectAccessible(el)
  })

  it("draws circle rings, a radius axis and value labels", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 320px; height: 320px" .data=${data} .config=${config}>
        <tec-chart-polar-grid grid-type="circle" radial-lines="false" filled></tec-chart-polar-grid>
        <tec-chart-polar-radius-axis domain="0 400" axis-line></tec-chart-polar-radius-axis>
        <tec-chart-radar key="desktop" fill="none" stroke-width="2">
          <tec-chart-label-list></tec-chart-label-list>
        </tec-chart-radar>
      </tec-chart>`
    )
    await drawn(el, ".radar-shape")
    expect(all(el, ".polar-grid circle").length).toBeGreaterThanOrEqual(4)
    expect(all(el, ".polar-grid line")).toHaveLength(0)
    expect(all(el, ".grid-fill *")).toHaveLength(1)
    // Lines only.
    const shape = shadow(el).querySelector(".radar-shape")!
    expect(shape.getAttribute("fill")).toBe("none")
    expect(shape.getAttribute("stroke")).toBe("var(--tec-chart-color-desktop)")
    // The explicit domain: ticks 100 … 400.
    expect(all(el, ".polar-radius-axis text").map((t) => t.textContent)).toEqual(["100", "200", "300", "400"])
    expect(all(el, ".polar-radius-axis .axis-line")).toHaveLength(1)
    const values = all(el, ".value-label").map((t) => t.textContent)
    expect(values.length).toBeGreaterThan(3)
    for (const value of values) expect(data.map((d) => String(d.desktop))).toContain(value)
    expectTextInside(el)
    // Grid off: no rings.
    el.querySelector("tec-chart-polar-grid")!.hidden = true
    await waitUntil(() => !shadow(el).querySelector(".polar-grid"))
  })

  it("draws a radar per coloured config key with the type shortcut", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 300px; height: 300px" type="radar" category-key="month" .data=${data} .config=${config}></tec-chart>`
    )
    await drawn(el, ".radar-shape")
    expect(all(el, ".radar-shape")).toHaveLength(2)
    expect(plot(el).getAttribute("aria-label")).toBe("Radar chart")
  })
})

async function radial(extra = html``, options: { dir?: "ltr" | "rtl"; attrs?: string } = {}) {
  const el = await fixture<TecChart>(
    html`<tec-chart style="width: 300px; height: 300px" label="Visitors by browser" .data=${browsers} .config=${browserConfig}>
      <tec-chart-tooltip hide-label></tec-chart-tooltip>
      <tec-chart-legend></tec-chart-legend>
      <tec-chart-radial-bar key="visitors" name-key="browser" inner-radius="30%" outer-radius="100%" background>${extra}</tec-chart-radial-bar>
    </tec-chart>`,
    options
  )
  return drawn(el, ".radial-bar")
}

describe("tec-chart-radial-bar", () => {
  it("draws one ring per row, the first innermost, coloured per row, with tracks", async () => {
    const el = await radial()
    expect(plot(el).dataset.kind).toBe("radial-bar")
    const bars = all(el, ".radial-bar")
    expect(bars).toHaveLength(5)
    expect(all(el, ".track")).toHaveLength(5)
    expect(bars[0]!.getAttribute("fill")).toBe("var(--tec-chart-color-chrome)")
    expect(bars[4]!.getAttribute("fill")).toBe("var(--tec-chart-color-other)")
    const size = (i: number) => bars[i]!.getBoundingClientRect().width
    // Chrome (the largest value) is a full ring on the inside; Other is on the outside.
    expect(size(0)).toBeLessThan(size(4))
    // The legend names the rows.
    const legend = el.querySelector("tec-chart-legend")!
    await legend.updateComplete
    expect([...legend.shadowRoot!.querySelectorAll("[part=label]")].map((l) => l.textContent)).toEqual(["Chrome", "Safari", "Firefox", "Edge", "Other"])
  })

  it("moves over the rows with the keyboard and hits rings under the pointer", async () => {
    const el = await radial()
    await userEvent.tab()
    await waitUntil(() => live(el).textContent === "Chrome 275", "announcement")
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => live(el).textContent === "Safari 200", "announcement")
    // The outermost ring, on its track (right of the centre, above 3 o'clock).
    const rect = plot(el).getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const outer = Math.min(rect.width, rect.height) / 2
    pointAt(el, cx - 5, cy + outer - 4)
    await waitUntil(() => el.activeIndex === 4, "Other")
    pointAt(el, cx, cy)
    await waitUntil(() => el.activeIndex === -1, "the hole")
  })

  it("has a data table and passes axe", async () => {
    const el = await radial()
    const table = shadow(el).querySelector("table")!
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["browser", "Visitors"])
    expect([...table.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Chrome", "Safari", "Firefox", "Edge", "Other"])
    await expectAccessible(el)
  })

  /**
   * Every glyph of every ring label sits inside its own bar: the centre of its body and points
   * 0.35em above and below it (the body of the letters), and both ends of the label.
   */
  function expectLabelsInsideTheirBars(el: TecChart) {
    const labels = all<SVGTextElement>(el, ".radial-labels text")
    const fontSize = Number.parseFloat(getComputedStyle(labels[0]!).fontSize)
    for (const label of labels) {
      const bar = shadow(el).querySelector<SVGPathElement>(`.radial-bar[data-index="${label.dataset.row}"]`)!
      const chars = label.getNumberOfChars()
      expect(chars).toBe(label.textContent!.trim().length)
      for (let i = 0; i < chars; i++) {
        const a = label.getStartPositionOfChar(i)
        const b = label.getEndPositionOfChar(i)
        const angle = (label.getRotationOfChar(i) * Math.PI) / 180
        // "Up" for the glyph: its advance direction turned a quarter counter-clockwise on screen.
        const up = { x: Math.sin(angle), y: -Math.cos(angle) }
        const points = [
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, lift: 0.35 },
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, lift: 0.7 },
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, lift: 0 },
          { x: a.x, y: a.y, lift: 0.35 },
          { x: b.x, y: b.y, lift: 0.35 },
        ]
        for (const p of points) {
          const point = new DOMPoint(p.x + up.x * p.lift * fontSize, p.y + up.y * p.lift * fontSize)
          expect(bar.isPointInFill(point), `${label.textContent} [${i}] +${p.lift}em`).toBe(true)
        }
      }
    }
  }

  it("labels bars along their ring, inside their start, only where the label fits", async () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const el = await radial(html`<tec-chart-label-list key="browser" position="inside-start"></tec-chart-label-list>`, { dir })
      const labels = all(el, ".inside-label")
      // Chrome (innermost, full ring) … Other: the labels that fit.
      expect(labels.length).toBeGreaterThanOrEqual(4)
      // Drawn after every bar, so no ring covers them.
      const last = all(el, ".radial-bar").at(-1)!
      for (const label of labels) {
        expect(last.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // Never in the bar's colour.
        expect(getComputedStyle(label).fill).not.toBe(getComputedStyle(all(el, ".radial-bar")[0]!).fill)
      }
      expectLabelsInsideTheirBars(el)
      expectTextInside(el)
    }
  })

  it("keeps labels inside their ring on thin rings and in the docs layout, and drops those that do not fit", async () => {
    for (const size of [250, 390, 560]) {
      const el = await fixture<TecChart>(
        html`<tec-chart style="width: ${size}px; height: ${size}px" .data=${browsers} .config=${browserConfig}>
          <tec-chart-radial-bar key="visitors" name-key="browser" start-angle="90" end-angle="-180" inner-radius="30" outer-radius="110" background>
            <tec-chart-label-list key="browser" position="inside-start"></tec-chart-label-list>
          </tec-chart-radial-bar>
        </tec-chart>`
      )
      await drawn(el, ".radial-bar")
      if (all(el, ".radial-labels text").length) expectLabelsInsideTheirBars(el)
    }
    // A label longer than its bar is left out (the value stays in the tooltip and the table).
    const el = await radial(html`<tec-chart-label-list position="inside-start" .formatter=${() => "A label far too long for any of these bars ".repeat(6)}></tec-chart-label-list>`)
    expect(all(el, ".radial-labels text")).toHaveLength(0)
    // Past the end of the bar, on the rest of the track: in text colour.
    const end = await radial(html`<tec-chart-label-list position="end"></tec-chart-label-list>`)
    const values = all(end, ".radial-labels .value-label")
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(getComputedStyle(v).fill).toBe(getComputedStyle(shadow(end).querySelector(".value-label")!).fill)
  })

  it("mirrors the sweep in RTL", async () => {
    const ltr = await radial(html``)
    const rtl = await radial(html``, { dir: "rtl" })
    const cx = ltr.getBoundingClientRect().width / 2
    // Other (90 of 275) sweeps a third of the circle: above 3 o'clock in LTR, above 9 o'clock in RTL.
    const other = (el: TecChart) => centerOf(el, all(el, ".radial-bar")[4]!).x
    expect(other(ltr)).toBeGreaterThan(cx)
    expect(other(rtl)).toBeLessThan(cx)
  })

  it("stacks series along the ring and shows a centre label", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 300px; height: 160px" .data=${[{ month: "January", desktop: 1260, mobile: 570 }]} .config=${{ ...config, visitors: { label: "Visitors" } }}>
        <tec-chart-tooltip hide-label></tec-chart-tooltip>
        <tec-chart-radial-bar key="desktop" stack="a" start-angle="180" end-angle="0" inner-radius="70%" outer-radius="100%" corner-radius="5">
          <tec-chart-label-list key="visitors" position="center" .formatter=${(_: unknown, row: Record<string, number>) => (row.desktop! + row.mobile!).toLocaleString("en-US")}></tec-chart-label-list>
        </tec-chart-radial-bar>
        <tec-chart-radial-bar key="mobile" stack="a" corner-radius="5"></tec-chart-radial-bar>
      </tec-chart>`
    )
    await drawn(el, ".radial-bar")
    const [desktop, mobile] = all(el, ".radial-bar")
    expect(desktop!.getAttribute("fill")).toBe("var(--tec-chart-color-desktop)")
    expect(mobile!.getAttribute("fill")).toBe("var(--tec-chart-color-mobile)")
    // Desktop runs from 9 o'clock over the top; mobile continues to 3 o'clock.
    expect(centerOf(el, desktop!).x).toBeLessThan(centerOf(el, mobile!).x)
    // The half circle fills the width of the chart.
    const box = shadow(el).querySelector(".radial")!.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(250)
    expect(shadow(el).querySelector(".center-value")!.textContent).toBe("1,830")
    expect(shadow(el).querySelector(".center-caption")!.textContent).toBe("Visitors")
    // The centre label sits above the centre, inside the half ring.
    const value = shadow(el).querySelector(".center-value")!.getBoundingClientRect()
    expect(value.bottom).toBeLessThanOrEqual(box.bottom)
    await userEvent.tab()
    // The tooltip hides its label, so the announcement does too.
    await waitUntil(() => live(el).textContent === "Desktop 1,260, Mobile 570", "announcement")
    await expectAccessible(el)
  })

  it("draws a radial bar per numeric field with the type shortcut", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 200px; height: 200px" type="radial-bar" .data=${browsers} .config=${browserConfig}></tec-chart>`
    )
    await drawn(el, ".radial-bar")
    expect(all(el, ".radial-bar")).toHaveLength(5)
    expect(plot(el).getAttribute("aria-label")).toBe("Radial bar chart")
  })

  it("shows progress against a maximum", async () => {
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 200px; height: 200px" .data=${[{ browser: "safari", visitors: 150 }]} .config=${browserConfig}>
        <tec-chart-radial-bar key="visitors" start-angle="90" end-angle="-270" max-value="300" background>
          <tec-chart-label-list position="center"></tec-chart-label-list>
        </tec-chart-radial-bar>
      </tec-chart>`
    )
    await drawn(el, ".radial-bar")
    // Half of the circle, clockwise from 12 o'clock: the right half.
    const bar = all(el, ".radial-bar")[0]!.getBoundingClientRect()
    const track = all(el, ".track")[0]!.getBoundingClientRect()
    expect(bar.width).toBeCloseTo(track.width / 2, -1)
    expect(bar.left).toBeGreaterThanOrEqual(track.left + track.width / 2 - 2)
    expect(shadow(el).querySelector(".center-value")!.textContent).toBe("150")
  })
})
