import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecAppShellAction, TecAppShellCommandTrigger, TecAppShellUserMenuTrigger } from "./app-shell-action.js"
import type { TecAppShellSplit, TecAppShellSplitHandle } from "./app-shell-split.js"
import "./define.js"

const svg = html`<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>`

const shell = () => html`<tec-app-shell style="height: 400px; width: 900px">
  <tec-app-shell-header>
    <tec-app-shell-brand>${svg} Tecton</tec-app-shell-brand>
    <tec-app-shell-nav aria-label="Application"><a href="#wells">Wells</a><a href="#fda">FDA</a></tec-app-shell-nav>
    <tec-app-shell-actions>
      <tec-app-shell-action label="Help" shortcut="shift+?">${svg}</tec-app-shell-action>
      <tec-app-shell-divider></tec-app-shell-divider>
      <tec-app-shell-action label="Settings">${svg}</tec-app-shell-action>
    </tec-app-shell-actions>
  </tec-app-shell-header>
  <tec-app-shell-body>
    <tec-app-shell-sidebar aria-label="Project"><p>Tree</p></tec-app-shell-sidebar>
    <tec-app-shell-main><p>Work area</p></tec-app-shell-main>
    <tec-app-shell-aside aria-label="Properties"><p>Panel</p></tec-app-shell-aside>
  </tec-app-shell-body>
</tec-app-shell>`

const inner = (el: Element) => el.shadowRoot!.querySelector("tec-button")!.shadowRoot!.querySelector("button")!
// The action renders a real tec-tooltip; its bubble is the tooltip's `content` part.
const tooltip = (el: TecAppShellAction) => el.shadowRoot!.querySelector("tec-tooltip")!.shadowRoot!.querySelector(".content") as HTMLElement
const caps = (el: Element) => [...el.shadowRoot!.querySelector("tec-shortcut-keys")!.shadowRoot!.querySelectorAll("kbd")].map((k) => k.textContent)

describe("tec-app-shell layout", () => {
  it("lays out the header (48px), a 256px sidebar, a 320px aside and the main area", async () => {
    const root = await fixture<HTMLElement>(shell())
    const rect = (sel: string) => root.querySelector(sel)!.getBoundingClientRect()
    expect(root.getBoundingClientRect().height).toBe(400)
    expect(rect("tec-app-shell-header").height).toBe(48)
    expect(rect("tec-app-shell-body").height).toBe(352)
    expect(rect("tec-app-shell-sidebar").width).toBe(256)
    expect(rect("tec-app-shell-aside").width).toBe(320)
    expect(rect("tec-app-shell-main").width).toBe(900 - 256 - 320)
    expect(rect("tec-app-shell-main").height).toBe(352)
    // The action cluster is pinned to the end of the header (12px padding).
    expect(Math.round(rect("tec-app-shell-header").right - rect("tec-app-shell-actions tec-app-shell-action:last-child").right)).toBe(12)
  })

  it("fills the viewport by default", async () => {
    const root = await fixture<HTMLElement>(html`<tec-app-shell><tec-app-shell-body></tec-app-shell-body></tec-app-shell>`)
    expect(Math.round(root.getBoundingClientRect().height)).toBe(Math.round(window.innerHeight))
  })

  it("exposes the landmarks and passes axe", async () => {
    const root = await fixture<HTMLElement>(shell())
    expect(await axNode(root.querySelector("tec-app-shell-header")!.shadowRoot!.querySelector("header")!)).toMatchObject({ role: "banner" })
    expect(await axNode(root.querySelector("tec-app-shell-nav")!)).toMatchObject({ role: "navigation", name: "Application" })
    expect(await axNode(root.querySelector("tec-app-shell-sidebar")!)).toMatchObject({ role: "complementary", name: "Project" })
    expect(await axNode(root.querySelector("tec-app-shell-main")!)).toMatchObject({ role: "main" })
    expect(await axNode(root.querySelector("tec-app-shell-aside")!)).toMatchObject({ role: "complementary", name: "Properties" })
    expect(await axNode(root.querySelector("tec-app-shell-divider")!)).toMatchObject({ role: "separator", orientation: "vertical" })
    await expectAccessible(root)
  })

  it("keeps the sidebar and aside surfaces with logical borders (RTL)", async () => {
    const root = await fixture<HTMLElement>(shell(), { dir: "rtl" })
    const sidebar = root.querySelector("tec-app-shell-sidebar")!
    const base = sidebar.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(base).borderLeftWidth).toBe("1px")
    expect(getComputedStyle(base).borderRightWidth).toBe("0px")
    expect(sidebar.getBoundingClientRect().right).toBe(root.getBoundingClientRect().right)
  })
})

describe("tec-app-shell-action", () => {
  it("is a named ghost icon button whose shortcut is its description", async () => {
    const root = await fixture<HTMLElement>(shell())
    const help = root.querySelector<TecAppShellAction>("tec-app-shell-action")!
    expect(await axNode(inner(help))).toMatchObject({ role: "button", name: "Help", description: "Shift + ?" })
    expect(await axNode(inner(root.querySelectorAll("tec-app-shell-action")[1]))).toMatchObject({ name: "Settings" })
  })

  it("shows the tooltip on keyboard focus (with the key caps) and hides it on Escape and blur", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 60px"><button id="before">Before</button>${shell()}</div>`)
    const help = root.querySelector<TecAppShellAction>("tec-app-shell-action")!
    root.querySelector<HTMLButtonElement>("#before")!.focus()
    await userEvent.keyboard("{Tab}{Tab}{Tab}")
    expect(deepActiveElement()).toBe(inner(help))
    await waitUntil(() => tooltip(help).matches(":popover-open"), "tooltip open")
    await animationsFinished(tooltip(help))
    expect(help.matches(":state(tooltip-open)")).toBe(true)
    expect(help.shadowRoot!.querySelector("tec-tooltip")!.textContent).toContain("Help")
    expect(caps(help)).toEqual(["Shift", "?"])
    // The open tooltip describes the button with the key hint only (the label is already its name).
    expect(await axNode(inner(help))).toMatchObject({ name: "Help", description: "Shift + ?" })
    const t = tooltip(help).getBoundingClientRect()
    expect(Math.round(t.top - help.getBoundingClientRect().bottom)).toBe(4)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !tooltip(help).matches(":popover-open"), "tooltip closed on Escape")
    await userEvent.keyboard("{Tab}")
    await waitUntil(() => tooltip(root.querySelectorAll<TecAppShellAction>("tec-app-shell-action")[1]).matches(":popover-open"), "next tooltip")
  })

  it("shows the tooltip on hover, not on a mouse press", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 60px">${shell()}</div>`)
    const help = root.querySelector<TecAppShellAction>("tec-app-shell-action")!
    await userEvent.hover(help)
    await waitUntil(() => tooltip(help).matches(":popover-open"), "hover opens")
    await userEvent.click(help)
    await waitUntil(() => !tooltip(help).matches(":popover-open"), "press closes")
    await userEvent.unhover(help)
  })

  it("keeps the tooltip's tec-open-change inside and shares the page's tooltip timing", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 60px">${shell()}</div>`)
    const [help, settings] = root.querySelectorAll<TecAppShellAction>("tec-app-shell-action")
    const { events } = recordEvents(root, "tec-open-change")
    await userEvent.hover(help)
    await waitUntil(() => tooltip(help).matches(":popover-open"), "hover opens")
    await userEvent.hover(settings)
    // Only one tooltip at a time: moving to the next action switches at once.
    await waitUntil(() => tooltip(settings).matches(":popover-open") && !tooltip(help).matches(":popover-open"), "switched")
    expect(events.length).toBe(0)
    await userEvent.unhover(settings)
  })

  it("draws the tooltip key caps inverted", async () => {
    const root = await fixture<HTMLElement>(shell())
    const help = root.querySelector<TecAppShellAction>("tec-app-shell-action")!
    const kbd = help.shadowRoot!.querySelector("tec-shortcut-keys")!.shadowRoot!.querySelector("kbd")!
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-background)"
    root.append(probe)
    expect(getComputedStyle(kbd).color).toBe(getComputedStyle(probe).color)
  })

  it("forwards aria-expanded / aria-haspopup set by a menu", async () => {
    const root = await fixture<HTMLElement>(shell())
    const help = root.querySelector<TecAppShellAction>("tec-app-shell-action")!
    help.setAttribute("aria-haspopup", "menu")
    help.setAttribute("aria-expanded", "true")
    await waitUntil(() => inner(help).getAttribute("aria-expanded") === "true")
    expect(await axNode(inner(help))).toMatchObject({ expanded: "true", hasPopup: "menu" })
  })
})

describe("tec-app-shell-command-trigger", () => {
  it("is named by its text, fires click and draws the mod+k hint", async () => {
    const el = await fixture<TecAppShellCommandTrigger>(html`<tec-app-shell-command-trigger>Search or jump to…</tec-app-shell-command-trigger>`)
    const button = el.shadowRoot!.querySelector("button")!
    expect(await axNode(button)).toMatchObject({ role: "button", name: "Search or jump to…" })
    const clicks = recordEvents(el, "click")
    await userEvent.click(el)
    expect(clicks.events.length).toBe(1)
    const keys = caps(el)
    expect(keys[keys.length - 1]).toBe("K")
    expect(["⌘", "Ctrl"]).toContain(keys[0])
    // Narrow viewport (the test frame): the icon-button form.
    expect(button.getBoundingClientRect().width).toBe(28)
  })

  it("keeps the key chord left to right in RTL", async () => {
    // (The hint itself shows from the lg breakpoint, wider than the test frame.)
    const root = await fixture<HTMLElement>(html`<div><tec-app-shell-command-trigger>Search</tec-app-shell-command-trigger></div>`, { dir: "rtl" })
    const keys = root.querySelector("tec-app-shell-command-trigger")!.shadowRoot!.querySelector("tec-shortcut-keys")!
    expect(getComputedStyle(keys).direction).toBe("ltr")
    expect(getComputedStyle(keys.shadowRoot!.querySelector("kbd")!).direction).toBe("ltr")
  })

  it("defaults the name to Search and can hide the hint", async () => {
    const el = await fixture<TecAppShellCommandTrigger>(html`<tec-app-shell-command-trigger hide-shortcut></tec-app-shell-command-trigger>`)
    expect(await axNode(el.shadowRoot!.querySelector("button")!)).toMatchObject({ name: "Search" })
    expect(el.shadowRoot!.querySelector("tec-shortcut-keys")).toBeNull()
    await expectAccessible(el)
  })
})

describe("menu triggers", () => {
  it("overflow and user menu triggers are named buttons with an avatar fallback", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-app-shell-overflow-trigger></tec-app-shell-overflow-trigger>
      <tec-app-shell-user-menu-trigger name="Sarah Elliott" image="/does-not-exist.png"></tec-app-shell-user-menu-trigger>
    </div>`)
    const overflow = root.querySelector("tec-app-shell-overflow-trigger")!
    const user = root.querySelector<TecAppShellUserMenuTrigger>("tec-app-shell-user-menu-trigger")!
    expect(await axNode(inner(overflow))).toMatchObject({ role: "button", name: "More" })
    expect(await axNode(inner(user))).toMatchObject({ role: "button", name: "Account: Sarah Elliott" })
    // A tec-avatar (sm): the failed picture falls back to the initials derived from the name.
    const fallback = user.shadowRoot!.querySelector("tec-avatar-fallback")!
    await waitUntil(() => user.shadowRoot!.querySelector("tec-avatar-image")!.matches(":state(error)"), "image error")
    expect(fallback.textContent).toBe("SE")
    expect(fallback.checkVisibility()).toBe(true)
    expect(user.shadowRoot!.querySelector("tec-avatar")!.getBoundingClientRect().width).toBe(24)
    await expectAccessible(root)
  })
})

const split = (o: { dir?: string; hidden?: boolean } = {}) => html`<div dir=${o.dir ?? "ltr"} style="display: flex; width: 801px; height: 300px">
  <tec-app-shell-split>
    <tec-app-shell-split-panel min-size="40%"><tec-app-shell-main>Main</tec-app-shell-main></tec-app-shell-split-panel>
    <tec-app-shell-split-handle style=${o.hidden ? "display: none" : ""}></tec-app-shell-split-handle>
    <tec-app-shell-split-panel default-size="240px" min-size="160px" max-size="50%" style=${o.hidden ? "display: none" : ""}>
      <tec-app-shell-aside aria-label="Properties">Aside</tec-app-shell-aside>
    </tec-app-shell-split-panel>
  </tec-app-shell-split>
</div>`

const widths = (root: Element) => [...root.querySelectorAll("tec-app-shell-split-panel")].map((p) => Math.round(p.getBoundingClientRect().width))

describe("tec-app-shell-split", () => {
  it("sizes panels from px defaults, and the aside fills its panel without a border", async () => {
    const root = await fixture<HTMLElement>(split())
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    await waitUntil(() => widths(root)[1] === 240, "aside panel is 240px")
    expect(widths(root)).toEqual([560, 240])
    expect(el.sizes).toEqual([70, 30])
    const aside = root.querySelector("tec-app-shell-aside")!
    expect(Math.round(aside.getBoundingClientRect().width)).toBe(240)
    expect(getComputedStyle(aside.shadowRoot!.querySelector(".base")!).borderLeftWidth).toBe("0px")
  })

  it("is a window splitter: value, limits, arrows (5%), Home/End, events", async () => {
    const root = await fixture<HTMLElement>(split())
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const handle = root.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    await waitUntil(() => el.sizes[0] === 70)
    expect(await axNode(handle)).toMatchObject({ role: "separator", orientation: "vertical", valuemin: "50", valuemax: "80" })
    expect(handle.getAttribute("tabindex")).toBe("0")
    const { events } = recordEvents<CustomEvent>(el, "tec-layout-change")
    handle.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.sizes).toEqual([65, 35])
    expect(events[0].detail.sizes).toEqual([65, 35])
    expect((handle as unknown as { internals: ElementInternals }).internals.ariaValueNow).toBe("65")
    await userEvent.keyboard("{Home}")
    // The aside's max-size (50%) stops it.
    expect(el.sizes).toEqual([50, 50])
    await userEvent.keyboard("{End}")
    // The aside's min-size (160px of 800px = 20%).
    expect(el.sizes).toEqual([80, 20])
    await expectAccessible(root)
  })

  it("mirrors the arrow keys in RTL and resizes by dragging", async () => {
    const root = await fixture<HTMLElement>(split({ dir: "rtl" }))
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const handle = root.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    await waitUntil(() => el.sizes[0] === 70)
    handle.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.sizes).toEqual([75, 25])

    const ltr = await fixture<HTMLElement>(split())
    const s2 = ltr.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const h2 = ltr.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    await waitUntil(() => s2.sizes[0] === 70)
    const r = h2.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + 50
    const { events } = recordEvents<CustomEvent>(s2, "tec-layout-change")
    h2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y, button: 0, pointerType: "mouse" }))
    h2.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x - 80, clientY: y, pointerType: "mouse" }))
    expect(h2.matches(":state(active)")).toBe(true)
    expect(events.length).toBe(0)
    h2.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: x - 80, clientY: y, pointerType: "mouse" }))
    expect(s2.sizes).toEqual([60, 40])
    expect(widths(ltr)).toEqual([480, 320])
    // One event at the end of the drag, as tec-resizable-group.
    expect(events.map((e) => e.detail.layout)).toEqual([[60, 40]])
    // Double-click restores the default size of the panel before the handle (none here: no change).
    h2.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(s2.sizes).toEqual([60, 40])
  })

  it("gives the whole space to the visible panels when one is hidden, and takes it back", async () => {
    const root = await fixture<HTMLElement>(split({ hidden: true }))
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    await waitUntil(() => el.sizes.length === 1)
    expect(el.sizes).toEqual([100])
    expect(widths(root)[0]).toBe(801)
    for (const hidden of root.querySelectorAll<HTMLElement>("tec-app-shell-split-handle, tec-app-shell-split-panel[default-size]")) hidden.style.display = ""
    await waitUntil(() => el.sizes.length === 2, "the aside is back")
    expect(el.sizes).toEqual([70, 30])
  })

  it("keeps px sizes constant when the window resizes, restores a saved layout and resets on double-click", async () => {
    const root = await fixture<HTMLElement>(split())
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const handle = root.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    await waitUntil(() => el.sizes[0] === 70)
    root.style.width = "481px"
    await waitUntil(() => widths(root)[1] === 240, "the aside keeps 240px")
    el.layout = [55, 45]
    expect(el.sizes).toEqual([55, 45])
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    // The panel before the handle has no default-size: nothing to restore.
    expect(el.layout).toEqual([55, 45])
  })

  it("collapses a collapsible panel with Enter and restores it", async () => {
    const root = await fixture<HTMLElement>(html`<div style="display: flex; width: 800px; height: 200px">
      <tec-app-shell-split>
        <tec-app-shell-split-panel default-size="25%" min-size="15%" collapsible>Nav</tec-app-shell-split-panel>
        <tec-app-shell-split-handle with-handle></tec-app-shell-split-handle>
        <tec-app-shell-split-panel>Main</tec-app-shell-split-panel>
      </tec-app-shell-split>
    </div>`)
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const handle = root.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    await waitUntil(() => el.sizes[0] === 25)
    handle.focus()
    await userEvent.keyboard("{Enter}")
    expect(el.sizes).toEqual([0, 100])
    expect(root.querySelector("tec-app-shell-split-panel")!.matches(":state(collapsed)")).toBe(true)
    await userEvent.keyboard("{Enter}")
    expect(el.sizes).toEqual([25, 75])
    // Home collapses a collapsible panel; keyboard steps snap across the minimum.
    await userEvent.keyboard("{Home}")
    expect(el.sizes).toEqual([0, 100])
    await userEvent.keyboard("{ArrowRight}")
    expect(el.sizes).toEqual([15, 85])
    await userEvent.keyboard("{ArrowLeft}")
    expect(el.sizes).toEqual([0, 100])
    await userEvent.keyboard("{ArrowRight}")
    expect(el.sizes).toEqual([15, 85])
    // Double-click restores the default size.
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(el.sizes).toEqual([25, 75])
  })

  it("draws the divider in the shell's colours and can be disabled", async () => {
    const root = await fixture<HTMLElement>(split())
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    const handle = root.querySelector<TecAppShellSplitHandle>("tec-app-shell-split-handle")!
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-border-subtle)"
    root.append(probe)
    expect(getComputedStyle(handle.shadowRoot!.querySelector(".base")!).backgroundColor).toBe(getComputedStyle(probe).color)
    el.disabled = true
    await el.updateComplete
    await handle.updateComplete
    expect(handle.hasAttribute("tabindex")).toBe(false)
    expect(await axNode(handle)).toMatchObject({ role: "separator", disabled: "true" })
  })
})
