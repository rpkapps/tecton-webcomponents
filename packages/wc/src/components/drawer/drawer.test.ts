import { html } from "lit"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { aTimeout, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { isScrollLocked } from "../../internal/scroll-lock.js"
import type { TecDrawer } from "./drawer.js"
import "./define.js"

const dlg = (el: Element) => el.shadowRoot!.querySelector("dialog")!
const popup = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

const basic = (attrs = "") => `<div>
  <button id="outside">Outside</button>
  <tec-drawer ${attrs}>
    <tec-button slot="trigger" variant="outline">Open Drawer</tec-button>
    <tec-drawer-header>
      <tec-drawer-title>Move Goal</tec-drawer-title>
      <tec-drawer-description>Set your daily activity goal.</tec-drawer-description>
    </tec-drawer-header>
    <div id="body" style="height: 200px; padding: 16px">Body</div>
    <tec-drawer-footer><tec-drawer-close>Close</tec-drawer-close></tec-drawer-footer>
  </tec-drawer>
</div>`

async function settled(el: TecDrawer) {
  await waitUntil(() => popup(el).getAnimations().every((a) => a.playState !== "running"), "transitions finished", 3000)
}

async function open(el: TecDrawer) {
  await userEvent.click(el.querySelector("[slot=trigger]")!)
  await waitUntil(() => dlg(el).open || dlg(el).matches(":popover-open"), "open")
  await aTimeout(20)
  await settled(el)
}

/** Drags the panel with synthetic pointer events (`dy`/`dx` in px, `ms` total). */
async function drag(el: TecDrawer, dx: number, dy: number, steps = 6, ms = 120, target: Element = popup(el)) {
  const r = popup(el).getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y0 = r.top + 30
  const opts = { pointerId: 7, isPrimary: true, bubbles: true, composed: true, pointerType: "touch", button: 0 }
  target.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: x0, clientY: y0 }))
  for (let i = 1; i <= steps; i++) {
    await aTimeout(ms / steps)
    popup(el).dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: x0 + (dx * i) / steps, clientY: y0 + (dy * i) / steps }))
  }
  popup(el).dispatchEvent(new PointerEvent("pointerup", { ...opts, clientX: x0 + dx, clientY: y0 + dy }))
}

describe("tec-drawer", () => {
  it("opens a modal dialog at the bottom, named, focused, scroll locked", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-drawer")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ hasPopup: "dialog", expanded: "false" })
    await open(el)
    expect(await axNode(dlg(el))).toMatchObject({ role: "dialog", name: "Move Goal", description: "Set your daily activity goal." })
    expect(deepActiveElement()).toBe(dlg(el))
    expect(isScrollLocked()).toBe(true)
    const r = popup(el).getBoundingClientRect()
    expect(Math.round(r.bottom)).toBe(innerHeight)
    expect(Math.round(r.width)).toBe(innerWidth)
    expect(getComputedStyle(popup(el)).borderTopLeftRadius).toBe("12px")
    expect(getComputedStyle(el.querySelector("tec-drawer-header")!.shadowRoot!.querySelector(".base")!).textAlign).toBe("center")
    await expectAccessible(root)
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(deepActiveElement()).toBe(innerButton(trigger))
  })

  it("a short swipe springs back, a long swipe dismisses with reason swipe", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-drawer")!
    await open(el)
    await drag(el, 0, 40, 6, 600)
    await aTimeout(20)
    expect(el.open).toBe(true)
    expect(popup(el).style.getPropertyValue("--_d-move")).toBe("0px")
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await drag(el, 0, popup(el).offsetHeight * 0.7, 6, 300)
    expect((await change).detail).toEqual({ open: false, reason: "swipe" })
  })

  it("a fast flick dismisses; a sideways drag does not", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-drawer")!
    await open(el)
    await drag(el, 80, 5, 4, 80)
    expect(el.open).toBe(true)
    await drag(el, 0, 60, 3, 45)
    await aTimeout(10)
    expect(el.open).toBe(false)
  })

  it("moves with the pointer while swiping and dims the overlay", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-drawer")!
    await open(el)
    const r = popup(el).getBoundingClientRect()
    const opts = { pointerId: 3, isPrimary: true, bubbles: true, composed: true, pointerType: "mouse", button: 0 }
    popup(el).dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: 100, clientY: r.top + 20 }))
    popup(el).dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: 100, clientY: r.top + 70 }))
    popup(el).dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: 100, clientY: r.top + 120 }))
    await aTimeout(20)
    expect(el.matches(":state(swiping)")).toBe(true)
    expect(Math.round(popup(el).getBoundingClientRect().top - r.top)).toBe(100)
    const overlay = el.shadowRoot!.querySelector(".overlay")!
    expect(Number(getComputedStyle(overlay).opacity)).toBeLessThan(1)
    popup(el).dispatchEvent(new PointerEvent("pointercancel", opts))
    expect(el.matches(":state(swiping)")).toBe(false)
  })

  it("sides: right and left drawers are side panels and swipe horizontally", async () => {
    await page.viewport(1024, 768)
    try {
      const root = await fixture<HTMLElement>(basic('swipe-direction="left"'))
      const el = root.querySelector("tec-drawer")!
      await open(el)
      const r = popup(el).getBoundingClientRect()
      expect(Math.round(r.left)).toBe(0)
      expect(Math.round(r.width)).toBe(384)
      expect(Math.round(r.height)).toBe(innerHeight)
      const change = oneEvent<CustomEvent>(el, "tec-open-change")
      await drag(el, -300, 0, 6, 300)
      expect((await change).detail.reason).toBe("swipe")
    } finally {
      await page.viewport(414, 896)
    }
  })

  it("snap points: opens at the first, swipes up to the full height, down to close", async () => {
    const root = await fixture<HTMLElement>(basic('snap-points="300px 1" show-swipe-handle'))
    const el = root.querySelector("tec-drawer")!
    await open(el)
    expect(el.snapPoint).toBe("300px")
    expect(Math.round(innerHeight - popup(el).getBoundingClientRect().top)).toBe(300)
    expect(el.shadowRoot!.querySelector(".handle")).not.toBeNull()
    const snap = oneEvent<CustomEvent>(el, "tec-snap-point-change")
    await drag(el, 0, -250, 6, 300)
    expect((await snap).detail).toEqual({ snapPoint: 1 })
    await settled(el)
    expect(Math.round(popup(el).getBoundingClientRect().top)).toBe(0)
    expect(el.matches(":state(expanded)")).toBe(true)
    await drag(el, 0, 60, 6, 600)
    await settled(el)
    expect(el.snapPoint).toBe(1)
    const events = recordEvents<CustomEvent>(el, "tec-snap-point-change")
    await drag(el, 0, innerHeight - 350, 6, 600)
    await settled(el)
    expect(events.events[0]?.detail).toEqual({ snapPoint: "300px" })
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await drag(el, 0, 280, 6, 300)
    expect((await change).detail.reason).toBe("swipe")
  })

  it("non-modal: page stays interactive, no overlay; outside press closes unless persistent", async () => {
    const root = await fixture<HTMLElement>(basic('non-modal swipe-direction="right"'))
    const el = root.querySelector("tec-drawer")!
    expect(el.shadowRoot!.querySelector(".overlay")).toBeNull()
    await open(el)
    expect(dlg(el).matches(":modal")).toBe(false)
    expect(dlg(el).matches(":popover-open")).toBe(true)
    expect(isScrollLocked()).toBe(false)
    expect(await axNode(dlg(el))).toMatchObject({ role: "dialog", name: "Move Goal" })
    el.persistent = true
    await el.updateComplete
    await userEvent.click(root.querySelector("#outside")!)
    expect(el.open).toBe(true)
    expect(deepActiveElement()).toBe(root.querySelector("#outside"))
    el.persistent = false
    await el.updateComplete
    await userEvent.click(root.querySelector("#outside")!)
    expect(el.open).toBe(false)
  })

  it("nested drawers stack: the parent scales behind the front one", async () => {
    const root = await fixture<HTMLElement>(`<div>
      <tec-drawer id="outer">
        <tec-button slot="trigger">Open</tec-button>
        <tec-drawer-title>Outer</tec-drawer-title>
        <div style="height: 300px"></div>
        <tec-drawer id="inner">
          <tec-button slot="trigger">Nested</tec-button>
          <tec-drawer-title>Inner</tec-drawer-title>
          <div style="height: 200px"></div>
        </tec-drawer>
      </tec-drawer>
    </div>`)
    const outer = root.querySelector<TecDrawer>("#outer")!
    const inner = root.querySelector<TecDrawer>("#inner")!
    await open(outer)
    await open(inner)
    await settled(outer)
    expect(outer.matches(":state(nested-open)")).toBe(true)
    expect(popup(outer).style.getPropertyValue("--_d-nested")).toBe("1")
    const o = popup(outer).getBoundingClientRect()
    const i = popup(inner).getBoundingClientRect()
    expect(o.width).toBeLessThan(i.width)
    expect(Math.round(i.top - o.top)).toBe(16)
    await userEvent.keyboard("{Escape}")
    expect(inner.open).toBe(false)
    expect(outer.open).toBe(true)
    await waitUntil(() => !outer.matches(":state(nested-open)"), "unstacked")
  })

  it("the close part closes; scrolling content scrolls instead of swiping", async () => {
    const root = await fixture<HTMLElement>(`<div><tec-drawer>
      <tec-button slot="trigger">Open</tec-button>
      <tec-drawer-title>Scroll</tec-drawer-title>
      <div id="scroller" style="height: 100px; overflow-y: auto"><div style="height: 600px"></div></div>
      <tec-drawer-close>Close</tec-drawer-close>
    </tec-drawer></div>`)
    const el = root.querySelector<TecDrawer>("tec-drawer")!
    await open(el)
    const scroller = root.querySelector<HTMLElement>("#scroller")!
    scroller.scrollTop = 100
    await drag(el, 0, 300, 6, 300, scroller.firstElementChild!)
    expect(el.open).toBe(true)
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(el.querySelector("tec-drawer-close")!)
    expect((await change).detail.reason).toBe("close")
  })
})
