import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, aTimeout, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, recordEvents, waitUntil } from "../../internal/test-utils.js"
import "../button/define.js"
import type { TecButton } from "../button/button.js"
import type { TecPopover } from "./popover.js"
import "./define.js"

const panel = (el: TecPopover) => el.shadowRoot!.querySelector(".content") as HTMLElement
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!
const isShown = (el: TecPopover) => panel(el).matches(":popover-open")

const basic = (o: { side?: string; align?: string; open?: boolean } = {}) => html`<div style="padding: 120px">
  <button id="outside" style="position: absolute; top: 0; left: 0">Outside</button>
  <tec-popover side=${o.side ?? "bottom"} align=${o.align ?? "center"} ?open=${o.open}>
    <tec-button slot="trigger" variant="outline">Open popover</tec-button>
    <tec-popover-header>
      <tec-popover-title>Dimensions</tec-popover-title>
      <tec-popover-description>Set the dimensions for the layer.</tec-popover-description>
    </tec-popover-header>
    <input aria-label="Width" value="100%" />
    <input aria-label="Height" value="25px" />
  </tec-popover>
</div>`

async function open(el: TecPopover) {
  await userEvent.click(el.querySelector("tec-button")!)
  await waitUntil(() => isShown(el), "popover shown")
  await el.updateComplete
  await animationsFinished(panel(el))
}

describe("tec-popover", () => {
  it("wires the trigger (aria-haspopup, aria-expanded) through tec-button", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ role: "button", name: "Open popover", expanded: "false", hasPopup: "dialog" })
    expect(isShown(el)).toBe(false)
  })

  it("opens on trigger press: top layer, focus on the named dialog, expanded trigger", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await open(el)
    expect((await change).detail).toEqual({ open: true, reason: "trigger" })
    expect(el.open).toBe(true)
    expect(deepActiveElement()).toBe(panel(el))
    expect(await axNode(panel(el))).toMatchObject({ role: "dialog", name: "Dimensions", description: "Set the dimensions for the layer." })
    expect(await axNode(innerButton(el.querySelector("tec-button")!))).toMatchObject({ expanded: "true" })
    await expectAccessible(root)
  })

  it("positions below the trigger, centered, 4px away", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    await open(el)
    const t = el.querySelector("tec-button")!.getBoundingClientRect()
    const p = panel(el).getBoundingClientRect()
    expect(panel(el).dataset.side).toBe("bottom")
    expect(Math.round(p.top - t.bottom)).toBe(4)
    expect(Math.round(p.left + p.width / 2)).toBe(Math.round(t.left + t.width / 2))
    expect(Math.round(p.width)).toBe(288)
  })

  it("honours side/align, and logical alignment in RTL", async () => {
    const root = await fixture<HTMLElement>(basic({ side: "right", align: "start" }))
    const el = root.querySelector("tec-popover")!
    await open(el)
    const t = el.querySelector("tec-button")!.getBoundingClientRect()
    const p = panel(el).getBoundingClientRect()
    expect(panel(el).dataset.side).toBe("right")
    expect(Math.round(p.left - t.right)).toBe(4)
    expect(Math.round(p.top)).toBe(Math.round(t.top))

    const rtl = await fixture<HTMLElement>(html`<div dir="rtl" style="padding: 40px 400px">
      <tec-popover align="start"><tec-button slot="trigger">Open</tec-button>Content</tec-popover>
    </div>`)
    const el2 = rtl.querySelector("tec-popover")!
    await open(el2)
    const t2 = el2.querySelector("tec-button")!.getBoundingClientRect()
    const p2 = panel(el2).getBoundingClientRect()
    expect(Math.round(p2.right)).toBe(Math.round(t2.right))
  })

  it("flips to the other side when there is no room", async () => {
    const root = await fixture<HTMLElement>(html`<div style="position: fixed; bottom: 4px; left: 200px">
      <tec-popover><tec-button slot="trigger">Open</tec-button><div style="height: 200px">Tall</div></tec-popover>
    </div>`)
    const el = root.querySelector("tec-popover")!
    await open(el)
    expect(panel(el).dataset.side).toBe("top")
  })

  it("Escape closes and returns focus to the trigger", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    await open(el)
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(events.events[0]!.detail).toEqual({ open: false, reason: "escape" })
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
    await waitUntil(() => !isShown(el), "popover hidden after exit animation")
  })

  it("closes on an outside press but not on a press inside", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    await open(el)
    await userEvent.click(el.querySelector("input")!)
    expect(el.open).toBe(true)
    await userEvent.click(root.querySelector("#outside")!)
    expect(el.open).toBe(false)
  })

  it("the trigger toggles it closed again", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    await open(el)
    await userEvent.click(el.querySelector("tec-button")!)
    expect(el.open).toBe(false)
  })

  it("keeps Tab inside the panel", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    await open(el)
    const [w, h] = [...el.querySelectorAll("input")]
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(w)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(h)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(w)
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()).toBe(h)
  })

  it("tec-open-change is cancelable", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-popover")!
    el.addEventListener("tec-open-change", (e) => e.preventDefault())
    await userEvent.click(el.querySelector("tec-button")!)
    await aTimeout(20)
    expect(el.open).toBe(false)
    expect(isShown(el)).toBe(false)
  })

  it("show()/hide() work without events; open attribute opens initially", async () => {
    const root = await fixture<HTMLElement>(basic({ open: true }))
    const el = root.querySelector("tec-popover")!
    await waitUntil(() => isShown(el), "initially open")
    const events = recordEvents(el, "tec-open-change")
    el.hide()
    await el.updateComplete
    await waitUntil(() => !isShown(el), "hidden")
    el.show()
    await el.updateComplete
    await waitUntil(() => isShown(el), "shown")
    expect(events.events).toHaveLength(0)
  })

  it("Escape closes only the innermost of nested popovers", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 80px">
      <tec-popover id="outer">
        <tec-button slot="trigger">Outer</tec-button>
        <tec-popover id="inner"><tec-button slot="trigger">Inner</tec-button>Inner content</tec-popover>
      </tec-popover>
    </div>`)
    const outer = root.querySelector<TecPopover>("#outer")!
    const inner = root.querySelector<TecPopover>("#inner")!
    await open(outer)
    await userEvent.click(inner.querySelector("tec-button")!)
    await waitUntil(() => isShown(inner), "inner shown")
    await userEvent.click(inner.shadowRoot!.querySelector(".content")!)
    expect(outer.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(inner.open).toBe(false)
    expect(outer.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(outer.open).toBe(false)
  })

  it("uses the label attribute or the trigger as the dialog name without a title", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-popover open><tec-button slot="trigger">Filters</tec-button>Body</tec-popover></div>`)
    const el = root.querySelector("tec-popover")!
    await waitUntil(() => isShown(el), "open")
    expect(await axNode(panel(el))).toMatchObject({ role: "dialog", name: "Filters" })
    el.label = "Filter options"
    await el.updateComplete
    expect(await axNode(panel(el))).toMatchObject({ name: "Filter options" })
  })

  it("does not open from a disabled trigger", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-popover><tec-button slot="trigger" disabled>Open</tec-button>Body</tec-popover></div>`)
    const el = root.querySelector("tec-popover")!
    ;(el.querySelector("tec-button") as TecButton).click()
    await aTimeout(10)
    expect(el.open).toBe(false)
  })
})
