import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecInputGroup } from "./input-group.js"
import "./define.js"

const input = (group: Element) => group.querySelector("tec-input-group-input")!.shadowRoot!.querySelector("input")!
const base = (el: Element) => el.shadowRoot!.querySelector(".base")!

describe("tec-input-group", () => {
  it("lays out addons by align, not by markup order", async () => {
    const group = await fixture<TecInputGroup>(html`<tec-input-group>
      <tec-input-group-input aria-label="Search"></tec-input-group-input>
      <tec-input-group-addon><svg width="16" height="16" aria-hidden="true"></svg></tec-input-group-addon>
      <tec-input-group-addon align="inline-end">12 results</tec-input-group-addon>
    </tec-input-group>`)
    const [start, end] = [...group.querySelectorAll("tec-input-group-addon")].map((a) => a.getBoundingClientRect())
    const field = group.querySelector("tec-input-group-input")!.getBoundingClientRect()
    expect(start!.right).toBeLessThanOrEqual(field.left + 1)
    expect(end!.left).toBeGreaterThanOrEqual(field.right - 1)
    expect(group.getBoundingClientRect().height).toBe(32)
    expect(getComputedStyle(input(group)).borderTopWidth).toBe("0px")
    expect(getComputedStyle(input(group)).paddingLeft).toBe("6px")
    expect(await axNode(group)).toMatchObject({ role: "group" })
    await expectAccessible(group)
  })

  it("draws the ring on the group while the input has focus; addon click focuses the input", async () => {
    const group = await fixture<TecInputGroup>(html`<tec-input-group>
      <tec-input-group-input aria-label="Amount"></tec-input-group-input>
      <tec-input-group-addon align="inline-end"><tec-input-group-text>USD</tec-input-group-text></tec-input-group-addon>
    </tec-input-group>`)
    await userEvent.click(group.querySelector("tec-input-group-text")!)
    expect(group.querySelector("tec-input-group-input")!.shadowRoot!.activeElement).toBe(input(group))
    expect(group.matches(":state(focused)")).toBe(true)
    expect(getComputedStyle(base(group)).boxShadow).not.toBe("none")
    input(group).blur()
    await waitUntil(() => !group.matches(":state(focused)"))
  })

  it("shows the control's invalid state on the group", async () => {
    const group = await fixture<TecInputGroup>(html`<tec-input-group><tec-input-group-input aria-label="x" invalid></tec-input-group-input></tec-input-group>`)
    await waitUntil(() => group.matches(":state(invalid)"))
    group.querySelector("tec-input-group-input")!.invalid = false
    await waitUntil(() => !group.matches(":state(invalid)"))
  })

  it("block addons stack and the group grows", async () => {
    const group = await fixture<TecInputGroup>(html`<tec-input-group>
      <tec-input-group-textarea aria-label="Comment"></tec-input-group-textarea>
      <tec-input-group-addon align="block-end"><tec-input-group-text>0/280</tec-input-group-text></tec-input-group-addon>
    </tec-input-group>`)
    await waitUntil(() => group.matches(":state(block)"))
    const addon = group.querySelector("tec-input-group-addon")!.getBoundingClientRect()
    const area = group.querySelector("tec-input-group-textarea")!.getBoundingClientRect()
    expect(addon.top).toBeGreaterThanOrEqual(area.bottom - 1)
    expect(group.getBoundingClientRect().height).toBeGreaterThan(64)
  })

  it("input-group-button is a ghost xs button; its click does not steal focus to the input", async () => {
    const group = await fixture<TecInputGroup>(html`<tec-input-group>
      <tec-input-group-input aria-label="URL"></tec-input-group-input>
      <tec-input-group-addon align="inline-end"><tec-input-group-button aria-label="Copy">C</tec-input-group-button></tec-input-group-addon>
    </tec-input-group>`)
    const button = group.querySelector("tec-input-group-button")!
    expect(button.variant).toBe("ghost")
    expect(button.getBoundingClientRect().height).toBe(24)
    let clicked = 0
    button.addEventListener("click", () => clicked++)
    await userEvent.click(button)
    expect(clicked).toBe(1)
    expect(document.activeElement).toBe(button)
  })

  it("the input submits with its form", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input-group><tec-input-group-input name="q" value="well" aria-label="q"></tec-input-group-input></tec-input-group></form>`)
    expect(new FormData(form).get("q")).toBe("well")
  })
})
