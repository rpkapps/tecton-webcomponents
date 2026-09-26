import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecDatePicker } from "./date-picker.js"
import type { TecDateRangePicker } from "./date-range-picker.js"
import "./define.js"

const panel = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const trigger = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>(".trigger")!
const calendar = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>(".calendar")!
const day = (el: HTMLElement, iso: string) => calendar(el).shadowRoot!.querySelector<HTMLElement>(`.cell[data-date="${iso}"]`)!
const segments = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".segment")]

async function openPicker(el: HTMLElement) {
  await userEvent.click(trigger(el))
  await waitUntil(() => panel(el).matches(":popover-open"))
  await animationsFinished(panel(el))
}

describe("tec-date-picker", () => {
  it("opens the calendar on the value, focuses it and picks a date", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="p">Due date</label><tec-date-picker id="p" locale="en-US" value="2026-09-10"></tec-date-picker></div>`)
    const el = root.querySelector("tec-date-picker")!
    expect(await axNode(el.shadowRoot!.querySelector("button")!)).toMatchObject({ role: "button", name: "Calendar Due date", hasPopup: "dialog", expanded: "false" })
    expect(await axNode(segments(el)[0]!)).toMatchObject({ role: "spinbutton", name: "month Due date" })
    const opens = recordEvents<CustomEvent>(el, "tec-open-change")
    const changes = recordEvents(el, "change")
    await openPicker(el)
    expect(el.open).toBe(true)
    expect(opens.events[0]!.detail).toEqual({ open: true, reason: "trigger" })
    expect((deepActiveElement() as HTMLElement).getAttribute("data-date")).toBe("2026-09-10")
    expect(await axNode(panel(el))).toMatchObject({ role: "dialog", name: "Due date" })
    await expectAccessible(root)
    await userEvent.keyboard("{ArrowRight}{Enter}")
    expect(el.value).toBe("2026-09-11")
    expect(changes.events).toHaveLength(1)
    await waitUntil(() => !panel(el).matches(":popover-open"))
    expect(el.open).toBe(false)
    expect(deepActiveElement()).toBe(trigger(el))
    expect(segments(el).map((s) => s.textContent)).toEqual(["9", "11", "2026"])
  })

  it("keeps the inner calendar's events inside", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-date-picker locale="en-US" value="2026-09-10" aria-label="D"></tec-date-picker></div>`)
    const el = root.querySelector("tec-date-picker")!
    const changes = recordEvents(root, "change")
    await openPicker(el)
    await userEvent.click(day(el, "2026-09-20"))
    expect(el.value).toBe("2026-09-20")
    expect(changes.events).toHaveLength(1)
    expect(changes.events[0]!.target).toBe(el)
  })

  it("opens with Alt+ArrowDown and closes with Escape", async () => {
    const el = await fixture<TecDatePicker>(html`<tec-date-picker locale="en-US" aria-label="D"></tec-date-picker>`)
    el.focus()
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await waitUntil(() => panel(el).matches(":popover-open"))
    await animationsFinished(panel(el))
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
  })

  it("types a date into the field", async () => {
    const el = await fixture<TecDatePicker>(html`<tec-date-picker locale="en-US" aria-label="D"></tec-date-picker>`)
    el.focus()
    await userEvent.keyboard("06012025")
    expect(el.value).toBe("2025-06-01")
  })

  it("button appearance shows the formatted value and is labelled", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="b">Date</label><tec-date-picker id="b" appearance="button" locale="en-US"></tec-date-picker></div>`)
    const el = root.querySelector("tec-date-picker")!
    const button = el.shadowRoot!.querySelector("button")!
    expect(button.textContent!.trim()).toBe("Pick a date")
    expect(await axNode(button)).toMatchObject({ role: "button", name: "Date Pick a date", hasPopup: "dialog" })
    el.value = "2026-09-26"
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".value")!.textContent).toBe("September 26, 2026")
    await openPicker(el)
    await expectAccessible(root)
  })

  it("keeps the time when picking a day with a time granularity", async () => {
    const el = await fixture<TecDatePicker>(html`<tec-date-picker granularity="minute" locale="en-US" value="2026-09-10T09:45" aria-label="D"></tec-date-picker>`)
    await openPicker(el)
    await userEvent.click(day(el, "2026-09-12"))
    expect(el.value).toBe("2026-09-12T09:45")
  })

  it("validates in forms (required, min, max, unavailable)", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-date-picker name="d" required min="2026-09-05" locale="en-US" aria-label="D"></tec-date-picker></form>`)
    const el = form.querySelector("tec-date-picker")!
    expect(form.checkValidity()).toBe(false)
    expect(el.validity.valueMissing).toBe(true)
    el.value = "2026-09-01"
    await el.updateComplete
    expect(el.validity.rangeUnderflow).toBe(true)
    el.isDateUnavailable = (d) => d.toString() === "2026-09-07"
    el.value = "2026-09-07"
    await el.updateComplete
    expect(el.validity.badInput).toBe(true)
    el.value = "2026-09-08"
    await el.updateComplete
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).get("d")).toBe("2026-09-08")
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("")
  })

  it("can veto opening", async () => {
    const el = await fixture<TecDatePicker>(html`<tec-date-picker locale="en-US" aria-label="D"></tec-date-picker>`)
    el.addEventListener("tec-open-change", (e) => e.preventDefault())
    await userEvent.click(trigger(el))
    expect(el.open).toBe(false)
  })
})

describe("tec-date-range-picker", () => {
  it("edits two fields and picks a range in the calendar", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-date-range-picker name="stay" locale="en-US" value="2026-01-20/2026-02-09" aria-label="Stay"></tec-date-range-picker></form>`)
    const el = form.querySelector<TecDateRangePicker>("tec-date-range-picker")!
    expect(segments(el).map((s) => s.textContent)).toEqual(["1", "20", "2026", "2", "9", "2026"])
    expect(await axNode(segments(el)[3]!)).toMatchObject({ name: "month, Stay, End date" })
    expect(new FormData(form).get("stay")).toBe("2026-01-20/2026-02-09")
    await openPicker(el)
    await userEvent.click(day(el, "2026-01-05"))
    await userEvent.click(day(el, "2026-01-08"))
    expect(el.value).toBe("2026-01-05/2026-01-08")
    await waitUntil(() => !el.open)
    await expectAccessible(el)
  })

  it("flags incomplete and reversed ranges", async () => {
    const el = await fixture<TecDateRangePicker>(html`<tec-date-range-picker locale="en-US" value="2026-03-10/2026-03-01" aria-label="R"></tec-date-range-picker>`)
    expect(el.validity.badInput).toBe(true)
    segments(el)[3]!.focus()
    await userEvent.keyboard("{Backspace}{Backspace}")
    expect(el.value).toBe("")
    expect(el.isPartial).toBe(true)
    expect(el.validity.badInput).toBe(true)
  })

  it("submits start-name / end-name entries and formats the button", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-date-range-picker appearance="button" start-name="from" end-name="to" locale="en-US" value="2026-01-20/2026-02-09"></tec-date-range-picker></form>`)
    const el = form.querySelector("tec-date-range-picker")!
    const data = new FormData(form)
    expect([data.get("from"), data.get("to")]).toEqual(["2026-01-20", "2026-02-09"])
    expect(el.shadowRoot!.querySelector(".value")!.textContent).toMatch(/^January 20\s–\sFebruary 9, 2026$/)
  })
})
