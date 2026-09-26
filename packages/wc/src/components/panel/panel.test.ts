import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture, nextFrame } from "../../internal/test-utils.js"
import "../overflow/define.js"
import "./define.js"

describe("tec-panel", () => {
  it("renders the parts with a level-2 title and passes axe", async () => {
    const root = await fixture(html`<div style="width: 320px">
      <tec-panel>
        <tec-panel-header>
          <tec-panel-title>Well properties</tec-panel-title>
          <tec-panel-description>34/10-A-12</tec-panel-description>
          <tec-panel-actions><tec-button variant="ghost" size="icon-sm" aria-label="Settings">+</tec-button></tec-panel-actions>
        </tec-panel-header>
        <tec-panel-content>Body</tec-panel-content>
        <tec-panel-footer justify="end"><tec-button size="sm">Open</tec-button></tec-panel-footer>
      </tec-panel>
    </div>`)
    expect(await axNode(root.querySelector("tec-panel-title")!)).toMatchObject({ role: "heading", level: "2", name: "Well properties" })
    const header = root.querySelector("tec-panel-header")!
    expect(header.matches(":state(has-actions)")).toBe(true)
    // The description wraps onto its own line below title and actions.
    const title = root.querySelector("tec-panel-title")!.getBoundingClientRect()
    const description = root.querySelector("tec-panel-description")!.getBoundingClientRect()
    expect(description.top).toBeGreaterThan(title.bottom - 1)
    await expectAccessible(root)
  })

  it("scrolls the content and pins the footer inside a fixed height", async () => {
    const root = await fixture(html`<tec-panel style="height: 200px; width: 300px">
      <tec-panel-header><tec-panel-title>T</tec-panel-title></tec-panel-header>
      <tec-panel-content><div style="height: 600px">Tall</div></tec-panel-content>
      <tec-panel-footer>Footer</tec-panel-footer>
    </tec-panel>`)
    const panel = root.getBoundingClientRect()
    const footer = root.querySelector("tec-panel-footer")!.getBoundingClientRect()
    expect(Math.round(footer.bottom)).toBeLessThanOrEqual(Math.round(panel.bottom))
    const scroller = root.querySelector("tec-panel-content")!.shadowRoot!.querySelector(".base")!
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })

  it("applies variants and sizes", async () => {
    const root = await fixture(html`<div>
      <tec-panel variant="elevated" size="sm"><tec-panel-content>a</tec-panel-content></tec-panel>
      <tec-panel variant="outline" size="lg"><tec-panel-content>b</tec-panel-content></tec-panel>
    </div>`)
    const [elevated, outline] = [...root.querySelectorAll("tec-panel")].map((p) => getComputedStyle(p.shadowRoot!.querySelector(".base")!))
    expect(elevated!.boxShadow).not.toBe("none")
    expect(outline!.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    const [small, large] = [...root.querySelectorAll("tec-panel-content")].map((c) => getComputedStyle(c.shadowRoot!.querySelector(".base")!).paddingLeft)
    expect([small, large]).toEqual(["12px", "24px"])
  })

  it("yields width to an overflow row in the actions", async () => {
    const root = await fixture(html`<div style="width: 260px">
      <tec-panel>
        <tec-panel-header>
          <tec-panel-title>Production forecast for the northern area</tec-panel-title>
          <tec-panel-actions>
            <tec-toolbar aria-label="Panel actions" labels="never">
              ${["a", "b", "c", "d", "e"].map((v) => html`<tec-overflow-item value=${v} label=${v}><tec-button variant="ghost" size="icon-sm" aria-label=${v}><svg viewBox="0 0 24 24" aria-hidden="true"></svg></tec-button></tec-overflow-item>`)}
            </tec-toolbar>
          </tec-panel-actions>
        </tec-panel-header>
      </tec-panel>
    </div>`)
    await nextFrame()
    await nextFrame()
    const header = root.querySelector("tec-panel-header")!
    expect(header.matches(":state(has-overflow)")).toBe(true)
    const headerBox = header.getBoundingClientRect()
    const title = root.querySelector("tec-panel-title")!.getBoundingClientRect()
    expect(title.width).toBeLessThanOrEqual(headerBox.width * 0.6 + 1)
    const toolbar = root.querySelector("tec-toolbar")!
    expect(toolbar.matches(":state(overflowing)")).toBe(true)
    expect(toolbar.getBoundingClientRect().right).toBeLessThanOrEqual(headerBox.right + 1)
  })
})
