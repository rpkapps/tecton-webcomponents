import { html } from "lit"
import { describe, expect, it } from "vitest"
import { expectAccessible, fixture } from "../../internal/test-utils.js"
import "./define.js"
import "../button/define.js"
import "../spinner/define.js"

const icon = html`<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>`

describe("tec-empty", () => {
  it("lays out a centred empty state", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-empty>
        <tec-empty-header>
          <tec-empty-media variant="icon">${icon}</tec-empty-media>
          <tec-empty-title>No projects yet</tec-empty-title>
          <tec-empty-description>Create your first project. <a href="#x">Learn more</a></tec-empty-description>
        </tec-empty-header>
        <tec-empty-content><tec-button>Create project</tec-button></tec-empty-content>
      </tec-empty>
    </div>`)
    const empty = root.querySelector("tec-empty")!
    const base = empty.shadowRoot!.querySelector(".base")!
    const cs = getComputedStyle(base)
    expect(cs.paddingTop).toBe("48px")
    expect(cs.textAlign).toBe("center")
    const media = root.querySelector("tec-empty-media")!
    const tile = media.shadowRoot!.querySelector(".base")!
    expect(tile.getBoundingClientRect()).toMatchObject({ width: 40, height: 40 })
    expect(getComputedStyle(tile).marginBottom).toBe("8px")
    expect(media.querySelector("svg")!.getBoundingClientRect().width).toBe(24)
    const title = root.querySelector("tec-empty-title")!
    expect(getComputedStyle(title).fontSize).toBe("18px")
    const desc = root.querySelector("tec-empty-description")!
    expect(getComputedStyle(desc.querySelector("a")!).textDecorationLine).toBe("underline")
    // centred: the title is horizontally centred in the empty state
    const t = title.getBoundingClientRect()
    const e = empty.getBoundingClientRect()
    expect(Math.abs(t.left - e.left - (e.right - t.right))).toBeLessThan(2)
    await expectAccessible(root)
  })

  it("offers outline and muted surfaces with rounded corners", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-empty variant="outline"><tec-empty-title>a</tec-empty-title></tec-empty>
      <tec-empty variant="muted"><tec-empty-title>b</tec-empty-title></tec-empty>
    </div>`)
    const [outline, muted] = [...root.querySelectorAll("tec-empty")].map((e) => getComputedStyle(e.shadowRoot!.querySelector(".base")!))
    expect(outline!.borderTopStyle).toBe("dashed")
    expect(outline!.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(outline!.borderTopLeftRadius).not.toBe("0px")
    expect(muted!.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("sizes a spinner in the icon tile", async () => {
    const root = await fixture<HTMLElement>(html`<tec-empty-media variant="icon"><tec-spinner></tec-spinner></tec-empty-media>`)
    expect(root.querySelector("tec-spinner")!.getBoundingClientRect().width).toBe(24)
  })
})
