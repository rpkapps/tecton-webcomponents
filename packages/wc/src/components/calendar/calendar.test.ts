import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecCalendar } from "./calendar.js"
import type { TecRangeCalendar } from "./range-calendar.js"
import "./define.js"

const cell = (el: HTMLElement, iso: string) => el.shadowRoot!.querySelector<HTMLElement>(`.cell[data-date="${iso}"]`)!
const focusedIso = () => (deepActiveElement() as HTMLElement | null)?.getAttribute("data-date")
const headings = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll(".heading")].map((h) => h.textContent)

describe("tec-calendar", () => {
  it("renders the month of its value as an accessible grid", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" locale="en-US"></tec-calendar>`)
    expect(headings(el)).toEqual(["September 2026"])
    const grid = el.shadowRoot!.querySelector("table")!
    expect(grid.getAttribute("role")).toBe("grid")
    expect(grid.getAttribute("aria-label")).toBe("September 2026")
    const selected = cell(el, "2026-09-10")
    expect(selected.getAttribute("tabindex")).toBe("0")
    expect(selected.closest("td")!.getAttribute("aria-selected")).toBe("true")
    expect(selected.getAttribute("aria-label")).toContain("Thursday, September 10, 2026 selected")
    // Outside-month days are shown, dimmed and not focusable.
    expect(cell(el, "2026-08-30").hasAttribute("data-outside-month")).toBe(true)
    expect(cell(el, "2026-08-30").hasAttribute("tabindex")).toBe(false)
    expect(el.shadowRoot!.querySelectorAll("thead th")).toHaveLength(7)
    await expectAccessible(el)
  })

  it("selects with a click and fires input + change", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" locale="en-US"></tec-calendar>`)
    const changes = recordEvents(el, "change")
    const inputs = recordEvents(el, "input")
    await userEvent.click(cell(el, "2026-09-15"), { force: true })
    expect(el.value).toBe("2026-09-15")
    expect(changes.events).toHaveLength(1)
    expect(inputs.events).toHaveLength(1)
    expect(changes.events[0]!.composed).toBe(true)
    expect(el.getAttribute("value")).toBe("2026-09-10")
    el.value = "2026-09-20"
    await el.updateComplete
    expect(changes.events).toHaveLength(1)
    expect(cell(el, "2026-09-20").hasAttribute("data-selected")).toBe(true)
  })

  it("follows the APG date grid keyboard model", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" locale="en-US"></tec-calendar>`)
    el.focus()
    expect(focusedIso()).toBe("2026-09-10")
    await userEvent.keyboard("{ArrowRight}")
    expect(focusedIso()).toBe("2026-09-11")
    await userEvent.keyboard("{ArrowDown}")
    expect(focusedIso()).toBe("2026-09-18")
    await userEvent.keyboard("{ArrowLeft}{ArrowUp}")
    expect(focusedIso()).toBe("2026-09-10")
    await userEvent.keyboard("{Home}")
    expect(focusedIso()).toBe("2026-09-06")
    await userEvent.keyboard("{End}")
    expect(focusedIso()).toBe("2026-09-12")
    await userEvent.keyboard("{PageDown}")
    expect(focusedIso()).toBe("2026-10-12")
    expect(headings(el)).toEqual(["October 2026"])
    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}")
    expect(focusedIso()).toBe("2025-10-12")
    await userEvent.keyboard("{PageUp}")
    expect(focusedIso()).toBe("2025-09-12")
    await userEvent.keyboard("{Enter}")
    expect(el.value).toBe("2025-09-12")
    await userEvent.keyboard("{ArrowRight} ")
    expect(el.value).toBe("2025-09-13")
  })

  it("mirrors the arrow keys in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div dir="rtl"><tec-calendar value="2026-09-10" locale="en-US"></tec-calendar></div>`)
    const el = root.querySelector("tec-calendar")!
    el.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(focusedIso()).toBe("2026-09-11")
  })

  it("pages with the previous and next buttons and announces the month", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" locale="en-US"></tec-calendar>`)
    const next = el.shadowRoot!.querySelector<HTMLElement>(".next")!
    expect(await axNode(next.shadowRoot!.querySelector("button")!)).toMatchObject({ role: "button", name: "Next" })
    await userEvent.click(next)
    await el.updateComplete
    expect(headings(el)).toEqual(["October 2026"])
    await el.updateComplete
    expect(el.shadowRoot!.querySelector("[aria-live]")!.textContent).toBe("October 2026")
    await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>(".previous")!)
    await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>(".previous")!)
    expect(headings(el)).toEqual(["August 2026"])
  })

  it("honours min, max and unavailable dates", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" min="2026-09-05" max="2026-09-25" locale="en-US"></tec-calendar>`)
    el.isDateUnavailable = (d) => d.toString() === "2026-09-15"
    await el.updateComplete
    expect(cell(el, "2026-09-04").hasAttribute("data-disabled")).toBe(true)
    expect(cell(el, "2026-09-04").hasAttribute("tabindex")).toBe(false)
    expect(cell(el, "2026-09-15").hasAttribute("data-unavailable")).toBe(true)
    expect(cell(el, "2026-09-15").getAttribute("tabindex")).toBe("-1")
    await userEvent.click(cell(el, "2026-09-15"), { force: true })
    expect(el.value).toBe("2026-09-10")
    const prev = el.shadowRoot!.querySelector<HTMLElement & { disabled: boolean }>(".previous")!
    expect(prev.disabled).toBe(true)
    // Keyboard focus stops at the bounds.
    el.focus()
    await userEvent.keyboard("{PageUp}")
    expect(focusedIso()).toBe("2026-09-05")
    await expectAccessible(el)
  })

  it("shows several months and week numbers", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar visible-months="2" show-week-number value="2026-01-05" locale="en-GB"></tec-calendar>`)
    expect(headings(el)).toEqual(["January 2026", "February 2026"])
    // en-GB weeks start on Monday; ISO week numbers.
    expect(el.shadowRoot!.querySelector(".weekday:nth-child(2)")!.textContent).toBe("M")
    expect([...el.shadowRoot!.querySelectorAll(".week-number")].slice(0, 2).map((w) => w.textContent)).toEqual(["1", "2"])
    // Paging moves by the number of visible months.
    await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>(".next")!)
    expect(headings(el)).toEqual(["March 2026", "April 2026"])
  })

  it("localizes names, first day of week and honours first-day-of-week", async () => {
    const el = await fixture<TecCalendar>(html`<div lang="de"><tec-calendar value="2026-03-10"></tec-calendar></div>`)
    const cal = el.querySelector("tec-calendar")!
    expect(headings(cal)).toEqual(["März 2026"])
    expect(cal.shadowRoot!.querySelector(".previous")!.getAttribute("aria-label")).toBe("Zurück")
    expect(cal.shadowRoot!.querySelector(".weekday")!.textContent).toBe("M")
    cal.firstDayOfWeek = "sun"
    await cal.updateComplete
    expect(cal.shadowRoot!.querySelector(".weekday")!.textContent).toBe("S")
  })

  it("has month and year dropdowns", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar caption-layout="dropdown" value="2026-09-10" locale="en-US"></tec-calendar>`)
    const [month, year] = [...el.shadowRoot!.querySelectorAll("select")]
    expect(month!.getAttribute("aria-label")).toBe("month")
    expect(month!.selectedOptions[0]!.textContent).toBe("Sep")
    expect(year!.selectedOptions[0]!.textContent).toBe("2026")
    await userEvent.selectOptions(month!, "3")
    expect(el.focusedDate).toBe("2026-03-10")
    await el.updateComplete
    const y = el.shadowRoot!.querySelectorAll("select")[1]!
    await userEvent.selectOptions(y, [...y.options].find((o) => o.textContent === "2020")!)
    expect(el.focusedDate).toBe("2020-03-10")
    await expectAccessible(el)
  })

  it("renders custom day content", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar value="2026-09-10" locale="en-US"></tec-calendar>`)
    el.renderDay = (day) => {
      const price = document.createElement("span")
      price.textContent = day.isWeekend ? "$120" : "$100"
      return [day.formatted, price]
    }
    await el.updateComplete
    expect(cell(el, "2026-09-12").textContent).toBe("12$120")
    expect(cell(el, "2026-09-10").textContent).toBe("10$100")
  })

  it("selects several days with multiple and submits each", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-calendar name="d" multiple value="2026-09-10 2026-09-12" locale="en-US"></tec-calendar></form>`)
    const el = form.querySelector("tec-calendar")!
    expect(el.values).toEqual(["2026-09-10", "2026-09-12"])
    await userEvent.click(cell(el, "2026-09-11"))
    await userEvent.click(cell(el, "2026-09-10"))
    expect(el.values).toEqual(["2026-09-11", "2026-09-12"])
    expect(new FormData(form).getAll("d")).toEqual(["2026-09-11", "2026-09-12"])
  })

  it("participates in forms: value, required, reset", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-calendar name="when" required locale="en-US" focused-date="2026-09-01"></tec-calendar></form>`)
    const el = form.querySelector("tec-calendar")!
    expect(el.checkValidity()).toBe(false)
    expect(el.validity.valueMissing).toBe(true)
    await userEvent.click(cell(el, "2026-09-03"))
    expect(el.checkValidity()).toBe(true)
    expect(new FormData(form).get("when")).toBe("2026-09-03")
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("")
  })

  it("is labelled by the label attribute", async () => {
    const el = await fixture<TecCalendar>(html`<tec-calendar label="Spud date" value="2026-09-10" locale="en-US"></tec-calendar>`)
    expect(await axNode(el.shadowRoot!.querySelector(".base")!)).toMatchObject({ role: "application", name: "Spud date, September 2026" })
  })
})

describe("tec-range-calendar", () => {
  it("renders the range band and selects a new range with two clicks", async () => {
    const el = await fixture<TecRangeCalendar>(html`<tec-range-calendar value="2026-09-08/2026-09-12" locale="en-US"></tec-range-calendar>`)
    expect(cell(el, "2026-09-08").getAttribute("data-selection")).toBe("start")
    expect(cell(el, "2026-09-10").getAttribute("data-selection")).toBe("middle")
    expect(cell(el, "2026-09-12").getAttribute("data-selection")).toBe("end")
    expect(el.shadowRoot!.querySelector("table")!.getAttribute("aria-multiselectable")).toBe("true")
    const changes = recordEvents(el, "change")
    await userEvent.click(cell(el, "2026-09-20"))
    expect(el.matches(":state(selecting)")).toBe(true)
    await userEvent.hover(cell(el, "2026-09-23"))
    expect(cell(el, "2026-09-22").getAttribute("data-selection")).toBe("middle")
    await userEvent.click(cell(el, "2026-09-23"))
    expect(el.value).toBe("2026-09-20/2026-09-23")
    expect(el.start).toBe("2026-09-20")
    expect(el.end).toBe("2026-09-23")
    expect(changes.events).toHaveLength(1)
    await expectAccessible(el)
  })

  it("selects with the keyboard and cancels with Escape", async () => {
    const el = await fixture<TecRangeCalendar>(html`<tec-range-calendar locale="en-US" focused-date="2026-09-10"></tec-range-calendar>`)
    el.focus()
    await userEvent.keyboard("{Enter}")
    // Focus advances by a day, previewing the range.
    expect(focusedIso()).toBe("2026-09-11")
    await userEvent.keyboard("{Escape}")
    expect(el.matches(":state(selecting)")).toBe(false)
    await userEvent.keyboard("{Enter}{ArrowRight}{ArrowRight}{Enter}")
    expect(el.value).toBe("2026-09-11/2026-09-14")
  })

  it("does not let a range cross an unavailable day", async () => {
    const el = await fixture<TecRangeCalendar>(html`<tec-range-calendar locale="en-US" focused-date="2026-09-10"></tec-range-calendar>`)
    el.isDateUnavailable = (d) => d.toString() === "2026-09-15"
    await el.updateComplete
    await userEvent.click(cell(el, "2026-09-10"))
    expect(cell(el, "2026-09-20").hasAttribute("data-disabled")).toBe(true)
    await userEvent.click(cell(el, "2026-09-14"))
    expect(el.value).toBe("2026-09-10/2026-09-14")
  })

  it("submits start-name / end-name entries", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-range-calendar start-name="from" end-name="to" value="2026-09-08/2026-09-12"></tec-range-calendar></form>`)
    const data = new FormData(form)
    expect(data.get("from")).toBe("2026-09-08")
    expect(data.get("to")).toBe("2026-09-12")
  })
})
