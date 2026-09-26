import { html } from "lit"
import { describe, expect, it } from "vitest"
import { expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecStat } from "./stat.js"
import "./define.js"

describe("tec-stat", () => {
  it("renders label, mono value with unit, delta and help", async () => {
    const el = await fixture<TecStat>(html`<tec-stat>
      <tec-stat-label>Cost per barrel</tec-stat-label>
      <tec-stat-value unit="USD">16.9</tec-stat-value>
      <tec-stat-delta trend="down" tone="positive">-8%</tec-stat-delta>
      <tec-stat-help>Base case</tec-stat-help>
    </tec-stat>`)
    const value = el.querySelector("tec-stat-value")!
    expect(getComputedStyle(value).fontSize).toBe("20px")
    expect(getComputedStyle(value).fontFamily).toContain("Plex Mono")
    const unit = value.shadowRoot!.querySelector<HTMLElement>(".unit")!
    expect(unit.textContent).toBe("USD")
    expect(getComputedStyle(unit).fontSize).toBe("12px")
    const delta = el.querySelector("tec-stat-delta")!
    expect(delta.matches(":state(positive)")).toBe(true)
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-success)"
    el.append(probe)
    expect(getComputedStyle(delta).color).toBe(getComputedStyle(probe).color)
    expect(delta.shadowRoot!.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true")
    await expectAccessible(el)
  })

  it("defaults the tone from the trend and scales the value by size", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-stat size="sm"><tec-stat-value>1</tec-stat-value><tec-stat-delta trend="up">+1</tec-stat-delta></tec-stat>
      <tec-stat size="lg"><tec-stat-value>1</tec-stat-value><tec-stat-delta trend="down">-1</tec-stat-delta></tec-stat>
      <tec-stat><tec-stat-delta>0</tec-stat-delta></tec-stat>
    </div>`)
    const values = [...root.querySelectorAll("tec-stat-value")].map((v) => getComputedStyle(v).fontSize)
    expect(values).toEqual(["14px", "28px"])
    const tones = [...root.querySelectorAll("tec-stat-delta")].map((d) => d.resolvedTone)
    expect(tones).toEqual(["positive", "negative", "neutral"])
  })

  it("aligns without reflecting align", async () => {
    const el = await fixture<TecStat>(html`<tec-stat style="width:200px"><tec-stat-label>NPV</tec-stat-label></tec-stat>`)
    el.align = "end"
    await el.updateComplete
    expect(el.hasAttribute("align")).toBe(false)
    const label = el.querySelector("tec-stat-label")!
    expect(Math.round(label.getBoundingClientRect().right)).toBe(Math.round(el.getBoundingClientRect().right))
  })

  it("lays out a group in auto-fit columns", async () => {
    const group = await fixture<HTMLElement>(html`<tec-stat-group style="width:400px">
      <tec-stat><tec-stat-value>1</tec-stat-value></tec-stat><tec-stat><tec-stat-value>2</tec-stat-value></tec-stat>
    </tec-stat-group>`)
    const [a, b] = [...group.querySelectorAll("tec-stat")]
    expect(a!.getBoundingClientRect().top).toBe(b!.getBoundingClientRect().top)
    expect(b!.getBoundingClientRect().left - a!.getBoundingClientRect().right).toBe(24)
  })
})
