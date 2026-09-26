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
const tooltip = (el: TecAppShellAction) => el.shadowRoot!.querySelector(".tooltip") as HTMLElement

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
    expect(tooltip(help).textContent).toContain("Help")
    expect([...tooltip(help).querySelectorAll("kbd")].map((k) => k.textContent)).toEqual(["Shift", "?"])
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
    const caps = [...el.shadowRoot!.querySelectorAll("kbd")].map((k) => k.textContent)
    expect(caps[caps.length - 1]).toBe("K")
    expect(["⌘", "Ctrl"]).toContain(caps[0])
    // Narrow viewport (the test frame): the icon-button form.
    expect(button.getBoundingClientRect().width).toBe(28)
  })

  it("defaults the name to Search and can hide the hint", async () => {
    const el = await fixture<TecAppShellCommandTrigger>(html`<tec-app-shell-command-trigger hide-shortcut></tec-app-shell-command-trigger>`)
    expect(await axNode(el.shadowRoot!.querySelector("button")!)).toMatchObject({ name: "Search" })
    expect(el.shadowRoot!.querySelector("kbd")).toBeNull()
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
    await waitUntil(() => user.shadowRoot!.querySelector(".fallback"), "image error falls back to initials")
    expect(user.shadowRoot!.querySelector(".fallback")!.textContent).toBe("SE")
    expect(user.shadowRoot!.querySelector(".avatar")!.getBoundingClientRect().width).toBe(24)
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
    h2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y, button: 0, pointerType: "mouse" }))
    h2.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x - 80, clientY: y, pointerType: "mouse" }))
    h2.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: x - 80, clientY: y, pointerType: "mouse" }))
    expect(s2.sizes).toEqual([60, 40])
    expect(widths(ltr)).toEqual([480, 320])
  })

  it("gives the whole space to the visible panels when one is hidden", async () => {
    const root = await fixture<HTMLElement>(split({ hidden: true }))
    const el = root.querySelector<TecAppShellSplit>("tec-app-shell-split")!
    await waitUntil(() => el.sizes.length === 1)
    expect(el.sizes).toEqual([100])
    expect(widths(root)[0]).toBe(801)
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
  })
})
