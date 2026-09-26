import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecSwitch } from "./switch.js"
import "./define.js"

const input = (el: TecSwitch) => el.shadowRoot!.querySelector("input")!
const track = (el: TecSwitch) => el.shadowRoot!.querySelector<HTMLElement>(".track")!
const thumb = (el: TecSwitch) => el.shadowRoot!.querySelector<HTMLElement>(".thumb")!

describe("tec-switch", () => {
  it("renders an off switch with role=switch named by its slot", async () => {
    const el = await fixture<TecSwitch>(html`<tec-switch>Airplane mode</tec-switch>`)
    expect(el.checked).toBe(false)
    expect(await axNode(input(el))).toMatchObject({ role: "switch", name: "Airplane mode", checked: "false" })
    const box = track(el).getBoundingClientRect()
    expect([box.width, box.height]).toEqual([34, 16])
    await expectAccessible(el)
  })

  it("sm size is 26×12 with a 6px thumb", async () => {
    const el = await fixture<TecSwitch>(html`<tec-switch size="sm" aria-label="Small"></tec-switch>`)
    const box = track(el).getBoundingClientRect()
    expect([box.width, box.height]).toEqual([26, 12])
    expect(thumb(el).getBoundingClientRect().width).toBe(6)
  })

  it("toggles on click, Space and label click, firing input and change", async () => {
    const el = await fixture<TecSwitch>(html`<tec-switch>Wi-Fi</tec-switch>`)
    const changes = recordEvents(el, "change")
    const inputs = recordEvents(el, "input")
    await userEvent.click(track(el))
    expect(el.checked).toBe(true)
    expect(el.matches(":state(checked)")).toBe(true)
    expect(await axNode(input(el))).toMatchObject({ checked: "true" })
    await userEvent.keyboard(" ")
    expect(el.checked).toBe(false)
    await userEvent.click(el.shadowRoot!.querySelector(".label")!)
    expect(el.checked).toBe(true)
    expect(changes.events).toHaveLength(3)
    expect(inputs.events).toHaveLength(3)
    expect(changes.events[0]!.composed).toBe(true)
  })

  it("moves the thumb to the end, mirrored in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-switch checked aria-label="A"></tec-switch><tec-switch dir="rtl" checked aria-label="B"></tec-switch></div>`)
    const [ltr, rtl] = [...root.querySelectorAll("tec-switch")]
    await aTimeout(250)
    const tl = track(ltr!).getBoundingClientRect()
    const hl = thumb(ltr!).getBoundingClientRect()
    expect(Math.round(tl.right - hl.right)).toBe(3) // 1px border + 2px gap
    const tr = track(rtl!).getBoundingClientRect()
    const hr = thumb(rtl!).getBoundingClientRect()
    expect(Math.round(hr.left - tr.left)).toBe(3)
  })

  it("does not fire events for programmatic changes", async () => {
    const el = await fixture<TecSwitch>(html`<tec-switch aria-label="x"></tec-switch>`)
    const changes = recordEvents(el, "change")
    el.checked = true
    await el.updateComplete
    expect(input(el).checked).toBe(true)
    expect(changes.events).toHaveLength(0)
  })

  it("is labelled by <label for> (and described by aria-describedby) and toggled by clicking the label", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-switch id="s1" aria-describedby="s1-d"></tec-switch><label for="s1">Share across devices</label>
      <p id="s1-d">Focus is shared.</p>
    </div>`)
    const sw = root.querySelector("tec-switch")!
    expect(await axNode(input(sw))).toMatchObject({ role: "switch", name: "Share across devices", description: "Focus is shared." })
    await userEvent.click(root.querySelector("label")!)
    expect(sw.checked).toBe(true)
    await expectAccessible(root)
  })

  it("submits its value while on and resets to the checked attribute", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-switch name="wifi" checked>Wi-Fi</tec-switch><tec-switch name="bt" value="yes">BT</tec-switch></form>`)
    const [wifi, bt] = [...form.querySelectorAll("tec-switch")]
    let data = new FormData(form)
    expect(data.get("wifi")).toBe("on")
    expect(data.has("bt")).toBe(false)
    await userEvent.click(input(bt!))
    await userEvent.click(input(wifi!))
    data = new FormData(form)
    expect(data.get("bt")).toBe("yes")
    expect(data.has("wifi")).toBe(false)
    form.reset()
    await wifi!.updateComplete
    expect(wifi!.checked).toBe(true)
    expect(bt!.checked).toBe(false)
  })

  it("required blocks submission until on; invalid shows immediately", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-switch name="t" required>Accept</tec-switch><tec-switch invalid>Other</tec-switch></form>`)
    const [req, inv] = [...form.querySelectorAll("tec-switch")]
    expect(req!.checkValidity()).toBe(false)
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", onSubmit)
    inv!.invalid = false
    await inv!.updateComplete
    form.requestSubmit()
    await aTimeout()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(req!.matches(":state(user-invalid)")).toBe(true)
    await aTimeout(250)
    expect(getComputedStyle(track(req!)).borderColor).not.toBe(getComputedStyle(track(inv!)).borderColor)
    await userEvent.click(input(req!))
    form.requestSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    inv!.invalid = true
    await inv!.updateComplete
    expect(await axNode(input(inv!))).toMatchObject({ invalid: "true" })
  })

  it("disabled and readonly switches do not toggle", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-switch disabled>A</tec-switch>
      <tec-switch readonly checked>B</tec-switch>
      <fieldset disabled><tec-switch>C</tec-switch></fieldset>
    </div>`)
    const [a, b, c] = [...root.querySelectorAll("tec-switch")]
    await c!.updateComplete
    a!.click()
    c!.click()
    await userEvent.click(input(b!))
    expect(a!.checked).toBe(false)
    expect(b!.checked).toBe(true)
    expect(c!.checked).toBe(false)
    expect(input(c!).disabled).toBe(true)
    expect(await axNode(input(a!))).toMatchObject({ disabled: "true" })
  })

  it("shows a focus ring on keyboard focus", async () => {
    const el = await fixture<TecSwitch>(html`<tec-switch>Focus</tec-switch>`)
    await userEvent.keyboard("{Tab}")
    expect(el.matches(":state(focus-visible)")).toBe(true)
    expect(getComputedStyle(track(el)).boxShadow).not.toBe("none")
  })
})
