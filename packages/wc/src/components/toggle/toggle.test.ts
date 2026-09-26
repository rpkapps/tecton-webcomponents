import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecToggle } from "./toggle.js"
import "./define.js"

const button = (el: TecToggle) => el.shadowRoot!.querySelector("button")!

describe("tec-toggle", () => {
  it("renders a toggle button with aria-pressed, named by aria-label", async () => {
    const el = await fixture<TecToggle>(html`<tec-toggle aria-label="Toggle italic"><svg aria-hidden="true" viewBox="0 0 24 24"></svg></tec-toggle>`)
    expect(await axNode(button(el))).toMatchObject({ role: "button", name: "Toggle italic", pressed: "false" })
    expect(el.getBoundingClientRect().height).toBe(32)
    expect(el.getBoundingClientRect().width).toBe(32)
    await expectAccessible(el)
  })

  it("toggles on click, Enter and Space; fires tec-pressed-change; reflects pressed", async () => {
    const el = await fixture<TecToggle>(html`<tec-toggle>Bold</tec-toggle>`)
    const events = recordEvents<CustomEvent>(el, "tec-pressed-change")
    await userEvent.click(el)
    expect(el.pressed).toBe(true)
    expect(el.hasAttribute("pressed")).toBe(true)
    expect(el.matches(":state(pressed)")).toBe(true)
    expect(await axNode(button(el))).toMatchObject({ pressed: "true" })
    await userEvent.keyboard("{Enter}")
    expect(el.pressed).toBe(false)
    await userEvent.keyboard(" ")
    expect(el.pressed).toBe(true)
    expect(events.events.map((e) => e.detail.pressed)).toEqual([true, false, true])
  })

  it("preventDefault keeps the state; programmatic changes fire nothing", async () => {
    const el = await fixture<TecToggle>(html`<tec-toggle>Bold</tec-toggle>`)
    el.addEventListener("tec-pressed-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(el)
    expect(el.pressed).toBe(false)
    const events = recordEvents(el, "tec-pressed-change")
    el.pressed = true
    await el.updateComplete
    expect(button(el).getAttribute("aria-pressed")).toBe("true")
    expect(events.events).toHaveLength(0)
  })

  it("sizes and the outline variant", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-toggle size="sm">S</tec-toggle><tec-toggle size="lg" variant="outline">L</tec-toggle>
    </div>`)
    const [sm, lg] = [...root.querySelectorAll("tec-toggle")]
    expect(sm!.getBoundingClientRect().height).toBe(28)
    expect(lg!.getBoundingClientRect().height).toBe(36)
    expect(getComputedStyle(button(lg!)).borderTopWidth).toBe("1px")
    expect(getComputedStyle(button(sm!)).borderTopWidth).toBe("0px")
  })

  it("uses the ghost-active background when pressed and ghost-hover on hover", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-toggle pressed>On</tec-toggle><tec-toggle>Off</tec-toggle></div>`)
    const [on, off] = [...root.querySelectorAll("tec-toggle")]
    const probe = document.createElement("div")
    probe.style.cssText = "background: var(--tec-ghost-active); height: 20px"
    root.append(probe)
    await userEvent.hover(probe) // keep the pointer off the toggles
    await aTimeout(200)
    expect(getComputedStyle(button(on!)).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
    expect(getComputedStyle(button(off!)).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    await userEvent.hover(off!)
    await aTimeout(200)
    probe.style.background = "var(--tec-ghost-hover)"
    expect(getComputedStyle(button(off!)).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
    // Hover wins over the pressed colours (as in the spec).
    await userEvent.hover(on!)
    await aTimeout(200)
    expect(getComputedStyle(button(on!)).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
  })

  it("disabled toggles are not focusable and do not toggle", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-toggle disabled>Disabled</tec-toggle><button>after</button></div>`)
    const el = root.querySelector("tec-toggle")!
    el.click()
    expect(el.pressed).toBe(false)
    expect(await axNode(button(el))).toMatchObject({ disabled: "true" })
    await userEvent.keyboard("{Tab}")
    expect(document.activeElement).toBe(root.querySelector("button"))
  })

  it("shows a focus ring on keyboard focus", async () => {
    const el = await fixture<TecToggle>(html`<tec-toggle>Focus</tec-toggle>`)
    await userEvent.keyboard("{Tab}")
    expect(el.matches(":state(focus-visible)")).toBe(true)
    expect(getComputedStyle(button(el)).boxShadow).not.toBe("none")
  })
})
