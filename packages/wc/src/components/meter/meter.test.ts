import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecMeter } from "./meter.js"
import "./define.js"

const fills = (el: TecMeter) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".fill")].map((f) => f.style.width)

describe("tec-meter", () => {
  it("is a meter named by its label, announcing the value label", async () => {
    const el = await fixture<TecMeter>(html`<tec-meter label="Drilling complexity" value="60" value-label="Medium"></tec-meter>`)
    expect(await axNode(el)).toMatchObject({ role: "meter", name: "Drilling complexity", valuetext: "Medium" })
    expect(el.shadowRoot!.querySelector(".value")!.textContent).toBe("Medium")
    expect(fills(el)).toEqual(["100%", "100%", "100%", "0%", "0%"])
    await expectAccessible(el)
  })

  it("fills segments partially and supports a continuous bar", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width:300px">
      <tec-meter aria-label="a" value="45" segments="1" show-value></tec-meter>
      <tec-meter aria-label="b" value="45" segments="10"></tec-meter>
      <tec-meter aria-label="c" value="4" max="5" show-value></tec-meter>
    </div>`)
    const [a, b, c] = [...root.querySelectorAll<TecMeter>("tec-meter")]
    expect(fills(a!)).toEqual(["45%"])
    expect(a!.shadowRoot!.querySelector(".value")!.textContent).toBe("45%")
    expect(fills(b!).map(parseFloat).map(Math.round)).toEqual([100, 100, 100, 100, 50, 0, 0, 0, 0, 0])
    expect(await axNode(c!)).toMatchObject({ valuetext: "80%" })
  })

  it("picks the colour from the value with color=auto", async () => {
    const el = await fixture<TecMeter>(html`<tec-meter aria-label="Risk" color="auto" value="20"></tec-meter>`)
    expect(el.matches(":state(success)")).toBe(true)
    el.value = 50
    await el.updateComplete
    expect(el.matches(":state(warning)")).toBe(true)
    expect(el.matches(":state(success)")).toBe(false)
    el.value = 67
    await el.updateComplete
    expect(el.resolvedColor).toBe("error")
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-destructive)"
    el.after(probe)
    expect(getComputedStyle(el.shadowRoot!.querySelector(".fill")!).backgroundColor).toBe(getComputedStyle(probe).color)
  })

  it("sizes the track and uses a slotted label", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-meter size="sm" aria-label="s" value="10"></tec-meter>
      <tec-meter size="lg" value="10"><span slot="label">Confidence</span></tec-meter>
    </div>`)
    const [sm, lg] = [...root.querySelectorAll<TecMeter>("tec-meter")]
    expect(sm!.shadowRoot!.querySelector<HTMLElement>(".track")!.getBoundingClientRect().height).toBe(4)
    expect(lg!.shadowRoot!.querySelector<HTMLElement>(".track")!.getBoundingClientRect().height).toBe(10)
    expect(await axNode(lg!)).toMatchObject({ role: "meter", name: "Confidence" })
    await expectAccessible(root)
  })
})
