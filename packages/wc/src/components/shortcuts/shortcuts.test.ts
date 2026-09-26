import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import { createShortcutRegistry, describeShortcut, formatShortcut, type Shortcut } from "./registry.js"
import { getShortcutRegistry } from "./shortcuts-context.js"
import type { TecShortcut } from "./shortcut.js"
import type { TecShortcutKeys } from "./shortcut-keys.js"
import type { TecShortcutList } from "./shortcut-list.js"
import type { TecShortcuts } from "./shortcuts.js"
import "./define.js"

const key = (init: KeyboardEventInit & { key: string }, target: EventTarget = document.body) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe("createShortcutRegistry", () => {
  it("registers, replaces by id, unregisters and notifies", () => {
    const registry = createShortcutRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)
    const a: Shortcut = { id: "a", keys: "n", label: "New", onAction: () => {} }
    const remove = registry.register([a, { id: "b", keys: "g w", label: "Go", onAction: () => {} }])
    expect(registry.getAll().map((s) => s.id)).toEqual(["a", "b"])
    registry.register({ ...a, label: "New well" })
    expect(registry.getAll().map((s) => s.label)).toEqual(["Go", "New well"])
    registry.unregister("b")
    expect(registry.getAll().map((s) => s.id)).toEqual(["a"])
    remove() // "a" was replaced, so the stale remover leaves the new one
    expect(registry.getAll().map((s) => s.id)).toEqual(["a"])
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it("matches chords, symbols with loose shift, sequences, and the latest registration wins", () => {
    const registry = createShortcutRegistry()
    const calls: string[] = []
    registry.register([
      { id: "save", keys: "ctrl+s", label: "Save", onAction: () => calls.push("save") },
      { id: "help", keys: "?", label: "Help", onAction: () => calls.push("help") },
      { id: "go", keys: "g w", label: "Go", onAction: () => calls.push("go") },
      { id: "n1", keys: "n", label: "One", onAction: () => calls.push("n1") },
      { id: "n2", keys: "n", label: "Two", onAction: () => calls.push("n2") },
    ])
    expect(registry.handleKeyDown(key({ key: "s", ctrlKey: true }))).toBe(true)
    expect(registry.handleKeyDown(key({ key: "s" }))).toBe(false)
    expect(registry.handleKeyDown(key({ key: "?", shiftKey: true }))).toBe(true)
    const first = key({ key: "g" })
    expect(registry.handleKeyDown(first)).toBe(true) // pending: swallowed
    expect(first.defaultPrevented).toBe(true)
    expect(registry.handleKeyDown(key({ key: "w" }))).toBe(true)
    expect(registry.handleKeyDown(key({ key: "n" }))).toBe(true)
    expect(calls).toEqual(["save", "help", "go", "n2"])
  })

  it("matches the physical key when the character hides it (Option on a Mac, non-Latin layouts)", () => {
    const registry = createShortcutRegistry()
    const onAction = vi.fn()
    registry.register({ id: "k", keys: "alt+k", label: "K", onAction })
    registry.register({ id: "w", keys: "w", label: "W", onAction })
    registry.handleKeyDown(key({ key: "˚", code: "KeyK", altKey: true }))
    registry.handleKeyDown(key({ key: "ц", code: "KeyW" }))
    expect(onAction).toHaveBeenCalledTimes(2)
  })

  it("skips unmodified keys in text fields (through shadow roots), disabled shortcuts and repeats", async () => {
    const registry = createShortcutRegistry()
    const plain = vi.fn()
    const modified = vi.fn()
    let enabled = false
    registry.register([
      { id: "n", keys: "n", label: "New", onAction: plain },
      { id: "save", keys: "ctrl+s", label: "Save", onAction: modified },
      { id: "x", keys: "x", label: "X", onAction: plain, isEnabled: () => enabled },
    ])
    const host = await fixture<HTMLDivElement>(html`<div></div>`)
    const input = host.attachShadow({ mode: "open" }).appendChild(document.createElement("input"))
    let handled: boolean | undefined
    host.addEventListener("keydown", (e) => (handled = registry.handleKeyDown(e)), { once: true })
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true, composed: true, cancelable: true }))
    expect(handled).toBe(false)
    host.addEventListener("keydown", (e) => registry.handleKeyDown(e), { once: true })
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, composed: true, cancelable: true }))
    expect(modified).toHaveBeenCalledTimes(1)
    expect(registry.handleKeyDown(key({ key: "x" }))).toBe(false)
    enabled = true
    expect(registry.handleKeyDown(key({ key: "x" }))).toBe(true)
    const repeat = key({ key: "n", repeat: true })
    expect(registry.handleKeyDown(repeat)).toBe(true)
    expect(repeat.defaultPrevented).toBe(true)
    expect(plain).toHaveBeenCalledTimes(1)
  })

  it("formats caps per platform and describes them for screen readers", () => {
    expect(formatShortcut("mod+k", false)).toEqual([["Ctrl", "K"]])
    expect(formatShortcut("mod+k", true)).toEqual([["⌘", "K"]])
    expect(formatShortcut("shift+alt+enter", false)).toEqual([["Alt", "Shift", "↵"]])
    expect(formatShortcut("g w", false)).toEqual([["G"], ["W"]])
    expect(describeShortcut("g w", false)).toBe("G, then W")
    expect(describeShortcut("ctrl+shift+p", false)).toBe("Ctrl + Shift + P")
  })
})

describe("tec-shortcuts", () => {
  it("listens on the document and fires tec-shortcut on the declaring element", async () => {
    const root = await fixture<TecShortcuts>(html`<tec-shortcuts>
      <tec-shortcut name="new" keys="n" label="Create well" group="Wells"></tec-shortcut>
      <input aria-label="Name" />
    </tec-shortcuts>`)
    const shortcut = root.querySelector<TecShortcut>("tec-shortcut")!
    const events = recordEvents<CustomEvent>(root, "tec-shortcut")
    await userEvent.keyboard("n")
    expect(events.events.map((e) => [e.target, e.detail.id, e.detail.keys])).toEqual([[shortcut, "new", "n"]])
    // Not while typing.
    root.querySelector("input")!.focus()
    await userEvent.keyboard("n")
    expect(events.events).toHaveLength(1)
    expect(root.querySelector("input")!.value).toBe("n")
    // Disabled: skipped. Removed: unregistered.
    ;(document.activeElement as HTMLElement).blur()
    shortcut.disabled = true
    await userEvent.keyboard("n")
    expect(events.events).toHaveLength(1)
    shortcut.disabled = false
    shortcut.remove()
    expect(root.activeRegistry.getAll()).toEqual([])
  })

  it("nested providers share the parent's registry unless scoped", async () => {
    const root = await fixture<TecShortcuts>(html`<tec-shortcuts>
      <tec-shortcuts id="inner"><tec-shortcut name="a" keys="a" label="A"></tec-shortcut></tec-shortcuts>
      <tec-shortcuts id="scoped" scoped>
        <tec-shortcut name="b" keys="b" label="B"></tec-shortcut>
        <button>In scope</button>
      </tec-shortcuts>
    </tec-shortcuts>`)
    const inner = root.querySelector<TecShortcuts>("#inner")!
    const scoped = root.querySelector<TecShortcuts>("#scoped")!
    await inner.updateComplete
    await scoped.updateComplete
    expect(inner.activeRegistry).toBe(root.activeRegistry)
    expect(scoped.activeRegistry).not.toBe(root.activeRegistry)
    expect(root.activeRegistry.getAll().map((s) => s.id)).toEqual(["a"])
    expect(getShortcutRegistry(scoped.querySelector("button")!)).toBe(scoped.activeRegistry)

    const events = recordEvents<CustomEvent>(root, "tec-shortcut")
    await userEvent.keyboard("a")
    await userEvent.keyboard("b") // focus is outside the scoped region
    expect(events.events.map((e) => e.detail.id)).toEqual(["a"])
    scoped.querySelector("button")!.focus()
    await userEvent.keyboard("b")
    expect(events.events.map((e) => e.detail.id)).toEqual(["a", "b"])
  })

  it("uses a registry handed to it, which scripts can register against", async () => {
    const registry = createShortcutRegistry()
    const root = await fixture<TecShortcuts>(html`<tec-shortcuts .registry=${registry}><p>App</p></tec-shortcuts>`)
    const onAction = vi.fn()
    const remove = getShortcutRegistry(root.querySelector("p")!)!.register({ id: "k", keys: "mod+k", label: "Search", onAction })
    expect(registry.getAll().map((s) => s.id)).toEqual(["k"])
    await userEvent.keyboard("{Control>}k{/Control}")
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(onAction).toHaveBeenCalledTimes(1)
    remove()
    root.remove()
    await userEvent.keyboard("{Control>}k{/Control}")
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

describe("tec-shortcut-list", () => {
  it("lists the visible shortcuts by group and follows registrations", async () => {
    const root = await fixture<TecShortcuts>(html`<tec-shortcuts>
      <tec-shortcut name="new" keys="n" label="Create well" group="Wells"></tec-shortcut>
      <tec-shortcut name="go" keys="g w" label="Go to wells" group="Navigate"></tec-shortcut>
      <tec-shortcut name="save" keys="ctrl+s" label="Save" group="Wells"></tec-shortcut>
      <tec-shortcut name="secret" keys="x" label="Secret" unlisted></tec-shortcut>
      <tec-shortcut-list platform="other"></tec-shortcut-list>
    </tec-shortcuts>`)
    const list = root.querySelector<TecShortcutList>("tec-shortcut-list")!
    await list.updateComplete
    const rows = () =>
      [...list.shadowRoot!.querySelectorAll(".group")].map((group) => [
        group.querySelector(".group-label")!.textContent,
        [...group.querySelectorAll(".label")].map((l) => l.textContent),
      ])
    expect(rows()).toEqual([
      ["Wells", ["Create well", "Save"]],
      ["Navigate", ["Go to wells"]],
    ])
    expect(await axNode(list.shadowRoot!.querySelector("ul")!)).toMatchObject({ role: "list", name: "Wells" })
    root.querySelector("tec-shortcut[name=save]")!.remove()
    root.querySelector<TecShortcut>("tec-shortcut[name=new]")!.label = "New well"
    await list.updateComplete
    await new Promise((r) => requestAnimationFrame(r))
    await list.updateComplete
    // Registering again (a new label) moves the shortcut to the end: the latest registration wins.
    expect(rows()).toEqual([
      ["Navigate", ["Go to wells"]],
      ["Wells", ["New well"]],
    ])
    await expectAccessible(root)
  })
})

describe("tec-shortcut-keys", () => {
  it("renders caps hidden from assistive technology and reads the shortcut as text", async () => {
    const root = await fixture<HTMLDivElement>(html`<div>
      <tec-shortcut-keys keys="mod+k" platform="other"></tec-shortcut-keys>
      <tec-shortcut-keys keys="g w" platform="other"></tec-shortcut-keys>
      <tec-shortcut-keys keys="mod+shift+p" platform="mac"></tec-shortcut-keys>
    </div>`)
    const [chord, sequence, mac] = [...root.querySelectorAll<TecShortcutKeys>("tec-shortcut-keys")]
    const caps = (el: TecShortcutKeys) => [...el.shadowRoot!.querySelectorAll("kbd")].map((k) => k.textContent)
    expect(caps(chord!)).toEqual(["Ctrl", "K"])
    expect(caps(sequence!)).toEqual(["G", "W"])
    expect(sequence!.shadowRoot!.querySelector("[part=then]")!.textContent).toBe("then")
    expect(caps(mac!)).toEqual(["⇧", "⌘", "P"])
    expect(chord!.shadowRoot!.querySelector(".sr-only")!.textContent).toBe("Ctrl + K")
    expect(sequence!.shadowRoot!.querySelector(".sr-only")!.textContent).toBe("G, then W")
    expect((await axNode(chord!.shadowRoot!.querySelector("kbd")!)).ignored).toBe("true")
    await expectAccessible(root)
  })
})
