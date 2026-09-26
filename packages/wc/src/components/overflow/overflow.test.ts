import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, deepActiveElement, expectAccessible, fixture, nextFrame, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecOverflow, TecOverflowItem } from "./overflow.js"
import "../toggle/define.js"
import "./define.js"

const svg = html`<svg slot="start" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>`

const item = (value: string, label: string, priority = 0) => html`<tec-overflow-item value=${value} priority=${priority}>
  <tec-button variant="outline">${svg}<tec-overflow-label>${label}</tec-overflow-label></tec-button>
</tec-overflow-item>`

const toolbar = (width: number, extra = html``) => html`<div style="width: ${width}px">
  <tec-toolbar aria-label="Well actions">
    ${item("tag", "Add tag", 2)} ${item("share", "Share", 1)} ${item("copy", "Duplicate")} ${item("export", "Export")}
    <tec-overflow-divider></tec-overflow-divider>
    <tec-overflow-item value="delete" label-behavior="keep">
      <tec-button variant="destructive">${svg}Delete</tec-button>
    </tec-overflow-item>
    <tec-button>New well</tec-button>
    ${extra}
  </tec-toolbar>
</div>`

async function settleRow(row: Element) {
  await nextFrame()
  await nextFrame()
  await (row as TecOverflow).updateComplete
}

const rowOf = (root: Element) => root.querySelector<TecOverflow>("tec-toolbar, tec-overflow")!
const items = (root: Element) => [...root.querySelectorAll<TecOverflowItem>("tec-overflow-item")]
const hidden = (root: Element) => items(root).filter((i) => i.overflowing).map((i) => i.value)
const trigger = (row: TecOverflow) => row.shadowRoot!.querySelector<HTMLElement>(".trigger")!
const menu = (row: TecOverflow) => row.shadowRoot!.querySelector<HTMLElement>(".menu-content:not(.submenu)")!

describe("tec-overflow", () => {
  it("shows every item at full size when there is room, with no More button", async () => {
    const root = await fixture(toolbar(1200))
    const row = rowOf(root)
    await settleRow(row)
    expect(hidden(root)).toEqual([])
    expect(items(root).some((i) => i.compact)).toBe(false)
    expect(getComputedStyle(row.shadowRoot!.querySelector(".menu")!).display).toBe("none")
    expect(await axNode(row)).toMatchObject({ role: "toolbar", name: "Well actions" })
    await expectAccessible(root)
  })

  it("collapses labels first, then moves items out lowest priority first, ties from the end", async () => {
    const root = await fixture(toolbar(1200))
    const row = rowOf(root)
    await settleRow(row)
    const full = row.getBoundingClientRect().width
    expect(full).toBeGreaterThan(0)
    const wrapper = root as HTMLElement
    // Just too narrow for the labels: everything that has an icon goes icon-only.
    const natural = items(root).reduce((sum, i) => sum + i.getBoundingClientRect().width, 0)
    wrapper.style.width = `${natural}px`
    await settleRow(row)
    expect(hidden(root)).toEqual([])
    expect(items(root).filter((i) => i.compact).map((i) => i.value)).toEqual(["tag", "share", "copy", "export"])
    expect(items(root).find((i) => i.value === "delete")!.compact).toBe(false)
    const label = root.querySelector("tec-overflow-label")!
    expect(label.matches(":state(compact)")).toBe(true)
    // The icon-only button keeps its label as accessible name.
    expect(await axNode(items(root)[0]!.querySelector("tec-button")!.shadowRoot!.querySelector("button")!)).toMatchObject({ name: "Add tag" })

    wrapper.style.width = "260px"
    await settleRow(row)
    const out = hidden(root)
    expect(out.length).toBeGreaterThan(0)
    // Priority 0 items leave first, from the end: delete, export, copy …; priority 2 ("tag") last.
    const order = ["delete", "export", "copy", "share", "tag"]
    expect(out).toEqual(order.slice(0, out.length).sort((a, b) => ["tag", "share", "copy", "export", "delete"].indexOf(a) - ["tag", "share", "copy", "export", "delete"].indexOf(b)))
    expect(getComputedStyle(row.shadowRoot!.querySelector(".menu")!).display).toBe("flex")
    // Everything visible fits.
    expect(row.scrollWidth).toBeLessThanOrEqual(Math.ceil(row.clientWidth) + 1)

    // Back to wide: everything returns with its label.
    wrapper.style.width = "1200px"
    await settleRow(row)
    expect(hidden(root)).toEqual([])
    expect(items(root).some((i) => i.compact)).toBe(false)
  })

  it("fires tec-overflow-change with the hidden values", async () => {
    const root = await fixture(toolbar(1200))
    const row = rowOf(root)
    await settleRow(row)
    const events = recordEvents<CustomEvent>(row, "tec-overflow-change").events
    ;(root as HTMLElement).style.width = "240px"
    await settleRow(row)
    expect(events.length).toBeGreaterThan(0)
    expect(events.at(-1)!.detail.hidden).toEqual(hidden(root))
    expect(row.hiddenItems.map((i) => i.value)).toEqual(hidden(root))
  })

  it("lists hidden items in the More menu in row order, with a separator for the divider", async () => {
    const root = await fixture(toolbar(200))
    const row = rowOf(root)
    await settleRow(row)
    expect(hidden(root)).toContain("delete")
    await userEvent.click(trigger(row))
    await waitUntil(() => menu(row).matches(":popover-open"))
    await animationsFinished(menu(row))
    const tree = await axTree(menu(row))
    expect(tree[0]).toMatch(/^menu: More actions/)
    expect(tree.at(-1)).toBe("menuitem: Delete")
    expect(tree).toContain("separator")
    expect(await axNode(trigger(row).shadowRoot!.querySelector("button")!)).toMatchObject({ expanded: "true", hasPopup: "menu", name: "More actions" })
    await expectAccessible(root)
  })

  it("activating a menu item clicks the row control and fires tec-select", async () => {
    const root = await fixture(toolbar(200))
    const row = rowOf(root)
    await settleRow(row)
    const clicks: string[] = []
    root.addEventListener("click", (e) => {
      const b = (e.target as Element).closest?.("tec-overflow-item")
      if (b) clicks.push((b as TecOverflowItem).value)
    })
    const selects = recordEvents<CustomEvent>(row, "tec-select").events
    trigger(row).focus()
    await userEvent.keyboard("{ArrowUp}")
    await waitUntil(() => menu(row).matches(":popover-open"))
    await waitUntil(() => deepActiveElement()?.getAttribute("data-label") === "Delete")
    await userEvent.keyboard("{Enter}")
    expect(clicks).toEqual(["delete"])
    expect(selects.map((e) => e.detail.value)).toEqual(["delete"])
    await waitUntil(() => !menu(row).matches(":popover-open"))
    expect(deepActiveElement()).toBe(trigger(row).shadowRoot!.querySelector("button"))
  })

  it("menu keyboard: Enter opens on the first item, arrows move, Escape closes to the trigger", async () => {
    const root = await fixture(toolbar(200))
    const row = rowOf(root)
    await settleRow(row)
    trigger(row).focus()
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => menu(row).matches(":popover-open"))
    const first = menu(row).querySelector("[data-key]")!
    await waitUntil(() => deepActiveElement() === first)
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).not.toBe(first)
    await userEvent.keyboard("{Home}")
    expect(deepActiveElement()).toBe(first)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !menu(row).matches(":popover-open"))
    expect(deepActiveElement()).toBe(trigger(row).shadowRoot!.querySelector("button"))
  })

  it("toolbar: one tab stop, arrows skip hidden items, the More button is the last stop", async () => {
    const root = await fixture(html`<div>
      <button id="before">before</button>${toolbar(230)}
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    root.querySelector<HTMLElement>("#before")!.focus()
    await userEvent.tab()
    const firstButton = items(root)[0]!.querySelector("tec-button")!.shadowRoot!.querySelector("button")
    expect(deepActiveElement()).toBe(firstButton)
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()).toBe(trigger(row).shadowRoot!.querySelector("button"))
    await userEvent.keyboard("{ArrowLeft}")
    expect(((deepActiveElement()!.getRootNode() as ShadowRoot).host as HTMLElement).textContent!.trim()).toBe("New well")
    await userEvent.tab({ shift: true })
    expect(deepActiveElement()?.id).toBe("before")
  })

  it("moves focus to the More button when the focused item leaves, and back when it returns", async () => {
    const root = await fixture(toolbar(1200))
    const row = rowOf(root)
    await settleRow(row)
    const exportButton = items(root)[3]!.querySelector("tec-button")!
    exportButton.focus()
    ;(root as HTMLElement).style.width = "200px"
    await settleRow(row)
    expect(items(root)[3]!.overflowing).toBe(true)
    expect(deepActiveElement()).toBe(trigger(row).shadowRoot!.querySelector("button"))
    ;(root as HTMLElement).style.width = "1200px"
    await settleRow(row)
    await waitUntil(() => deepActiveElement() !== trigger(row).shadowRoot!.querySelector("button"))
    expect(hidden(root)).toEqual([])
  })

  it("labels='always' keeps labels; labels='never' is icon-only from the start", async () => {
    const root = await fixture(html`<div style="width: 1200px">
      <tec-overflow labels="never">${item("a", "Alpha")} ${item("b", "Beta")}</tec-overflow>
      <tec-overflow labels="always" style="width: 150px">${item("c", "Gamma")} ${item("d", "Delta")}</tec-overflow>
    </div>`)
    const [never, always] = [...root.querySelectorAll<TecOverflow>("tec-overflow")]
    await settleRow(never!)
    await settleRow(always!)
    expect(items(never!).map((i) => i.compact)).toEqual([true, true])
    expect(items(always!).map((i) => i.compact)).toEqual([false, false])
    expect(hidden(always!).length).toBeGreaterThan(0)
  })

  it("shows the label as a tooltip while icon-only", async () => {
    const root = await fixture(html`<div style="width: 400px"><tec-overflow labels="never">${item("a", "Alpha")}</tec-overflow></div>`)
    const row = rowOf(root)
    await settleRow(row)
    const it0 = items(root)[0]!
    await userEvent.hover(it0.querySelector("tec-button")!)
    await waitUntil(() => it0.shadowRoot!.querySelector(".tooltip")?.matches(":popover-open"))
    expect(it0.shadowRoot!.querySelector(".tooltip")!.textContent!.trim()).toBe("Alpha")
    await userEvent.unhover(it0.querySelector("tec-button")!)
    await waitUntil(() => !it0.shadowRoot!.querySelector(".tooltip"))
  })

  it("a toggle becomes a checkbox item; a group becomes a labelled section; badge counts hidden items", async () => {
    const root = await fixture(html`<div style="width: 90px">
      <tec-overflow overflow-badge>
        <tec-overflow-group label="View">
          <tec-overflow-item value="preview" label="Preview pane"><tec-toggle aria-label="Preview pane" pressed>${svg}</tec-toggle></tec-overflow-item>
          ${item("grid", "Grid")}
        </tec-overflow-group>
        <tec-button>Fixed</tec-button>
      </tec-overflow>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    expect(hidden(root)).toEqual(["preview", "grid"])
    expect(row.shadowRoot!.querySelector(".badge")!.textContent!.trim()).toBe("2")
    await userEvent.click(trigger(row))
    await waitUntil(() => menu(row).matches(":popover-open"))
    await animationsFinished(menu(row))
    expect(await axTree(menu(row))).toEqual(["menu: More actions [focused]", "group: View", "menuitemcheckbox: Preview pane [checked]", "menuitem: Grid"])
    await userEvent.click(menu(row).querySelector("[role=menuitemcheckbox]")!)
    // The checkbox item toggles the row control and keeps the menu open.
    expect(root.querySelector("tec-toggle")!.pressed).toBe(false)
    await waitUntil(() => menu(row).querySelector("[role=menuitemcheckbox]")!.getAttribute("aria-checked") === "false")
    expect(menu(row).matches(":popover-open")).toBe(true)
  })

  it("a select becomes a submenu of radio items that sets its value", async () => {
    const root = await fixture(html`<div style="width: 60px">
      <tec-overflow>
        <tec-overflow-item value="field" label="Field">
          <select aria-label="Field"><option>All fields</option><option>Gullfaks</option><option>Snorre</option></select>
        </tec-overflow-item>
      </tec-overflow>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    expect(hidden(root)).toEqual(["field"])
    const select = root.querySelector("select")!
    const changes = recordEvents(select, "change").events
    trigger(row).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement()?.getAttribute("data-label") === "Field")
    expect(await axNode(deepActiveElement()!)).toMatchObject({ role: "menuitem", hasPopup: "menu", expanded: "false" })
    await userEvent.keyboard("{ArrowRight}")
    const sub = row.shadowRoot!.querySelector<HTMLElement>(".submenu")!
    await waitUntil(() => sub.matches(":popover-open"))
    await waitUntil(() => deepActiveElement()?.getAttribute("data-label") === "All fields")
    expect(await axTree(sub)).toEqual(["menu: Field", "menuitemradio: All fields [checked, focused]", "menuitemradio: Gullfaks", "menuitemradio: Snorre"])
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => !sub.matches(":popover-open"))
    expect(deepActiveElement()?.getAttribute("data-label")).toBe("Field")
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => sub.matches(":popover-open"))
    await waitUntil(() => deepActiveElement()?.getAttribute("data-label") === "All fields")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(select.value).toBe("Gullfaks")
    expect(changes.length).toBe(1)
    await waitUntil(() => !menu(row).matches(":popover-open"))
  })

  it("a text field overflows into a dialog holding the same field", async () => {
    const root = await fixture(html`<div style="width: 60px">
      <tec-overflow>
        <tec-overflow-item value="search" label="Search" elastic style="--tec-overflow-item-min: 8rem">
          <input aria-label="Search wells" placeholder="Search wells" />
        </tec-overflow-item>
      </tec-overflow>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    expect(hidden(root)).toEqual(["search"])
    const input = root.querySelector("input")!
    await userEvent.click(trigger(row))
    await waitUntil(() => menu(row).matches(":popover-open"))
    await userEvent.click(menu(row).querySelector("[data-key]")!)
    const searchItem = items(root)[0]!
    const dialog = searchItem.shadowRoot!.querySelector("dialog")!
    await waitUntil(() => dialog?.open)
    expect(deepActiveElement()).toBe(input)
    expect(await axNode(dialog)).toMatchObject({ role: "dialog", name: "Search" })
    await userEvent.keyboard("gull{Enter}")
    await waitUntil(() => !searchItem.shadowRoot!.querySelector("dialog"))
    expect(input.value).toBe("gull")
    await waitUntil(() => deepActiveElement() === trigger(row).shadowRoot!.querySelector("button"))
  })

  it("vertical rows measure heights and keep the More button at the bottom", async () => {
    const root = await fixture(html`<div style="height: 120px; display: flex">
      <tec-toolbar aria-label="Tools" orientation="vertical" labels="never" style="height: 100%">
        ${["a", "b", "c", "d", "e"].map(
          (v) => html`<tec-overflow-item value=${v} label=${v}><tec-button variant="ghost" size="icon" aria-label=${v}>${svg}</tec-button></tec-overflow-item>`
        )}
      </tec-toolbar>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    const out = hidden(root)
    expect(out.length).toBeGreaterThan(0)
    expect(out.at(-1)).toBe("e")
    expect(await axNode(row)).toMatchObject({ role: "toolbar", orientation: "vertical" })
    const menuBox = row.shadowRoot!.querySelector(".menu")!.getBoundingClientRect()
    const lastVisible = items(root).filter((i) => !i.overflowing).at(-1)!.getBoundingClientRect()
    expect(menuBox.top).toBeGreaterThanOrEqual(lastVisible.bottom)
    expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(120)
  })

  it("dividers hide once one side is empty; collapse='together' moves a group at once", async () => {
    const root = await fixture(html`<div style="width: 1200px">
      <tec-overflow labels="always">
        ${item("a", "Alpha", 5)}
        <tec-overflow-divider></tec-overflow-divider>
        <tec-overflow-group collapse="together">${item("b", "Beta", 1)} ${item("c", "Gamma", 3)}</tec-overflow-group>
      </tec-overflow>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    const divider = root.querySelector("tec-overflow-divider")!
    expect(divider.matches(":state(overflowing)")).toBe(false)
    expect(await axNode(divider)).toMatchObject({ role: "separator" })
    const alpha = items(root)[0]!.getBoundingClientRect().width
    ;(root as HTMLElement).style.width = `${alpha + 60}px`
    await settleRow(row)
    expect(hidden(root)).toEqual(["b", "c"])
    // The More button stands after the divider, so it stays.
    expect(divider.matches(":state(overflowing)")).toBe(false)
  })

  it("wraps as a last resort when fixed items alone do not fit", async () => {
    const root = await fixture(html`<div style="width: 80px">
      <tec-overflow><tec-button>First fixed</tec-button><tec-button>Second fixed</tec-button></tec-overflow>
    </div>`)
    const row = rowOf(root)
    await settleRow(row)
    expect(getComputedStyle(row).flexWrap).toBe("wrap")
  })
})
