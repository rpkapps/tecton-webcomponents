import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { axActiveDescendant, aTimeout, animationsFinished, axNode, axTree, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { matchesFilter } from "../../internal/listbox-core.js"
import type { TecSelect } from "./select.js"
import "./define.js"

const trigger = (el: TecSelect) => el.shadowRoot!.querySelector<HTMLButtonElement>(".trigger")!
const list = (el: TecSelect) => el.shadowRoot!.querySelector<HTMLElement>(".list")!
const content = (el: TecSelect) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const items = (el: TecSelect) => [...el.querySelectorAll("tec-select-item")]
const active = (el: TecSelect) => items(el).find((i) => i.highlighted) ?? null

const fruits = html`<tec-select-group>
  <tec-select-label>Fruits</tec-select-label>
  <tec-select-item value="apple">Apple</tec-select-item>
  <tec-select-item value="banana">Banana</tec-select-item>
  <tec-select-item value="blueberry">Blueberry</tec-select-item>
  <tec-select-item value="grapes" disabled>Grapes</tec-select-item>
  <tec-select-item value="pineapple">Pineapple</tec-select-item>
</tec-select-group>`

async function opened(el: TecSelect) {
  await waitUntil(() => content(el).matches(":popover-open"), "popup open")
  await animationsFinished(content(el))
}

describe("tec-select", () => {
  it("renders a collapsed listbox button named by value and label", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <label for="fruit">Fruit</label>
      <tec-select id="fruit" placeholder="Select a fruit">${fruits}</tec-select>
    </div>`)
    const el = root.querySelector("tec-select")!
    expect(await axNode(trigger(el))).toMatchObject({ role: "button", name: "Select a fruit Fruit", expanded: "false", hasPopup: "listbox" })
    expect(el.shadowRoot!.querySelector(".value")!.hasAttribute("data-placeholder")).toBe(true)
    expect(el.getBoundingClientRect().height).toBe(32)
    await expectAccessible(root)
  })

  it("opens on click; the listbox gets focus and shows options, groups and the check", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit" value="banana">${fruits}</tec-select>`)
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    await userEvent.click(trigger(el))
    await opened(el)
    expect(el.open).toBe(true)
    expect(events.events[0]!.detail).toEqual({ open: true, reason: "trigger" })
    expect(el.shadowRoot!.activeElement).toBe(list(el))
    expect(await axTree(list(el))).toEqual([
      "listbox: Fruit [focused]",
      "group: Fruits",
      "option: Apple",
      "option: Banana [selected]",
      "option: Blueberry",
      "option: Grapes [disabled]",
      "option: Pineapple",
    ])
    // Pointer open highlights the selected option.
    expect(await axActiveDescendant(list(el), items(el))).toBe(items(el)[1])
    expect(items(el)[1]!.shadowRoot!.querySelector(".indicator svg")).not.toBeNull()
    expect(await axNode(trigger(el))).toMatchObject({ expanded: "true" })
    // Matches the trigger width (min 9rem).
    expect(content(el).getBoundingClientRect().width).toBeGreaterThanOrEqual(144)
    await expectAccessible(el)
  })

  it("keyboard: arrows open and move (skipping disabled), Enter selects and restores focus", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit">${fruits}</tec-select>`)
    const changes = recordEvents(el, "change")
    const inputs = recordEvents(el, "input")
    trigger(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    await opened(el)
    expect(active(el)?.value).toBe("apple")
    expect(await axActiveDescendant(list(el), items(el))).toBe(items(el)[0])
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(active(el)?.value).toBe("pineapple")
    await userEvent.keyboard("{ArrowUp}")
    expect(active(el)?.value).toBe("blueberry")
    await userEvent.keyboard("{Home}")
    expect(active(el)?.value).toBe("apple")
    await userEvent.keyboard("{End}")
    expect(active(el)?.value).toBe("pineapple")
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => !content(el).matches(":popover-open"), "closed")
    expect(el.value).toBe("pineapple")
    expect(changes.events).toHaveLength(1)
    expect(inputs.events).toHaveLength(1)
    expect(changes.events[0]!.composed).toBe(true)
    expect(el.shadowRoot!.activeElement).toBe(trigger(el))
    expect(el.shadowRoot!.querySelector(".value")!.textContent!.trim()).toBe("Pineapple")
    expect(await axNode(trigger(el))).toMatchObject({ name: "Pineapple Fruit", expanded: "false" })
  })

  it("ArrowUp opens on the last option; Enter/Space on the trigger opens on the first", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit">${fruits}</tec-select>`)
    trigger(el).focus()
    await userEvent.keyboard("{ArrowUp}")
    await opened(el)
    expect(active(el)?.value).toBe("pineapple")
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
    expect(el.shadowRoot!.activeElement).toBe(trigger(el))
    await userEvent.keyboard("{Enter}")
    await opened(el)
    expect(active(el)?.value).toBe("apple")
    await userEvent.keyboard(" ")
    await waitUntil(() => !el.open)
    expect(el.value).toBe("apple")
  })

  it("typeahead: on the closed trigger it selects; in the open list it highlights", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit">${fruits}</tec-select>`)
    const changes = recordEvents(el, "change")
    trigger(el).focus()
    await userEvent.keyboard("b")
    expect(el.value).toBe("banana")
    await userEvent.keyboard("b")
    expect(el.value).toBe("blueberry")
    expect(el.open).toBe(false)
    expect(changes.events).toHaveLength(2)
    await userEvent.keyboard("{ArrowDown}")
    await opened(el)
    await userEvent.keyboard("p")
    expect(active(el)?.value).toBe("pineapple")
  })

  it("selects with the pointer; disabled options are ignored", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit">${fruits}</tec-select>`)
    await userEvent.click(trigger(el))
    await opened(el)
    items(el)[3]!.click()
    expect(el.value).toBe("")
    await userEvent.click(items(el)[2]!)
    await waitUntil(() => !el.open)
    expect(el.value).toBe("blueberry")
  })

  it("closes on outside press and on Tab", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-select aria-label="Fruit">${fruits}</tec-select><button>After</button></div>`)
    const el = root.querySelector("tec-select")!
    await userEvent.click(trigger(el))
    await opened(el)
    await userEvent.click(root.querySelector("button")!)
    await waitUntil(() => !el.open, "outside press")
    await userEvent.click(trigger(el))
    await opened(el)
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => !el.open, "tab")
  })

  it("tec-open-change is cancelable", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="Fruit">${fruits}</tec-select>`)
    el.addEventListener("tec-open-change", (e) => e.preventDefault())
    await userEvent.click(trigger(el))
    await aTimeout(50)
    expect(el.open).toBe(false)
  })

  it("multiple: toggles values, stays open, lists the values and submits each", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-select name="fruit" multiple aria-label="Fruits">
        <tec-select-item value="apple" selected>Apple</tec-select-item>
        <tec-select-item value="banana">Banana</tec-select-item>
        <tec-select-item value="cherry">Cherry</tec-select-item>
      </tec-select>
    </form>`)
    const el = form.querySelector("tec-select")!
    expect(el.values).toEqual(["apple"])
    expect(new FormData(form).getAll("fruit")).toEqual(["apple"])
    await userEvent.click(trigger(el))
    await opened(el)
    expect(await axNode(list(el))).toMatchObject({ role: "listbox", multiselectable: "true" })
    await userEvent.click(items(el)[2]!)
    await userEvent.click(items(el)[1]!)
    expect(el.open).toBe(true)
    expect(el.values).toEqual(["apple", "cherry", "banana"])
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".value")!.textContent).toBe("Apple, Banana, and Cherry")
    await userEvent.keyboard("{Home}{Enter}")
    expect(el.values).toEqual(["cherry", "banana"])
    expect(new FormData(form).getAll("fruit")).toEqual(["cherry", "banana"])
    form.reset()
    await el.updateComplete
    expect(el.values).toEqual(["apple"])
  })

  it("form: value attribute is the default, required blocks submit, reset restores", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-select name="fruit" required aria-label="Fruit">${fruits}</tec-select><button>Go</button>
    </form>`)
    const el = form.querySelector("tec-select")!
    expect(el.checkValidity()).toBe(false)
    expect(el.validity.valueMissing).toBe(true)
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", onSubmit)
    form.requestSubmit()
    await el.updateComplete
    expect(onSubmit).not.toHaveBeenCalled()
    expect(el.matches(":state(user-invalid)")).toBe(true)
    expect(await axNode(trigger(el))).toMatchObject({ invalid: "true" })
    trigger(el).focus()
    await userEvent.keyboard("a")
    expect(el.value).toBe("apple")
    await el.updateComplete
    expect(el.checkValidity()).toBe(true)
    form.requestSubmit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(new FormData(form).get("fruit")).toBe("apple")
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("")
  })

  it("invalid and disabled", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-select invalid aria-label="A">${fruits}</tec-select>
      <tec-select disabled aria-label="B">${fruits}</tec-select>
    </div>`)
    const [a, b] = root.querySelectorAll("tec-select")
    expect(await axNode(trigger(a!))).toMatchObject({ invalid: "true" })
    expect(getComputedStyle(trigger(a!)).boxShadow).not.toBe("none")
    expect(await axNode(trigger(b!))).toMatchObject({ disabled: "true" })
    await userEvent.click(b!, { force: true })
    expect(b!.open).toBe(false)
  })

  it("variants and sizes", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-select variant="filled" size="sm" aria-label="A">${fruits}</tec-select>
      <tec-select variant="text" aria-label="B">${fruits}</tec-select>
    </div>`)
    const [a, b] = root.querySelectorAll("tec-select")
    expect(a!.getBoundingClientRect().height).toBe(28)
    expect(getComputedStyle(trigger(a!)).borderTopWidth).toBe("0px")
    expect(getComputedStyle(trigger(a!)).borderBottomWidth).toBe("1px")
    expect(getComputedStyle(trigger(b!)).paddingInlineStart).toBe("0px")
    expect(getComputedStyle(trigger(b!)).borderTopLeftRadius).toBe("0px")
  })

  it("searchable: the search field filters, keeps focus and uses aria-activedescendant", async () => {
    const el = await fixture<TecSelect>(html`<tec-select searchable aria-label="Country">
      <tec-select-item value="ar">Argentina</tec-select-item>
      <tec-select-item value="au">Australia</tec-select-item>
      <tec-select-item value="br">Brazil</tec-select-item>
      <tec-select-item value="ca">Canada</tec-select-item>
      <tec-select-empty>No items found.</tec-select-empty>
    </tec-select>`)
    await userEvent.click(trigger(el))
    await opened(el)
    const search = el.shadowRoot!.querySelector("input")!
    expect(el.shadowRoot!.activeElement).toBe(search)
    expect(await axNode(search)).toMatchObject({ role: "searchbox", name: "Search", autocomplete: "list" })
    await userEvent.keyboard("ar")
    await el.updateComplete
    expect(items(el).filter((i) => !i.filtered).map((i) => i.value)).toEqual(["ar"])
    expect(await axActiveDescendant(search, items(el))).toBeNull()
    await userEvent.keyboard("{ArrowDown}")
    expect(await axActiveDescendant(search, items(el))).toBe(items(el)[0])
    await userEvent.keyboard("{Backspace}{Backspace}az")
    await el.updateComplete
    expect(items(el).filter((i) => !i.filtered).map((i) => i.value)).toEqual(["br"])
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await waitUntil(() => !el.open)
    expect(el.value).toBe("br")
    await userEvent.click(trigger(el))
    await opened(el)
    await userEvent.keyboard("zzz")
    await el.updateComplete
    expect(el.querySelector("tec-select-empty")!.matches(":state(shown)")).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(true)
    expect(search.value).toBe("")
    await el.updateComplete
    expect(items(el).every((i) => !i.filtered)).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
  })

  it("rtl: the check sits at the inline end", async () => {
    const el = await fixture<TecSelect>(html`<tec-select aria-label="فاكهة" value="a"><tec-select-item value="a">تفاح</tec-select-item></tec-select>`, { dir: "rtl" })
    await userEvent.click(trigger(el))
    await opened(el)
    const item = items(el)[0]!
    const check = item.shadowRoot!.querySelector(".indicator")!.getBoundingClientRect()
    const base = item.getBoundingClientRect()
    expect(check.left - base.left).toBeLessThan(20)
  })

  it("filter helper", () => {
    expect(matchesFilter("São Paulo", "sao")).toBe(true)
    expect(matchesFilter("Settings", "stg", "fuzzy")).toBe(true)
    expect(matchesFilter("Settings", "tings", "starts-with")).toBe(false)
    expect(matchesFilter("Settings", "x", () => true)).toBe(true)
  })
})
