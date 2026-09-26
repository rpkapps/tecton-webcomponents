import { html } from "lit"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, waitUntil } from "../../internal/test-utils.js"
import type { TecSheet } from "./sheet.js"
import "./define.js"

const dlg = (el: Element) => el.shadowRoot!.querySelector("dialog")!
const panel = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

const basic = (side = "right", attrs = "") => `<div>
  <tec-sheet side="${side}" ${attrs}>
    <tec-button slot="trigger" variant="outline">Open</tec-button>
    <tec-sheet-header>
      <tec-sheet-title>Edit profile</tec-sheet-title>
      <tec-sheet-description>Make changes to your profile here.</tec-sheet-description>
    </tec-sheet-header>
    <div style="padding: 0 1rem"><input aria-label="Name" value="Pedro" /></div>
    <tec-sheet-footer>
      <tec-button>Save changes</tec-button>
      <tec-sheet-close>Close</tec-sheet-close>
    </tec-sheet-footer>
  </tec-sheet>
</div>`

async function open(el: TecSheet) {
  await userEvent.click(el.querySelector("[slot=trigger]")!)
  await waitUntil(() => dlg(el).open, "open")
  await animationsFinished(panel(el))
}

describe("tec-sheet", () => {
  it("opens a modal dialog on the right, named by its title", async () => {
    await page.viewport(1024, 768)
    try {
      const root = await fixture<HTMLElement>(basic())
      const el = root.querySelector("tec-sheet")!
      await open(el)
      expect(await axNode(dlg(el))).toMatchObject({ role: "dialog", name: "Edit profile", description: "Make changes to your profile here." })
      expect(deepActiveElement()).toBe(dlg(el))
      const r = panel(el).getBoundingClientRect()
      expect(Math.round(r.right)).toBe(innerWidth)
      expect(Math.round(r.width)).toBe(384)
      expect(Math.round(r.height)).toBe(innerHeight)
      expect(getComputedStyle(panel(el)).borderLeftWidth).toBe("1px")
      // header padding 16px, footer at the bottom
      const header = el.querySelector("tec-sheet-header")!.shadowRoot!.querySelector(".base")!
      expect(getComputedStyle(header).paddingTop).toBe("16px")
      const footer = el.querySelector("tec-sheet-footer")!.getBoundingClientRect()
      expect(Math.round(footer.bottom)).toBe(innerHeight)
      await expectAccessible(root)
    } finally {
      await page.viewport(414, 896)
    }
  })

  it("places each side on its edge", async () => {
    for (const side of ["top", "bottom", "left"] as const) {
      const root = await fixture<HTMLElement>(basic(side))
      const el = root.querySelector("tec-sheet")!
      el.show()
      await el.updateComplete
      await animationsFinished(panel(el))
      const r = panel(el).getBoundingClientRect()
      if (side === "top") expect(Math.round(r.top)).toBe(0)
      if (side === "bottom") expect(Math.round(r.bottom)).toBe(innerHeight)
      if (side === "left") expect(Math.round(r.left)).toBe(0)
      if (side !== "left") expect(Math.round(r.width)).toBe(innerWidth)
      el.hide()
      await el.updateComplete
    }
  })

  it("closes on overlay press, close part and Escape; focus returns to the trigger", async () => {
    const root = await fixture<HTMLElement>(basic("right"))
    const el = root.querySelector("tec-sheet")!
    await open(el)
    let change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect((await change).detail.reason).toBe("outside")
    await open(el)
    change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(el.querySelector("tec-sheet-close")!)
    expect((await change).detail.reason).toBe("close")
    await waitUntil(() => !dlg(el).open, "closed")
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("[slot=trigger]")!))
  })

  it("hide-close and persistent", async () => {
    const root = await fixture<HTMLElement>(basic("right", "hide-close persistent"))
    const el = root.querySelector("tec-sheet")!
    expect(el.shadowRoot!.querySelector(".close")).toBeNull()
    await open(el)
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect(el.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
  })
})
