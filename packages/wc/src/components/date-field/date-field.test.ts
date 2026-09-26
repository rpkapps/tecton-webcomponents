import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecDateField, TecTimeField } from "./date-field.js"
import "./define.js"

const segments = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".segment")]
const texts = (el: HTMLElement) => segments(el).map((s) => s.textContent)
const active = () => deepActiveElement() as HTMLElement | null

describe("tec-date-field", () => {
  it("renders locale-ordered spinbutton segments", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="d">Birthday</label><tec-date-field id="d" locale="en-US" value="2026-09-26"></tec-date-field></div>`)
    const el = root.querySelector("tec-date-field")!
    expect(texts(el)).toEqual(["9", "26", "2026"])
    const [month] = segments(el)
    expect(await axNode(month!)).toMatchObject({ role: "spinbutton", name: "month Birthday" })
    expect(month!.getAttribute("aria-valuetext")).toBe("9 \u2013 September")
    expect(month!.getAttribute("aria-valuemax")).toBe("12")
    await expectAccessible(root)
  })

  it("shows localized placeholders and order", async () => {
    const de = await fixture<TecDateField>(html`<tec-date-field locale="de-DE" aria-label="Datum"></tec-date-field>`)
    expect(texts(de)).toEqual(["tt", "mm", "jjjj"])
    expect(de.shadowRoot!.querySelector(".literal")!.textContent).toBe(".")
    const us = await fixture<TecDateField>(html`<tec-date-field locale="en-US" aria-label="Date"></tec-date-field>`)
    expect(texts(us)).toEqual(["mm", "dd", "yyyy"])
    expect(segments(us)[0]!.getAttribute("aria-valuetext")).toBe("Empty")
  })

  it("accepts typing, auto-advances and commits a complete date", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field locale="en-US" aria-label="Date"></tec-date-field>`)
    const changes = recordEvents(el, "change")
    el.focus()
    expect(active()?.dataset.type).toBe("month")
    await userEvent.keyboard("3")
    // 3 cannot start a two-digit month: moves on.
    expect(active()?.dataset.type).toBe("day")
    await userEvent.keyboard("1")
    expect(active()?.dataset.type).toBe("day")
    await userEvent.keyboard("5")
    expect(active()?.dataset.type).toBe("year")
    expect(el.value).toBe("")
    expect(el.isPartial).toBe(true)
    expect(el.validity.badInput).toBe(true)
    await userEvent.keyboard("2026")
    expect(el.value).toBe("2026-03-15")
    expect(el.validity.valid).toBe(true)
    // Like a native date input, each keystroke that yields a complete date commits it (year 2, 20, 202, 2026).
    expect(changes.events).toHaveLength(4)
  })

  it("steps with arrows, Page keys, Home/End and moves with left/right", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field locale="en-US" value="2026-01-31" aria-label="Date"></tec-date-field>`)
    segments(el)[0]!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(texts(el)[0]).toBe("12")
    await userEvent.keyboard("{ArrowUp}{ArrowUp}")
    // February 31 does not exist: the value empties until the day is fixed (or the field is left).
    expect(texts(el)[0]).toBe("2")
    expect(el.value).toBe("")
    await userEvent.keyboard("{ArrowRight}")
    expect(active()?.dataset.type).toBe("day")
    await userEvent.keyboard("{Home}")
    expect(el.value).toBe("2026-02-01")
    await userEvent.keyboard("{PageUp}")
    expect(el.value).toBe("2026-02-08")
    // Page Down steps the month by 2 and wraps within the year.
    await userEvent.keyboard("{ArrowLeft}{PageDown}")
    expect(el.value).toBe("2026-12-08")
  })

  it("clears with Backspace and moves back from an empty segment", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field locale="en-US" value="2026-09-26" aria-label="Date"></tec-date-field>`)
    const changes = recordEvents(el, "change")
    segments(el)[1]!.focus()
    await userEvent.keyboard("{Backspace}")
    expect(texts(el)[1]).toBe("2")
    await userEvent.keyboard("{Backspace}")
    expect(texts(el)[1]).toBe("dd")
    expect(el.value).toBe("")
    await userEvent.keyboard("{Backspace}")
    expect(active()?.dataset.type).toBe("month")
    expect(changes.events.length).toBeGreaterThan(0)
  })

  it("constrains an impossible day on blur", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-date-field locale="en-US" value="2026-01-31" aria-label="Date"></tec-date-field><button>after</button></div>`)
    const el = root.querySelector("tec-date-field")!
    segments(el)[0]!.focus()
    await userEvent.keyboard("{ArrowUp}")
    expect(el.value).toBe("")
    root.querySelector("button")!.focus()
    await el.updateComplete
    expect(el.value).toBe("2026-02-28")
  })

  it("edits a date and time with the granularity", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field locale="en-US" granularity="minute" value="2026-09-26T14:05" aria-label="Start"></tec-date-field>`)
    expect(texts(el)).toEqual(["9", "26", "2026", "2", "05", "PM"])
    segments(el)[5]!.focus()
    await userEvent.keyboard("a")
    expect(el.value).toBe("2026-09-26T02:05")
  })

  it("validates required, min, max and unavailable dates", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-date-field name="d" required min="2026-01-01" max="2026-12-31" locale="en-US" aria-label="D"></tec-date-field></form>`)
    const el = form.querySelector("tec-date-field")!
    expect(el.validity.valueMissing).toBe(true)
    el.value = "2025-06-01"
    await el.updateComplete
    expect(el.validity.rangeUnderflow).toBe(true)
    expect(el.validationMessage).toBe("Value must be 1/1/2026 or later.")
    el.value = "2027-06-01"
    await el.updateComplete
    expect(el.validity.rangeOverflow).toBe(true)
    el.isDateUnavailable = (d) => d.day === 13
    el.value = "2026-03-13"
    await el.updateComplete
    expect(el.validity.badInput).toBe(true)
    el.value = "2026-03-14"
    await el.updateComplete
    expect(el.checkValidity()).toBe(true)
    expect(new FormData(form).get("d")).toBe("2026-03-14")
    form.reset()
    await el.updateComplete
    expect(texts(el)).toEqual(["mm", "dd", "yyyy"])
  })

  it("marks invalid segments after a submit attempt", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field required locale="en-US" aria-label="D"></tec-date-field>`)
    el.reportValidity()
    await el.updateComplete
    expect(el.matches(":state(user-invalid)")).toBe(true)
    expect(segments(el)[0]!.getAttribute("aria-invalid")).toBe("true")
  })

  it("is disabled and readonly", async () => {
    const el = await fixture<TecDateField>(html`<tec-date-field disabled locale="en-US" value="2026-09-26" aria-label="D"></tec-date-field>`)
    expect(segments(el)[0]!.hasAttribute("tabindex")).toBe(false)
    const ro = await fixture<TecDateField>(html`<tec-date-field readonly locale="en-US" value="2026-09-26" aria-label="D"></tec-date-field>`)
    segments(ro)[0]!.focus()
    await userEvent.keyboard("{ArrowUp}")
    expect(ro.value).toBe("2026-09-26")
  })
})

describe("tec-time-field", () => {
  it("edits a time with seconds and AM/PM", async () => {
    const el = await fixture<TecTimeField>(html`<tec-time-field granularity="second" value="10:30:00" locale="en-US" aria-label="Start time"></tec-time-field>`)
    expect(texts(el)).toEqual(["10", "30", "00", "AM"])
    expect(await axNode(segments(el)[0]!)).toMatchObject({ role: "spinbutton", name: "hour, Start time" })
    expect(segments(el)[0]!.getAttribute("aria-valuetext")).toMatch(/^10\sAM$/)
    segments(el)[0]!.focus()
    // The hour cycles 1–12 and keeps AM/PM (12 AM is midnight).
    await userEvent.keyboard("{ArrowUp}{ArrowUp}")
    expect(el.value).toBe("00:30:00")
    await userEvent.keyboard("{ArrowRight}45")
    expect(el.value).toBe("00:45:00")
    segments(el)[3]!.focus()
    await userEvent.keyboard("p")
    expect(el.value).toBe("12:45:00")
    await expectAccessible(el)
  })

  it("uses a 24-hour clock with hour-cycle=24 and validates min/max", async () => {
    const el = await fixture<TecTimeField>(html`<tec-time-field hour-cycle="24" min="08:00" max="18:00" locale="en-US" aria-label="T"></tec-time-field>`)
    expect(texts(el)).toEqual(["––", "––"])
    el.focus()
    await userEvent.keyboard("2015")
    expect(el.value).toBe("20:15")
    expect(el.validity.rangeOverflow).toBe(true)
  })
})
