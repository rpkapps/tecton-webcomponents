import { html } from "lit"
import { describe, expect, it } from "vitest"
import { expectAccessible, fixture } from "../../internal/test-utils.js"
import "./define.js"

describe("tec-kbd", () => {
  it("renders a 20px muted key cap in a <kbd>", async () => {
    const root = await fixture<HTMLElement>(html`<p>Press <tec-kbd-group><tec-kbd>Ctrl</tec-kbd><span>+</span><tec-kbd>B</tec-kbd></tec-kbd-group></p>`)
    const kbd = root.querySelector("tec-kbd")!
    const base = kbd.shadowRoot!.querySelector("kbd")!
    expect(base.getBoundingClientRect().height).toBe(20)
    expect(getComputedStyle(base).fontSize).toBe("12px")
    expect(root.querySelector("tec-kbd-group")!.shadowRoot!.querySelector("kbd")).not.toBeNull()
    await expectAccessible(root)
  })

  it("inverts inside a tooltip", async () => {
    const root = await fixture<HTMLElement>(html`<div role="tooltip">Save <tec-kbd>S</tec-kbd><span style="color: var(--tec-background)"></span></div>`)
    const kbd = root.querySelector("tec-kbd")!
    expect(kbd.matches(":state(in-tooltip)")).toBe(true)
    const background = getComputedStyle(root.querySelector("span")!).color
    expect(getComputedStyle(kbd.shadowRoot!.querySelector("kbd")!).color).toBe(background)
  })
})
