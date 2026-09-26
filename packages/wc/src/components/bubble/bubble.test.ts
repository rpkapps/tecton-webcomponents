import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import "../button/define.js"
import type { TecBubble, TecBubbleContent, TecBubbleReactions } from "./bubble.js"
import "./define.js"

const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement

describe("tec-bubble", () => {
  it("paints the content surface from the variant", async () => {
    const root = await fixture<HTMLElement>(html`<div style="display:flex;flex-direction:column;width:400px">
      <tec-bubble id="d"><tec-bubble-content>Default</tec-bubble-content></tec-bubble>
      <tec-bubble id="m" variant="muted"><tec-bubble-content>Muted</tec-bubble-content></tec-bubble>
      <tec-bubble id="o" variant="outline"><tec-bubble-content>Outline</tec-bubble-content></tec-bubble>
      <tec-bubble id="g" variant="ghost"><tec-bubble-content>Ghost</tec-bubble-content></tec-bubble>
      <tec-bubble id="t" variant="tinted"><tec-bubble-content>Tinted</tec-bubble-content></tec-bubble>
    </div>`)
    const probe = document.createElement("div")
    root.append(probe)
    const color = (v: string) => {
      probe.style.backgroundColor = `var(${v})`
      return getComputedStyle(probe).backgroundColor
    }
    const bg = (id: string) => getComputedStyle(base(root.querySelector(`#${id} tec-bubble-content`)!)).backgroundColor
    expect(bg("d")).toBe(color("--tec-primary"))
    expect(bg("m")).toBe(color("--tec-muted"))
    expect(bg("o")).toBe(color("--tec-background"))
    expect(getComputedStyle(base(root.querySelector("#o tec-bubble-content")!)).borderTopColor).toBe(color("--tec-border"))
    expect(bg("g")).toBe("rgba(0, 0, 0, 0)")
    expect(getComputedStyle(base(root.querySelector("#g tec-bubble-content")!)).paddingTop).toBe("0px")
    expect(bg("t")).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("sizes to content up to 80% of the row; align=end sits at the end", async () => {
    const root = await fixture<HTMLElement>(html`<div style="display:flex;flex-direction:column;width:400px">
      <tec-bubble id="s"><tec-bubble-content>Short</tec-bubble-content></tec-bubble>
      <tec-bubble id="l"><tec-bubble-content>${"long text ".repeat(40)}</tec-bubble-content></tec-bubble>
      <tec-bubble id="e" align="end"><tec-bubble-content>End</tec-bubble-content></tec-bubble>
      <tec-bubble id="g" variant="ghost"><tec-bubble-content>${"long text ".repeat(40)}</tec-bubble-content></tec-bubble>
    </div>`)
    const w = (id: string) => root.querySelector(`#${id}`)!.getBoundingClientRect()
    expect(w("s").width).toBeLessThan(100)
    expect(Math.round(w("l").width)).toBe(320)
    expect(Math.round(w("e").right)).toBe(Math.round(root.getBoundingClientRect().right))
    expect(Math.round(w("g").width)).toBe(400)
    expect(root.querySelector<TecBubble>("#e")!.matches(":state(end)")).toBe(true)
  })

  it("renders a real button or link surface with href / type=button", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-bubble variant="tinted"><tec-bubble-content type="button">I forgot my password</tec-bubble-content></tec-bubble>
      <tec-bubble variant="muted"><tec-bubble-content href="#docs">Read the docs</tec-bubble-content></tec-bubble>
    </div>`)
    const [button, link] = root.querySelectorAll<TecBubbleContent>("tec-bubble-content")
    expect(await axNode(base(button))).toMatchObject({ role: "button", name: "I forgot my password" })
    expect(await axNode(base(link))).toMatchObject({ role: "link", name: "Read the docs" })
    const clicks = recordEvents(button, "click")
    await userEvent.click(button)
    expect(clicks.events.length).toBe(1)
    await userEvent.keyboard("{Tab}")
    expect(base(link).matches(":focus-visible")).toBe(true)
    await expectAccessible(root)
  })

  it("anchors reactions to the bubble edge (side, align) and drops padding around buttons", async () => {
    const root = await fixture<HTMLElement>(html`<div style="display:flex;flex-direction:column;gap:48px;padding:40px;width:400px">
      <tec-bubble id="a" variant="muted">
        <tec-bubble-content>Bold. Fine I'll add some tests.</tec-bubble-content>
        <tec-bubble-reactions role="img" aria-label="Reactions: eyes, rocket"><span>👀</span><span>🚀</span></tec-bubble-reactions>
      </tec-bubble>
      <tec-bubble id="b" align="end">
        <tec-bubble-content>Tests passed on the first try.</tec-bubble-content>
        <tec-bubble-reactions side="top" align="start"><tec-button variant="ghost" size="icon-xs" aria-label="Like">+</tec-button></tec-bubble-reactions>
      </tec-bubble>
    </div>`)
    const a = root.querySelector("#a")!.getBoundingClientRect()
    const ra = root.querySelector("#a tec-bubble-reactions")!.getBoundingClientRect()
    expect(ra.bottom).toBeGreaterThan(a.bottom)
    expect(Math.round(a.right - ra.right)).toBe(12)
    const b = root.querySelector("#b")!.getBoundingClientRect()
    const rbEl = root.querySelector<TecBubbleReactions>("#b tec-bubble-reactions")!
    const rb = rbEl.getBoundingClientRect()
    expect(rb.top).toBeLessThan(b.top)
    expect(Math.round(rb.left - b.left)).toBe(12)
    expect(rbEl.matches(":state(has-button)")).toBe(true)
    expect(getComputedStyle(base(rbEl)).paddingTop).toBe("0px")
    expect(await axNode(root.querySelector("#a tec-bubble-reactions")!)).toMatchObject({ role: "image", name: "Reactions: eyes, rocket" })
    await expectAccessible(root)
  })

  it("mirrors reactions in RTL", async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="display:flex;flex-direction:column;padding:40px;width:400px">
        <tec-bubble><tec-bubble-content>مرحبا بكم في المحادثة</tec-bubble-content><tec-bubble-reactions><span>👍</span></tec-bubble-reactions></tec-bubble>
      </div>`,
      { dir: "rtl" }
    )
    const b = root.querySelector("tec-bubble")!.getBoundingClientRect()
    const r = root.querySelector("tec-bubble-reactions")!.getBoundingClientRect()
    expect(Math.round(r.left - b.left)).toBe(12)
  })
})
