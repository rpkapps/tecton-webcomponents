import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, axTree, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecSeparator } from "./separator.js"
import "./define.js"

const line = (el: Element) => el.shadowRoot!.querySelector(".line.start") as HTMLElement
const resolve = (el: Element, value: string) => {
  const probe = document.createElement("span")
  probe.style.color = value
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe("tec-separator", () => {
  it("is a 1px horizontal separator across the width", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 200px"><tec-separator></tec-separator></div>`)
    const el = root.querySelector<TecSeparator>("tec-separator")!
    expect(el.orientation).toBe("horizontal")
    expect(el.getAttribute("emphasis")).toBe("default")
    expect(el.getBoundingClientRect()).toMatchObject({ width: 200, height: 1 })
    expect(line(el).getBoundingClientRect()).toMatchObject({ width: 200, height: 1 })
    expect(getComputedStyle(line(el)).backgroundColor).toBe(resolve(root, "var(--tec-border)"))
    expect(await axNode(el)).toMatchObject({ role: "separator" })
    expect((await axNode(el)).orientation).not.toBe("vertical")
    await expectAccessible(root)
  })

  it("stretches vertically in a flex row and exposes aria-orientation", async () => {
    const root = await fixture<HTMLElement>(html`<div style="display: flex; height: 20px; align-items: center; gap: 16px">
      <span>Blog</span><tec-separator orientation="vertical"></tec-separator><span>Docs</span>
    </div>`)
    const el = root.querySelector("tec-separator")!
    expect(el.getBoundingClientRect()).toMatchObject({ width: 1, height: 20 })
    expect(line(el).getBoundingClientRect().height).toBe(20)
    expect(await axNode(el)).toMatchObject({ role: "separator", orientation: "vertical" })
    await expectAccessible(root)
  })

  it("maps emphasis to the three border levels", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-separator emphasis="subtle"></tec-separator><tec-separator emphasis="strong"></tec-separator>
    </div>`)
    const [subtle, strong] = [...root.querySelectorAll("tec-separator")]
    expect(getComputedStyle(line(subtle!)).backgroundColor).toBe(resolve(root, "var(--tec-border-subtle)"))
    expect(getComputedStyle(line(strong!)).backgroundColor).toBe(resolve(root, "var(--tec-border-strong)"))
  })

  it("decorative separators have no role", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-separator decorative></tec-separator></div>`)
    expect(await axTree(root)).toEqual([])
  })

  it("renders a labelled divider whose label is read as text", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 300px"><tec-separator emphasis="subtle">or</tec-separator></div>`)
    const el = root.querySelector("tec-separator")!
    expect(el.matches(":state(labelled)")).toBe(true)
    const [start, end] = [...el.shadowRoot!.querySelectorAll(".line")]
    expect(start!.getBoundingClientRect().height).toBe(1)
    expect(start!.getBoundingClientRect().width).toBeGreaterThan(100)
    expect(end!.getBoundingClientRect().width).toBe(start!.getBoundingClientRect().width)
    expect((await axNode(el)).role).not.toBe("separator")
    expect(await axTree(root)).not.toContain("separator")
    expect(root.textContent).toContain("or")
    await expectAccessible(root)
  })

  it("mirrors in RTL (logical layout)", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 300px" dir="rtl"><tec-separator align-label="start">أو</tec-separator></div>`)
    const el = root.querySelector("tec-separator")!
    const start = el.shadowRoot!.querySelector(".line.start")!.getBoundingClientRect()
    expect(start.width).toBe(16)
    expect(start.right).toBe(root.getBoundingClientRect().right)
  })
})
