import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecProgress } from "./progress.js"
import "./define.js"

const part = (el: Element, name: string) => el.shadowRoot!.querySelector(`[part=${name}]`) as HTMLElement

describe("tec-progress", () => {
  it("is a progressbar with value semantics", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 200px"><tec-progress aria-label="Loading" value="66"></tec-progress></div>`)
    const el = root.querySelector<TecProgress>("tec-progress")!
    expect(await axNode(el)).toMatchObject({ role: "progressbar", name: "Loading", valuemin: "0", valuemax: "100", valuetext: "66%" })
    // CDP does not report valuenow; check the default semantics directly
    expect(el.internals.ariaValueNow).toBe("66")
    expect(el.hasAttribute("role")).toBe(false)
    expect(part(el, "track").getBoundingClientRect()).toMatchObject({ width: 200, height: 4 })
    expect(part(el, "indicator").getBoundingClientRect().width).toBeCloseTo(132, 0)
    await expectAccessible(root)
  })

  it("is labelled by tec-progress-label and prints the value", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 300px">
      <tec-progress value="56"><tec-progress-label>Upload progress</tec-progress-label><tec-progress-value></tec-progress-value></tec-progress>
    </div>`)
    const el = root.querySelector<TecProgress>("tec-progress")!
    const value = root.querySelector("tec-progress-value")!
    await el.updateComplete
    await (value as unknown as { updateComplete: Promise<unknown> }).updateComplete
    expect(await axNode(el)).toMatchObject({ role: "progressbar", name: "Upload progress", valuetext: "56%" })
    expect(value.shadowRoot!.textContent).toContain("56%")
    // label and value share the line above the full-width track, value at the end
    const label = root.querySelector("tec-progress-label")!.getBoundingClientRect()
    const v = value.getBoundingClientRect()
    expect(v.top).toBe(label.top)
    expect(v.right).toBeCloseTo(300, 0)
    expect(part(el, "track").getBoundingClientRect().top).toBeGreaterThan(label.bottom)
    el.value = 80
    await el.updateComplete
    await (value as unknown as { updateComplete: Promise<unknown> }).updateComplete
    expect(value.shadowRoot!.textContent).toContain("80%")
    await expectAccessible(root)
  })

  it("supports min/max, value-label and formatOptions", async () => {
    const el = await fixture<TecProgress>(html`<tec-progress aria-label="Files" value="3" max="8" value-label="3 of 8 files"></tec-progress>`)
    expect(el.percentage).toBe(0.375)
    expect(await axNode(el)).toMatchObject({ valuetext: "3 of 8 files", valuemax: "8" })
    el.valueLabel = undefined
    el.formatOptions = { style: "unit", unit: "megabyte" }
    await el.updateComplete
    expect(await axNode(el)).toMatchObject({ valuetext: "3 MB" })
  })

  it("formats for the closest lang", async () => {
    const root = await fixture<HTMLElement>(html`<div lang="ar-EG"><tec-progress aria-label="x" value="56"><tec-progress-value></tec-progress-value></tec-progress></div>`)
    const el = root.querySelector<TecProgress>("tec-progress")!
    expect(el.valueText).toBe(new Intl.NumberFormat("ar-EG", { style: "percent" }).format(0.56))
  })

  it("indeterminate exposes no value and animates", async () => {
    const el = await fixture<TecProgress>(html`<tec-progress aria-label="Loading" indeterminate></tec-progress>`)
    const node = await axNode(el)
    expect(node.role).toBe("progressbar")
    expect(node.valuetext ?? "").toBe("")
    expect(el.internals.ariaValueNow).toBeNull()
    expect(el.matches(":state(indeterminate)")).toBe(true)
    expect(part(el, "indicator").getAnimations().length).toBe(1)
    await expectAccessible(el)
  })

  it("fills from the inline start in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div dir="rtl" style="width: 200px"><tec-progress aria-label="x" value="25"></tec-progress></div>`)
    const el = root.querySelector("tec-progress")!
    const ind = part(el, "indicator").getBoundingClientRect()
    expect(ind.right).toBeCloseTo(root.getBoundingClientRect().right, 0)
    expect(ind.width).toBeCloseTo(50, 0)
  })
})
