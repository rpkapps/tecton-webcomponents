import { html, LitElement } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { defineElement } from "./define.js"
import { ListNavigationController } from "./list-navigation.js"
import { RovingFocusController } from "./roving-focus.js"
import { axNode, deepActiveElement, fixture } from "./test-utils.js"
import { Typeahead } from "./typeahead.js"

class TestToolbar extends LitElement {
  onActivate = vi.fn()
  roving = new RovingFocusController(this, {
    items: () => [...this.querySelectorAll("button")],
    orientation: () => (this.getAttribute("orientation") as "horizontal" | "vertical") ?? "horizontal",
    loop: this.hasAttribute("noloop") ? false : true,
    typeahead: true,
    activateOnFocus: true,
    onActivate: (item) => this.onActivate(item.id),
  })
  render() {
    return html`<slot></slot>`
  }
}
defineElement("test-toolbar", TestToolbar)

class TestCombo extends LitElement {
  get input() {
    return this.renderRoot.querySelector("input")!
  }
  nav = new ListNavigationController(this, {
    items: () => [...this.querySelectorAll<HTMLElement>("[role=option]")],
    focusTarget: () => this.input,
    keyTarget: () => this.input,
    homeEnd: false,
  })
  render() {
    return html`<input role="combobox" aria-label="Fruit" aria-expanded="true" /><div role="listbox" aria-label="Fruits"><slot></slot></div>`
  }
}
defineElement("test-combo", TestCombo)

describe("RovingFocusController", () => {
  const toolbar = () => html`<test-toolbar>
    <button id="bold">Bold</button><button id="italic" disabled>Italic</button><button id="under">Underline</button><button id="strike">Strike</button>
  </test-toolbar>`

  it("keeps one tab stop, moves with arrows (skipping disabled), wraps, Home/End, activates on focus", async () => {
    const el = await fixture<TestToolbar>(toolbar())
    const buttons = [...el.querySelectorAll("button")]
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    buttons[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()?.id).toBe("under")
    expect(buttons.map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1])
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()?.id).toBe("strike")
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()?.id).toBe("bold")
    await userEvent.keyboard("{ArrowLeft}")
    expect(deepActiveElement()?.id).toBe("strike")
    await userEvent.keyboard("{Home}")
    expect(el.onActivate.mock.calls.map((c) => c[0])).toEqual(["under", "strike", "bold", "strike", "bold"])
  })

  it("ignores the other axis and remembers the last focused item", async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="before">before</button>${toolbar()}</div>`)
    const el = root.querySelector("test-toolbar")!
    el.querySelector<HTMLElement>("#bold")!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()?.id).toBe("bold")
    await userEvent.keyboard("{ArrowRight}")
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()?.id).toBe("under")
  })

  it("typeahead focuses by text", async () => {
    const el = await fixture<TestToolbar>(toolbar())
    el.querySelector<HTMLElement>("#bold")!.focus()
    await userEvent.keyboard("s")
    expect(deepActiveElement()?.id).toBe("strike")
    await userEvent.keyboard("i") // "si" matches nothing, stays
    expect(deepActiveElement()?.id).toBe("strike")
  })

  it("RTL mirrors horizontal arrows", async () => {
    const el = await fixture<TestToolbar>(toolbar(), { dir: "rtl" })
    el.querySelector<HTMLElement>("#bold")!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(deepActiveElement()?.id).toBe("under")
  })
})

describe("ListNavigationController", () => {
  const combo = () => html`<test-combo>
    <div role="option" id="apple" aria-selected="false">Apple</div>
    <div role="option" id="banana" aria-disabled="true" aria-selected="false">Banana</div>
    <div role="option" id="cherry" aria-selected="false">Cherry</div>
  </test-combo>`

  it("moves the active descendant while focus stays in the input", async () => {
    const el = await fixture<TestCombo>(combo())
    el.input.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(el.nav.activeItem?.id).toBe("apple")
    expect(el.input.ariaActiveDescendantElement?.id).toBe("apple")
    expect(el.querySelector("#apple")!.hasAttribute("data-highlighted")).toBe(true)
    await userEvent.keyboard("{ArrowDown}")
    expect(el.nav.activeItem?.id).toBe("cherry")
    expect(el.querySelector("#apple")!.hasAttribute("data-highlighted")).toBe(false)
    await userEvent.keyboard("{ArrowDown}")
    expect(el.nav.activeItem?.id).toBe("cherry") // no loop by default
    await userEvent.keyboard("{ArrowUp}")
    expect(el.nav.activeItem?.id).toBe("apple")
    expect(deepActiveElement()).toBe(el.input)
    expect(await axNode(el.input)).toMatchObject({ role: "combobox", activedescendant: expect.anything() })
  })

  it("leaves Home/End to the text caret when homeEnd is false; PageDown jumps", async () => {
    const el = await fixture<TestCombo>(combo())
    el.input.focus()
    await userEvent.keyboard("{Home}")
    expect(el.nav.activeItem).toBeNull()
    await userEvent.keyboard("{PageDown}")
    expect(el.nav.activeItem?.id).toBe("cherry")
  })

  it("highlights on hover and clears", async () => {
    const el = await fixture<TestCombo>(combo())
    await userEvent.hover(el.querySelector("#cherry")!)
    expect(el.nav.activeItem?.id).toBe("cherry")
    el.nav.clear()
    expect(el.input.ariaActiveDescendantElement).toBeNull()
  })
})

describe("Typeahead", () => {
  const items = ["Apple", "Apricot", "Banana", "Blueberry", "Écru"]
  const key = (k: string) => new KeyboardEvent("keydown", { key: k })

  it("matches prefixes, cycles on a repeated letter, ignores accents and case", () => {
    const t = new Typeahead()
    expect(t.match(key("a"), items, null, (s) => s)).toBe("Apple")
    expect(t.match(key("p"), items, "Apple", (s) => s)).toBe("Apple")
    expect(t.match(key("r"), items, "Apple", (s) => s)).toBe("Apricot")
    t.reset()
    expect(t.match(key("b"), items, "Apricot", (s) => s)).toBe("Banana")
    expect(t.match(key("b"), items, "Banana", (s) => s)).toBe("Blueberry")
    t.reset()
    expect(t.match(key("e"), items, null, (s) => s)).toBe("Écru")
  })

  it("only treats printable keys (and Space during a search) as typeahead", () => {
    const t = new Typeahead()
    expect(t.isTypeaheadKey(key(" "))).toBe(false)
    expect(t.isTypeaheadKey(key("ArrowDown"))).toBe(false)
    expect(t.isTypeaheadKey(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }))).toBe(false)
    t.match(key("a"), items, null, (s) => s)
    expect(t.isTypeaheadKey(key(" "))).toBe(true)
  })

  it("skips disabled items", () => {
    const t = new Typeahead()
    expect(t.match(key("b"), items, null, (s) => s, (s) => s === "Banana")).toBe("Blueberry")
  })
})
