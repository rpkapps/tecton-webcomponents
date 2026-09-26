import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecCheckbox } from "./checkbox.js"
import "./define.js"

const input = (el: TecCheckbox) => el.shadowRoot!.querySelector("input")!

describe("tec-checkbox", () => {
  it("renders an unchecked native checkbox named by its slot", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox>Accept terms</tec-checkbox>`)
    expect(el.checked).toBe(false)
    expect(await axNode(input(el))).toMatchObject({ role: "checkbox", name: "Accept terms", checked: "false" })
    expect(input(el).getBoundingClientRect().width).toBe(16)
    await expectAccessible(el)
  })

  it("toggles on click, Space and label click, firing input and change", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox>Accept</tec-checkbox>`)
    const changes = recordEvents(el, "change")
    const inputs = recordEvents(el, "input")
    await userEvent.click(input(el))
    expect(el.checked).toBe(true)
    expect(el.matches(":state(checked)")).toBe(true)
    await userEvent.keyboard(" ")
    expect(el.checked).toBe(false)
    await userEvent.click(el.shadowRoot!.querySelector(".label")!)
    expect(el.checked).toBe(true)
    expect(changes.events).toHaveLength(3)
    expect(inputs.events).toHaveLength(3)
    expect(changes.events[0]!.composed).toBe(true)
  })

  it("does not fire events for programmatic changes", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox>Accept</tec-checkbox>`)
    const changes = recordEvents(el, "change")
    el.checked = true
    await el.updateComplete
    expect(input(el).checked).toBe(true)
    expect(changes.events).toHaveLength(0)
  })

  it("is labelled by <label for> and toggled by clicking it", async () => {
    const el = await fixture<HTMLElement>(html`<div><tec-checkbox id="terms"></tec-checkbox><label for="terms">Accept terms and conditions</label></div>`)
    const box = el.querySelector("tec-checkbox")!
    expect(await axNode(input(box))).toMatchObject({ role: "checkbox", name: "Accept terms and conditions" })
    await userEvent.click(el.querySelector("label")!)
    expect(box.checked).toBe(true)
    await expectAccessible(el)
  })

  it("delegates aria-label and aria-describedby", async () => {
    const el = await fixture<HTMLElement>(html`<div><tec-checkbox aria-label="Select row" aria-describedby="d"></tec-checkbox><p id="d">Row 1</p></div>`)
    const box = el.querySelector("tec-checkbox")!
    expect(await axNode(input(box))).toMatchObject({ name: "Select row", description: "Row 1" })
  })

  it("checked attribute is the default; property is the current state; form reset restores", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-checkbox name="news" checked>News</tec-checkbox></form>`)
    const box = form.querySelector("tec-checkbox")!
    expect(box.checked).toBe(true)
    expect(new FormData(form).get("news")).toBe("on")
    await userEvent.click(input(box))
    expect(box.checked).toBe(false)
    expect(box.hasAttribute("checked")).toBe(true)
    expect(new FormData(form).get("news")).toBeNull()
    form.reset()
    await box.updateComplete
    expect(box.checked).toBe(true)
    expect(input(box).checked).toBe(true)
  })

  it("submits its value when checked", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-checkbox name="plan" value="pro" checked></tec-checkbox><tec-checkbox name="x"></tec-checkbox></form>`)
    const data = new FormData(form)
    expect(data.get("plan")).toBe("pro")
    expect(data.has("x")).toBe(false)
  })

  it("required: invalid until checked, displayed only after interaction or submit", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-checkbox name="t" required>Accept</tec-checkbox><button>Go</button></form>`)
    const box = form.querySelector("tec-checkbox")!
    expect(box.checkValidity()).toBe(false)
    expect(box.validity.valueMissing).toBe(true)
    expect(box.validationMessage).not.toBe("")
    await box.updateComplete
    expect(box.matches(":state(user-invalid)")).toBe(false)
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", onSubmit)
    form.requestSubmit()
    await aTimeout()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(box.matches(":state(user-invalid)")).toBe(true)
    expect(input(box).getAttribute("aria-invalid")).toBe("true")
    await userEvent.click(input(box))
    expect(box.checkValidity()).toBe(true)
    expect(box.matches(":state(user-invalid)")).toBe(false)
    form.requestSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("invalid attribute is shown immediately and blocks submission", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox invalid>Accept</tec-checkbox>`)
    expect(el.checkValidity()).toBe(false)
    expect(el.validationMessage).toBe("Invalid value.")
    expect(await axNode(input(el))).toMatchObject({ invalid: "true" })
    expect(getComputedStyle(input(el)).boxShadow).not.toBe("none")
  })

  it("setCustomValidity", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox>Accept</tec-checkbox>`)
    el.setCustomValidity("Nope")
    expect(el.validity.customError).toBe(true)
    expect(el.validationMessage).toBe("Nope")
    el.setCustomValidity("")
    expect(el.checkValidity()).toBe(true)
  })

  it("disabled and fieldset-disabled checkboxes do not toggle and are not submitted", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-checkbox name="a" checked disabled>A</tec-checkbox>
      <fieldset disabled><tec-checkbox name="b" checked>B</tec-checkbox></fieldset>
    </form>`)
    const [a, b] = [...form.querySelectorAll("tec-checkbox")]
    await b!.updateComplete
    a!.click()
    b!.click()
    expect(a!.checked).toBe(true)
    expect(b!.checked).toBe(true)
    expect(input(b!).disabled).toBe(true)
    const data = new FormData(form)
    expect(data.has("a")).toBe(false)
    expect(data.has("b")).toBe(false)
  })

  it("indeterminate shows the mixed state and clears on toggle", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox indeterminate aria-label="All"></tec-checkbox>`)
    expect(await axNode(input(el))).toMatchObject({ checked: "mixed" })
    expect(el.shadowRoot!.querySelector(".indicator svg")).not.toBeNull()
    await userEvent.click(input(el))
    expect(el.indeterminate).toBe(false)
    expect(el.checked).toBe(true)
  })

  it("readonly prevents toggling", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox readonly checked>Locked</tec-checkbox>`)
    await userEvent.click(input(el))
    expect(el.checked).toBe(true)
  })

  it("restores its state via formStateRestoreCallback", async () => {
    const el = await fixture<TecCheckbox>(html`<tec-checkbox></tec-checkbox>`)
    el.formStateRestoreCallback("true", "restore")
    await el.updateComplete
    expect(el.checked).toBe(true)
  })
})
