import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecSpinner } from "./spinner.js"
import "./define.js"
import "../button/define.js"

describe("tec-spinner", () => {
  it("is a status with the label Loading", async () => {
    const el = await fixture<TecSpinner>(html`<tec-spinner></tec-spinner>`)
    expect(await axNode(el)).toMatchObject({ role: "status", name: "Loading" })
    expect(el.getBoundingClientRect().width).toBe(16)
    expect(el.shadowRoot!.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true")
    expect(el.hasAttribute("role")).toBe(false)
    await expectAccessible(el)
  })

  it("takes a localised label, and host ARIA overrides it", async () => {
    const el = await fixture<TecSpinner>(html`<tec-spinner label="Chargement"></tec-spinner>`)
    expect(await axNode(el)).toMatchObject({ name: "Chargement" })
    el.setAttribute("aria-label", "Saving")
    expect(await axNode(el)).toMatchObject({ name: "Saving" })
  })

  it("spins", async () => {
    const el = await fixture<TecSpinner>(html`<tec-spinner></tec-spinner>`)
    const part = el.shadowRoot!.querySelector("[part=icon]")!
    expect(part.getAnimations().length).toBe(1)
  })

  it("replaces the icon with slotted content", async () => {
    const el = await fixture<TecSpinner>(html`<tec-spinner><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg></tec-spinner>`)
    const svg = el.querySelector("svg")!
    expect(svg.getBoundingClientRect().width).toBe(16)
  })

  it("follows --tec-icon-size and size classes", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-button size="xs"><tec-spinner slot="start"></tec-spinner>Saving</tec-button>
      <tec-spinner style="width: 2rem; height: 2rem"></tec-spinner>
    </div>`)
    const [inButton, big] = [...root.querySelectorAll("tec-spinner")]
    expect(inButton!.getBoundingClientRect().width).toBe(12)
    expect(big!.getBoundingClientRect().width).toBe(32)
    expect(big!.shadowRoot!.querySelector("svg")!.getBoundingClientRect().width).toBe(32)
  })
})
