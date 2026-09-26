import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import "./define.js"
import type { TecSidebar } from "./sidebar.js"
import type { TecSidebarMenuButton } from "./sidebar-menu.js"
import type { TecSidebarProvider } from "./sidebar-provider.js"

const clearCookie = () => (document.cookie = "sidebar_state=; path=/; max-age=0")
afterEach(() => {
  clearCookie()
  localStorage.removeItem("sidebar_state")
})

interface Opts {
  collapsible?: string
  variant?: string
  side?: string
  breakpoint?: number
  collapsed?: boolean
  persist?: string
  shortcut?: string
}

/** A layout bounded by a transformed wrapper (the fixed container stays inside it). */
const layout = (o: Opts = {}) => html`<div style="transform: translateZ(0); width: 400px; height: 360px; overflow: hidden">
  <tec-sidebar-provider
    style="min-height: 0; height: 100%"
    mobile-breakpoint=${o.breakpoint ?? 200}
    persist=${o.persist ?? "cookie"}
    shortcut=${o.shortcut ?? "b"}
    ?collapsed=${o.collapsed}
  >
    <tec-sidebar collapsible=${o.collapsible ?? "offcanvas"} variant=${o.variant ?? "sidebar"} side=${o.side ?? "left"}>
      <tec-sidebar-header><tec-sidebar-input aria-label="Search" placeholder="Search"></tec-sidebar-input></tec-sidebar-header>
      <tec-sidebar-content>
        <tec-sidebar-group>
          <tec-sidebar-group-label>Project</tec-sidebar-group-label>
          <tec-sidebar-group-action aria-label="Add project">+</tec-sidebar-group-action>
          <tec-sidebar-menu>
            <tec-sidebar-menu-item>
              <tec-sidebar-menu-button href="#overview" active tooltip="Overview"><svg viewBox="0 0 16 16"></svg><span>Overview</span></tec-sidebar-menu-button>
              <tec-sidebar-menu-badge>4</tec-sidebar-menu-badge>
            </tec-sidebar-menu-item>
            <tec-sidebar-menu-item>
              <tec-sidebar-menu-button href="#wells" tooltip="Wells"><svg viewBox="0 0 16 16"></svg><span>Wells</span></tec-sidebar-menu-button>
              <tec-sidebar-menu-action show-on-hover aria-label="More">…</tec-sidebar-menu-action>
              <tec-sidebar-menu-sub>
                <tec-sidebar-menu-sub-item><tec-sidebar-menu-sub-button href="#a12" active><span>34/10-A-12</span></tec-sidebar-menu-sub-button></tec-sidebar-menu-sub-item>
              </tec-sidebar-menu-sub>
            </tec-sidebar-menu-item>
          </tec-sidebar-menu>
        </tec-sidebar-group>
      </tec-sidebar-content>
      <tec-sidebar-separator></tec-sidebar-separator>
      <tec-sidebar-footer><tec-sidebar-menu><tec-sidebar-menu-item><tec-sidebar-menu-button size="lg">Lena Haugen</tec-sidebar-menu-button></tec-sidebar-menu-item></tec-sidebar-menu></tec-sidebar-footer>
      <tec-sidebar-rail></tec-sidebar-rail>
    </tec-sidebar>
    <tec-sidebar-inset>
      <header><tec-sidebar-trigger></tec-sidebar-trigger></header>
      <p>Content</p>
    </tec-sidebar-inset>
  </tec-sidebar-provider>
</div>`

async function setup(o: Opts = {}, dir?: "rtl") {
  const root = await fixture<HTMLElement>(layout(o), dir ? { dir } : {})
  const provider = root.querySelector<TecSidebarProvider>("tec-sidebar-provider")!
  const sidebar = root.querySelector<TecSidebar>("tec-sidebar")!
  const trigger = root.querySelector("tec-sidebar-trigger")!
  const container = () => sidebar.shadowRoot!.querySelector<HTMLElement>(".container")!
  const settle = async () => {
    await provider.updateComplete
    await sidebar.updateComplete
    await new Promise((r) => requestAnimationFrame(r))
    const c = sidebar.shadowRoot!.querySelector(".container")
    if (c) await Promise.all(c.getAnimations().map((a) => a.finished.catch(() => undefined)))
  }
  return { root, provider, sidebar, trigger, container, settle }
}

describe("tec-sidebar (desktop)", () => {
  it("lays out the sidebar and the content side by side", async () => {
    const { root, sidebar, container } = await setup()
    const inset = root.querySelector("tec-sidebar-inset")!
    expect(sidebar.matches(":state(expanded)")).toBe(true)
    expect(container().getBoundingClientRect().width).toBe(256)
    expect(inset.getBoundingClientRect().left - root.getBoundingClientRect().left).toBe(256)
    expect(await axNode(inset.shadowRoot!.querySelector("main")!)).toMatchObject({ role: "main" })
    await expectAccessible(root)
  })

  it("toggles off-canvas from the trigger, fires a cancelable event and persists the state in a cookie", async () => {
    const { root, provider, sidebar, trigger, container, settle } = await setup()
    const inner = trigger.shadowRoot!.querySelector("button")!
    expect(await axNode(inner)).toMatchObject({ role: "button", name: "Toggle Sidebar", expanded: "true" })
    const { events } = recordEvents<CustomEvent>(provider, "tec-open-change")
    await userEvent.click(trigger)
    await settle()
    expect(events.map((e) => e.detail)).toEqual([{ open: false, mobile: false, reason: "trigger" }])
    expect(provider.collapsed).toBe(true)
    expect(sidebar.matches(":state(offcanvas)")).toBe(true)
    expect(container().getBoundingClientRect().right).toBeLessThanOrEqual(root.getBoundingClientRect().left)
    expect(document.cookie).toContain("sidebar_state=false")
    expect(await axNode(inner)).toMatchObject({ expanded: "false" })

    provider.addEventListener("tec-open-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(trigger)
    await settle()
    expect(provider.collapsed).toBe(true)
  })

  it("restores the persisted state (cookie or localStorage) on connect", async () => {
    document.cookie = "sidebar_state=false; path=/"
    const a = await setup()
    expect(a.provider.open).toBe(false)
    clearCookie()
    localStorage.setItem("sidebar_state", "false")
    const b = await setup({ persist: "local-storage" })
    expect(b.provider.collapsed).toBe(true)
    await userEvent.click(b.trigger)
    expect(localStorage.getItem("sidebar_state")).toBe("true")
    const c = await setup({ persist: "none", collapsed: true })
    await userEvent.click(c.trigger)
    expect(document.cookie).not.toContain("sidebar_state")
  })

  it("toggles with Ctrl+B unless the shortcut is disabled", async () => {
    const { provider, settle } = await setup()
    await userEvent.keyboard("{Control>}b{/Control}")
    await settle()
    expect(provider.collapsed).toBe(true)
    await userEvent.keyboard("{Meta>}b{/Meta}")
    await settle()
    expect(provider.collapsed).toBe(false)
    provider.shortcut = ""
    await userEvent.keyboard("{Control>}b{/Control}")
    await settle()
    expect(provider.collapsed).toBe(false)
  })

  it("collapses to icons: narrow rail, square buttons, hidden labels, tooltips", async () => {
    const { root, provider, sidebar, container, settle } = await setup({ collapsible: "icon" })
    provider.collapsed = true
    await settle()
    expect(sidebar.matches(":state(icon)")).toBe(true)
    expect(container().getBoundingClientRect().width).toBe(48)
    const [overview] = [...root.querySelectorAll<TecSidebarMenuButton>("tec-sidebar-menu-button")]
    await overview!.updateComplete
    expect(overview!.getBoundingClientRect().width).toBe(32)
    expect(getComputedStyle(root.querySelector("tec-sidebar-menu-badge")!).display).toBe("none")
    expect(getComputedStyle(root.querySelector("tec-sidebar-menu-sub")!).display).toBe("none")
    expect(getComputedStyle(root.querySelector("tec-sidebar-group-action")!).display).toBe("none")
    const label = root.querySelector("tec-sidebar-group-label")!.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(label).opacity).toBe("0")

    await userEvent.hover(overview!)
    const tip = overview!.shadowRoot!.querySelector<HTMLElement>(".tooltip")!
    await waitUntil(() => tip.matches(":popover-open"), "tooltip shown")
    await animationsFinished(tip)
    expect(tip.getBoundingClientRect().left).toBeGreaterThan(overview!.getBoundingClientRect().right)
    expect(await axNode(overview!.shadowRoot!.querySelector("a")!)).toMatchObject({ role: "link", name: "Overview", description: "Overview" })
    await userEvent.unhover(overview!)
    await waitUntil(() => !tip.matches(":popover-open"), "tooltip hidden")

    // no tooltip while expanded
    provider.collapsed = false
    await settle()
    await userEvent.hover(overview!)
    await new Promise((r) => setTimeout(r, 50))
    expect(tip.matches(":popover-open")).toBe(false)
  })

  it("marks the active destination and aligns actions and badges", async () => {
    const { root } = await setup()
    const [overview, wells] = [...root.querySelectorAll<TecSidebarMenuButton>("tec-sidebar-menu-button")]
    expect(await axNode(overview!.shadowRoot!.querySelector("a")!)).toMatchObject({ role: "link", name: "Overview" })
    expect(overview!.shadowRoot!.querySelector("a")!.getAttribute("aria-current")).toBe("page")
    expect(wells!.shadowRoot!.querySelector("a")!.hasAttribute("aria-current")).toBe(false)
    expect(wells!.matches(":state(has-action)")).toBe(true)
    const sub = root.querySelector("tec-sidebar-menu-sub-button")!
    expect(sub.shadowRoot!.querySelector("a")!.getAttribute("aria-current")).toBe("page")
    const action = root.querySelector("tec-sidebar-menu-action")!
    expect(getComputedStyle(action).opacity).toBe("1") // iframe < 768px: always visible
    expect(await axNode(action.shadowRoot!.querySelector("button")!)).toMatchObject({ role: "button", name: "More" })
    await userEvent.hover(wells!)
    await waitUntil(() => action.matches(":state(engaged)"), "engaged")
  })

  it("the rail toggles the sidebar and is not a tab stop", async () => {
    const { root, provider, settle } = await setup()
    const rail = root.querySelector("tec-sidebar-rail")!
    const button = rail.shadowRoot!.querySelector("button")!
    expect(button.tabIndex).toBe(-1)
    const { events } = recordEvents<CustomEvent>(provider, "tec-open-change")
    button.click()
    await settle()
    expect(provider.collapsed).toBe(true)
    expect(events[0]!.detail.reason).toBe("rail")
  })

  it("puts a right sidebar on the inline end, mirrored in RTL", async () => {
    const right = await setup({ side: "right" })
    const r = right.root.getBoundingClientRect()
    expect(right.container().getBoundingClientRect().right).toBe(r.right)
    const rtl = await setup({}, "rtl")
    const q = rtl.root.getBoundingClientRect()
    expect(rtl.container().getBoundingClientRect().right).toBe(q.right)
  })

  it("inset variant: the content becomes an inset card", async () => {
    const { root, provider } = await setup({ variant: "inset" })
    const inset = root.querySelector("tec-sidebar-inset")!
    await inset.updateComplete
    expect(provider.matches(":state(inset)")).toBe(true)
    expect(inset.matches(":state(inset)")).toBe(true)
    expect(getComputedStyle(inset.shadowRoot!.querySelector(".base")!).marginTop).toBe("8px")
  })

  it("collapsible none is a plain column", async () => {
    const { root, provider, sidebar, settle } = await setup({ collapsible: "none" })
    provider.collapsed = true
    await settle()
    expect(sidebar.getBoundingClientRect().width).toBe(256)
    expect(root.querySelector("tec-sidebar-inset")!.getBoundingClientRect().left - root.getBoundingClientRect().left).toBe(256)
  })
})

describe("tec-sidebar (mobile)", () => {
  it("renders as a modal sheet opened by the trigger and closed with Escape", async () => {
    const { root, provider, sidebar, trigger, settle } = await setup({ breakpoint: 10000 })
    expect(provider.mobile).toBe(true)
    expect(sidebar.matches(":state(mobile)")).toBe(true)
    const sheet = sidebar.shadowRoot!.querySelector("dialog")!
    expect(sheet.open).toBe(false)
    const { events } = recordEvents<CustomEvent>(provider, "tec-open-change")
    await userEvent.click(trigger)
    await settle()
    expect(sheet.open).toBe(true)
    expect(sheet.matches(":modal")).toBe(true)
    expect(provider.openMobile).toBe(true)
    expect(await axNode(sheet)).toMatchObject({ role: "dialog", name: "Sidebar" })
    // focus moved into the sheet (the search input)
    expect((deepActiveElement() as HTMLElement).localName).toBe("input")
    await expectAccessible(root)
    await userEvent.keyboard("{Escape}")
    await settle()
    expect(sheet.open).toBe(false)
    expect(provider.openMobile).toBe(false)
    expect(events.map((e) => e.detail)).toEqual([
      { open: true, mobile: true, reason: "trigger" },
      { open: false, mobile: true, reason: "escape" },
    ])
    // the desktop state is untouched
    expect(provider.collapsed).toBe(false)
  })
})

describe("tec-sidebar-inset / sections", () => {
  it("embedded renders no main landmark", async () => {
    const el = await fixture<HTMLElement>(html`<tec-sidebar-inset embedded><p>x</p></tec-sidebar-inset>`)
    expect(el.shadowRoot!.querySelector("main")).toBeNull()
    expect(el.shadowRoot!.querySelector("div.base")).not.toBeNull()
  })

  it("sections take layout classes on the host (forwarded to the padded part)", async () => {
    const el = await fixture<HTMLElement>(html`<tec-sidebar-header style="flex-direction: row; gap: 12px"><span>a</span><span>b</span></tec-sidebar-header>`)
    const [a, b] = [...el.querySelectorAll("span")]
    expect(Math.round(b!.getBoundingClientRect().left - a!.getBoundingClientRect().right)).toBe(12)
    expect(a!.getBoundingClientRect().top).toBe(b!.getBoundingClientRect().top)
  })
})

describe("tec-sidebar-input", () => {
  it("is a form control", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><tec-sidebar-input name="q" aria-label="Search"></tec-sidebar-input></form>`)
    const input = form.querySelector("tec-sidebar-input")!
    await userEvent.click(input)
    await userEvent.keyboard("wells")
    expect(new FormData(form).get("q")).toBe("wells")
    expect(await axNode(input.shadowRoot!.querySelector("input")!)).toMatchObject({ role: "textbox", name: "Search" })
  })
})
