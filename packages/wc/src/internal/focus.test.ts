import { html, LitElement } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { defineElement } from "./define.js"
import { containsFlat, deepActiveElement, focusFirst, FocusTrap, getTabbables, isTabbable } from "./focus.js"
import { fixture } from "./test-utils.js"

class TestWrapper extends LitElement {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }
  render() {
    return html`<button id="inner">inner</button><slot></slot><button id="last" disabled>disabled</button>`
  }
}
defineElement("test-wrapper", TestWrapper)

describe("focus utilities", () => {
  it("getTabbables walks shadow roots and slots in flat-tree order, skipping disabled, hidden and inert", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <button id="a">a</button>
      <test-wrapper><input id="slotted" /><button id="hidden" hidden>h</button></test-wrapper>
      <div inert><button id="inert">i</button></div>
      <a id="no-href">not a link</a>
      <a id="link" href="#">link</a>
      <div tabindex="-1" id="minus">-1</div>
      <div tabindex="0" id="zero">0</div>
    </div>`)
    const ids = getTabbables(root).map((el) => el.id)
    expect(ids).toEqual(["a", "inner", "slotted", "link", "zero"])
    expect(isTabbable(root.querySelector("#minus")!)).toBe(false)
  })

  it("containsFlat follows slots and shadow hosts", async () => {
    const root = await fixture<HTMLElement>(html`<div><test-wrapper><span id="s">x</span></test-wrapper></div>`)
    const wrapper = root.querySelector("test-wrapper")!
    const inner = wrapper.shadowRoot!.querySelector("#inner")!
    const slot = wrapper.shadowRoot!.querySelector("slot")!
    expect(containsFlat(root, inner)).toBe(true)
    expect(containsFlat(slot, root.querySelector("#s"))).toBe(true)
    expect(containsFlat(inner, root)).toBe(false)
  })

  it("deepActiveElement and focusFirst", async () => {
    const root = await fixture<HTMLElement>(html`<div tabindex="-1"><test-wrapper></test-wrapper></div>`)
    const target = focusFirst(root)
    expect(target.id).toBe("inner")
    expect(deepActiveElement()).toBe(target)
  })

  it("FocusTrap wraps Tab and Shift+Tab", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <button id="outside">outside</button>
      <div id="box"><button id="one">1</button><button id="two">2</button></div>
    </div>`)
    const box = root.querySelector<HTMLElement>("#box")!
    const trap = new FocusTrap(() => box)
    trap.activate()
    root.querySelector<HTMLElement>("#two")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()?.id).toBe("one")
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()?.id).toBe("two")
    trap.deactivate()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()?.id).not.toBe("one")
  })
})
