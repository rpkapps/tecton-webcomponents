import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecNativeSelect } from "./native-select.js"
import "./define.js"

const inner = (el: TecNativeSelect) => el.shadowRoot!.querySelector("select")!

describe("tec-native-select", () => {
  it("mirrors options and groups into a native select", async () => {
    const el = await fixture<TecNativeSelect>(html`<tec-native-select aria-label="Department">
      <option value="">Select department</option>
      <optgroup label="Engineering"><option value="frontend">Frontend</option><option value="backend">Backend</option></optgroup>
    </tec-native-select>`)
    const select = inner(el)
    expect(select.options.length).toBe(3)
    expect(select.querySelector("optgroup")!.label).toBe("Engineering")
    expect(el.value).toBe("")
    expect(el.getBoundingClientRect().height).toBe(32)
    expect(await axNode(select)).toMatchObject({ role: "combobox", name: "Department" })
    await expectAccessible(el)
  })

  it("defaults to the selected option and resets to it", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-native-select name="s" aria-label="s">
      <option value="a">A</option><option value="b" selected>B</option><option value="c">C</option>
    </tec-native-select></form>`)
    const el = form.querySelector("tec-native-select")!
    expect(el.value).toBe("b")
    expect(new FormData(form).get("s")).toBe("b")
    el.value = "c"
    await el.updateComplete
    expect(inner(el).value).toBe("c")
    expect(el.selectedIndex).toBe(2)
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("b")
    expect(inner(el).value).toBe("b")
  })

  it("keyboard selection updates value and fires input/change", async () => {
    const el = await fixture<TecNativeSelect>(html`<tec-native-select aria-label="s"><option value="a">A</option><option value="b">B</option></tec-native-select>`)
    const changes = recordEvents(el, "change")
    inner(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(el.value).toBe("b")
    expect(changes.events).toHaveLength(1)
  })

  it("follows option changes", async () => {
    const el = await fixture<TecNativeSelect>(html`<tec-native-select aria-label="s"><option value="a">A</option></tec-native-select>`)
    const option = document.createElement("option")
    option.value = "z"
    option.textContent = "Z"
    el.append(option)
    await new Promise((r) => setTimeout(r))
    await el.updateComplete
    expect(inner(el).options.length).toBe(2)
  })

  it("required fails on the placeholder option; invalid is displayed", async () => {
    const el = await fixture<TecNativeSelect>(html`<tec-native-select required invalid aria-label="s"><option value="">Pick</option><option value="a">A</option></tec-native-select>`)
    expect(el.validity.valid).toBe(false)
    expect(inner(el).getAttribute("aria-invalid")).toBe("true")
  })

  it("disabled dims the element", async () => {
    const el = await fixture<TecNativeSelect>(html`<tec-native-select disabled aria-label="s"><option>A</option></tec-native-select>`)
    expect(inner(el).disabled).toBe(true)
    expect(getComputedStyle(el).opacity).toBe("0.5")
  })

  it("places the chevron at the inline end in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-native-select aria-label="s"><option>Option</option></tec-native-select></div>`, { dir: "rtl" })
    const el = root.querySelector("tec-native-select")!
    const icon = el.shadowRoot!.querySelector(".icon")!.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    expect(icon.left - box.left).toBeLessThan(box.right - icon.right)
  })
})
