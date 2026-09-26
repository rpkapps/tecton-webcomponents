import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import "../button/define.js"
import type { TecCollapsible } from "./collapsible.js"
import type { TecCollapsibleContent } from "./collapsible-content.js"
import "./define.js"

const inner = (el: Element) => el.shadowRoot!.querySelector("button")!
const region = (c: TecCollapsibleContent) => c.shadowRoot!.querySelector<HTMLElement>(".region")!
const isShown = (c: TecCollapsibleContent) => region(c).getAttribute("hidden") !== "until-found"

const slotted = (open = false) => html`<tec-collapsible ?open=${open}>
  <tec-button slot="trigger" variant="ghost">Order #4189</tec-button>
  <p>Status: shipped</p>
  <tec-collapsible-content><p>100 Market St, San Francisco</p></tec-collapsible-content>
</tec-collapsible>`

describe("tec-collapsible", () => {
  it("wires a slotted tec-button: aria-expanded, aria-controls, named group", async () => {
    const el = await fixture<TecCollapsible>(slotted())
    const button = el.querySelector("tec-button")!
    const content = el.querySelector("tec-collapsible-content")!
    expect(await axNode(inner(button))).toMatchObject({ role: "button", name: "Order #4189", expanded: "false" })
    expect(button.getAttribute("aria-controls")).toBe(content.id)
    expect(isShown(content)).toBe(false)
    expect(content.getBoundingClientRect().height).toBe(0)
    await expectAccessible(el)
  })

  it("toggles on click, Enter and Space; fires cancelable tec-open-change", async () => {
    const el = await fixture<TecCollapsible>(slotted())
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    const button = el.querySelector("tec-button")!
    const content = el.querySelector("tec-collapsible-content")!
    await userEvent.click(button)
    await el.updateComplete
    expect(el.open).toBe(true)
    expect(isShown(content)).toBe(true)
    expect(await axNode(inner(button))).toMatchObject({ expanded: "true" })
    expect(await axNode(content)).toMatchObject({ role: "group", name: "Order #4189" })
    await userEvent.keyboard("{Enter}")
    expect(el.open).toBe(false)
    await userEvent.keyboard(" ")
    expect(el.open).toBe(true)
    expect(events.events.map((e) => e.detail)).toEqual([
      { open: true, reason: "trigger" },
      { open: false, reason: "trigger" },
      { open: true, reason: "trigger" },
    ])
    el.addEventListener("tec-open-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(button)
    expect(el.open).toBe(true)
  })

  it("collapses after the height animation and keeps content findable (until-found)", async () => {
    const el = await fixture<TecCollapsible>(slotted(true))
    const content = el.querySelector("tec-collapsible-content")!
    expect(content.getBoundingClientRect().height).toBeGreaterThan(10)
    el.open = false
    await el.updateComplete
    await waitUntil(() => !isShown(content), "collapsed")
    expect(region(content).getAttribute("hidden")).toBe("until-found")
    expect(content.getBoundingClientRect().height).toBe(0)
    expect(content.matches(":state(open)")).toBe(false)
  })

  it("animates the height when opening", async () => {
    const el = await fixture<TecCollapsible>(slotted())
    const content = el.querySelector("tec-collapsible-content")!
    el.open = true
    await el.updateComplete
    await content.updateComplete
    await aTimeout(20)
    const mid = region(content).getAnimations()
    expect(mid.length).toBe(1)
    await mid[0]!.finished
    expect(content.getBoundingClientRect().height).toBeGreaterThan(10)
  })

  it("beforematch (find-in-page) expands it with reason find", async () => {
    const el = await fixture<TecCollapsible>(slotted())
    const content = el.querySelector("tec-collapsible-content")!
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    region(content).dispatchEvent(new Event("beforematch"))
    await el.updateComplete
    expect(el.open).toBe(true)
    expect(events.events[0]!.detail).toEqual({ open: true, reason: "find" })
  })

  it("tec-collapsible-trigger wraps a button anywhere inside, and renders a bare button for text", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-collapsible id="a">
        <div class="header"><span>Radius</span><tec-collapsible-trigger><tec-button aria-label="More" size="icon">+</tec-button></tec-collapsible-trigger></div>
        <tec-collapsible-content>More fields</tec-collapsible-content>
      </tec-collapsible>
      <tec-collapsible id="b">
        <tec-collapsible-trigger>Can I use this?</tec-collapsible-trigger>
        <tec-collapsible-content>Yes.</tec-collapsible-content>
      </tec-collapsible>
    </div>`)
    const a = root.querySelector<TecCollapsible>("#a")!
    const b = root.querySelector<TecCollapsible>("#b")!
    const wrapped = a.querySelector("tec-button")!
    expect(wrapped.getAttribute("aria-expanded")).toBe("false")
    await userEvent.click(wrapped)
    expect(a.open).toBe(true)
    expect(await axNode(a.querySelector("tec-collapsible-content")!)).toMatchObject({ role: "group", name: "More" })

    const bare = inner(b.querySelector("tec-collapsible-trigger")!)
    expect(await axNode(bare)).toMatchObject({ role: "button", name: "Can I use this?", expanded: "false" })
    await userEvent.click(bare)
    await b.updateComplete
    await b.querySelector("tec-collapsible-trigger")!.updateComplete
    expect(b.open).toBe(true)
    expect(await axNode(bare)).toMatchObject({ expanded: "true" })
    await expectAccessible(root)
  })

  it("disabled: trigger disabled, no toggle", async () => {
    const el = await fixture<TecCollapsible>(html`<tec-collapsible disabled>
      <tec-button slot="trigger">Toggle</tec-button>
      <tec-collapsible-content>Content</tec-collapsible-content>
    </tec-collapsible>`)
    const button = el.querySelector("tec-button")!
    expect(button.hasAttribute("disabled")).toBe(true)
    await userEvent.click(button, { force: true })
    expect(el.open).toBe(false)
    el.disabled = false
    await el.updateComplete
    expect(button.hasAttribute("disabled")).toBe(false)
  })

  it("nested collapsibles toggle independently", async () => {
    const el = await fixture<TecCollapsible>(html`<tec-collapsible open>
      <tec-button slot="trigger">components</tec-button>
      <tec-collapsible-content>
        <tec-collapsible>
          <tec-button slot="trigger">ui</tec-button>
          <tec-collapsible-content>button.tsx</tec-collapsible-content>
        </tec-collapsible>
      </tec-collapsible-content>
    </tec-collapsible>`)
    const innerCollapsible = el.querySelector("tec-collapsible")!
    await userEvent.click(innerCollapsible.querySelector("tec-button")!)
    expect(innerCollapsible.open).toBe(true)
    expect(el.open).toBe(true)
  })
})
