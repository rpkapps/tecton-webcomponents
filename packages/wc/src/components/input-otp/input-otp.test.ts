import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecInputOtp } from "./input-otp.js"
import "./define.js"

const six = html`<tec-input-otp-group>
    <tec-input-otp-slot></tec-input-otp-slot><tec-input-otp-slot></tec-input-otp-slot><tec-input-otp-slot></tec-input-otp-slot>
  </tec-input-otp-group>
  <tec-input-otp-separator></tec-input-otp-separator>
  <tec-input-otp-group>
    <tec-input-otp-slot></tec-input-otp-slot><tec-input-otp-slot></tec-input-otp-slot><tec-input-otp-slot></tec-input-otp-slot>
  </tec-input-otp-group>`

const input = (el: TecInputOtp) => el.shadowRoot!.querySelector("input")!
const slots = (el: TecInputOtp) => [...el.querySelectorAll("tec-input-otp-slot")]
const chars = (el: TecInputOtp) => slots(el).map((s) => s.shadowRoot!.querySelector(".base")!.textContent!.trim())

describe("tec-input-otp", () => {
  it("renders the default value in the slots; one text field for assistive technology", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp value="123456" aria-label="Code">${six}</tec-input-otp>`)
    await Promise.all(slots(el).map((s) => (s as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete))
    expect(el.length).toBe(6)
    expect(chars(el)).toEqual(["1", "2", "3", "4", "5", "6"])
    expect(input(el).autocomplete).toBe("one-time-code")
    expect(await axNode(input(el))).toMatchObject({ role: "textbox", name: "Code" })
    expect(input(el).value).toBe("123456")
    expect(slots(el)[0]!.getBoundingClientRect().width).toBe(32)
    await expectAccessible(el)
  })

  it("types into the slots, highlights the active slot and fires tec-complete", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp pattern="digits" aria-label="Code">${six}</tec-input-otp>`)
    const complete = recordEvents<CustomEvent>(el, "tec-complete")
    const inputs = recordEvents(el, "input")
    await userEvent.click(slots(el)[0]!, { force: true })
    await waitUntil(() => slots(el)[0]!.matches(":state(active)"))
    expect(input(el).inputMode).toBe("numeric")
    await userEvent.keyboard("12a3")
    expect(el.value).toBe("123")
    expect(inputs.events).toHaveLength(3)
    await waitUntil(() => slots(el)[3]!.matches(":state(active)"))
    await userEvent.keyboard("456")
    expect(el.value).toBe("123456")
    expect(complete.events).toHaveLength(1)
    expect(complete.events[0]!.detail).toEqual({ value: "123456" })
  })

  it("clicking a filled slot selects it so typing replaces it; arrows move", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp value="123456" aria-label="Code">${six}</tec-input-otp>`)
    await userEvent.click(slots(el)[2]!, { force: true })
    await waitUntil(() => slots(el)[2]!.matches(":state(active)"))
    expect([input(el).selectionStart, input(el).selectionEnd]).toEqual([2, 3])
    await userEvent.keyboard("9")
    expect(el.value).toBe("129456")
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => input(el).selectionStart === 2)
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => input(el).selectionStart === 1)
    expect(input(el).selectionEnd).toBe(2)
  })

  it("clicking past the value puts the caret in the next empty slot", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp value="12" aria-label="Code">${six}</tec-input-otp>`)
    await userEvent.click(slots(el)[5]!, { force: true })
    await waitUntil(() => slots(el)[2]!.matches(":state(active)"))
    expect(slots(el)[2]!.shadowRoot!.querySelector(".caret")).not.toBeNull()
  })

  it("paste fills the code and rejects what the pattern refuses", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp pattern="digits" aria-label="Code">${six}</tec-input-otp>`)
    input(el).focus()
    const paste = (text: string) => {
      const data = new DataTransfer()
      data.setData("text/plain", text)
      input(el).dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    }
    paste("12a")
    expect(el.value).toBe("")
    paste("987 654")
    expect(el.value).toBe("987654")
  })

  it("submits, requires and resets like a form control", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-input-otp name="otp" required aria-label="Code">${six}</tec-input-otp></form>`)
    const el = form.querySelector("tec-input-otp")!
    expect(el.validity.valueMissing).toBe(true)
    el.value = "111111"
    await el.updateComplete
    expect(new FormData(form).get("otp")).toBe("111111")
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("")
  })

  it("invalid turns the slots destructive; disabled dims", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp invalid disabled aria-label="Code">${six}</tec-input-otp>`)
    await waitUntil(() => slots(el)[0]!.matches(":state(invalid)"))
    expect(el.querySelector("tec-input-otp-group")!.matches(":state(invalid)")).toBe(true)
    expect(input(el).disabled).toBe(true)
    expect(getComputedStyle(el).opacity).toBe("0.5")
  })

  it("explicit index and maxlength", async () => {
    const el = await fixture<TecInputOtp>(html`<tec-input-otp maxlength="2" value="ab" aria-label="x"
      ><tec-input-otp-group><tec-input-otp-slot index="1"></tec-input-otp-slot><tec-input-otp-slot index="0"></tec-input-otp-slot></tec-input-otp-group
    ></tec-input-otp>`)
    await waitUntil(() => chars(el).join("") === "ba")
    expect(input(el).maxLength).toBe(2)
  })
})
