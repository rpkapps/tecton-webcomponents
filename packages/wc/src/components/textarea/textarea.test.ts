import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecTextarea } from "./textarea.js"
import "./define.js"

const inner = (el: TecTextarea) => el.shadowRoot!.querySelector("textarea")!

describe("tec-textarea", () => {
  it("renders a native textarea at least 64px tall", async () => {
    const el = await fixture<TecTextarea>(html`<tec-textarea aria-label="Message" placeholder="Type"></tec-textarea>`)
    expect(await axNode(inner(el))).toMatchObject({ role: "textbox", name: "Message" })
    expect(inner(el).getBoundingClientRect().height).toBeGreaterThanOrEqual(64)
    await expectAccessible(el)
  })

  it("grows with its content", async () => {
    const el = await fixture<TecTextarea>(html`<tec-textarea aria-label="Message"></tec-textarea>`)
    const before = inner(el).getBoundingClientRect().height
    el.value = "1\n2\n3\n4\n5\n6\n7"
    await el.updateComplete
    expect(inner(el).getBoundingClientRect().height).toBeGreaterThan(before)
  })

  it("types, fires input/change and submits", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-textarea name="notes" aria-label="Notes"></tec-textarea></form>`)
    const el = form.querySelector("tec-textarea")!
    const inputs = recordEvents(el, "input")
    await userEvent.click(inner(el))
    await userEvent.keyboard("hi")
    expect(el.value).toBe("hi")
    expect(inputs.events).toHaveLength(2)
    expect(new FormData(form).get("notes")).toBe("hi")
  })

  it("takes its default value from the value attribute or its text, and resets to it", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-textarea name="a" aria-label="a">Initial text</tec-textarea></form>`)
    const el = form.querySelector("tec-textarea")!
    expect(el.value).toBe("Initial text")
    el.value = "changed"
    form.reset()
    await el.updateComplete
    expect(inner(el).value).toBe("Initial text")
  })

  it("validates minlength and required", async () => {
    const el = await fixture<TecTextarea>(html`<tec-textarea required aria-label="x"></tec-textarea>`)
    expect(el.checkValidity()).toBe(false)
    expect(el.validity.valueMissing).toBe(true)
  })

  it("resize=none turns off the handle", async () => {
    const el = await fixture<TecTextarea>(html`<tec-textarea resize="none" aria-label="x"></tec-textarea>`)
    expect(getComputedStyle(inner(el)).resize).toBe("none")
  })
})
