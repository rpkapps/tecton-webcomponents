import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import "../button/define.js"
import "../popover/define.js"
import type { TecThemeRoot } from "./theme-root.js"
import { getTheme, readStoredTheme, resolveTheme, setTheme } from "./theme.js"
import "./define.js"

const bg = (el: Element) => getComputedStyle(el).backgroundColor
const probe = () => html`<div class="probe" style="background: var(--tec-background); color: var(--tec-foreground)">Text</div>`

afterEach(() => {
  localStorage.removeItem("test-theme")
  localStorage.removeItem("tecton-theme")
  document.documentElement.removeAttribute("data-theme")
})

describe("tec-theme-root", () => {
  it("pins its subtree to dark or light and sets data-theme / color-scheme", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      ${probe()}
      <tec-theme-root theme="dark">${probe()}</tec-theme-root>
    </div>`)
    const [outer, inner] = root.querySelectorAll(".probe")
    const el = root.querySelector("tec-theme-root")!
    expect(el.getAttribute("data-theme")).toBe("dark")
    expect(getComputedStyle(el).colorScheme).toBe("dark")
    expect(bg(inner)).not.toBe(bg(outer))
    expect(el.matches(":state(dark)")).toBe(true)
    // The text colour is re-resolved for the pinned mode.
    expect(getComputedStyle(el).color).toBe(getComputedStyle(inner).color)
    el.theme = "light"
    await el.updateComplete
    expect(bg(inner)).toBe(bg(outer))
    el.theme = "inherit"
    await el.updateComplete
    expect(el.hasAttribute("data-theme")).toBe(false)
    expect(el.resolvedTheme).toBeNull()
  })

  it("resolves system from prefers-color-scheme", async () => {
    const el = await fixture<TecThemeRoot>(html`<tec-theme-root theme="system">${probe()}</tec-theme-root>`)
    const expected = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    expect(el.getAttribute("data-theme")).toBe(expected)
    expect(el.resolvedTheme).toBe(expected)
  })

  it("persists with storage-key: restores on connect, writes changes", async () => {
    localStorage.setItem("test-theme", "dark")
    const el = await fixture<TecThemeRoot>(html`<tec-theme-root theme="light" storage-key="test-theme">${probe()}</tec-theme-root>`)
    expect(el.theme).toBe("dark")
    expect(el.getAttribute("data-theme")).toBe("dark")
    expect(readStoredTheme("test-theme")).toBe("dark")
    el.theme = "light"
    await el.updateComplete
    expect(readStoredTheme("test-theme")).toBe("light")
    window.dispatchEvent(new StorageEvent("storage", { key: "test-theme", newValue: "dark" }))
    await el.updateComplete
    expect(el.theme).toBe("dark")
  })

  it("overlays opened inside inherit the mode without a portal container", async () => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 40px">
      <tec-theme-root theme="dark" style="--tec-popover: rgb(1, 2, 3)">
        <tec-popover label="Info">
          <tec-button slot="trigger">Open</tec-button>
          <p>Inside the top layer</p>
        </tec-popover>
      </tec-theme-root>
    </div>`)
    const popover = root.querySelector("tec-popover")!
    await userEvent.click(root.querySelector("tec-button")!)
    const panel = popover.shadowRoot!.querySelector(".content") as HTMLElement
    await waitUntil(() => panel.matches(":popover-open"))
    await animationsFinished(panel)
    expect(bg(panel)).toBe("rgb(1, 2, 3)")
    expect(getComputedStyle(panel).colorScheme).toBe("dark")
    await expectAccessible(root)
  })
})

describe("theme helpers", () => {
  it("setTheme applies to <html>, persists and getTheme reads it back", () => {
    setTheme("dark")
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(getTheme()).toBe("dark")
    expect(readStoredTheme()).toBe("dark")
    setTheme("system", { storageKey: null })
    expect(document.documentElement.getAttribute("data-theme")).toBe(resolveTheme("system"))
    expect(getTheme()).toBe("system")
    expect(readStoredTheme()).toBe("dark")
  })

  it("setTheme on a tec-theme-root sets its theme", async () => {
    const el = await fixture<TecThemeRoot>(html`<tec-theme-root></tec-theme-root>`)
    setTheme("dark", { root: el })
    await el.updateComplete
    expect(el.getAttribute("data-theme")).toBe("dark")
    expect(getTheme({ root: el })).toBe("dark")
  })
})
