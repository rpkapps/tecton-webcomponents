import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import "../button/define.js"
import { aTimeout, animationsFinished, axNode, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { resetHoverDelay } from "./hover-delay.js"
import type { TecTooltip } from "./tooltip.js"
import "./define.js"

const bubble = (el: TecTooltip) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const shown = (el: TecTooltip) => bubble(el).matches(":popover-open")
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

afterEach(() => resetHoverDelay())

const basic = (attrs: { side?: string; delay?: number; closeDelay?: number } = {}) => html`<div style="padding: 80px 120px">
  <button id="before">Before</button>
  <tec-tooltip side=${attrs.side ?? "top"} delay=${attrs.delay ?? 0} close-delay=${attrs.closeDelay ?? 0}>
    <tec-button slot="trigger" variant="outline">Hover</tec-button>
    <p>Add to library</p>
  </tec-tooltip>
  <button id="after">After</button>
</div>`

describe("tec-tooltip", () => {
  it("opens on hover above the trigger and describes it", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-tooltip")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ role: "button", name: "Hover" })
    await userEvent.hover(trigger)
    await waitUntil(() => shown(el), "tooltip shown")
    await animationsFinished(bubble(el))
    expect(await axNode(bubble(el))).toMatchObject({ role: "tooltip" })
    expect(await axNode(innerButton(trigger))).toMatchObject({ name: "Hover", description: "Add to library" })
    const t = trigger.getBoundingClientRect()
    const b = bubble(el).getBoundingClientRect()
    expect(Math.round(t.top - b.bottom)).toBe(4)
    expect(Math.round(b.left + b.width / 2)).toBe(Math.round(t.left + t.width / 2))
    const arrow = el.shadowRoot!.querySelector<HTMLElement>(".arrow")!.getBoundingClientRect()
    expect(arrow.bottom).toBeGreaterThan(b.bottom)
    expect(Math.round(arrow.left + arrow.width / 2)).toBe(Math.round(t.left + t.width / 2))
    const cs = getComputedStyle(bubble(el))
    expect(cs.fontSize).toBe("12px")
    expect(cs.paddingLeft).toBe("12px")
    await expectAccessible(root)
    await userEvent.unhover(trigger)
    await waitUntil(() => !el.open, "closed after leaving")
    expect((await axNode(innerButton(trigger))).description ?? "").toBe("")
  })

  it("opens on keyboard focus, not on pointer focus; Escape closes", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-tooltip")!
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => el.open, "opened on focus")
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(events.events[0]!.detail).toEqual({ open: false, reason: "escape" })
    await userEvent.keyboard("{Tab}")
    expect(el.open).toBe(false)
  })

  it("closes when the trigger is pressed and on blur", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-tooltip")!
    const trigger = el.querySelector("tec-button")!
    await userEvent.hover(trigger)
    await waitUntil(() => el.open, "open")
    await userEvent.click(trigger)
    expect(el.open).toBe(false)
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => el.open, "open on focus")
    await userEvent.keyboard("{Tab}")
    expect(el.open).toBe(false)
  })

  it("waits for the delay, then the page is warm: the next tooltip opens at once", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 60px; display: flex; gap: 8px">
      <tec-tooltip id="a" delay="300" close-delay="0"><tec-button slot="trigger">A</tec-button>First</tec-tooltip>
      <tec-tooltip id="b" delay="300" close-delay="0"><tec-button slot="trigger">B</tec-button>Second</tec-tooltip>
    </div>`)
    const a = root.querySelector<TecTooltip>("#a")!
    const b = root.querySelector<TecTooltip>("#b")!
    await userEvent.hover(a.querySelector("tec-button")!)
    await aTimeout(100)
    expect(a.open).toBe(false)
    await waitUntil(() => a.open, "a opened after the delay")
    await userEvent.hover(b.querySelector("tec-button")!)
    await aTimeout(30)
    expect(b.open).toBe(true)
    expect(a.open).toBe(false)
    expect(bubble(b).hasAttribute("data-instant")).toBe(true)
  })

  it("stays open while the pointer is on the tooltip (close-delay)", async () => {
    const root = await fixture<HTMLElement>(basic({ closeDelay: 200 }))
    const el = root.querySelector("tec-tooltip")!
    await userEvent.hover(el.querySelector("tec-button")!)
    await waitUntil(() => el.open, "open")
    await animationsFinished(bubble(el))
    await userEvent.hover(bubble(el))
    await aTimeout(300)
    expect(el.open).toBe(true)
    await userEvent.hover(root.querySelector("#after")!)
    await waitUntil(() => !el.open, "closed after leaving the tooltip")
  })

  it("honours side (logical sides follow the direction) and disabled", async () => {
    const root = await fixture<HTMLElement>(basic({ side: "inline-start" }), { dir: "rtl" })
    const el = root.querySelector("tec-tooltip")!
    await userEvent.hover(el.querySelector("tec-button")!)
    await waitUntil(() => el.open, "open")
    await animationsFinished(bubble(el))
    expect(bubble(el).dataset.side).toBe("right")
    await userEvent.unhover(el.querySelector("tec-button")!)
    await waitUntil(() => !el.open, "closed")
    el.disabled = true
    await el.updateComplete
    await userEvent.hover(el.querySelector("tec-button")!)
    await aTimeout(30)
    expect(el.open).toBe(false)
  })

  it("text content with a kbd describes through aria-description; a disabled button's wrapper works", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 60px">
      <tec-tooltip id="k">
        <tec-button slot="trigger" size="icon-sm" aria-label="Save">S</tec-button>
        Save Changes <kbd>S</kbd>
      </tec-tooltip>
      <tec-tooltip id="d">
        <span slot="trigger" tabindex="0" style="display: inline-block"><tec-button disabled>Disabled</tec-button></span>
        This feature is currently unavailable
      </tec-tooltip>
    </div>`)
    const k = root.querySelector<TecTooltip>("#k")!
    await userEvent.hover(k.querySelector("tec-button")!)
    await waitUntil(() => k.open, "open")
    expect(await axNode(innerButton(k.querySelector("tec-button")!))).toMatchObject({ name: "Save", description: "Save Changes S" })
    await userEvent.unhover(k.querySelector("tec-button")!)
    await waitUntil(() => !k.open, "closed")
    const d = root.querySelector<TecTooltip>("#d")!
    await userEvent.hover(d.querySelector("span")!)
    await waitUntil(() => d.open, "open over the disabled button's wrapper")
  })
})
