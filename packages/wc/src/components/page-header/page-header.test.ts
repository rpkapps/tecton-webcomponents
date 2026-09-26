import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, axTree, expectAccessible, fixture, nextFrame } from "../../internal/test-utils.js"
import type { TecOverflowItem } from "../overflow/overflow.js"
import "../tabs/define.js"
import "./define.js"

const svg = html`<svg slot="start" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>`

const header = (width: number) => html`<div style="width: ${width}px">
  <tec-page-header>
    <tec-page-header-content>
      <tec-page-header-eyebrow>Gullfaks / Wells</tec-page-header-eyebrow>
      <tec-page-header-title>Wells of the Gullfaks field development</tec-page-header-title>
      <tec-page-header-description>23 wells across 4 fields.</tec-page-header-description>
    </tec-page-header-content>
    <tec-page-header-actions>
      <tec-overflow-item value="export" priority="1"><tec-button variant="outline">${svg}<tec-overflow-label>Export</tec-overflow-label></tec-button></tec-overflow-item>
      <tec-overflow-item value="share" priority="2"><tec-button variant="outline">${svg}<tec-overflow-label>Share</tec-overflow-label></tec-button></tec-overflow-item>
      <tec-button>New well</tec-button>
    </tec-page-header-actions>
  </tec-page-header>
</div>`

const settle = async () => {
  await nextFrame()
  await nextFrame()
}

describe("tec-page-header", () => {
  it("exposes a level-1 heading, a description and a plain actions row", async () => {
    const root = await fixture(header(900))
    await settle()
    const title = root.querySelector("tec-page-header-title")!
    expect(await axNode(title)).toMatchObject({ role: "heading", name: "Wells of the Gullfaks field development", level: "1" })
    const actions = root.querySelector("tec-page-header-actions")!
    expect((await axNode(actions)).role).not.toBe("toolbar")
    expect(root.querySelector("tec-page-header")!.matches(":state(has-actions)")).toBe(true)
    await expectAccessible(root)
  })

  it("keeps one row: the content is capped at 60% and the actions collapse", async () => {
    const root = await fixture(header(420))
    await settle()
    const head = root.querySelector("tec-page-header")!.getBoundingClientRect()
    const content = root.querySelector("tec-page-header-content")!.getBoundingClientRect()
    const actions = root.querySelector("tec-page-header-actions")!.getBoundingClientRect()
    expect(content.width).toBeLessThanOrEqual(head.width * 0.6 + 1)
    expect(Math.abs(actions.top - content.top)).toBeLessThan(2)
    const items = [...root.querySelectorAll<TecOverflowItem>("tec-overflow-item")]
    expect(items.some((i) => i.overflowing || i.compact)).toBe(true)
    // Lower priority leaves first.
    if (items[1]!.overflowing) expect(items[0]!.overflowing).toBe(true)
  })

  it("section tabs collapse into a labelled radio section of the More menu", async () => {
    const root = await fixture(html`<div style="width: 200px">
      <tec-page-header>
        <tec-page-header-content><tec-page-header-title>Orion</tec-page-header-title></tec-page-header-content>
        <tec-page-header-actions>
          <tec-overflow-item value="sections" label="Section" priority="2">
            <tec-page-header-nav aria-label="Project sections">
              <tec-tabs value="overview"><tec-tabs-list>
                <tec-tabs-trigger value="overview">Overview</tec-tabs-trigger><tec-tabs-trigger value="team">Team</tec-tabs-trigger>
              </tec-tabs-list></tec-tabs>
            </tec-page-header-nav>
          </tec-overflow-item>
        </tec-page-header-actions>
      </tec-page-header>
    </div>`)
    await settle()
    const actions = root.querySelector("tec-page-header-actions")!
    expect(root.querySelector<TecOverflowItem>("tec-overflow-item")!.overflowing).toBe(true)
    actions.shadowRoot!.querySelector<HTMLElement>(".trigger")!.click()
    const menu = actions.shadowRoot!.querySelector<HTMLElement>(".menu-content")!
    await settle()
    expect(menu.matches(":popover-open")).toBe(true)
    expect((await axTree(menu)).slice(1)).toEqual(["group: Section", "menuitemradio: Overview [checked, focused]", "menuitemradio: Team"])
    menu.querySelectorAll<HTMLElement>("[role=menuitemradio]")[1]!.click()
    expect(root.querySelector("tec-tabs")!.value).toBe("team")
    ;(root as HTMLElement).style.width = "900px"
    await settle()
    expect(await axNode(root.querySelector("tec-page-header-nav")!)).toMatchObject({ role: "navigation", name: "Project sections" })
  })
})
