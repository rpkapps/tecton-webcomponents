import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecMarker } from "./marker.js"
import "./define.js"

const svg = html`<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>`
const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement

describe("tec-marker", () => {
  it("renders an inline row with a decorative icon", async () => {
    const el = await fixture<TecMarker>(html`<tec-marker role="status">
      <tec-marker-icon>${svg}</tec-marker-icon>
      <tec-marker-content>Explored 4 files</tec-marker-content>
    </tec-marker>`)
    expect(getComputedStyle(base(el)).display).toBe("flex")
    const icon = el.querySelector("svg")!.getBoundingClientRect()
    expect(icon.width).toBe(16)
    expect(await axNode(el)).toMatchObject({ role: "status" })
    const tree = await axTree(el)
    expect(tree.join("|")).not.toMatch(/image|img/)
    await expectAccessible(el)
  })

  it("separator draws lines either side of the centred label; border adds a bottom border", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width:400px">
      <tec-marker id="s" variant="separator"><tec-marker-content>Today</tec-marker-content></tec-marker>
      <tec-marker id="b" variant="border"><tec-marker-content>Row</tec-marker-content></tec-marker>
    </div>`)
    const s = root.querySelector<TecMarker>("#s")!
    const lines = s.shadowRoot!.querySelectorAll<HTMLElement>(".line")
    const label = s.querySelector("tec-marker-content")!
    expect(lines[0].getBoundingClientRect().width).toBeGreaterThan(100)
    expect(lines[0].getBoundingClientRect().right).toBeLessThan(label.getBoundingClientRect().left)
    expect(lines[1].getBoundingClientRect().left).toBeGreaterThan(label.getBoundingClientRect().right)
    expect(label.matches(":state(separator)")).toBe(true)
    expect(getComputedStyle(base(root.querySelector("#b")!)).borderBottomWidth).toBe("1px")
    expect(getComputedStyle(root.querySelector("#b")!.shadowRoot!.querySelector(".line")!).display).toBe("none")
  })

  it("stacks with a flex-col class on the element", async () => {
    const el = await fixture<TecMarker>(html`<tec-marker style="flex-direction: column"><tec-marker-icon>${svg}</tec-marker-icon><tec-marker-content>Done</tec-marker-content></tec-marker>`)
    expect(getComputedStyle(base(el)).flexDirection).toBe("column")
  })

  it("renders a link or a button named by its text", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-marker href="#pr"><tec-marker-icon>${svg}</tec-marker-icon><tec-marker-content>View the pull request</tec-marker-content></tec-marker>
      <tec-marker type="button"><tec-marker-content>Revert this change</tec-marker-content></tec-marker>
    </div>`)
    const [link, button] = root.querySelectorAll<TecMarker>("tec-marker")
    expect(await axNode(base(link))).toMatchObject({ role: "link", name: "View the pull request" })
    expect(await axNode(base(button))).toMatchObject({ role: "button", name: "Revert this change" })
    const clicks = recordEvents(button, "click")
    await userEvent.click(button)
    expect(clicks.events.length).toBe(1)
    await expectAccessible(root)
  })
})
