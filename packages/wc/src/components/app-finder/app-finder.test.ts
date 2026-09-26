import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecAppFinder, TecAppFinderItem } from "./app-finder.js"
import "./define.js"

const finder = () => html`<div style="padding: 20px 20px 500px">
  <button id="outside">Outside</button>
  <tec-app-finder>
    <tec-app-finder-trigger slot="trigger" name="Discovery" tone="blue">DSG</tec-app-finder-trigger>
    <tec-app-finder-group heading="Recent" hide-while-searching>
      <tec-app-finder-item value="recent-dwp" icon="DWP" tone="green" name="Well Planning"></tec-app-finder-item>
    </tec-app-finder-group>
    <tec-app-finder-group heading="Subsurface">
      <tec-app-finder-item value="dsg" icon="DSG" tone="blue" name="Discovery" description="Regional geology" keywords="DSG Subsurface" current></tec-app-finder-item>
      <tec-app-finder-item value="fwm" icon="FWM" tone="blue" name="Framework Modeling" keywords="FWM Subsurface"></tec-app-finder-item>
    </tec-app-finder-group>
    <tec-app-finder-group heading="Wells">
      <tec-app-finder-item value="dwp" icon="DWP" tone="green" name="Well Planning" keywords="DWP Wells"></tec-app-finder-item>
      <tec-app-finder-item value="trj" icon="TRJ" tone="green" name="Trajectory Design" keywords="TRJ Wells" disabled></tec-app-finder-item>
    </tec-app-finder-group>
  </tec-app-finder>
</div>`

const panel = (el: TecAppFinder) => el.shadowRoot!.querySelector(".content") as HTMLElement
const input = (el: TecAppFinder) => el.shadowRoot!.querySelector("input")!
const triggerButton = (el: TecAppFinder) => el.querySelector("tec-app-finder-trigger")!.shadowRoot!.querySelector("button")!
const shown = (el: TecAppFinder) => el.items.filter((i) => i.checkVisibility()).map((i) => i.value)

async function open(el: TecAppFinder) {
  await userEvent.click(el.querySelector("tec-app-finder-trigger")!)
  await waitUntil(() => panel(el).matches(":popover-open"), "finder open")
  await el.updateComplete
  await animationsFinished(panel(el))
}

async function type(el: TecAppFinder, text: string) {
  await userEvent.keyboard(text)
  await el.updateComplete
}

describe("tec-app-finder", () => {
  it("names the trigger after the current app and wires aria-haspopup/expanded", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    expect(await axNode(triggerButton(el))).toMatchObject({ role: "button", name: "Switch application, current: Discovery", hasPopup: "dialog", expanded: "false" })
    const tile = el.querySelector("tec-app-finder-trigger")!.shadowRoot!.querySelector("tec-app-finder-icon")!
    expect(tile.getBoundingClientRect().width).toBe(24)
  })

  it("opens below the trigger (start-aligned, 6px), focuses the search, exposes dialog + menu", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    el.style.setProperty("--tec-app-finder-width", "240px")
    await open(el)
    expect(events.events[0].detail).toEqual({ open: true, reason: "trigger" })
    expect(deepActiveElement()).toBe(input(el))
    const t = el.querySelector("tec-app-finder-trigger")!.getBoundingClientRect()
    const p = panel(el).getBoundingClientRect()
    expect(Math.round(p.top - t.bottom)).toBe(6)
    expect(Math.round(p.left)).toBe(Math.round(t.left))
    expect(await axNode(panel(el))).toMatchObject({ role: "dialog", name: "Applications" })
    expect(await axNode(input(el))).toMatchObject({ name: "Search applications…", autocomplete: "list" })
    expect(input(el).getAttribute("aria-controls")).toBe("list")
    const trigger = el.querySelector("tec-app-finder-trigger")!
    trigger.name = "Well Planning"
    await trigger.updateComplete
    expect(trigger.getAttribute("name")).toBe("Well Planning")
    expect(await axTree(el.shadowRoot!.querySelector(".list")!)).toEqual([
      "menu: Suggestions",
      "group: Recent",
      "menuitem: DWP Well Planning",
      "group: Subsurface",
      "menuitem: DSG Discovery Regional geology Current",
      "menuitem: FWM Framework Modeling",
      "group: Wells",
      "menuitem: DWP Well Planning",
      "menuitem: TRJ Trajectory Design [disabled]",
    ])
    expect(await axNode(triggerButton(el))).toMatchObject({ expanded: "true" })
    await expectAccessible(root)
  })

  it("filters across groups (name and keywords, accent-insensitive), hides Recent and highlights the match", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    await open(el)
    await type(el, "wel")
    expect(shown(el)).toEqual(["dwp", "trj"])
    const dwp = el.items.find((i) => i.value === "dwp")!
    await dwp.updateComplete
    expect(dwp.shadowRoot!.querySelector(".name mark")!.textContent).toBe("Wel")
    // The first match is highlighted and is the active descendant of the search field.
    expect(dwp.highlighted).toBe(true)
    expect(input(el).ariaActiveDescendantElement).toBe(dwp)
    // Keywords match too; the Recent group is left out while searching.
    await userEvent.clear(input(el))
    await type(el, "subsurfacé")
    expect(shown(el)).toEqual(["dsg", "fwm"])
    const groups = [...el.querySelectorAll("tec-app-finder-group")]
    expect(groups.map((g) => g.checkVisibility())).toEqual([false, true, false])
    expect(groups[1].matches(":state(first)")).toBe(true)
  })

  it("moves with the arrow keys (skipping disabled items) and chooses with Enter", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    await open(el)
    await type(el, "{ArrowDown}")
    expect(el.items.find((i) => i.highlighted)?.value).toBe("recent-dwp")
    await type(el, "{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(el.items.find((i) => i.highlighted)?.value).toBe("dwp")
    await type(el, "{ArrowUp}")
    expect(el.items.find((i) => i.highlighted)?.value).toBe("fwm")
    const selects = recordEvents<CustomEvent>(el, "tec-select")
    const changes = recordEvents<CustomEvent>(el, "tec-open-change")
    await type(el, "{Enter}")
    expect(selects.events.map((e) => e.detail)).toEqual([{ value: "fwm" }])
    expect(changes.events[0].detail).toEqual({ open: false, reason: "select" })
    await waitUntil(() => !panel(el).matches(":popover-open"), "closed")
    expect(deepActiveElement()).toBe(triggerButton(el))
  })

  it("chooses with a click; a prevented tec-select keeps it open", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    await open(el)
    el.addEventListener("tec-select", (e) => e.preventDefault(), { once: true })
    const fwm = el.items.find((i) => i.value === "fwm")!
    await userEvent.click(fwm)
    expect(el.open).toBe(true)
    const selects = recordEvents<CustomEvent>(el, "tec-select")
    await userEvent.click(fwm)
    expect(selects.events[0].detail).toEqual({ value: "fwm" })
    await waitUntil(() => !el.open)
    // A disabled item is not chosen.
    await open(el)
    await userEvent.click(el.items.find((i) => i.value === "trj")!, { force: true })
    expect(el.open).toBe(true)
  })

  it("shows the empty state; Escape clears the search, then closes", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    await open(el)
    await type(el, "zzz")
    const empty = el.shadowRoot!.querySelector(".empty")!
    expect(empty.textContent).toContain("No applications match")
    expect(empty.textContent).toContain("Try the app's short code or its category")
    expect(el.shadowRoot!.querySelector<HTMLElement>(".list")!.hidden).toBe(true)
    await expectAccessible(root)
    await type(el, "{Escape}")
    expect(input(el).value).toBe("")
    expect(el.open).toBe(true)
    expect(shown(el).length).toBe(5)
    await type(el, "{Escape}")
    await waitUntil(() => !el.open, "closed by Escape")
  })

  it("resets the search on reopen and closes on an outside press", async () => {
    const root = await fixture<HTMLElement>(finder())
    const el = root.querySelector("tec-app-finder")!
    await open(el)
    await type(el, "dis")
    await userEvent.click(root.querySelector("#outside")!)
    await waitUntil(() => !el.open, "closed by outside press")
    await open(el)
    expect(input(el).value).toBe("")
    expect(shown(el).length).toBe(5)
  })

  it("renders the tile tones from the palette", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-app-finder-icon tone="green">DWP</tec-app-finder-icon><tec-app-finder-icon>N</tec-app-finder-icon></div>`)
    const [green, neutral] = [...root.querySelectorAll("tec-app-finder-icon")].map((i) => getComputedStyle(i.shadowRoot!.querySelector(".base")!))
    expect(green.backgroundColor).not.toBe(neutral.backgroundColor)
    expect(root.querySelector("tec-app-finder-icon")!.getBoundingClientRect().width).toBe(28)
  })
})

