import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { axActiveDescendant } from "../select/listbox-test-utils.js"
import type { TecCombobox } from "./combobox.js"
import "./define.js"

const input = (el: TecCombobox) => el.shadowRoot!.querySelector("input")!
const content = (el: TecCombobox) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const list = (el: TecCombobox) => el.shadowRoot!.querySelector<HTMLElement>(".list")!
const items = (el: TecCombobox) => [...el.querySelectorAll("tec-combobox-item")]
const visible = (el: TecCombobox) => items(el).filter((i) => !i.filtered).map((i) => i.value)
const active = (el: TecCombobox) => items(el).find((i) => i.highlighted) ?? null

const frameworks = html`<tec-combobox-item value="next">Next.js</tec-combobox-item>
  <tec-combobox-item value="svelte">SvelteKit</tec-combobox-item>
  <tec-combobox-item value="nuxt">Nuxt.js</tec-combobox-item>
  <tec-combobox-item value="remix" disabled>Remix</tec-combobox-item>
  <tec-combobox-item value="astro">Astro</tec-combobox-item>
  <tec-combobox-empty>No items found.</tec-combobox-empty>`

async function opened(el: TecCombobox) {
  await waitUntil(() => content(el).matches(":popover-open"), "popup open")
  await animationsFinished(content(el))
}

describe("tec-combobox", () => {
  it("renders a named, collapsed combobox input", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <label for="fw">Framework</label>
      <tec-combobox id="fw" placeholder="Select a framework">${frameworks}</tec-combobox>
    </div>`)
    const el = root.querySelector("tec-combobox")!
    expect(await axNode(input(el))).toMatchObject({ role: "combobox", name: "Framework", expanded: "false", autocomplete: "list", hasPopup: "listbox" })
    expect(el.getBoundingClientRect().height).toBe(32)
    await expectAccessible(root)
  })

  it("typing opens and filters; ArrowDown highlights via aria-activedescendant; Enter selects", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Framework">${frameworks}</tec-combobox>`)
    const changes = recordEvents(el, "change")
    const inputChanges = recordEvents<CustomEvent>(el, "tec-input-change")
    const inputs = recordEvents(el, "input")
    input(el).focus()
    await userEvent.keyboard("u")
    await opened(el)
    expect(visible(el)).toEqual(["nuxt"])
    expect(active(el)).toBeNull()
    expect(inputChanges.events.at(-1)!.detail).toEqual({ inputValue: "u" })
    expect(inputs.events).toHaveLength(0) // typing is not a value change
    await userEvent.keyboard("{Backspace}")
    await el.updateComplete
    expect(visible(el)).toEqual(["next", "svelte", "nuxt", "remix", "astro"])
    await userEvent.keyboard("{ArrowDown}")
    expect(active(el)?.value).toBe("next")
    expect(await axActiveDescendant(input(el), items(el))).toBe(items(el)[0])
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(active(el)?.value).toBe("astro") // skips the disabled item
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => !el.open)
    expect(el.value).toBe("astro")
    expect(input(el).value).toBe("Astro")
    expect(changes.events).toHaveLength(1)
    expect(await axNode(input(el))).toMatchObject({ expanded: "false" })
    expect(await axActiveDescendant(input(el), items(el))).toBeNull()
  })

  it("ArrowDown opens with all items and highlights the selected item; Alt+ArrowDown opens without", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Framework" value="nuxt">${frameworks}</tec-combobox>`)
    expect(input(el).value).toBe("Nuxt.js")
    input(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    await opened(el)
    expect(visible(el)).toHaveLength(5)
    expect(active(el)?.value).toBe("nuxt")
    expect(await axTree(list(el))).toEqual([
      "listbox: Framework",
      "option: Next.js",
      "option: SvelteKit",
      "option: Nuxt.js [selected]",
      "option: Remix [disabled]",
      "option: Astro",
    ])
    expect(items(el)[2]!.shadowRoot!.querySelector(".indicator svg")).not.toBeNull()
    await expectAccessible(el)
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}")
    await waitUntil(() => !el.open)
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await opened(el)
    expect(active(el)).toBeNull()
  })

  it("Escape closes (reverting the text), then clears", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Framework" value="next">${frameworks}</tec-combobox>`)
    const changes = recordEvents(el, "change")
    input(el).focus()
    await userEvent.keyboard("{End}xyz")
    await opened(el)
    expect(el.querySelector("tec-combobox-empty")!.matches(":state(shown)")).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
    expect(input(el).value).toBe("Next.js")
    expect(el.value).toBe("next")
    await userEvent.keyboard("{Escape}")
    expect(el.value).toBe("")
    expect(input(el).value).toBe("")
    expect(changes.events).toHaveLength(1)
  })

  it("blur reverts unmatched text; allow-custom-value keeps it", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-combobox aria-label="A" value="next">${frameworks}</tec-combobox>
      <tec-combobox aria-label="B" allow-custom-value>${frameworks}</tec-combobox>
      <button>after</button>
    </div>`)
    const [a, b] = root.querySelectorAll("tec-combobox")
    input(a!).focus()
    await userEvent.keyboard("{Control>}a{/Control}Foo")
    await userEvent.click(root.querySelector("button")!)
    await waitUntil(() => !a!.open)
    await a!.updateComplete
    expect(input(a!).value).toBe("Next.js")
    expect(a!.value).toBe("next")
    input(b!).focus()
    await userEvent.keyboard("Qwik")
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => b!.value === "Qwik")
    expect(input(b!).value).toBe("Qwik")
  })

  it("selects with the pointer and keeps focus in the input", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Framework">${frameworks}</tec-combobox>`)
    await userEvent.click(el.shadowRoot!.querySelector(".trigger")!)
    await opened(el)
    expect(el.shadowRoot!.activeElement).toBe(input(el))
    await userEvent.click(items(el)[1]!)
    await waitUntil(() => !el.open)
    expect(el.value).toBe("svelte")
    expect(el.shadowRoot!.activeElement).toBe(input(el))
  })

  it("show-clear: the clear button replaces the chevron and clears", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Framework" show-clear value="next">${frameworks}</tec-combobox>`)
    const clear = el.shadowRoot!.querySelector<HTMLButtonElement>(".clear")!
    expect(el.shadowRoot!.querySelector(".trigger")).toBeNull()
    expect(await axNode(clear)).toMatchObject({ role: "button", name: "Clear" })
    await userEvent.click(clear)
    expect(el.value).toBe("")
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".clear")).toBeNull()
    expect(el.shadowRoot!.querySelector(".trigger")).not.toBeNull()
  })

  it("groups: labels name the groups, empty groups hide while filtering", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Timezone">
      <tec-combobox-group>
        <tec-combobox-label>Americas</tec-combobox-label>
        <tec-combobox-item>(GMT-5) New York</tec-combobox-item>
        <tec-combobox-item>(GMT-8) Los Angeles</tec-combobox-item>
        <tec-combobox-separator></tec-combobox-separator>
      </tec-combobox-group>
      <tec-combobox-group label="Europe">
        <tec-combobox-item>(GMT+0) London</tec-combobox-item>
        <tec-combobox-item>(GMT+1) Paris</tec-combobox-item>
      </tec-combobox-group>
      <tec-combobox-empty>No timezones found.</tec-combobox-empty>
    </tec-combobox>`)
    input(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    await opened(el)
    expect(await axTree(list(el))).toEqual([
      "listbox: Timezone",
      "group: Americas",
      "option: (GMT-5) New York",
      "option: (GMT-8) Los Angeles",
      "group: Europe",
      "option: (GMT+0) London",
      "option: (GMT+1) Paris",
    ])
    await expectAccessible(el)
    await userEvent.keyboard("par")
    await el.updateComplete
    const groups = el.querySelectorAll("tec-combobox-group")
    expect(groups[0]!.filtered).toBe(true)
    expect(groups[1]!.filtered).toBe(false)
    expect(el.querySelector("tec-combobox-separator")!.filtered).toBe(true)
    // Items without a value use their text.
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(el.value).toBe("(GMT+1) Paris")
  })

  it("closes when nothing matches and there is no empty element", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="X"><tec-combobox-item>One</tec-combobox-item></tec-combobox>`)
    input(el).focus()
    await userEvent.keyboard("o")
    await opened(el)
    await userEvent.keyboard("zz")
    await waitUntil(() => !el.open)
  })

  it("multiple: chips, toggling, Backspace and chip keyboard removal, form entries", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-combobox name="fw" multiple aria-label="Frameworks" value="next">${frameworks}</tec-combobox>
    </form>`)
    const el = form.querySelector("tec-combobox")!
    el.focus()
    expect(el.shadowRoot!.activeElement).toBe(input(el))
    const chips = () => [...el.shadowRoot!.querySelectorAll(".chip")].map((c) => c.textContent!.trim())
    expect(el.values).toEqual(["next"])
    expect(chips()).toEqual(["Next.js"])
    input(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    await opened(el)
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(el.values).toEqual(["next", "svelte"])
    expect(el.open).toBe(true)
    await userEvent.click(items(el)[4]!)
    expect(el.values).toEqual(["next", "svelte", "astro"])
    await el.updateComplete
    expect(chips()).toEqual(["Next.js", "SvelteKit", "Astro"])
    expect(new FormData(form).getAll("fw")).toEqual(["next", "svelte", "astro"])
    expect(await axNode(list(el))).toMatchObject({ multiselectable: "true" })
    await userEvent.keyboard("{Backspace}")
    expect(el.values).toEqual(["next", "svelte"])
    await el.updateComplete
    await userEvent.keyboard("{ArrowLeft}")
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".chip-remove")]
    expect(el.shadowRoot!.activeElement).toBe(buttons[1])
    expect(await axNode(buttons[1]!)).toMatchObject({ role: "button", name: "Remove SvelteKit" })
    await userEvent.keyboard("{ArrowLeft}{Delete}")
    expect(el.values).toEqual(["svelte"])
    await el.updateComplete
    await userEvent.click(el.shadowRoot!.querySelector(".chip-remove")!)
    expect(el.values).toEqual([])
    form.reset()
    await el.updateComplete
    expect(el.values).toEqual(["next"])
  })

  it("rtl: ArrowRight at the start of the input moves to the chips", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox multiple aria-label="الفئات" value="a">
      <tec-combobox-item value="a">التكنولوجيا</tec-combobox-item>
      <tec-combobox-item value="b">التصميم</tec-combobox-item>
    </tec-combobox>`, { dir: "rtl" })
    el.focus()
    await userEvent.keyboard("{ArrowRight}")
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(".chip-remove")!
    expect(el.shadowRoot!.activeElement).toBe(button)
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.shadowRoot!.activeElement).toBe(input(el))
    await expectAccessible(el)
  })

  it("required, invalid, disabled", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-combobox name="a" required aria-label="A">${frameworks}</tec-combobox>
      <tec-combobox invalid aria-label="B">${frameworks}</tec-combobox>
      <tec-combobox disabled aria-label="C">${frameworks}</tec-combobox>
    </form>`)
    const [a, b, c] = form.querySelectorAll("tec-combobox")
    expect(a!.checkValidity()).toBe(false)
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", onSubmit)
    form.requestSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    await a!.updateComplete
    expect(await axNode(input(a!))).toMatchObject({ invalid: "true", required: "true" })
    expect(await axNode(input(b!))).toMatchObject({ invalid: "true" })
    expect(getComputedStyle(b!.shadowRoot!.querySelector(".field")!).boxShadow).not.toBe("none")
    expect(await axNode(input(c!))).toMatchObject({ disabled: "true" })
    await userEvent.click(c!, { force: true })
    expect(c!.open).toBe(false)
  })

  it("menu-trigger=focus opens on focus", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="X" menu-trigger="focus">${frameworks}</tec-combobox>`)
    input(el).focus()
    await opened(el)
    expect(el.open).toBe(true)
  })

  it("start addon and custom item text", async () => {
    const el = await fixture<TecCombobox>(html`<tec-combobox aria-label="Country">
      <svg slot="start" aria-hidden="true" width="16" height="16"></svg>
      <tec-combobox-item value="ar" label="Argentina"><div><div>Argentina</div><div>South America (ar)</div></div></tec-combobox-item>
      <tec-combobox-item value="au" label="Australia"><div><div>Australia</div><div>Oceania (au)</div></div></tec-combobox-item>
    </tec-combobox>`)
    expect(el.matches(":state(has-start)")).toBe(true)
    input(el).focus()
    await userEvent.keyboard("aus")
    await opened(el)
    expect(visible(el)).toEqual(["au"])
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(input(el).value).toBe("Australia")
  })
})
