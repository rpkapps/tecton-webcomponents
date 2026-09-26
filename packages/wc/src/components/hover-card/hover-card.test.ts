import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import "../button/define.js"
import { aTimeout, animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { resetHoverDelay } from "../tooltip/hover-delay.js"
import type { TecHoverCard } from "./hover-card.js"
import "./define.js"

const card = (el: TecHoverCard) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

afterEach(() => resetHoverDelay())

const basic = (o: { delay?: number; closeDelay?: number; side?: string } = {}) => html`<div style="padding: 40px 80px">
  <button id="before">Before</button>
  <tec-hover-card delay=${o.delay ?? 10} close-delay=${o.closeDelay ?? 100} side=${o.side ?? "bottom"}>
    <tec-button slot="trigger" variant="link">Hover Here</tec-button>
    <div>@tecton</div>
    <div>Tecton web components.</div>
    <a href="#profile">Profile</a>
  </tec-hover-card>
  <button id="after" style="display: block; margin-top: 300px">After</button>
</div>`

describe("tec-hover-card", () => {
  it("opens on hover after the delay, below the trigger, and describes it", async () => {
    const root = await fixture<HTMLElement>(basic({ delay: 150 }))
    const el = root.querySelector("tec-hover-card")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ hasPopup: "dialog", expanded: "false" })
    await userEvent.hover(trigger)
    await aTimeout(60)
    expect(el.open).toBe(false)
    await waitUntil(() => el.open, "opened after the delay")
    await animationsFinished(card(el))
    const t = trigger.getBoundingClientRect()
    const c = card(el).getBoundingClientRect()
    expect(Math.round(c.top - t.bottom)).toBe(4)
    expect(Math.round(c.width)).toBe(256)
    expect(getComputedStyle(card(el)).paddingTop).toBe("16px")
    expect(await axNode(innerButton(trigger))).toMatchObject({ expanded: "true", description: "@tecton Tecton web components. Profile" })
    expect(await axNode(card(el))).toMatchObject({ role: "dialog", name: "Hover Here" })
    expect(deepActiveElement()).not.toBe(card(el))
    await expectAccessible(root)
  })

  it("stays open while the pointer crosses to the card, closes after leaving both", async () => {
    const root = await fixture<HTMLElement>(basic({ closeDelay: 50 }))
    const el = root.querySelector("tec-hover-card")!
    await userEvent.hover(el.querySelector("tec-button")!)
    await waitUntil(() => el.open, "open")
    await animationsFinished(card(el))
    await userEvent.hover(el.querySelector("a")!)
    await aTimeout(120)
    expect(el.open).toBe(true)
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    await userEvent.hover(root.querySelector("#after")!)
    await waitUntil(() => !el.open, "closed")
    expect(events.events[0]!.detail).toEqual({ open: false, reason: "hover" })
  })

  it("opens on keyboard focus after the delay; Tab moves into the card; Escape closes and keeps focus", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-hover-card")!
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => el.open, "opened on focus")
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(el.querySelector("a"))
    await aTimeout(150)
    expect(el.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
  })

  it("closes when focus leaves the trigger", async () => {
    const root = await fixture<HTMLElement>(basic({ closeDelay: 0 }))
    const el = root.querySelector("tec-hover-card")!
    el.querySelector("tec-button")!.focus()
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => el.open, "open")
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    await waitUntil(() => !el.open, "closed on blur")
  })

  it("side top places it above", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 300px 80px 40px">${basic({ side: "top" })}</div>`)
    const el = root.querySelector("tec-hover-card")!
    el.show()
    await el.updateComplete
    await waitUntil(() => card(el).matches(":popover-open"), "open")
    await animationsFinished(card(el))
    expect(card(el).dataset.side).toBe("top")
  })
})
