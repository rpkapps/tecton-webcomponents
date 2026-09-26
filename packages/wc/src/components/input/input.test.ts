import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecInput } from "./input.js"
import "./define.js"

const inner = (el: TecInput) => el.shadowRoot!.querySelector("input")!

describe("tec-input", () => {
  it("renders a 32px native text input named by aria-label", async () => {
    const el = await fixture<TecInput>(html`<tec-input aria-label="Well name" placeholder="34/10-A-12"></tec-input>`)
    expect(inner(el).type).toBe("text")
    expect(inner(el).placeholder).toBe("34/10-A-12")
    expect(el.getBoundingClientRect().height).toBe(32)
    expect(await axNode(inner(el))).toMatchObject({ role: "textbox", name: "Well name" })
    await expectAccessible(el)
  })

  it("updates value on typing and fires input and change", async () => {
    const el = await fixture<TecInput>(html`<tec-input aria-label="Name"></tec-input>`)
    const inputs = recordEvents(el, "input")
    const changes = recordEvents(el, "change")
    await userEvent.click(inner(el))
    await userEvent.keyboard("abc")
    expect(el.value).toBe("abc")
    expect(inputs.events).toHaveLength(3)
    await userEvent.keyboard("{Tab}")
    expect(changes.events).toHaveLength(1)
    expect(changes.events[0]!.composed).toBe(true)
  })

  it("value attribute is the default; property is current; reset restores; no events for script changes", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input name="well" value="A-1" aria-label="Well"></tec-input></form>`)
    const el = form.querySelector("tec-input")!
    const events = recordEvents(el, "input")
    expect(new FormData(form).get("well")).toBe("A-1")
    el.value = "B-2"
    await el.updateComplete
    expect(inner(el).value).toBe("B-2")
    expect(new FormData(form).get("well")).toBe("B-2")
    expect(events.events).toHaveLength(0)
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("A-1")
    expect(inner(el).value).toBe("A-1")
  })

  it("mirrors native constraint validation and displays it after interaction", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input name="e" type="email" required aria-label="Email"></tec-input></form>`)
    const el = form.querySelector("tec-input")!
    expect(el.validity.valueMissing).toBe(true)
    expect(el.matches(":state(user-invalid)")).toBe(false)
    await userEvent.click(inner(el))
    await userEvent.keyboard("nope")
    await userEvent.keyboard("{Tab}")
    await el.updateComplete
    expect(el.validity.typeMismatch).toBe(true)
    expect(el.matches(":state(user-invalid)")).toBe(true)
    expect(inner(el).getAttribute("aria-invalid")).toBe("true")
    expect(form.checkValidity()).toBe(false)
  })

  it("forwards native attributes and methods", async () => {
    const el = await fixture<TecInput>(
      html`<tec-input type="number" min="0" max="10" step="2" value="4" inputmode="decimal" readonly aria-label="Count"></tec-input>`
    )
    const input = inner(el)
    expect([input.min, input.max, input.step, input.inputMode, input.readOnly]).toEqual(["0", "10", "2", "decimal", true])
    el.stepUp()
    expect(el.value).toBe("6")
    expect(el.valueAsNumber).toBe(6)
    el.type = "text"
    el.value = "hello"
    await el.updateComplete
    el.setSelectionRange(1, 3)
    expect([el.selectionStart, el.selectionEnd]).toEqual([1, 3])
  })

  it("is labelled by <label for> and focused by clicking it", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="i1">API key</label><tec-input id="i1"></tec-input></div>`)
    const el = root.querySelector("tec-input")!
    expect(await axNode(inner(el))).toMatchObject({ name: "API key" })
    await userEvent.click(root.querySelector("label")!)
    expect(el.shadowRoot!.activeElement).toBe(inner(el))
  })

  it("uses the label attribute as a fallback name", async () => {
    const el = await fixture<TecInput>(html`<tec-input label="Search wells"></tec-input>`)
    expect(await axNode(inner(el))).toMatchObject({ name: "Search wells" })
  })

  it("draws the variants", async () => {
    const root = await fixture<HTMLElement>(
      html`<div><tec-input variant="filled" aria-label="a"></tec-input><tec-input variant="text" aria-label="b"></tec-input></div>`
    )
    const [filled, text] = [...root.querySelectorAll("tec-input")].map((e) => getComputedStyle(inner(e)))
    expect(filled!.borderTopWidth).toBe("0px")
    expect(filled!.borderBottomWidth).toBe("1px")
    expect(filled!.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(text!.paddingLeft).toBe("0px")
    expect(text!.borderTopLeftRadius).toBe("0px")
  })

  it("disabled removes it from the tab order and the form data", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input name="x" value="1" disabled aria-label="x"></tec-input></form>`)
    const el = form.querySelector("tec-input")!
    expect(inner(el).disabled).toBe(true)
    expect(el.matches(":disabled")).toBe(true)
    expect(new FormData(form).has("x")).toBe(false)
  })

  it("submits files for type=file", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input name="pic" type="file" aria-label="Picture"></tec-input></form>`)
    const el = form.querySelector("tec-input")!
    const file = new File(["x"], "a.png", { type: "image/png" })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    inner(el).files = transfer.files
    inner(el).dispatchEvent(new Event("change"))
    await el.updateComplete
    expect((new FormData(form).get("pic") as File).name).toBe("a.png")
  })
})
