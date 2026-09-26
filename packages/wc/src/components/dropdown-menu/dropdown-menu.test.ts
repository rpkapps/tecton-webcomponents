import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, animationsFinished, axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import "../button/define.js"
import type { TecDropdownMenu, TecDropdownMenuGroup, TecDropdownMenuItem, TecDropdownMenuSub } from "./dropdown-menu.js"
import "./define.js"

const content = (el: Element) => el.shadowRoot!.querySelector(".content") as HTMLElement
const isShown = (el: Element) => content(el).matches(":popover-open")
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!
const item = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<TecDropdownMenuItem>("tec-dropdown-menu-item, tec-dropdown-menu-sub-trigger")].find((i) => i.label === text)!

const demo = () => html`<div style="padding: 40px">
  <button id="before">Before</button>
  <tec-dropdown-menu>
    <tec-button slot="trigger" variant="outline">Open</tec-button>
    <tec-dropdown-menu-group>
      <tec-dropdown-menu-label>My Account</tec-dropdown-menu-label>
      <tec-dropdown-menu-item value="profile">Profile <tec-dropdown-menu-shortcut>⇧⌘P</tec-dropdown-menu-shortcut></tec-dropdown-menu-item>
      <tec-dropdown-menu-item value="billing">Billing</tec-dropdown-menu-item>
    </tec-dropdown-menu-group>
    <tec-dropdown-menu-separator></tec-dropdown-menu-separator>
    <tec-dropdown-menu-sub>
      <tec-dropdown-menu-sub-trigger>Invite users</tec-dropdown-menu-sub-trigger>
      <tec-dropdown-menu-sub-content>
        <tec-dropdown-menu-item value="email">Email</tec-dropdown-menu-item>
        <tec-dropdown-menu-item value="message">Message</tec-dropdown-menu-item>
      </tec-dropdown-menu-sub-content>
    </tec-dropdown-menu-sub>
    <tec-dropdown-menu-item value="api" disabled>API</tec-dropdown-menu-item>
    <tec-dropdown-menu-item value="logout" variant="destructive">Log out</tec-dropdown-menu-item>
  </tec-dropdown-menu>
  <button id="after">After</button>
</div>`

async function openWithPointer(el: TecDropdownMenu) {
  await userEvent.click(el.querySelector("tec-button")!)
  await waitUntil(() => isShown(el), "menu shown")
  await animationsFinished(content(el))
}

describe("tec-dropdown-menu", () => {
  it("wires the trigger and exposes menu semantics", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ role: "button", name: "Open", expanded: "false", hasPopup: "menu" })
    await openWithPointer(el)
    expect(await axNode(innerButton(trigger))).toMatchObject({ expanded: "true" })
    expect(deepActiveElement()).toBe(content(el))
    expect(await axNode(content(el))).toMatchObject({ role: "menu", name: "Open" })
    expect(await axTree(content(el))).toEqual([
      "menu: Open [focused]",
      "group: My Account",
      "menuitem: Profile ⇧⌘P",
      "menuitem: Billing",
      "separator",
      "menuitem: Invite users",
      "menuitem: API [disabled]",
      "menuitem: Log out",
    ])
    expect(await axNode(item(el, "Invite users"))).toMatchObject({ hasPopup: "menu", expanded: "false" })
    await expectAccessible(root)
  })

  it("positions below the trigger, start-aligned, at least as wide as the trigger", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    await openWithPointer(el)
    const t = el.querySelector("tec-button")!.getBoundingClientRect()
    const p = content(el).getBoundingClientRect()
    expect(Math.round(p.top - t.bottom)).toBe(4)
    expect(Math.round(p.left)).toBe(Math.round(t.left))
    expect(p.width).toBeGreaterThanOrEqual(128)
    el.style.setProperty("--tec-dropdown-menu-width", "10rem")
    expect(Math.round(content(el).getBoundingClientRect().width)).toBe(160)
    expect(item(el, "Profile").getBoundingClientRect().height).toBe(32)
  })

  it("opens from the keyboard with focus on the first (ArrowDown/Enter) or last (ArrowUp) item", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    innerButton(el.querySelector("tec-button")!).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"), "first item focused")
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !el.open)
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
    await waitUntil(() => !isShown(el))
    await userEvent.keyboard("{ArrowUp}")
    await waitUntil(() => deepActiveElement() === item(el, "Log out"), "last item focused")
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !isShown(el))
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"), "Enter focuses the first item")
  })

  it("arrow keys wrap and skip disabled items; Home/End; typeahead", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    innerButton(el.querySelector("tec-button")!).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"))
    await userEvent.keyboard("{ArrowUp}")
    expect(deepActiveElement()).toBe(item(el, "Log out"))
    await userEvent.keyboard("{ArrowUp}")
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(item(el, "Log out"))
    await userEvent.keyboard("{Home}")
    expect(deepActiveElement()).toBe(item(el, "Profile"))
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()).toBe(item(el, "Log out"))
    await userEvent.keyboard("b")
    expect(deepActiveElement()).toBe(item(el, "Billing"))
    await aTimeout(1100)
    await userEvent.keyboard("i")
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
  })

  it("activating an item fires tec-select and closes; canceling keeps it open", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    const selects = recordEvents<CustomEvent>(el, "tec-select").events
    const changes = recordEvents<CustomEvent>(el, "tec-open-change").events
    await openWithPointer(el)
    await userEvent.click(item(el, "Billing"))
    expect(selects.map((e) => e.detail)).toEqual([{ value: "billing" }])
    await waitUntil(() => !el.open)
    expect(changes.map((e) => e.detail)).toEqual([
      { open: true, reason: "trigger" },
      { open: false, reason: "select" },
    ])
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
    await waitUntil(() => !isShown(el))

    el.addEventListener("tec-select", (e) => e.preventDefault(), { once: true })
    await openWithPointer(el)
    await userEvent.click(item(el, "Profile"))
    await aTimeout(50)
    expect(el.open).toBe(true)
    // Disabled items do nothing.
    item(el, "API").click()
    expect(selects.length).toBe(2)
  })

  it("Tab closes the menu and moves on from the trigger", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    innerButton(el.querySelector("tec-button")!).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"))
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => !el.open)
    expect(deepActiveElement()).toBe(root.querySelector("#after"))
  })

  it("closes on outside press and on a second trigger press", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    await openWithPointer(el)
    await userEvent.click(root.querySelector("#before")!)
    await waitUntil(() => !el.open)
    await waitUntil(() => !isShown(el))
    await openWithPointer(el)
    await userEvent.click(el.querySelector("tec-button")!)
    await waitUntil(() => !el.open)
  })

  it("submenus: ArrowRight opens and focuses the first item, ArrowLeft / Escape close and refocus the trigger", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    const sub = el.querySelector<TecDropdownMenuSub>("tec-dropdown-menu-sub")!
    const subContent = sub.querySelector("tec-dropdown-menu-sub-content")!
    innerButton(el.querySelector("tec-button")!).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"))
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => deepActiveElement() === item(el, "Email"), "submenu first item")
    expect(sub.open).toBe(true)
    await animationsFinished(content(subContent))
    expect(await axNode(item(el, "Invite users"))).toMatchObject({ expanded: "true" })
    expect(await axNode(content(subContent))).toMatchObject({ role: "menu", name: "Invite users" })
    const t = item(el, "Invite users").getBoundingClientRect()
    const s = content(subContent).getBoundingClientRect()
    expect(Math.round(s.left)).toBeGreaterThanOrEqual(Math.round(t.right))
    await expectAccessible(root)

    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(item(el, "Message"))
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => !sub.open)
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
    expect(el.open).toBe(true)

    await userEvent.keyboard("{Enter}")
    await waitUntil(() => deepActiveElement() === item(el, "Email"))
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !sub.open)
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
    expect(el.open).toBe(true)

    // Selecting inside the submenu closes everything.
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => deepActiveElement() === item(el, "Email"))
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => !el.open && !sub.open)
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
  })

  it("submenus open on hover and close when another item is hovered", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    const sub = el.querySelector<TecDropdownMenuSub>("tec-dropdown-menu-sub")!
    await openWithPointer(el)
    await userEvent.hover(item(el, "Invite users"))
    await waitUntil(() => sub.open, "sub opened by hover", 1000)
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
    await userEvent.hover(item(el, "Email"))
    expect(deepActiveElement()).toBe(item(el, "Email"))
    await userEvent.hover(item(el, "Billing"))
    await waitUntil(() => !sub.open, "sub closed", 3000)
    expect(el.open).toBe(true)
  })

  it("mirrors submenu arrows in RTL", async () => {
    const root = await fixture<HTMLElement>(demo(), { dir: "rtl" })
    const el = root.querySelector("tec-dropdown-menu")!
    const sub = el.querySelector<TecDropdownMenuSub>("tec-dropdown-menu-sub")!
    innerButton(el.querySelector("tec-button")!).focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => deepActiveElement() === item(el, "Profile"))
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}")
    expect(sub.open).toBe(false)
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => deepActiveElement() === item(el, "Email"))
    const t = item(el, "Invite users").getBoundingClientRect()
    await animationsFinished(content(sub.querySelector("tec-dropdown-menu-sub-content")!))
    const s = content(sub.querySelector("tec-dropdown-menu-sub-content")!).getBoundingClientRect()
    expect(Math.round(s.right)).toBeLessThanOrEqual(Math.round(t.left))
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => !sub.open)
    expect(deepActiveElement()).toBe(item(el, "Invite users"))
  })

  it("checkbox and radio groups: roles, aria-checked, tec-value-change, close rules", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 20px">
      <tec-dropdown-menu>
        <tec-button slot="trigger">View</tec-button>
        <tec-dropdown-menu-group selection-mode="multiple">
          <tec-dropdown-menu-label>Appearance</tec-dropdown-menu-label>
          <tec-dropdown-menu-item value="status-bar" checked>Status Bar</tec-dropdown-menu-item>
          <tec-dropdown-menu-item value="panel">Panel</tec-dropdown-menu-item>
        </tec-dropdown-menu-group>
        <tec-dropdown-menu-group selection-mode="single" id="position">
          <tec-dropdown-menu-label>Position</tec-dropdown-menu-label>
          <tec-dropdown-menu-item value="top">Top</tec-dropdown-menu-item>
          <tec-dropdown-menu-item value="bottom" checked>Bottom</tec-dropdown-menu-item>
        </tec-dropdown-menu-group>
      </tec-dropdown-menu>
    </div>`)
    const el = root.querySelector("tec-dropdown-menu")!
    const [multi, single] = [...el.querySelectorAll<TecDropdownMenuGroup>("tec-dropdown-menu-group")]
    const changes = recordEvents<CustomEvent>(el, "tec-value-change").events
    await openWithPointer(el)
    expect(await axTree(content(el))).toEqual([
      "menu: View [focused]",
      "group: Appearance",
      "menuitemcheckbox: Status Bar [checked]",
      "menuitemcheckbox: Panel",
      "group: Position",
      "menuitemradio: Top",
      "menuitemradio: Bottom [checked]",
    ])
    expect(multi!.values).toEqual(["status-bar"])
    expect(single!.value).toBe("bottom")
    await expectAccessible(root)

    // Pointer on a checkbox: toggles, stays open.
    await userEvent.click(item(el, "Panel"))
    expect(multi!.values).toEqual(["status-bar", "panel"])
    expect(changes.at(-1)!.detail).toEqual({ value: "status-bar", values: ["status-bar", "panel"] })
    await aTimeout(30)
    expect(el.open).toBe(true)
    // Space on a checkbox: toggles, stays open.
    item(el, "Status Bar").focus()
    await userEvent.keyboard(" ")
    expect(multi!.values).toEqual(["panel"])
    await aTimeout(30)
    expect(el.open).toBe(true)
    expect(await axNode(item(el, "Status Bar"))).toMatchObject({ role: "menuitemcheckbox", checked: "false" })
    // Space on a radio: selects, stays open.
    item(el, "Top").focus()
    await userEvent.keyboard(" ")
    expect(single!.value).toBe("top")
    expect(item(el, "Bottom").checked).toBe(false)
    await aTimeout(30)
    expect(el.open).toBe(true)
    // Veto.
    single!.addEventListener("tec-value-change", (e) => e.preventDefault(), { once: true })
    item(el, "Bottom").focus()
    await userEvent.keyboard(" ")
    expect(single!.value).toBe("top")
    // Pointer on a radio: selects and closes.
    await userEvent.click(item(el, "Bottom"))
    expect(single!.value).toBe("bottom")
    await waitUntil(() => !el.open)
    // Programmatic value.
    single!.value = "top"
    expect(item(el, "Top").checked).toBe(true)
  })

  it("programmatic open/show/hide fire no events", async () => {
    const root = await fixture<HTMLElement>(demo())
    const el = root.querySelector("tec-dropdown-menu")!
    const changes = recordEvents(el, "tec-open-change").events
    el.show()
    await waitUntil(() => isShown(el))
    el.hide()
    await waitUntil(() => !isShown(el))
    expect(changes.length).toBe(0)
  })
})
