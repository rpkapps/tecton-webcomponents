import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import "../checkbox/define.js"
import "../input/define.js"
import type { TecLabel } from "./label.js"
import "./define.js"

describe("tec-label", () => {
  it("names the control given by for= and toggles it on click", async () => {
    const root = await fixture<HTMLElement>(
      html`<div class="flex gap-2"><tec-checkbox id="terms"></tec-checkbox><tec-label for="terms">Accept terms</tec-label></div>`
    )
    const box = root.querySelector("tec-checkbox")!
    const label = root.querySelector<TecLabel>("tec-label")!
    await waitUntil(() => box.getAttribute("aria-labelledby") === label.id)
    expect(label.control).toBe(box)
    expect(await axNode(box.shadowRoot!.querySelector("input")!)).toMatchObject({ role: "checkbox", name: "Accept terms" })
    await userEvent.click(label)
    expect(box.checked).toBe(true)
    await expectAccessible(root)
  })

  it("labels a native input and a contained control", async () => {
    const root = await fixture<HTMLElement>(
      html`<div>
        <tec-label for="n1">Native</tec-label><input id="n1" />
        <tec-label>Wrapped <tec-input></tec-input></tec-label>
      </div>`
    )
    const native = root.querySelector("input")!
    const wrapped = root.querySelector("tec-input")!
    await waitUntil(() => wrapped.hasAttribute("aria-labelledby"))
    expect(await axNode(native)).toMatchObject({ name: "Native" })
    expect(await axNode(wrapped.shadowRoot!.querySelector("input")!)).toMatchObject({ name: "Wrapped" })
    await userEvent.click(root.querySelector("tec-label")!)
    expect(document.activeElement).toBe(native)
  })

  it("keeps author ids in aria-labelledby and cleans up on removal", async () => {
    const root = await fixture<HTMLElement>(html`<div><span id="x">Extra</span><input id="n2" aria-labelledby="x" /><tec-label for="n2">Main</tec-label></div>`)
    const input = root.querySelector("input")!
    const label = root.querySelector("tec-label")!
    await waitUntil(() => input.getAttribute("aria-labelledby") === `x ${label.id}`)
    label.remove()
    expect(input.getAttribute("aria-labelledby")).toBe("x")
  })

  it("dims while the control is disabled", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-input id="d1" disabled></tec-input><tec-label for="d1">Email</tec-label></div>`)
    const label = root.querySelector<TecLabel>("tec-label")!
    await waitUntil(() => label.matches(":state(disabled)"))
    expect(getComputedStyle(label).opacity).toBe("0.5")
    expect(label.getAttribute("aria-disabled")).toBe("true")
    await expectAccessible(root)
    root.querySelector("tec-input")!.disabled = false
    await waitUntil(() => !label.matches(":state(disabled)"))
    expect(label.hasAttribute("aria-disabled")).toBe(false)
  })

  it("is small medium text", async () => {
    const label = await fixture<TecLabel>(html`<tec-label>Text</tec-label>`)
    const style = getComputedStyle(label)
    expect(style.fontSize).toBe("14px")
    expect(style.fontWeight).toBe("500")
  })
})
