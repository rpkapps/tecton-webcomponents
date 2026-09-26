import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecToggleGroup } from "./toggle-group.js"
import "./define.js"

const items = (g: TecToggleGroup) => [...g.querySelectorAll("tec-toggle-group-item")]

describe("tec-toggle-group", () => {
  it("single mode is a radiogroup of radios; the selected item is the tab stop", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group aria-label="View" value="grid">
      <tec-toggle-group-item value="list">List</tec-toggle-group-item>
      <tec-toggle-group-item value="grid">Grid</tec-toggle-group-item>
      <tec-toggle-group-item value="cards">Cards</tec-toggle-group-item>
    </tec-toggle-group>`)
    expect(await axTree(g)).toEqual(["radiogroup: View", "radio: List", "radio: Grid [checked]", "radio: Cards"])
    expect(items(g).map((i) => i.tabIndex)).toEqual([-1, 0, -1])
    await expectAccessible(g)
  })

  it("single mode: clicking selects one, clicking the selected one clears it; tec-value-change", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group>
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b">B</tec-toggle-group-item>
    </tec-toggle-group>`)
    const events = recordEvents<CustomEvent>(g, "tec-value-change")
    const [a, b] = items(g)
    await userEvent.click(a!)
    expect(g.value).toBe("a")
    expect(a!.matches(":state(pressed)")).toBe(true)
    await userEvent.click(b!)
    expect(g.values).toEqual(["b"])
    expect(a!.matches(":state(pressed)")).toBe(false)
    await userEvent.click(b!)
    expect(g.value).toBe("")
    expect(events.events.map((e) => e.detail.values)).toEqual([["a"], ["b"], []])
  })

  it("disallow-empty keeps the last selection; preventDefault vetoes", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group value="a" disallow-empty>
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b">B</tec-toggle-group-item>
    </tec-toggle-group>`)
    await userEvent.click(items(g)[0]!)
    expect(g.value).toBe("a")
    g.addEventListener("tec-value-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(items(g)[1]!)
    expect(g.value).toBe("a")
  })

  it("multiple mode is a toolbar of toggle buttons with aria-pressed", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group multiple value="bold italic" aria-label="Format">
      <tec-toggle-group-item value="bold" aria-label="Toggle bold">B</tec-toggle-group-item>
      <tec-toggle-group-item value="italic" aria-label="Toggle italic">I</tec-toggle-group-item>
      <tec-toggle-group-item value="underline" aria-label="Toggle underline">U</tec-toggle-group-item>
    </tec-toggle-group>`)
    expect(g.values).toEqual(["bold", "italic"])
    expect(await axTree(g)).toEqual(["toolbar: Format", "button: Toggle bold [pressed]", "button: Toggle italic [pressed]", "button: Toggle underline"])
    await userEvent.click(items(g)[2]!)
    await userEvent.click(items(g)[0]!)
    expect(g.values).toEqual(["italic", "underline"])
    expect(await axNode(items(g)[0]!)).toMatchObject({ pressed: "false" })
    await expectAccessible(g)
  })

  it("arrow keys move focus (not selection), mirrored in RTL; Space/Enter toggle; Home/End", async () => {
    const root = await fixture<HTMLElement>(html`<div dir="rtl"><tec-toggle-group value="a">
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b" disabled>B</tec-toggle-group-item>
      <tec-toggle-group-item value="c">C</tec-toggle-group-item>
    </tec-toggle-group></div>`)
    const g = root.querySelector("tec-toggle-group")!
    const [a, , c] = items(g)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(a)
    await userEvent.keyboard("{ArrowLeft}") // RTL: left = next, skipping the disabled item
    expect(deepActiveElement()).toBe(c)
    expect(g.value).toBe("a")
    await userEvent.keyboard("{ArrowLeft}") // no wrap
    expect(deepActiveElement()).toBe(c)
    await userEvent.keyboard(" ")
    expect(g.value).toBe("c")
    await userEvent.keyboard("{Home}")
    expect(deepActiveElement()).toBe(a)
    await userEvent.keyboard("{Enter}")
    expect(g.value).toBe("a")
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()).toBe(c)
  })

  it("vertical groups use Up/Down", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group orientation="vertical" multiple>
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b">B</tec-toggle-group-item>
    </tec-toggle-group>`)
    items(g)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(items(g)[0])
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(items(g)[1])
    expect(await axNode(g)).toMatchObject({ role: "toolbar", orientation: "vertical" })
    const [ra, rb] = items(g).map((i) => i.getBoundingClientRect())
    expect(rb!.top).toBeGreaterThan(ra!.bottom - 1)
  })

  it("propagates variant and size to the items", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group variant="outline" size="sm">
      <tec-toggle-group-item value="a" size="lg">A</tec-toggle-group-item>
    </tec-toggle-group>`)
    const item = items(g)[0]!
    expect(item.getBoundingClientRect().height).toBe(28)
    expect(item.matches(":state(outline)")).toBe(true)
    g.size = undefined
    await g.updateComplete
    await item.updateComplete
    expect(item.getBoundingClientRect().height).toBe(36)
  })

  it("spacing sets the gap; spacing=0 joins the items with shared borders", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group variant="outline" spacing="0">
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b">B</tec-toggle-group-item>
      <tec-toggle-group-item value="c">C</tec-toggle-group-item>
    </tec-toggle-group>`)
    const [a, b, c] = items(g)
    const base = (el: Element) => getComputedStyle(el.shadowRoot!.querySelector(".base")!)
    expect(b!.getBoundingClientRect().left).toBe(a!.getBoundingClientRect().right)
    expect(base(a!).borderTopLeftRadius).not.toBe("0px")
    expect(base(a!).borderTopRightRadius).toBe("0px")
    expect(base(b!).borderTopLeftRadius).toBe("0px")
    expect(base(b!).borderLeftWidth).toBe("0px")
    expect(base(c!).borderTopRightRadius).not.toBe("0px")
    g.spacing = 2
    await g.updateComplete
    await c!.updateComplete
    expect(b!.getBoundingClientRect().left - a!.getBoundingClientRect().right).toBe(8)
    expect(base(b!).borderTopLeftRadius).not.toBe("0px")
  })

  it("a disabled group disables every item", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group disabled value="a">
      <tec-toggle-group-item value="a">A</tec-toggle-group-item>
      <tec-toggle-group-item value="b">B</tec-toggle-group-item>
    </tec-toggle-group>`)
    items(g)[1]!.click()
    expect(g.value).toBe("a")
    expect(await axNode(items(g)[1]!)).toMatchObject({ disabled: "true" })
    expect(items(g).every((i) => i.tabIndex === -1)).toBe(true)
  })

  it("picks up items added later", async () => {
    const g = await fixture<TecToggleGroup>(html`<tec-toggle-group value="z"><tec-toggle-group-item value="a">A</tec-toggle-group-item></tec-toggle-group>`)
    const z = document.createElement("tec-toggle-group-item")
    z.value = "z"
    z.textContent = "Z"
    g.append(z)
    await g.updateComplete
    await z.updateComplete
    expect(z.matches(":state(pressed)")).toBe(true)
  })
})
