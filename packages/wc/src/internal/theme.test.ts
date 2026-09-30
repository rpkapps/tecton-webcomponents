import { html } from "lit"
import { describe, expect, it } from "vitest"
import { cdp, userEvent } from "vitest/browser"
import { animationsFinished, fixture } from "./test-utils.js"
import "../components/checkbox/define.js"
import "../components/dialog/define.js"
import "../components/drawer/define.js"
import "../components/kbd/define.js"
import "../components/progress/define.js"
import "../components/radio-group/define.js"
import "../components/sheet/define.js"
import "../components/sidebar/define.js"
import "../components/slider/define.js"
import "../components/tooltip/define.js"

// The v0.7.0 design-system colours, independent of the component CSS and generated semantic map.
const colours = {
  light: { tooltip: "#ffffff", text: "#21172a", checkbox: "#8b5ba9", radio: "#674782", hover: "#765292", pressed: "#8b5ba9", slider: "#7a4e9b", rail: "#decae5", progress: "#6b438c", track: "#b48ac5", content: "#dbd6dd" },
  dark: { tooltip: "#000000", text: "#f6f5f8", checkbox: "#af9ebc", radio: "#9d90a8", hover: "#ada0b8", pressed: "#beb1c8", slider: "#9f8ead", rail: "#776284", progress: "#af9ebc", track: "#6b5679", content: "#323134" },
}
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`
const part = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!

describe("Tecton v0.7.0 theme", () => {
  it.each(["light", "dark"] as const)("uses the tooltip and control colours in %s mode", async (theme) => {
    const root = await fixture<HTMLElement>(html`<div style="padding: 80px; width: 400px; display: grid; gap: 24px">
      <tec-tooltip><button slot="trigger">Save</button>Save <tec-kbd>S</tec-kbd></tec-tooltip>
      <tec-checkbox checked>Enabled</tec-checkbox>
      <tec-radio-group aria-label="Plan" value="a"><tec-radio-group-item value="a">A</tec-radio-group-item></tec-radio-group>
      <tec-slider aria-label="Volume" value="50"></tec-slider>
      <tec-progress aria-label="Loading" value="50"></tec-progress>
      <tec-sidebar-menu-button active>Current</tec-sidebar-menu-button>
    </div>`, { theme })
    const expected = colours[theme]
    const tooltip = root.querySelector("tec-tooltip")!
    expect(getComputedStyle(part(tooltip, ".content")).backgroundColor).toBe(rgb(expected.tooltip))
    expect(getComputedStyle(part(tooltip, ".content")).color).toBe(rgb(expected.text))
    expect(getComputedStyle(part(tooltip, ".arrow")).backgroundColor).toBe(rgb(expected.tooltip))
    expect(getComputedStyle(part(root.querySelector("tec-kbd")!, "kbd")).color).toBe(rgb(expected.text))

    const checkbox = part(root.querySelector("tec-checkbox")!, "input")
    expect(getComputedStyle(checkbox).backgroundColor).toBe(rgb(expected.checkbox))
    const radio = root.querySelector("tec-radio-group-item")!
    expect(getComputedStyle(part(radio, ".control")).color).toBe(rgb(expected.radio))
    const slider = root.querySelector("tec-slider")!
    expect(getComputedStyle(part(slider, ".range")).backgroundColor).toBe(rgb(expected.slider))
    expect(getComputedStyle(part(slider, ".track")).backgroundColor).toBe(rgb(expected.rail))
    const progress = root.querySelector("tec-progress")!
    expect(getComputedStyle(part(progress, ".indicator")).backgroundColor).toBe(rgb(expected.progress))
    expect(getComputedStyle(part(progress, ".track")).backgroundColor).toBe(rgb(expected.track))
    expect(getComputedStyle(part(root.querySelector("tec-sidebar-menu-button")!, ".base")).backgroundColor).toBe(rgb(expected.content))

    await userEvent.hover(checkbox)
    await animationsFinished(checkbox)
    expect(getComputedStyle(checkbox).backgroundColor).toBe(rgb(expected.hover))
    const rect = checkbox.getBoundingClientRect()
    try {
      await cdp().send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, button: "left", clickCount: 1 })
      await animationsFinished(checkbox)
      expect(getComputedStyle(checkbox).backgroundColor).toBe(rgb(expected.pressed))
    } finally {
      await cdp().send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, button: "left", clickCount: 1 })
    }
    await userEvent.hover(radio)
    await animationsFinished(part(radio, ".control"))
    expect(getComputedStyle(part(radio, ".control")).color).toBe(rgb(expected.hover))
  })

  it.each(["light", "dark"] as const)("uses the modal backdrop and honours separate card/popover overrides in %s mode", async (theme) => {
    const root = await fixture<HTMLElement>(html`<div style="--tec-card: rgb(12, 34, 56); --tec-popover: rgb(78, 90, 123)">
      <tec-dialog aria-label="Dialog"></tec-dialog>
      <tec-sheet aria-label="Sheet"></tec-sheet>
      <tec-drawer aria-label="Drawer"></tec-drawer>
      <span style="background-color: var(--tec-backdrop)"></span>
    </div>`, { theme })
    const backdrop = getComputedStyle(root.querySelector("span")!).backgroundColor
    expect(backdrop).toContain(theme === "light" ? "255, 255, 255" : "0, 0, 0")
    for (const el of root.querySelectorAll("tec-dialog, tec-sheet, tec-drawer")) {
      expect(getComputedStyle(part(el, ".overlay")).backgroundColor).toBe(backdrop)
      expect(getComputedStyle(part(el, ".content")).backgroundColor).toBe(el.localName === "tec-dialog" ? "rgb(78, 90, 123)" : "rgb(12, 34, 56)")
    }
  })
})
