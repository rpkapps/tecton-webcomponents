import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, expectAccessible, fixture } from "../../internal/test-utils.js"
import "../input/define.js"
import "../input-group/define.js"
import "../native-select/define.js"
import "../popover/define.js"
import "../select/define.js"
import "../textarea/define.js"
import "./define.js"
import type { TecButtonGroup } from "./button-group.js"

const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement
const radius = (el: Element) => {
  const s = getComputedStyle(base(el))
  return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join(" ")
}
const R = "4px"

const three = (attrs = "") => `<tec-button-group aria-label="Actions" ${attrs}>
  <tec-button variant="outline">Archive</tec-button>
  <tec-button variant="outline">Report</tec-button>
  <tec-button variant="outline">Snooze</tec-button>
</tec-button-group>`

describe("tec-button-group", () => {
  it("is a labelled group", async () => {
    const el = await fixture<TecButtonGroup>(three())
    expect(await axNode(el)).toMatchObject({ role: "group", name: "Actions" })
    expect(await axTree(el)).toEqual(["group: Actions", "button: Archive", "button: Report", "button: Snooze"])
    await expectAccessible(el)
  })

  it("squares the inner corners and overlaps the borders", async () => {
    const el = await fixture<TecButtonGroup>(three())
    const [a, b, c] = [...el.querySelectorAll("tec-button")]
    expect(radius(a!)).toBe(`${R} 0px 0px ${R}`)
    expect(radius(b!)).toBe("0px 0px 0px 0px")
    expect(radius(c!)).toBe(`0px ${R} ${R} 0px`)
    expect(b!.getBoundingClientRect().left).toBe(a!.getBoundingClientRect().right - 1)
    expect(c!.getBoundingClientRect().left).toBe(b!.getBoundingClientRect().right - 1)
  })

  it("mirrors the corners in RTL", async () => {
    const el = await fixture<TecButtonGroup>(three(), { dir: "rtl" })
    const [a, , c] = [...el.querySelectorAll("tec-button")]
    expect(radius(a!)).toBe(`0px ${R} ${R} 0px`)
    expect(radius(c!)).toBe(`${R} 0px 0px ${R}`)
    expect(a!.getBoundingClientRect().left).toBeGreaterThan(c!.getBoundingClientRect().left)
  })

  it("stacks vertically", async () => {
    const el = await fixture<TecButtonGroup>(three('orientation="vertical"'))
    const [a, b, c] = [...el.querySelectorAll("tec-button")]
    expect(radius(a!)).toBe(`${R} ${R} 0px 0px`)
    expect(radius(c!)).toBe(`0px 0px ${R} ${R}`)
    expect(b!.getBoundingClientRect().top).toBe(a!.getBoundingClientRect().bottom - 1)
  })

  it("raises the hovered button over its neighbours", async () => {
    const el = await fixture<TecButtonGroup>(three())
    const b = el.querySelectorAll("tec-button")[1]!
    await userEvent.hover(b)
    expect(getComputedStyle(b).zIndex).toBe("10")
  })

  it("spaces nested groups and keeps a single child fully rounded", async () => {
    const el = await fixture<TecButtonGroup>(`<tec-button-group>
      <tec-button-group><tec-button variant="outline" size="icon" aria-label="Back">←</tec-button></tec-button-group>
      <tec-button-group><tec-button variant="outline">Archive</tec-button><tec-button variant="outline">Report</tec-button></tec-button-group>
    </tec-button-group>`)
    expect(el.matches(":state(has-groups)")).toBe(true)
    const [g1, g2] = [...el.querySelectorAll(":scope > tec-button-group")]
    expect(g2!.getBoundingClientRect().left - g1!.getBoundingClientRect().right).toBe(8)
    expect(radius(g1!.querySelector("tec-button")!)).toBe(`${R} ${R} ${R} ${R}`)
    expect(radius(g2!.querySelector("tec-button")!)).toBe(`${R} 0px 0px ${R}`)
  })

  it("honours --tec-button-group-radius", async () => {
    const el = await fixture<TecButtonGroup>(three('style="--tec-button-group-radius: 9999px"'))
    const a = el.querySelector("tec-button")!
    expect(getComputedStyle(base(a)).borderTopLeftRadius).toBe("9999px")
  })

  it("joins a popover trigger (split button) and cleans up when it leaves", async () => {
    const el = await fixture<TecButtonGroup>(`<tec-button-group>
      <tec-button variant="secondary">Copilot</tec-button>
      <tec-button-group-separator></tec-button-group-separator>
      <tec-popover><tec-button slot="trigger" variant="secondary" size="icon" aria-label="Open">v</tec-button><p>Content</p></tec-popover>
    </tec-button-group>`)
    const trigger = el.querySelector("tec-popover > tec-button")!
    expect(radius(trigger)).toBe(`0px ${R} ${R} 0px`)
    const sep = el.querySelector("tec-button-group-separator")!
    expect(trigger.getBoundingClientRect().left).toBe(sep.getBoundingClientRect().right - 1)
    const popover = el.querySelector("tec-popover")!
    const button = popover.querySelector("tec-button")!
    button.removeAttribute("slot")
    el.append(button)
    popover.remove()
    await new Promise((r) => setTimeout(r))
    const moved = el.querySelector(":scope > tec-button[size=icon]") as HTMLElement
    expect(moved.style.getPropertyValue("--tec-button-radius")).toBe("")
    expect(radius(moved)).toBe(`0px ${R} ${R} 0px`)
  })

  it("gives filled buttons a border next to outlined controls", async () => {
    const el = await fixture<TecButtonGroup>(`<tec-button-group>
      <tec-button variant="outline">A</tec-button><tec-button>B</tec-button>
    </tec-button-group>`)
    expect(el.matches(":state(bordered)")).toBe(true)
    const b = el.querySelectorAll("tec-button")[1]!
    expect(getComputedStyle(base(b)).borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
  })
})

describe("tec-button-group-separator", () => {
  it("is a vertical separator in a row and horizontal in a column", async () => {
    const el = await fixture<TecButtonGroup>(`<tec-button-group>
      <tec-button variant="secondary">Copy</tec-button><tec-button-group-separator></tec-button-group-separator><tec-button variant="secondary">Paste</tec-button>
    </tec-button-group>`)
    const sep = el.querySelector("tec-button-group-separator")!
    expect(await axNode(sep)).toMatchObject({ role: "separator", orientation: "vertical" })
    expect(sep.getBoundingClientRect().width).toBe(1)
    expect(sep.getBoundingClientRect().height).toBe(32)
    el.orientation = "vertical"
    await el.updateComplete
    await (sep as unknown as TecButtonGroup).updateComplete
    expect(await axNode(sep)).toMatchObject({ role: "separator" })
    expect(sep.matches(":state(horizontal)")).toBe(true)
    expect(sep.getBoundingClientRect().height).toBe(1)
    await expectAccessible(el)
  })
})

describe("tec-button-group-text", () => {
  it("renders a muted box joined to an input and can hold a label", async () => {
    const el = await fixture<TecButtonGroup>(`<tec-button-group>
      <tec-button-group-text><label for="bgt-url">https://</label></tec-button-group-text>
      <input id="bgt-url" style="border:1px solid; border-radius: 0" />
    </tec-button-group>`)
    const text = el.querySelector("tec-button-group-text")!
    expect(radius(text)).toBe(`${R} 0px 0px ${R}`)
    expect(await axNode(el.querySelector("input")!)).toMatchObject({ role: "textbox", name: "https://" })
    await expectAccessible(el)
  })
})

describe("joined form controls", () => {
  const box = (el: Element, selector = ".base") => {
    const s = getComputedStyle(el.shadowRoot!.querySelector(selector)!)
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join(" ")
  }

  it("joins inputs, textareas, selects, native selects and input groups", async () => {
    const root = await fixture<HTMLElement>(`<div>
      <tec-button-group id="a">
        <tec-input aria-label="Search"></tec-input>
        <tec-button variant="outline">Go</tec-button>
      </tec-button-group>
      <tec-button-group id="b">
        <tec-select value="$" aria-label="Currency"><tec-select-item value="$">$</tec-select-item></tec-select>
        <tec-textarea aria-label="Note"></tec-textarea>
        <tec-native-select aria-label="Unit"><option>m</option></tec-native-select>
      </tec-button-group>
      <tec-button-group id="c">
        <tec-button variant="outline" size="icon" aria-label="Add">+</tec-button>
        <tec-input-group>
          <tec-input-group-input aria-label="Message"></tec-input-group-input>
          <tec-input-group-addon align="inline-end"><tec-input-group-button size="icon-xs" aria-label="Voice">v</tec-input-group-button></tec-input-group-addon>
        </tec-input-group>
      </tec-button-group>
    </div>`)
    const [a, b, c] = ["#a", "#b", "#c"].map((id) => root.querySelector(id)!)
    expect(box(a!.querySelector("tec-input")!)).toBe(`${R} 0px 0px ${R}`)
    expect(box(b!.querySelector("tec-select")!, ".trigger")).toBe(`${R} 0px 0px ${R}`)
    expect(box(b!.querySelector("tec-textarea")!)).toBe("0px 0px 0px 0px")
    expect(box(b!.querySelector("tec-native-select")!, "select")).toBe(`0px ${R} ${R} 0px`)
    const group = c!.querySelector("tec-input-group")!
    expect(box(group)).toBe(`0px ${R} ${R} 0px`)
    // The joined corners do not leak into the group's own control and addon button.
    expect(box(group.querySelector("tec-input-group-input")!)).toBe("0px 0px 0px 0px")
    const button = group.querySelector("tec-input-group-button")!
    expect(box(button)).not.toBe("0px 0px 0px 0px")
    const rtl = await fixture<HTMLElement>(`<tec-button-group dir="rtl"><tec-input aria-label="A"></tec-input><tec-textarea aria-label="B"></tec-textarea></tec-button-group>`)
    expect(box(rtl.querySelector("tec-input")!)).toBe(`0px ${R} ${R} 0px`)
    expect(box(rtl.querySelector("tec-textarea")!)).toBe(`${R} 0px 0px ${R}`)
  })
})
