import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecContextMenu, TecContextMenuItem, TecContextMenuSub } from "./context-menu.js"
import "./define.js"

const content = (el: Element) => el.shadowRoot!.querySelector(".content") as HTMLElement
const isShown = (el: Element) => content(el).matches(":popover-open")
const item = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<TecContextMenuItem>("tec-context-menu-item, tec-context-menu-sub-trigger")].find((i) => i.label === text)!

const demo = (o: { side?: string; align?: string } = {}) => html`<div style="padding: 20px">
  <tec-context-menu side=${o.side ?? "bottom"} align=${o.align ?? "start"}>
    <div slot="trigger" tabindex="0" id="area" style="width: 300px; height: 150px; border: 1px dashed">Right click here</div>
    <tec-context-menu-group>
      <tec-context-menu-item value="back">Back <tec-context-menu-shortcut>⌘[</tec-context-menu-shortcut></tec-context-menu-item>
      <tec-context-menu-item value="forward" disabled>Forward</tec-context-menu-item>
      <tec-context-menu-item value="reload">Reload</tec-context-menu-item>
      <tec-context-menu-sub>
        <tec-context-menu-sub-trigger>More Tools</tec-context-menu-sub-trigger>
        <tec-context-menu-sub-content>
          <tec-context-menu-item value="save">Save Page...</tec-context-menu-item>
        </tec-context-menu-sub-content>
      </tec-context-menu-sub>
    </tec-context-menu-group>
    <tec-context-menu-separator></tec-context-menu-separator>
    <tec-context-menu-group selection-mode="multiple">
      <tec-context-menu-item value="bookmarks" checked>Show Bookmarks</tec-context-menu-item>
    </tec-context-menu-group>
  </tec-context-menu>
  <button id="outside">Outside</button>
</div>`

describe("tec-context-menu", () => {
  it("opens at the pointer on right click, with focus on the menu", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector<TecContextMenu>("tec-context-menu")!
    const area = root.querySelector<HTMLElement>("#area")!
    const changes = recordEvents<CustomEvent>(el, "tec-open-change").events
    const r = area.getBoundingClientRect()
    await userEvent.click(area, { button: "right", position: { x: 40, y: 30 } })
    await waitUntil(() => isShown(el), "menu shown")
    await animationsFinished(content(el))
    expect(changes.map((e) => e.detail)).toEqual([{ open: true, reason: "context-menu" }])
    const m = content(el).getBoundingClientRect()
    expect(Math.abs(m.left - (r.left + 40))).toBeLessThanOrEqual(1.5)
    expect(Math.abs(m.top - (r.top + 30 + 4))).toBeLessThanOrEqual(1.5)
    expect(Math.round(m.width)).toBe(Math.round(r.width))
    expect(deepActiveElement()).toBe(content(el))
    expect(area.hasAttribute("aria-haspopup")).toBe(false)
    expect(await axTree(content(el))).toEqual([
      "menu: Right click here [focused]",
      "group",
      "menuitem: Back ⌘[",
      "menuitem: Forward [disabled]",
      "menuitem: Reload",
      "menuitem: More Tools",
      "separator",
      "group",
      "menuitemcheckbox: Show Bookmarks [checked]",
    ])
    await expectAccessible(root)
  })

  it("opens from the keyboard (Shift+F10, ContextMenu) with focus on the first item; Escape restores focus", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector<TecContextMenu>("tec-context-menu")!
    const area = root.querySelector<HTMLElement>("#area")!
    area.focus()
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    await waitUntil(() => deepActiveElement() === item(el, "Back"), "first item focused")
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(item(el, "Reload"))
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
    expect(deepActiveElement()).toBe(area)
    await waitUntil(() => !isShown(el))
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true, composed: true }))
    await waitUntil(() => deepActiveElement() === item(el, "Back"), "ContextMenu key")
  })

  it("selecting closes and restores focus; submenus work", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector<TecContextMenu>("tec-context-menu")!
    const area = root.querySelector<HTMLElement>("#area")!
    const selects = recordEvents<CustomEvent>(el, "tec-select").events
    area.focus()
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    await waitUntil(() => deepActiveElement() === item(el, "Back"))
    await userEvent.keyboard("{End}{ArrowUp}{ArrowRight}")
    const sub = el.querySelector<TecContextMenuSub>("tec-context-menu-sub")!
    await waitUntil(() => deepActiveElement() === item(el, "Save Page..."), "submenu item")
    expect(sub.open).toBe(true)
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => !el.open)
    expect(selects.map((e) => e.detail)).toEqual([{ value: "save" }])
    expect(deepActiveElement()).toBe(area)
  })

  it("honours side and closes on outside press", async () => {
    const root = await fixture<HTMLElement>(demo({ side: "top", align: "start" }))
    const el = root.querySelector<TecContextMenu>("tec-context-menu")!
    const area = root.querySelector<HTMLElement>("#area")!
    area.style.marginTop = "200px"
    const r = area.getBoundingClientRect()
    await userEvent.click(area, { button: "right", position: { x: 20, y: 100 } })
    await waitUntil(() => isShown(el))
    await animationsFinished(content(el))
    const m = content(el).getBoundingClientRect()
    expect(content(el).dataset.side).toBe("top")
    expect(Math.abs(m.bottom - (r.top + 100 - 4))).toBeLessThanOrEqual(1.5)
    await userEvent.click(root.querySelector("#outside")!)
    await waitUntil(() => !el.open)
  })

  it("does nothing when disabled", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector<TecContextMenu>("tec-context-menu")!
    el.disabled = true
    const area = root.querySelector<HTMLElement>("#area")!
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    area.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(el.open).toBe(false)
  })
})
