import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import "../button/define.js"
import type { TecAccordion } from "./accordion.js"
import type { TecAccordionItem } from "./accordion-item.js"
import "./define.js"

const demo = (o: { value?: string; multiple?: boolean; noCollapse?: boolean; disabled?: string; variant?: string; level?: number } = {}) => html`
  <tec-accordion
    value=${o.value ?? ""}
    ?multiple=${o.multiple}
    ?no-collapse=${o.noCollapse}
    variant=${o.variant ?? "default"}
    heading-level=${o.level ?? 3}
  >
    <tec-accordion-item value="shipping">
      <tec-accordion-trigger>What are your shipping options?</tec-accordion-trigger>
      <tec-accordion-content>Standard, express and overnight.</tec-accordion-content>
    </tec-accordion-item>
    <tec-accordion-item value="returns" ?disabled=${o.disabled === "returns"}>
      <tec-accordion-trigger>What is your return policy?</tec-accordion-trigger>
      <tec-accordion-content>Returns accepted within 30 days.</tec-accordion-content>
    </tec-accordion-item>
    <tec-accordion-item value="support">
      <tec-accordion-trigger>How can I contact support?</tec-accordion-trigger>
      <tec-accordion-content>Email, live chat or phone.</tec-accordion-content>
    </tec-accordion-item>
  </tec-accordion>`

const items = (el: TecAccordion) => [...el.querySelectorAll<TecAccordionItem>("tec-accordion-item")]
const button = (item: TecAccordionItem) => item.trigger!.button!
const openValues = (el: TecAccordion) => items(el).filter((i) => i.open).map((i) => i.value)
const settle = async (el: TecAccordion) => {
  await el.updateComplete
  for (const i of items(el)) {
    await i.updateComplete
    await i.trigger!.updateComplete
    await i.content!.updateComplete
  }
}

describe("tec-accordion", () => {
  it("renders headings with buttons and named groups; value attribute expands an item", async () => {
    const el = await fixture<TecAccordion>(demo({ value: "shipping" }))
    await settle(el)
    expect(openValues(el)).toEqual(["shipping"])
    expect(el.value).toBe("shipping")
    expect(await axTree(el)).toEqual([
      "heading: What are your shipping options?",
      "button: What are your shipping options? [expanded]",
      "group: What are your shipping options?",
      "heading: What is your return policy?",
      "button: What is your return policy?",
      "heading: How can I contact support?",
      "button: How can I contact support?",
    ])
    await expectAccessible(el)
  })

  it("single mode: expanding one collapses the other; the open one collapses again", async () => {
    const el = await fixture<TecAccordion>(demo({ value: "shipping" }))
    const changes = recordEvents<CustomEvent>(el, "tec-value-change")
    await userEvent.click(button(items(el)[2]!))
    expect(openValues(el)).toEqual(["support"])
    await userEvent.click(button(items(el)[2]!))
    expect(openValues(el)).toEqual([])
    expect(changes.events.map((e) => e.detail)).toEqual([
      { value: "support", values: ["support"] },
      { value: "", values: [] },
    ])
  })

  it("multiple mode keeps several items open", async () => {
    const el = await fixture<TecAccordion>(demo({ multiple: true, value: "shipping" }))
    await userEvent.click(button(items(el)[2]!))
    expect(openValues(el)).toEqual(["shipping", "support"])
    expect(el.values).toEqual(["shipping", "support"])
    el.values = ["returns"]
    expect(openValues(el)).toEqual(["returns"])
  })

  it("no-collapse keeps the expanded item open and marks its button aria-disabled", async () => {
    const el = await fixture<TecAccordion>(demo({ noCollapse: true, value: "shipping" }))
    await settle(el)
    expect(await axNode(button(items(el)[0]!))).toMatchObject({ expanded: "true", disabled: "true" })
    // Playwright refuses to click aria-disabled elements; the click still reaches the button.
    button(items(el)[0]!).click()
    expect(openValues(el)).toEqual(["shipping"])
    await userEvent.click(button(items(el)[1]!))
    expect(openValues(el)).toEqual(["returns"])
  })

  it("tec-value-change is cancelable", async () => {
    const el = await fixture<TecAccordion>(demo())
    el.addEventListener("tec-value-change", (e) => e.preventDefault())
    await userEvent.click(button(items(el)[0]!))
    expect(openValues(el)).toEqual([])
  })

  it("keyboard: Enter/Space toggle, arrows / Home / End move between triggers, skipping disabled", async () => {
    const el = await fixture<TecAccordion>(demo({ disabled: "returns" }))
    await settle(el)
    button(items(el)[0]!).focus()
    await userEvent.keyboard("{Enter}")
    expect(openValues(el)).toEqual(["shipping"])
    await userEvent.keyboard(" ")
    expect(openValues(el)).toEqual([])
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(button(items(el)[2]!))
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(button(items(el)[0]!))
    await userEvent.keyboard("{ArrowUp}")
    expect(deepActiveElement()).toBe(button(items(el)[2]!))
    await userEvent.keyboard("{Home}")
    expect(deepActiveElement()).toBe(button(items(el)[0]!))
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()).toBe(button(items(el)[2]!))
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()).toBe(button(items(el)[0]!))
  })

  it("disabled item: not pressable, announced disabled, dimmed", async () => {
    const el = await fixture<TecAccordion>(demo({ disabled: "returns" }))
    await settle(el)
    const b = button(items(el)[1]!)
    expect(b.disabled).toBe(true)
    expect(getComputedStyle(b).opacity).toBe("0.5")
    await userEvent.click(items(el)[1]!.trigger!, { force: true })
    expect(openValues(el)).toEqual([])
  })

  it("links button and panel; panel is hidden until found while collapsed", async () => {
    const el = await fixture<TecAccordion>(demo({ value: "returns" }))
    await settle(el)
    const [first, second] = items(el)
    expect((button(second!) as unknown as { ariaControlsElements: Element[] }).ariaControlsElements).toEqual([second!.content])
    expect(await axNode(second!.content!)).toMatchObject({ role: "group", name: "What is your return policy?" })
    const region = first!.content!.shadowRoot!.querySelector(".region")!
    expect(region.getAttribute("hidden")).toBe("until-found")
    region.dispatchEvent(new Event("beforematch"))
    expect(openValues(el)).toEqual(["shipping"])
  })

  it("heading-level sets aria-level", async () => {
    const el = await fixture<TecAccordion>(demo({ level: 2 }))
    await settle(el)
    expect(await axNode(items(el)[0]!.trigger!.shadowRoot!.querySelector(".heading")!)).toMatchObject({ role: "heading", level: "2" })
  })

  it("Tecton look: 34px triggers, dividers, active background on the expanded trigger, chevron swap", async () => {
    const el = await fixture<TecAccordion>(demo({ value: "shipping" }))
    await settle(el)
    const [first, second, third] = items(el)
    expect(first!.trigger!.getBoundingClientRect().height).toBe(34)
    const firstBase = getComputedStyle(first!.shadowRoot!.querySelector(".base")!)
    expect(firstBase.borderBottomWidth).toBe("1px")
    expect(getComputedStyle(third!.shadowRoot!.querySelector(".base")!).borderBottomWidth).toBe("0px")
    const expanded = getComputedStyle(button(first!))
    const collapsed = getComputedStyle(button(second!))
    expect(expanded.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(collapsed.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(expanded.borderTopLeftRadius).toBe("4px")
    expect(expanded.borderBottomLeftRadius).toBe("0px")
    expect(first!.trigger!.shadowRoot!.querySelector(".icon svg")!.getAttribute("width")).toBe("20")
    expect(first!.trigger!.shadowRoot!.querySelector(".icon")!.innerHTML).toContain("m18 15")
  })

  it("variant plain removes the dividers; outline adds a border and wider padding", async () => {
    const plain = await fixture<TecAccordion>(demo({ variant: "plain" }))
    await settle(plain)
    expect(getComputedStyle(items(plain)[0]!.shadowRoot!.querySelector(".base")!).borderBottomWidth).toBe("0px")
    const outline = await fixture<TecAccordion>(demo({ variant: "outline" }))
    await settle(outline)
    expect(getComputedStyle(outline.shadowRoot!.querySelector(".base")!).borderTopWidth).toBe("1px")
    expect(getComputedStyle(button(items(outline)[0]!)).paddingLeft).toBe("16px")
  })

  it("secondary text and actions: actions are separate tab stops outside the toggle button", async () => {
    const el = await fixture<TecAccordion>(html`<tec-accordion>
      <tec-accordion-item value="a">
        <tec-accordion-trigger>
          <svg slot="start" viewBox="0 0 24 24" aria-hidden="true"></svg>
          Accordion Label
          <span slot="secondary">Secondary Text</span>
          <tec-button slot="actions" size="icon-xs" variant="ghost" aria-label="Edit">E</tec-button>
          <tec-button slot="actions" size="icon-xs" variant="ghost" aria-label="Delete">D</tec-button>
        </tec-accordion-trigger>
        <tec-accordion-content>Content</tec-accordion-content>
      </tec-accordion-item>
    </tec-accordion>`)
    await settle(el)
    const item = items(el)[0]!
    const trigger = item.trigger!
    const edit = trigger.querySelector("tec-button")!
    const b = button(item)
    expect(await axNode(b)).toMatchObject({ role: "button", name: "Accordion Label Secondary Text" })
    // Actions sit inside the row, before the chevron, without overlapping the label.
    const actionsRect = edit.getBoundingClientRect()
    const iconRect = trigger.shadowRoot!.querySelector(".icon")!.getBoundingClientRect()
    const labelRect = trigger.shadowRoot!.querySelector(".secondary")!.getBoundingClientRect()
    expect(actionsRect.right).toBeLessThanOrEqual(iconRect.left)
    expect(labelRect.right).toBeLessThanOrEqual(actionsRect.left)
    expect(actionsRect.top).toBeGreaterThanOrEqual(b.getBoundingClientRect().top)
    b.focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(edit.shadowRoot!.querySelector("button"))
    await userEvent.click(edit)
    expect(item.open).toBe(false)
    await userEvent.click(trigger.shadowRoot!.querySelector(".label")!)
    expect(item.open).toBe(true)
    expect(await axNode(item.content!)).toMatchObject({ name: "Accordion Label" })
    await expectAccessible(el)
    const dark = await fixture<HTMLElement>(html`<div style="background: var(--tec-background); padding: 8px">${el.cloneNode(true)}</div>`, { theme: "dark" })
    await settle(dark.querySelector("tec-accordion")!)
    await expectAccessible(dark)
  })

  it("programmatic open in single mode closes the other items", async () => {
    const el = await fixture<TecAccordion>(demo({ value: "shipping" }))
    items(el)[1]!.open = true
    await waitUntil(() => !items(el)[0]!.open, "first closed")
    expect(openValues(el)).toEqual(["returns"])
  })

  it("parses from HTML with value set before items exist", async () => {
    const root = await fixture<HTMLElement>(`<div><tec-accordion value="b">
      <tec-accordion-item value="a"><tec-accordion-trigger>A</tec-accordion-trigger><tec-accordion-content>a</tec-accordion-content></tec-accordion-item>
      <tec-accordion-item value="b"><tec-accordion-trigger>B</tec-accordion-trigger><tec-accordion-content>b</tec-accordion-content></tec-accordion-item>
    </tec-accordion></div>`)
    const el = root.querySelector("tec-accordion")!
    await settle(el)
    expect(openValues(el)).toEqual(["b"])
  })

  it("dark theme and RTL render accessibly", async () => {
    const root = await fixture<HTMLElement>(html`<div class="bg-background" style="background: var(--tec-background); padding: 8px">${demo({ value: "shipping" })}</div>`, { theme: "dark", dir: "rtl" })
    const el = root.querySelector("tec-accordion")!
    await settle(el)
    const b = button(items(el)[0]!)
    const icon = items(el)[0]!.trigger!.shadowRoot!.querySelector(".icon")!
    expect(icon.getBoundingClientRect().left).toBeLessThan(b.getBoundingClientRect().left + 40)
    await expectAccessible(el)
  })
})
