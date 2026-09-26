import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecCircularProgress } from "./circular-progress.js"
import "./define.js"

const label = (el: TecCircularProgress) => el.shadowRoot!.querySelector<HTMLElement>(".value")!

describe("tec-circular-progress", () => {
  it("is a named progressbar with a formatted value", async () => {
    const el = await fixture<TecCircularProgress>(html`<tec-circular-progress aria-label="Resampling" value="64" show-value></tec-circular-progress>`)
    expect(await axNode(el)).toMatchObject({ role: "progressbar", name: "Resampling", valuetext: "64%" })
    expect(label(el).hidden).toBe(false)
    expect(label(el).textContent!.trim()).toBe("64%")
    expect(el.getBoundingClientRect().width).toBe(40)
    await expectAccessible(el)
  })

  it("draws the arc from the percentage of the range", async () => {
    const el = await fixture<TecCircularProgress>(html`<tec-circular-progress aria-label="x" value="7" max="14"></tec-circular-progress>`)
    const indicator = el.shadowRoot!.querySelector("circle.indicator")!
    const c = 2 * Math.PI * 20
    expect(Number(indicator.getAttribute("stroke-dashoffset"))).toBeCloseTo(c / 2, 3)
    expect(label(el).hidden).toBe(true)
    el.formatOptions = { style: "decimal" }
    await el.updateComplete
    expect(el.valueText).toBe("7")
  })

  it("formats in the element's language", async () => {
    const el = await fixture<HTMLElement>(html`<div lang="de"><tec-circular-progress aria-label="x" value="12.5" format-options='{"style":"percent","minimumFractionDigits":1}'></tec-circular-progress></div>`)
    const progress = el.querySelector("tec-circular-progress")!
    expect(progress.valueText.replace(/\s/g, " ")).toBe("12,5 %")
  })

  it("is indeterminate without a value", async () => {
    const el = await fixture<TecCircularProgress>(html`<tec-circular-progress aria-label="Loading" indeterminate show-value></tec-circular-progress>`)
    const node = await axNode(el)
    expect(node).toMatchObject({ role: "progressbar", name: "Loading" })
    expect(node.valuetext || undefined).toBeUndefined()
    expect(label(el).hidden).toBe(true)
    expect(getComputedStyle(el.shadowRoot!.querySelector("svg")!).animationName).toBe("tec-circular-progress-spin")
    await expectAccessible(el)
  })

  it("shows custom centre content and scales with size", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-circular-progress aria-label="Templates" size="lg" value="7" max="12" value-label="7 of 12">7/12</tec-circular-progress>
      <tec-circular-progress aria-label="a" size="xs"></tec-circular-progress>
      <tec-circular-progress aria-label="b" size="xl" color="success"></tec-circular-progress>
    </div>`)
    const [lg, xs, xl] = [...root.querySelectorAll<TecCircularProgress>("tec-circular-progress")]
    expect(label(lg!).hidden).toBe(false)
    expect(await axNode(lg!)).toMatchObject({ valuetext: "7 of 12" })
    expect([lg!, xs!, xl!].map((e) => e.getBoundingClientRect().width)).toEqual([64, 16, 96])
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-success)"
    root.append(probe)
    expect(getComputedStyle(xl!).color).toBe(getComputedStyle(probe).color)
  })
})
