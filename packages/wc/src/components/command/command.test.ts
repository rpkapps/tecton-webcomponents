import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { axActiveDescendant } from "../select/listbox-test-utils.js"
import type { TecCommand } from "./command.js"
import type { TecCommandDialog } from "./command-dialog.js"
import "./define.js"

const palette = html`<tec-command>
  <tec-command-input placeholder="Type a command or search..."></tec-command-input>
  <tec-command-list>
    <tec-command-empty>No results found.</tec-command-empty>
    <tec-command-group heading="Suggestions">
      <tec-command-item value="calendar"><svg aria-hidden="true" width="16" height="16"></svg><span>Calendar</span></tec-command-item>
      <tec-command-item value="emoji" keywords="smiley, face"><span>Search Emoji</span></tec-command-item>
      <tec-command-item value="calculator" disabled><span>Calculator</span></tec-command-item>
    </tec-command-group>
    <tec-command-separator></tec-command-separator>
    <tec-command-group heading="Settings">
      <tec-command-item value="profile"><span>Profile</span><tec-command-shortcut>⌘P</tec-command-shortcut></tec-command-item>
      <tec-command-item value="billing"><span>Billing</span><tec-command-shortcut>⌘B</tec-command-shortcut></tec-command-item>
      <tec-command-item><span>Settings</span><tec-command-shortcut>⌘S</tec-command-shortcut></tec-command-item>
    </tec-command-group>
  </tec-command-list>
</tec-command>`

const inputOf = (el: Element) => el.querySelector("tec-command-input")!.input
const items = (el: Element) => [...el.querySelectorAll("tec-command-item")]
const visible = (el: Element) => items(el).filter((i) => !i.filtered).map((i) => i.key)
const active = (el: Element) => items(el).find((i) => i.highlighted) ?? null

describe("tec-command", () => {
  it("exposes a searchbox controlling a named menu of grouped items", async () => {
    const el = await fixture<TecCommand>(palette)
    expect(await axNode(inputOf(el))).toMatchObject({ role: "searchbox", name: "Type a command or search...", autocomplete: "list" })
    expect(await axTree(el.querySelector("tec-command-list")!)).toEqual([
      "menu: Suggestions",
      "group: Suggestions",
      "menuitem: Calendar",
      "menuitem: Search Emoji",
      "menuitem: Calculator [disabled]",
      "separator",
      "group: Settings",
      "menuitem: Profile ⌘P",
      "menuitem: Billing ⌘B",
      "menuitem: Settings ⌘S",
    ])
    expect(el.querySelector("tec-command-empty")!.matches(":state(shown)")).toBe(false)
    // The shortcut hides the check; items keep plain text as their key.
    expect(items(el)[5]!.key).toBe("Settings")
    await expectAccessible(el)
  })

  it("filters as you type: groups without matches and separators hide, the first match is highlighted", async () => {
    const el = await fixture<TecCommand>(palette)
    inputOf(el).focus()
    await userEvent.keyboard("se")
    await el.updateComplete
    expect(visible(el)).toEqual(["emoji", "Settings"])
    expect(el.querySelector("tec-command-separator")!.filtered).toBe(true)
    expect(active(el)?.key).toBe("emoji")
    expect(await axActiveDescendant(inputOf(el), items(el))).toBe(items(el)[1])
    await userEvent.keyboard("{Control>}a{/Control}smiley")
    await el.updateComplete
    expect(visible(el)).toEqual(["emoji"]) // keywords match
    await userEvent.keyboard("{Control>}a{/Control}zzz")
    await el.updateComplete
    expect(visible(el)).toEqual([])
    expect(el.querySelector("tec-command-empty")!.matches(":state(shown)")).toBe(true)
    expect(el.querySelectorAll("tec-command-group")[0]!.filtered).toBe(true)
    await expectAccessible(el)
  })

  it("arrows move (skipping disabled), Enter fires tec-select on the item", async () => {
    const el = await fixture<TecCommand>(palette)
    const selects = recordEvents<CustomEvent>(el, "tec-select")
    inputOf(el).focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(active(el)?.key).toBe("calendar")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    expect(active(el)?.key).toBe("profile")
    await userEvent.keyboard("{End}")
    expect(active(el)?.key).toBe("Settings")
    await userEvent.keyboard("{Home}")
    expect(active(el)?.key).toBe("calendar")
    await userEvent.keyboard("{Enter}")
    expect(selects.events).toHaveLength(1)
    expect(selects.events[0]!.target).toBe(items(el)[0])
    expect(selects.events[0]!.detail).toEqual({ value: "calendar" })
    // Clicking an item activates it and keeps focus in the input.
    await userEvent.click(items(el)[4]!)
    expect(selects.events[1]!.detail).toEqual({ value: "billing" })
    expect(el.querySelector("tec-command-input")!.shadowRoot!.activeElement).toBe(inputOf(el))
    items(el)[2]!.click()
    expect(selects.events).toHaveLength(2)
  })

  it("Escape clears the search first", async () => {
    const el = await fixture<TecCommand>(palette)
    inputOf(el).focus()
    await userEvent.keyboard("pro")
    await el.updateComplete
    await userEvent.keyboard("{Escape}")
    expect(el.search).toBe("")
    expect(inputOf(el).value).toBe("")
    await el.updateComplete
    expect(visible(el)).toHaveLength(6)
  })

  it("selection-mode multiple makes checkable items", async () => {
    const el = await fixture<TecCommand>(html`<tec-command>
      <tec-command-input aria-label="Filter"></tec-command-input>
      <tec-command-list selection-mode="multiple">
        <tec-command-item checked>Wells</tec-command-item>
        <tec-command-item>Rigs</tec-command-item>
      </tec-command-list>
    </tec-command>`)
    expect(await axTree(el.querySelector("tec-command-list")!)).toEqual(["menu: Suggestions", "menuitemcheckbox: Wells [checked]", "menuitemcheckbox: Rigs"])
    expect(await axNode(inputOf(el))).toMatchObject({ name: "Filter" })
    await userEvent.click(items(el)[1]!)
    expect(items(el)[1]!.checked).toBe(true)
    expect(getComputedStyle(items(el)[1]!.shadowRoot!.querySelector(".check")!).opacity).toBe("1")
  })

  it("custom filter function and fuzzy mode", async () => {
    const el = await fixture<TecCommand>(palette)
    el.filter = "fuzzy"
    el.search = "pfl"
    await el.updateComplete
    expect(visible(el)).toEqual(["profile"])
    el.filter = (text, query) => text.endsWith(query)
    el.search = "ing"
    await el.updateComplete
    expect(visible(el)).toEqual(["billing"])
  })
})

describe("tec-command-dialog", () => {
  it("opens modally, focuses the search, closes on Escape and restores focus", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <button>Open</button>
      <tec-command-dialog>${palette}</tec-command-dialog>
    </div>`)
    const dialogEl = root.querySelector("tec-command-dialog")! as TecCommandDialog
    const dialog = dialogEl.shadowRoot!.querySelector("dialog")!
    const opener = root.querySelector("button")!
    const events = recordEvents<CustomEvent>(dialogEl, "tec-open-change")
    opener.addEventListener("click", () => dialogEl.show())
    await userEvent.click(opener)
    await waitUntil(() => dialog.open)
    await animationsFinished(dialog)
    const cmd = dialogEl.querySelector("tec-command")!
    await waitUntil(() => cmd.querySelector("tec-command-input")!.shadowRoot!.activeElement === inputOf(cmd), "input focused")
    expect(await axNode(dialog)).toMatchObject({ role: "dialog", name: "Command Palette", description: "Search for a command to run...", modal: "true" })
    await expectAccessible(root)
    expect(items(cmd)[0]!.matches(":state(in-dialog)")).toBe(true)
    await userEvent.keyboard("bil")
    await userEvent.keyboard("{Escape}") // clears the search
    expect(dialogEl.open).toBe(true)
    await userEvent.keyboard("{Escape}") // closes
    await waitUntil(() => !dialog.open, "closed")
    expect(dialogEl.open).toBe(false)
    expect(events.events.map((e) => e.detail)).toEqual([{ open: false, reason: "escape" }])
    expect(document.activeElement).toBe(opener)
  })

  it("closes when an item is activated (unless cancelled) and on a backdrop press; reopening clears the search", async () => {
    const dialogEl = await fixture<TecCommandDialog>(html`<tec-command-dialog>${palette}</tec-command-dialog>`)
    const dialog = dialogEl.shadowRoot!.querySelector("dialog")!
    const cmd = dialogEl.querySelector("tec-command")!
    dialogEl.show()
    await waitUntil(() => dialog.open)
    cmd.addEventListener("tec-select", (e) => e.preventDefault(), { once: true })
    await userEvent.click(items(cmd)[0]!)
    await new Promise((r) => setTimeout(r, 20))
    expect(dialogEl.open).toBe(true)
    await userEvent.click(items(cmd)[1]!)
    await waitUntil(() => !dialog.open, "closed on select")
    cmd.search = "pro"
    dialogEl.show()
    await waitUntil(() => dialog.open)
    expect(cmd.search).toBe("")
    await animationsFinished(dialog)
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    await waitUntil(() => !dialog.open, "closed on backdrop")
  })
})
