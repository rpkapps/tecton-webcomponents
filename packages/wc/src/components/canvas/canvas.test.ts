import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture } from "../../internal/test-utils.js"
import "../button/define.js"
import "./define.js"

const demo = (o: { dir?: string } = {}) => html`<div dir=${o.dir ?? "ltr"} style="display: flex; flex-direction: column; height: 300px; width: 400px">
  <button id="before">Before</button>
  <tec-canvas>
    <tec-canvas-surface></tec-canvas-surface>
    <tec-canvas-overlay position="top-left">
      <tec-canvas-toolbar aria-label="Navigation">
        <tec-button variant="ghost" size="icon-sm" aria-label="Zoom in">+</tec-button>
        <tec-button variant="ghost" size="icon-sm" aria-label="Zoom out">-</tec-button>
        <tec-button variant="ghost" size="icon-sm" aria-label="Pan">P</tec-button>
      </tec-canvas-toolbar>
    </tec-canvas-overlay>
    <tec-canvas-overlay position="top-right">
      <tec-canvas-toolbar orientation="horizontal" aria-label="Measure">
        <tec-button variant="ghost" size="icon-sm" aria-label="Distance">D</tec-button>
        <tec-button variant="ghost" size="icon-sm" aria-label="Area">A</tec-button>
      </tec-canvas-toolbar>
    </tec-canvas-overlay>
    <tec-canvas-overlay position="bottom-left">
      <tec-canvas-legend aria-label="Legend">
        <tec-canvas-legend-item swatch="rgb(255, 0, 0)">Existing fields</tec-canvas-legend-item>
        <tec-canvas-legend-item><span slot="swatch" style="background: blue"></span>Sub-basin</tec-canvas-legend-item>
      </tec-canvas-legend>
    </tec-canvas-overlay>
  </tec-canvas>
  <button id="after">After</button>
</div>`

const label = (el: Element | null) => ((el?.getRootNode() as ShadowRoot | undefined)?.host ?? el)?.getAttribute("aria-label")

describe("tec-canvas", () => {
  it("fills the remaining height of a flex column; the surface fills the canvas", async () => {
    const root = await fixture<HTMLElement>(demo())
    const canvas = root.querySelector("tec-canvas")!
    const surface = root.querySelector("tec-canvas-surface")!
    const buttons = root.querySelectorAll("button")
    const expected = 300 - buttons[0].getBoundingClientRect().height - buttons[1].getBoundingClientRect().height
    expect(Math.round(canvas.getBoundingClientRect().height)).toBe(Math.round(expected))
    expect(surface.getBoundingClientRect()).toMatchObject({ width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height })
  })

  it("pins overlays to corners with a 12px inset (logical in RTL)", async () => {
    for (const dir of ["ltr", "rtl"]) {
      const root = await fixture<HTMLElement>(demo({ dir }))
      const c = root.querySelector("tec-canvas")!.getBoundingClientRect()
      const [topStart, topEnd, bottomStart] = [...root.querySelectorAll("tec-canvas-overlay")].map((o) => o.getBoundingClientRect())
      expect(Math.round(topStart.top - c.top)).toBe(12)
      expect(Math.round(c.bottom - bottomStart.bottom)).toBe(12)
      if (dir === "ltr") {
        expect(Math.round(topStart.left - c.left)).toBe(12)
        expect(Math.round(c.right - topEnd.right)).toBe(12)
      } else {
        expect(Math.round(c.right - topStart.right)).toBe(12)
        expect(Math.round(topEnd.left - c.left)).toBe(12)
      }
    }
  })

  it("centres top/bottom overlays and lets the pointer through between controls", async () => {
    const root = await fixture<HTMLElement>(html`<tec-canvas style="height: 200px; width: 400px">
      <tec-canvas-surface></tec-canvas-surface>
      <tec-canvas-overlay position="bottom"><button>A</button><button>B</button></tec-canvas-overlay>
    </tec-canvas>`)
    const c = root.getBoundingClientRect()
    const o = root.querySelector("tec-canvas-overlay")!
    const r = o.getBoundingClientRect()
    expect(Math.round(r.left + r.width / 2)).toBe(Math.round(c.left + c.width / 2))
    expect(getComputedStyle(o).pointerEvents).toBe("none")
    expect(getComputedStyle(o.querySelector("button")!).pointerEvents).toBe("auto")
  })

  it("exposes toolbars and the legend to assistive technology", async () => {
    const root = await fixture<HTMLElement>(demo())
    const [nav, measure] = root.querySelectorAll("tec-canvas-toolbar")
    expect(await axNode(nav)).toMatchObject({ role: "toolbar", name: "Navigation" })
    expect(await axNode(measure)).toMatchObject({ role: "toolbar", name: "Measure" })
    expect(await axTree(root.querySelector("tec-canvas-legend")!)).toEqual(["list: Legend", "listitem", "listitem"])
    const items = root.querySelectorAll("tec-canvas-legend-item")
    expect(items[0].textContent?.trim()).toBe("Existing fields")
    expect(await axNode(items[1].shadowRoot!.querySelector(".swatch")!)).toMatchObject({ ignored: "true" })
    await expectAccessible(root)
  })

  it("is one tab stop; arrows move along the rail (Up/Down vertical, Left/Right horizontal, mirrored in RTL)", async () => {
    const root = await fixture<HTMLElement>(demo())
    root.querySelector<HTMLButtonElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(label(deepActiveElement())).toBe("Zoom in")
    await userEvent.keyboard("{ArrowDown}")
    expect(label(deepActiveElement())).toBe("Zoom out")
    await userEvent.keyboard("{ArrowRight}")
    expect(label(deepActiveElement())).toBe("Zoom out")
    await userEvent.keyboard("{End}")
    expect(label(deepActiveElement())).toBe("Pan")
    await userEvent.keyboard("{Home}")
    expect(label(deepActiveElement())).toBe("Zoom in")
    await userEvent.keyboard("{ArrowUp}")
    expect(label(deepActiveElement())).toBe("Zoom in")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Tab}")
    expect(label(deepActiveElement())).toBe("Distance")
    await userEvent.keyboard("{ArrowRight}")
    expect(label(deepActiveElement())).toBe("Area")
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()?.id).toBe("after")
    await userEvent.keyboard("{Shift>}{Tab}{Tab}{/Shift}")
    expect(label(deepActiveElement())).toBe("Zoom out")

    const rtl = await fixture<HTMLElement>(demo({ dir: "rtl" }))
    rtl.querySelectorAll("tec-canvas-toolbar")[1].querySelector("tec-button")!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(label(deepActiveElement())).toBe("Area")
  })

  it("draws the colour swatch", async () => {
    const root = await fixture<HTMLElement>(demo())
    const item = root.querySelector("tec-canvas-legend-item")!
    const fill = item.shadowRoot!.querySelector(".fill")!
    expect(getComputedStyle(fill).backgroundColor).toBe("rgb(255, 0, 0)")
    expect(item.shadowRoot!.querySelector(".swatch")!.getBoundingClientRect().width).toBe(12)
  })
})
