import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, nextFrame, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecActionBarSelection } from "./action-bar.js"
import "./define.js"

const svg = html`<svg slot="start" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>`

const bar = (width: number, more = false) => html`<div style="width: ${width}px">
  <tec-action-bar aria-label="Selected wells">
    <tec-action-bar-selection count="12" total="340" label="wells" clearable></tec-action-bar-selection>
    <tec-action-bar-actions>
      <tec-overflow-item value="tag"><tec-button variant="outline" size="sm">${svg}<tec-overflow-label>Add tag</tec-overflow-label></tec-button></tec-overflow-item>
      ${more ? ["a", "b", "c"].map((v) => html`<tec-overflow-item value=${v}><tec-button variant="outline" size="sm">${svg}<tec-overflow-label>Action ${v}</tec-overflow-label></tec-button></tec-overflow-item>`) : ""}
      <tec-button size="sm">Assign</tec-button>
    </tec-action-bar-actions>
  </tec-action-bar>
</div>`

const visibleText = (sel: TecActionBarSelection) =>
  [...sel.shadowRoot!.querySelectorAll<HTMLElement>(".summary > span")].filter((s) => getComputedStyle(s).display !== "none").map((s) => s.textContent!.trim())

describe("tec-action-bar", () => {
  it("is a named region with an Actions toolbar and a polite live announcement", async () => {
    const root = await fixture(bar(700))
    const el = root.querySelector("tec-action-bar")!
    expect(await axNode(el)).toMatchObject({ role: "region", name: "Selected wells" })
    expect(await axNode(root.querySelector("tec-action-bar-actions")!)).toMatchObject({ role: "toolbar", name: "Actions" })
    const sel = root.querySelector<TecActionBarSelection>("tec-action-bar-selection")!
    await waitUntil(() => sel.shadowRoot!.querySelector("[aria-live]")!.textContent === "12 of 340 wells selected")
    expect(visibleText(sel)).toEqual(["12 of 340 wells selected"])
    await expectAccessible(root)
  })

  it("compacts the summary with the bar's width; the announcement stays full", async () => {
    const root = await fixture(bar(420))
    const sel = root.querySelector<TecActionBarSelection>("tec-action-bar-selection")!
    await nextFrame()
    expect(visibleText(sel)).toEqual(["12 selected"])
    ;(root as HTMLElement).style.width = "300px"
    await nextFrame()
    expect(visibleText(sel)).toEqual(["12"])
    const clearIcon = sel.shadowRoot!.querySelector<HTMLElement>(".clear-icon")!
    expect(getComputedStyle(clearIcon).display).not.toBe("none")
    expect(await axNode(clearIcon.shadowRoot!.querySelector("button")!)).toMatchObject({ name: "Clear selection" })
    await waitUntil(() => sel.shadowRoot!.querySelector("[aria-live]")!.textContent === "12 of 340 wells selected")
  })

  it("fires tec-clear and tec-dismiss (Escape inside the bar)", async () => {
    const root = await fixture(bar(700))
    const el = root.querySelector("tec-action-bar")!
    const clears = recordEvents(el, "tec-clear").events
    const dismisses = recordEvents(el, "tec-dismiss").events
    const sel = root.querySelector<TecActionBarSelection>("tec-action-bar-selection")!
    await userEvent.click(sel.shadowRoot!.querySelector(".clear-text")!)
    expect(clears.length).toBe(1)
    await userEvent.keyboard("{Escape}")
    expect(dismisses.length).toBe(1)
    // Outside the bar, Escape is not the bar's.
    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.focus()
    await aTimeout()
    await userEvent.keyboard("{Escape}")
    expect(dismisses.length).toBe(1)
  })

  it("an open More menu takes Escape before the bar", async () => {
    const root = await fixture(bar(160, true))
    await nextFrame()
    await nextFrame()
    const el = root.querySelector("tec-action-bar")!
    const actions = root.querySelector("tec-action-bar-actions")!
    const dismisses = recordEvents(el, "tec-dismiss").events
    const trigger = actions.shadowRoot!.querySelector<HTMLElement>(".trigger")!
    await waitUntil(() => getComputedStyle(actions.shadowRoot!.querySelector(".menu")!).display !== "none")
    trigger.focus()
    await userEvent.keyboard("{ArrowDown}")
    const menu = actions.shadowRoot!.querySelector(".menu-content")!
    await waitUntil(() => menu.matches(":popover-open"))
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !menu.matches(":popover-open"))
    expect(dismisses.length).toBe(0)
    await userEvent.keyboard("{Escape}")
    expect(dismisses.length).toBe(1)
  })

  it("floating placement is sticky", async () => {
    const root = await fixture(html`<div style="height: 100px; overflow: auto"><div style="height: 400px"></div>
      <tec-action-bar placement="floating" aria-label="Sel"><tec-action-bar-message>Unsaved changes</tec-action-bar-message></tec-action-bar></div>`)
    expect(getComputedStyle(root.querySelector("tec-action-bar")!).position).toBe("sticky")
    expect(await axNode(root.querySelector("tec-action-bar-message")!)).toMatchObject({ role: "paragraph" })
  })
})
