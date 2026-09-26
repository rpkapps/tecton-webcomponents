import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecRadioGroup } from "./radio-group.js"
import "./define.js"

const items = (g: Element) => [...g.querySelectorAll("tec-radio-group-item")]

describe("tec-radio-group", () => {
  it("renders a radiogroup of radios named by their content", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group aria-label="Density" value="comfortable">
      <tec-radio-group-item value="default">Default</tec-radio-group-item>
      <tec-radio-group-item value="comfortable">Comfortable</tec-radio-group-item>
      <tec-radio-group-item value="compact">Compact</tec-radio-group-item>
    </tec-radio-group>`)
    expect(await axTree(g)).toEqual(["radiogroup: Density", "radio: Default", "radio: Comfortable [checked]", "radio: Compact"])
    expect(items(g).map((i) => i.tabIndex)).toEqual([-1, 0, -1])
    const circle = items(g)[0]!.shadowRoot!.querySelector(".control")!.getBoundingClientRect()
    expect([circle.width, circle.height]).toEqual([16, 16])
    await expectAccessible(g)
  })

  it("items in wrappers are labelled by <label for>, which checks them", async () => {
    const root = await fixture<HTMLElement>(html`<tec-radio-group aria-label="Density" value="b">
      <div><tec-radio-group-item value="a" id="rg-a"></tec-radio-group-item><label for="rg-a">Default</label></div>
      <div><tec-radio-group-item value="b" id="rg-b" aria-describedby="rg-b-d"></tec-radio-group-item><label for="rg-b">Compact</label><p id="rg-b-d">Dense.</p></div>
    </tec-radio-group>`)
    const g = root as TecRadioGroup
    const [a, b] = items(g)
    expect(await axNode(a!)).toMatchObject({ role: "radio", name: "Default", checked: "false" })
    expect(await axNode(b!)).toMatchObject({ role: "radio", name: "Compact", description: "Dense.", checked: "true" })
    const changes = recordEvents(g, "change")
    await userEvent.click(root.querySelector("label[for=rg-a]")!)
    expect(g.value).toBe("a")
    expect(changes.events).toHaveLength(1)
    expect(deepActiveElement()).toBe(a)
    await expectAccessible(root)
  })

  it("arrow keys move focus and check, wrapping and skipping disabled items; Space checks", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group aria-label="Plan">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
      <tec-radio-group-item value="b" disabled>B</tec-radio-group-item>
      <tec-radio-group-item value="c">C</tec-radio-group-item>
    </tec-radio-group>`)
    const [a, , c] = items(g)
    const inputs = recordEvents(g, "input")
    const changes = recordEvents(g, "change")
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(a)
    expect(g.value).toBe("")
    await userEvent.keyboard(" ")
    expect(g.value).toBe("a")
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(c)
    expect(g.value).toBe("c")
    await userEvent.keyboard("{ArrowRight}")
    expect(g.value).toBe("a")
    await userEvent.keyboard("{ArrowUp}")
    expect(g.value).toBe("c")
    await userEvent.keyboard("{ArrowLeft}")
    expect(g.value).toBe("a")
    expect(inputs.events).toHaveLength(5)
    expect(changes.events).toHaveLength(5)
    expect(changes.events[0]!.composed).toBe(true)
    // Tab leaves the group; Shift+Tab returns to the checked item.
    await userEvent.keyboard("{Tab}")
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()).toBe(a)
  })

  it("mirrors Left/Right in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div dir="rtl"><tec-radio-group aria-label="x" value="a">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
      <tec-radio-group-item value="b">B</tec-radio-group-item>
    </tec-radio-group></div>`)
    const g = root.querySelector("tec-radio-group")!
    items(g)[0]!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(g.value).toBe("b")
  })

  it("does not fire events for programmatic changes; value attribute is the default; reset restores", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-radio-group name="plan" value="monthly" aria-label="Plan">
      <tec-radio-group-item value="monthly">Monthly</tec-radio-group-item>
      <tec-radio-group-item value="yearly">Yearly</tec-radio-group-item>
    </tec-radio-group></form>`)
    const g = form.querySelector("tec-radio-group")!
    const changes = recordEvents(g, "change")
    expect(new FormData(form).get("plan")).toBe("monthly")
    g.value = "yearly"
    await g.updateComplete
    expect(changes.events).toHaveLength(0)
    expect(items(g)[1]!.matches(":state(checked)")).toBe(true)
    expect(new FormData(form).get("plan")).toBe("yearly")
    expect(g.getAttribute("value")).toBe("monthly")
    form.reset()
    await g.updateComplete
    expect(g.value).toBe("monthly")
    expect(items(g)[0]!.matches(":state(checked)")).toBe(true)
    expect([...new FormData(form).keys()]).toEqual(["plan"])
  })

  it("required: invalid until checked; the error shows on the items after a submit attempt", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-radio-group name="n" required aria-label="Notify">
      <tec-radio-group-item value="email">Email</tec-radio-group-item>
      <tec-radio-group-item value="sms">SMS</tec-radio-group-item>
    </tec-radio-group></form>`)
    const g = form.querySelector("tec-radio-group")!
    expect(g.checkValidity()).toBe(false)
    expect(g.validity.valueMissing).toBe(true)
    expect(items(g)[0]!.matches(":state(user-invalid)")).toBe(false)
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", onSubmit)
    form.requestSubmit()
    await aTimeout()
    await g.updateComplete
    await items(g)[0]!.updateComplete
    expect(onSubmit).not.toHaveBeenCalled()
    expect(g.matches(":state(user-invalid)")).toBe(true)
    expect(items(g)[0]!.matches(":state(user-invalid)")).toBe(true)
    expect(await axNode(g)).toMatchObject({ invalid: "true", required: "true" })
    await userEvent.click(items(g)[1]!)
    await items(g)[0]!.updateComplete
    expect(items(g)[0]!.matches(":state(user-invalid)")).toBe(false)
    form.requestSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("invalid attribute shows the destructive state on every item", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group invalid value="a" aria-label="x">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
    </tec-radio-group>`)
    await items(g)[0]!.updateComplete
    expect(items(g)[0]!.matches(":state(user-invalid)")).toBe(true)
    expect(g.checkValidity()).toBe(false)
  })

  it("disabled group, disabled item and fieldset", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-radio-group disabled aria-label="g1"><tec-radio-group-item value="a">A</tec-radio-group-item></tec-radio-group>
      <fieldset disabled><tec-radio-group aria-label="g2"><tec-radio-group-item value="b">B</tec-radio-group-item></tec-radio-group></fieldset>
      <tec-radio-group aria-label="g3"><tec-radio-group-item value="c" disabled>C</tec-radio-group-item><tec-radio-group-item value="d">D</tec-radio-group-item></tec-radio-group>
    </div>`)
    const [g1, g2, g3] = [...root.querySelectorAll("tec-radio-group")]
    await g2!.updateComplete
    items(g1!)[0]!.click()
    items(g2!)[0]!.click()
    items(g3!)[0]!.click()
    expect([g1!.value, g2!.value, g3!.value]).toEqual(["", "", ""])
    expect(await axNode(items(g1!)[0]!)).toMatchObject({ disabled: "true" })
    expect(items(g3!).map((i) => i.tabIndex)).toEqual([-1, 0])
  })

  it("readonly keeps the value but allows focus", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group readonly value="a" aria-label="x">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
      <tec-radio-group-item value="b">B</tec-radio-group-item>
    </tec-radio-group>`)
    items(g)[0]!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(items(g)[1])
    await userEvent.keyboard(" ")
    expect(g.value).toBe("a")
  })

  it("is named by a <label for> pointing at the group", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="rg-plans">Plans</label><tec-radio-group id="rg-plans">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
    </tec-radio-group></div>`)
    const g = root.querySelector("tec-radio-group")!
    expect(await axNode(g)).toMatchObject({ role: "radiogroup", name: "Plans" })
  })

  it("focus() focuses the checked item and shows the focus ring", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group value="b" aria-label="x">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
      <tec-radio-group-item value="b">B</tec-radio-group-item>
    </tec-radio-group>`)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(items(g)[1])
    expect(getComputedStyle(items(g)[1]!.shadowRoot!.querySelector(".control")!).boxShadow).not.toBe("none")
  })

  it("the host is the layout box: author grid/gap styles apply to the options", async () => {
    const g = await fixture<TecRadioGroup>(html`<tec-radio-group aria-label="x" style="grid-template-columns: 1fr 1fr; gap: 20px; width: 300px">
      <tec-radio-group-item value="a">A</tec-radio-group-item>
      <tec-radio-group-item value="b">B</tec-radio-group-item>
    </tec-radio-group>`)
    const [a, b] = items(g).map((i) => i.getBoundingClientRect())
    expect(Math.round(b!.top)).toBe(Math.round(a!.top))
    expect(Math.round(b!.left - a!.left)).toBe(160)
  })
})
