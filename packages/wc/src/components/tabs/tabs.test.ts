import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecTabs } from "./tabs.js"
import type { TecTabsContent } from "./tabs-content.js"
import type { TecTabsTrigger } from "./tabs-trigger.js"
import "./define.js"

const demo = (o: { value?: string; orientation?: string; activation?: string; variant?: string; disabled?: string } = {}) => html`
  <tec-tabs value=${o.value ?? ""} orientation=${o.orientation ?? "horizontal"} activation=${o.activation ?? "automatic"}>
    <tec-tabs-list variant=${o.variant ?? "default"}>
      <tec-tabs-trigger value="overview">Overview</tec-tabs-trigger>
      <tec-tabs-trigger value="analytics" ?disabled=${o.disabled === "analytics"}>Analytics</tec-tabs-trigger>
      <tec-tabs-trigger value="reports">Reports</tec-tabs-trigger>
    </tec-tabs-list>
    <tec-tabs-content value="overview">Overview panel</tec-tabs-content>
    <tec-tabs-content value="analytics">Analytics panel</tec-tabs-content>
    <tec-tabs-content value="reports"><button>Export</button></tec-tabs-content>
  </tec-tabs>`

const triggers = (el: TecTabs) => [...el.querySelectorAll<TecTabsTrigger>("tec-tabs-trigger")]
const contents = (el: TecTabs) => [...el.querySelectorAll<TecTabsContent>("tec-tabs-content")]
const shown = (el: TecTabs) => contents(el).filter((c) => getComputedStyle(c).display !== "none").map((c) => c.value)

describe("tec-tabs", () => {
  it("selects the first tab by default and exposes tablist/tab/tabpanel semantics", async () => {
    const el = await fixture<TecTabs>(demo())
    expect(el.selectedValue).toBe("overview")
    expect(shown(el)).toEqual(["overview"])
    expect(await axTree(el)).toEqual(["tablist", "tab: Overview [selected]", "tab: Analytics", "tab: Reports", "tabpanel: Overview"])
    expect(await axNode(el.querySelector("tec-tabs-list")!)).toMatchObject({ role: "tablist", orientation: "horizontal" })
    await expectAccessible(el)
  })

  it("honours the value attribute", async () => {
    const el = await fixture<TecTabs>(demo({ value: "reports" }))
    expect(shown(el)).toEqual(["reports"])
    expect(triggers(el)[2]!.matches(":state(selected)")).toBe(true)
  })

  it("roving tabindex: only the selected tab is a tab stop; panel with focusable content is not", async () => {
    const el = await fixture<TecTabs>(demo())
    expect(triggers(el).map((t) => t.tabIndex)).toEqual([0, -1, -1])
    expect(contents(el)[0]!.tabIndex).toBe(0)
    el.value = "reports"
    await el.updateComplete
    await contents(el)[2]!.updateComplete
    expect(contents(el)[2]!.hasAttribute("tabindex")).toBe(false)
  })

  it("automatic activation: arrow keys move focus and select, wrapping, Home/End", async () => {
    const el = await fixture<TecTabs>(demo())
    const changes = recordEvents<CustomEvent>(el, "tec-value-change")
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(triggers(el)[1])
    expect(el.value).toBe("analytics")
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    expect(deepActiveElement()).toBe(triggers(el)[0])
    expect(el.value).toBe("overview")
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.value).toBe("reports")
    await userEvent.keyboard("{Home}")
    expect(el.value).toBe("overview")
    await userEvent.keyboard("{End}")
    expect(el.value).toBe("reports")
    expect(changes.events.map((e) => e.detail.value)).toEqual(["analytics", "reports", "overview", "reports", "overview", "reports"])
    await el.updateComplete
    expect(shown(el)).toEqual(["reports"])
  })

  it("manual activation: arrows move focus only, Enter/Space select", async () => {
    const el = await fixture<TecTabs>(demo({ activation: "manual" }))
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(triggers(el)[1])
    expect(el.value).toBe("")
    expect(el.selectedValue).toBe("overview")
    await userEvent.keyboard("{Enter}")
    expect(el.value).toBe("analytics")
    await userEvent.keyboard("{ArrowRight} ")
    expect(el.value).toBe("reports")
  })

  it("skips disabled tabs", async () => {
    const el = await fixture<TecTabs>(demo({ disabled: "analytics" }))
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(triggers(el)[2])
    await userEvent.click(triggers(el)[1]!, { force: true })
    expect(el.value).toBe("reports")
    expect(await axNode(triggers(el)[1]!)).toMatchObject({ disabled: "true" })
  })

  it("mirrors arrow keys in RTL", async () => {
    const el = await fixture<TecTabs>(demo(), { dir: "rtl" })
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.value).toBe("analytics")
  })

  it("vertical: Up/Down move, column layout, aria-orientation", async () => {
    const el = await fixture<TecTabs>(demo({ orientation: "vertical" }))
    const list = el.querySelector("tec-tabs-list")!
    expect(await axNode(list)).toMatchObject({ orientation: "vertical" })
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(el.value).toBe("analytics")
    await userEvent.keyboard("{ArrowRight}")
    expect(el.value).toBe("analytics")
    const [a, b] = triggers(el).map((t) => t.getBoundingClientRect())
    expect(b!.top).toBeGreaterThan(a!.top)
  })

  it("selects on click; tec-value-change is cancelable", async () => {
    const el = await fixture<TecTabs>(demo())
    await userEvent.click(triggers(el)[2]!)
    expect(el.value).toBe("reports")
    el.addEventListener("tec-value-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(triggers(el)[0]!)
    expect(el.value).toBe("reports")
  })

  it("re-entering the tablist focuses the selected tab", async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="before">before</button>${demo({ activation: "manual" })}</div>`)
    const el = root.querySelector("tec-tabs")!
    triggers(el)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    root.querySelector<HTMLButtonElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(triggers(el)[0])
  })

  it("links tabs and panels by element reference", async () => {
    const el = await fixture<TecTabs>(demo())
    const tab = triggers(el)[0]!
    const panel = contents(el)[0]!
    expect(await axNode(panel)).toMatchObject({ role: "tabpanel", name: "Overview" })
    expect((tab as unknown as { internals: ElementInternals }).internals.ariaControlsElements).toEqual([panel])
  })

  it("line variant: transparent track with an underline on the selected tab", async () => {
    const el = await fixture<TecTabs>(demo({ variant: "line" }))
    const list = el.querySelector("tec-tabs-list")!
    const track = list.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(track).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(list.getBoundingClientRect().height).toBe(32)
    const base = triggers(el)[0]!.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(base, "::after").opacity).toBe("1")
    expect(getComputedStyle(triggers(el)[1]!.shadowRoot!.querySelector(".base")!, "::after").opacity).toBe("0")
    await expectAccessible(el)
  })

  it("default variant: 44px track, selected tab filled", async () => {
    const el = await fixture<TecTabs>(demo())
    const list = el.querySelector("tec-tabs-list")!
    expect(list.getBoundingClientRect().height).toBe(44)
    expect(triggers(el)[0]!.getBoundingClientRect().height).toBe(31)
    const selected = getComputedStyle(triggers(el)[0]!.shadowRoot!.querySelector(".base")!)
    expect(selected.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(selected.borderTopWidth).toBe("1px")
  })

  it("picks up triggers and panels added later", async () => {
    const el = await fixture<TecTabs>(demo())
    const trigger = document.createElement("tec-tabs-trigger")
    trigger.value = "settings"
    trigger.textContent = "Settings"
    el.querySelector("tec-tabs-list")!.append(trigger)
    const panel = document.createElement("tec-tabs-content")
    panel.value = "settings"
    panel.textContent = "Settings panel"
    el.append(panel)
    await new Promise((r) => setTimeout(r, 0))
    await el.updateComplete
    await userEvent.click(trigger)
    await panel.updateComplete
    expect(shown(el)).toEqual(["settings"])
  })
})

describe("tec-tabs-list layout", () => {
  it("forwards layout classes set on the host (w-full / grid columns) to the track", async () => {
    const el = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-tabs>
        <tec-tabs-list style="display: grid; width: 100%; grid-template-columns: 1fr 1fr">
          <tec-tabs-trigger value="a">A</tec-tabs-trigger><tec-tabs-trigger value="b">B</tec-tabs-trigger>
        </tec-tabs-list>
      </tec-tabs>
    </div>`)
    const [a, b] = [...el.querySelectorAll("tec-tabs-trigger")].map((t) => t.getBoundingClientRect())
    expect(el.querySelector("tec-tabs-list")!.getBoundingClientRect().width).toBe(400)
    expect(Math.round(a!.width)).toBe(Math.round(b!.width))
    expect(Math.round(a!.width)).toBeGreaterThan(180)
  })
})
