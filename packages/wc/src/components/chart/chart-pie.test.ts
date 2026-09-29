import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecChart } from "./chart.js"
import "./define.js"

const browsers = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
]
const config = {
  visitors: { label: "Visitors" },
  desktop: { label: "Desktop" },
  mobile: { label: "Mobile" },
  chrome: { label: "Chrome", color: "var(--tec-chart-1)" },
  safari: { label: "Safari", color: "var(--tec-chart-2)" },
  firefox: { label: "Firefox", color: "var(--tec-chart-3)" },
  edge: { label: "Edge", color: "var(--tec-chart-4)" },
  other: { label: "Other", color: "var(--tec-chart-5)" },
}
const months = [
  { month: "january", desktop: 186, mobile: 80 },
  { month: "february", desktop: 305, mobile: 200 },
  { month: "march", desktop: 237, mobile: 120 },
]

const shadow = (el: Element) => el.shadowRoot!
const all = <T extends Element = SVGElement>(el: Element, selector: string) => [...shadow(el).querySelectorAll<T>(selector)]
const plot = (el: TecChart) => shadow(el).querySelector(".plot") as HTMLElement
const live = (el: TecChart) => shadow(el).querySelector("[aria-live]")!

async function pie(content: unknown, options: { dir?: "ltr" | "rtl"; size?: number; data?: unknown[] } = {}) {
  const size = options.size ?? 300
  const el = await fixture<TecChart>(
    html`<tec-chart style="width: ${size}px; height: ${size}px" label="Visitors by browser" .data=${options.data ?? browsers} .config=${config}>
      <tec-chart-tooltip hide-label></tec-chart-tooltip>
      ${content}
    </tec-chart>`,
    options
  )
  await waitUntil(() => shadow(el).querySelector(".sector"), "sectors drawn")
  await el.updateComplete
  await animationsFinished(shadow(el).querySelector("svg")!)
  return el
}

function pointAt(el: TecChart, x: number, y: number) {
  const rect = plot(el).getBoundingClientRect()
  plot(el).dispatchEvent(new PointerEvent("pointermove", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, composed: true }))
}

/** A point at `radius` and `angle` (degrees counter-clockwise from 3 o'clock) around the plot centre. */
function polar(el: TecChart, radius: number, angle: number) {
  const rect = plot(el).getBoundingClientRect()
  const a = (angle * Math.PI) / 180
  return { x: rect.width / 2 + radius * Math.cos(a), y: rect.height / 2 - radius * Math.sin(a) }
}

const boxOf = (el: Element) => el.getBoundingClientRect()
const overlap = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)

describe("tec-chart-pie extensions", () => {
  it("draws several pies as concentric rings and moves through every slice, ring by ring", async () => {
    const el = await pie(
      html`<tec-chart-pie key="desktop" name-key="month" outer-radius="60"></tec-chart-pie>
        <tec-chart-pie key="mobile" name-key="month" inner-radius="70" outer-radius="90"></tec-chart-pie>`,
      { data: months }
    )
    const rings = all(el, ".pie-ring")
    expect(rings).toHaveLength(2)
    expect(rings[0]!.querySelectorAll(".sector")).toHaveLength(3)
    // The outer ring surrounds the inner pie.
    expect(boxOf(rings[1]!).width).toBeCloseTo(180 + 2, -1)
    expect(boxOf(rings[0]!).width).toBeLessThanOrEqual(122)
    await userEvent.tab()
    await waitUntil(() => live(el).textContent === "january 186", "first slice of the inner pie")
    await userEvent.keyboard("{End}")
    expect(el.activeIndex).toBe(5)
    await waitUntil(() => live(el).textContent === "march 120", "last slice of the outer ring")
    // One table: a column per ring.
    const table = shadow(el).querySelector("table")!
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["month", "Desktop", "Mobile"])
    expect([...table.querySelectorAll("tbody tr")[1]!.children].map((c) => c.textContent)).toEqual(["february", "305", "200"])
    await expectAccessible(el)
  })

  it("names the ring in the tooltip label and gives rings with their own data their own table", async () => {
    const detail = [
      { version: "chrome-128", visitors: 200 },
      { version: "chrome-127", visitors: 75 },
      { version: "safari-17", visitors: 200 },
    ]
    const el = await fixture<TecChart>(
      html`<tec-chart style="width: 300px; height: 300px" label="Visitors" .data=${browsers.slice(0, 2)} .config=${config}>
        <tec-chart-tooltip></tec-chart-tooltip>
        <tec-chart-pie key="visitors" name-key="browser" outer-radius="50%"></tec-chart-pie>
        <tec-chart-pie key="visitors" name-key="version" inner-radius="60%" outer-radius="80%" .data=${detail}></tec-chart-pie>
      </tec-chart>`
    )
    await waitUntil(() => all(el, ".sector").length === 5)
    await userEvent.tab()
    await waitUntil(() => live(el).textContent === "Visitors, Chrome 275", "ring label")
    const tables = all<HTMLTableElement>(el, "table")
    expect(tables).toHaveLength(2)
    expect(tables[1]!.querySelector("caption")!.textContent).toBe("Visitors: Visitors")
    expect([...tables[1]!.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["chrome-128", "chrome-127", "safari-17"])
  })

  it("labels slices inside only where the label fits, in a colour that contrasts with the slice", async () => {
    const data = [...browsers, { browser: "tiny", visitors: 4 }]
    const el = await pie(
      html`<tec-chart-pie key="visitors" name-key="browser">
        <tec-chart-label-list key="browser"></tec-chart-label-list>
      </tec-chart-pie>`,
      { data }
    )
    const labels = all(el, ".inside-label")
    expect(labels.map((l) => l.textContent)).toEqual(["Chrome", "Safari", "Firefox", "Edge", "Other"])
    const sectors = all(el, ".sector")
    labels.forEach((label, i) => {
      // Inside its own slice.
      const box = boxOf(label)
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      const hit = shadow(el).elementsFromPoint(x, y).find((e) => e.classList.contains("sector"))
      expect(hit).toBe(sectors[i])
      // White or ink, never the slice colour.
      const fill = getComputedStyle(label).fill
      expect(["rgb(255, 255, 255)", "rgb(0, 0, 0)", "oklch(1 0 0)", "oklch(0 0 0)"]).toContain(fill)
      expect(fill).not.toBe(getComputedStyle(sectors[i]!).fill)
    })
  })

  it("puts outside labels with leader lines inside the chart, without overlaps", async () => {
    const data = [...browsers, { browser: "a", visitors: 5 }, { browser: "b", visitors: 6 }, { browser: "c", visitors: 7 }]
    for (const size of [300, 180]) {
      const el = await pie(
        html`<tec-chart-pie key="visitors" name-key="browser">
          <tec-chart-label-list position="outside"></tec-chart-label-list>
        </tec-chart-pie>`,
        { data, size }
      )
      const labels = all(el, ".outside-label")
      expect(labels.length).toBeGreaterThanOrEqual(5)
      expect(all(el, ".leader")).toHaveLength(labels.length)
      const chart = boxOf(el)
      const boxes = labels.map(boxOf)
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(chart.left)
        expect(box.right).toBeLessThanOrEqual(chart.right)
        expect(box.top).toBeGreaterThanOrEqual(chart.top)
        expect(box.bottom).toBeLessThanOrEqual(chart.bottom)
      }
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)))
      // Labels never overlap the pie.
      const pieBox = boxOf(shadow(el).querySelector(".pie-ring")!)
      const cx = pieBox.left + pieBox.width / 2
      const cy = pieBox.top + pieBox.height / 2
      for (const box of boxes) {
        const nearest = { x: Math.max(box.left, Math.min(cx, box.right)), y: Math.max(box.top, Math.min(cy, box.bottom)) }
        expect(Math.hypot(nearest.x - cx, nearest.y - cy)).toBeGreaterThanOrEqual(pieBox.width / 2 - 1)
      }
      el.parentElement!.remove()
    }
  })

  it("shows the total in the hole of a donut", async () => {
    const el = await pie(
      html`<tec-chart-pie key="visitors" name-key="browser" inner-radius="60%">
        <tec-chart-label-list position="center"></tec-chart-label-list>
      </tec-chart-pie>`
    )
    const value = shadow(el).querySelector(".center-value")!
    expect(value.textContent).toBe((925).toLocaleString())
    expect(shadow(el).querySelector(".center-caption")!.textContent).toBe("Visitors")
    // Inside the hole.
    const hole = boxOf(shadow(el).querySelector(".pie-ring")!).width * 0.6 * 0.5
    const box = boxOf(value)
    expect(box.width).toBeLessThan(hole * 2)
    await expectAccessible(el)
  })

  it("emphasises the active-index slice, then the hovered one", async () => {
    const el = await pie(html`<tec-chart-pie key="visitors" name-key="browser" inner-radius="50%" active-index="1"></tec-chart-pie>`)
    const emphasised = () => shadow(el).querySelector(".sector[data-emphasis]")
    expect(emphasised()?.getAttribute("data-index")).toBe("1")
    // Hover over Chrome (the first slice, from 3 o'clock counter-clockwise).
    const p = polar(el, 100, 40)
    pointAt(el, p.x, p.y)
    await waitUntil(() => el.activeIndex === 0, "chrome")
    await waitUntil(() => emphasised()?.getAttribute("data-index") === "0")
    // The emphasised slice reaches 4px further out.
    const outer = (slice: Element) => {
      const d = slice.getAttribute("d")!
      return Number(/A([\d.]+),/.exec(d)![1])
    }
    expect(outer(emphasised()!) - outer(all(el, ".sector")[2]!)).toBeCloseTo(4)
  })

  it("gives thin slices a 24px target", async () => {
    const data = [{ browser: "chrome", visitors: 995 }, { browser: "tiny", visitors: 5 }]
    const el = await pie(html`<tec-chart-pie key="visitors" name-key="browser"></tec-chart-pie>`, { data })
    // The tiny slice spans 1.8° (about 3px at radius 100) just below 3 o'clock; 10px away, over the
    // big slice, still hits it.
    const radius = 100
    const tinyMid = 359.1
    const offset = (10 / radius) * (180 / Math.PI)
    const p = polar(el, radius, tinyMid - offset)
    pointAt(el, p.x, p.y)
    await waitUntil(() => el.activeIndex === 1, "tiny slice")
    const q = polar(el, radius, 90)
    pointAt(el, q.x, q.y)
    await waitUntil(() => el.activeIndex === 0, "big slice")
  })

  it("mirrors the angles in RTL", async () => {
    const ltr = await pie(html`<tec-chart-pie key="visitors" name-key="browser"></tec-chart-pie>`)
    const rtl = await pie(html`<tec-chart-pie key="visitors" name-key="browser"></tec-chart-pie>`, { dir: "rtl" })
    const centre = (el: TecChart) => boxOf(plot(el)).left + boxOf(plot(el)).width / 2
    const first = (el: TecChart) => {
      const b = boxOf(all(el, ".sector")[0]!)
      return b.left + b.width / 2
    }
    // Chrome starts at 3 o'clock counter-clockwise in LTR (right half), at 9 o'clock clockwise in RTL.
    expect(first(ltr)).toBeGreaterThan(centre(ltr))
    expect(first(rtl)).toBeLessThan(centre(rtl))
  })

  it("fits a half donut to the width and scales pixel radii down in a small chart", async () => {
    const el = await pie(html`<tec-chart-pie key="visitors" name-key="browser" start-angle="180" end-angle="0" inner-radius="60" outer-radius="120"></tec-chart-pie>`, {
      size: 160,
    })
    const ring = boxOf(shadow(el).querySelector(".pie-ring")!)
    const chart = boxOf(el)
    expect(ring.width).toBeLessThanOrEqual(chart.width)
    expect(ring.width).toBeGreaterThan(chart.width * 0.9)
    expect(ring.height).toBeLessThanOrEqual(ring.width / 2 + 2)
  })
})
