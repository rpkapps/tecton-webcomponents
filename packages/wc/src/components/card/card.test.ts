import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture, nextFrame } from "../../internal/test-utils.js"
import type { TecCard } from "./card.js"
import "./define.js"

const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement
const px = (v: string) => Number.parseFloat(v)

const demo = html`<tec-card style="width: 360px">
  <tec-card-header>
    <tec-card-title level="2">Login to your account</tec-card-title>
    <tec-card-description>Enter your email below</tec-card-description>
    <tec-card-action><button>Sign Up</button></tec-card-action>
  </tec-card-header>
  <tec-card-content><p>Content</p></tec-card-content>
  <tec-card-footer><button>Login</button></tec-card-footer>
</tec-card>`

describe("tec-card", () => {
  it("draws the surface on the base and survives the document reset", async () => {
    const card = await fixture<TecCard>(demo)
    const cs = getComputedStyle(base(card))
    expect(cs.paddingTop).toBe("24px")
    expect(cs.paddingBottom).toBe("24px")
    expect(cs.rowGap).toBe("24px")
    expect(cs.borderTopLeftRadius).not.toBe("0px")
    expect(cs.boxShadow).toContain("1px")
    for (const tag of ["tec-card-header", "tec-card-content", "tec-card-footer"]) {
      const part = base(card.querySelector(tag)!)
      expect(getComputedStyle(part).paddingInlineStart, tag).toBe("24px")
      expect(getComputedStyle(part).paddingInlineEnd, tag).toBe("24px")
    }
    await expectAccessible(card)
  })

  it("puts the action in a second column spanning the title and description", async () => {
    const card = await fixture<TecCard>(demo)
    const header = card.querySelector("tec-card-header")!
    expect(header.matches(":state(has-action)")).toBe(true)
    expect(header.matches(":state(has-description)")).toBe(true)
    const title = card.querySelector("tec-card-title")!.getBoundingClientRect()
    const action = card.querySelector("tec-card-action")!.getBoundingClientRect()
    expect(action.left).toBeGreaterThan(title.right - 1)
    expect(Math.round(action.right)).toBe(Math.round(header.getBoundingClientRect().right - 24))
    // The header is exactly as tall as its content (no stray row gap from the host grid).
    const titleTop = card.querySelector("tec-card-title")!.getBoundingClientRect().top
    const descBottom = card.querySelector("tec-card-description")!.getBoundingClientRect().bottom
    expect(Math.round(header.getBoundingClientRect().height)).toBe(Math.round(descBottom - titleTop))
    card.querySelector("tec-card-action")!.remove()
    await nextFrame()
    expect(header.matches(":state(has-action)")).toBe(false)
  })

  it("follows size and --tec-card-spacing", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-card size="sm"><tec-card-header><tec-card-title>A</tec-card-title></tec-card-header></tec-card>
      <tec-card style="--tec-card-spacing: 2rem"><tec-card-content>B</tec-card-content></tec-card>
    </div>`)
    const [small, custom] = [...root.querySelectorAll("tec-card")]
    expect(getComputedStyle(base(small!)).paddingTop).toBe("16px")
    expect(getComputedStyle(base(small!.querySelector("tec-card-header")!)).paddingInlineStart).toBe("16px")
    expect(getComputedStyle(small!.querySelector("tec-card-title")!).fontSize).toBe("14px")
    expect(getComputedStyle(base(custom!)).paddingTop).toBe("32px")
    expect(getComputedStyle(base(custom!.querySelector("tec-card-content")!)).paddingInlineStart).toBe("32px")
  })

  it("makes the host the layout box: layout styles on the parts arrange their children", async () => {
    const card = await fixture<TecCard>(html`<tec-card style="width: 300px">
      <tec-card-content style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px"><i>A</i><i>B</i></tec-card-content>
      <tec-card-footer style="flex-direction: column; align-items: flex-start; gap: 8px"><button>A</button><button>B</button></tec-card-footer>
      <tec-card-footer style="justify-content: flex-end"><button>C</button></tec-card-footer>
    </tec-card>`)
    expect(getComputedStyle(card.querySelector("tec-card-footer")!).flexDirection).toBe("column")
    const [a, b] = [...card.querySelectorAll("tec-card-footer:first-of-type button")].map((x) => x.getBoundingClientRect())
    expect(b!.top - a!.bottom).toBe(8)
    expect(a!.left).toBe(card.getBoundingClientRect().left + 24)
    const [x, y] = [...card.querySelectorAll("i")].map((i) => i.getBoundingClientRect())
    expect(y!.top).toBe(x!.top)
    expect(y!.left - x!.right).toBe(10)
    expect(Math.round(x!.width)).toBe(Math.round((300 - 48 - 10) / 2))
    const c = card.querySelector("tec-card-footer:last-of-type button")!.getBoundingClientRect()
    expect(Math.round(c.right)).toBe(Math.round(card.getBoundingClientRect().right - 24))
  })

  it("removes the top padding when an image comes first and pads bordered sections", async () => {
    const card = await fixture<TecCard>(html`<tec-card>
      <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="height: 20px" />
      <tec-card-header class="border-b"><tec-card-title>T</tec-card-title></tec-card-header>
      <tec-card-footer class="border-t">F</tec-card-footer>
    </tec-card>`)
    expect(card.matches(":state(image-first)")).toBe(true)
    expect(getComputedStyle(base(card)).paddingTop).toBe("0px")
    expect(px(getComputedStyle(base(card.querySelector("tec-card-header")!)).paddingBottom)).toBe(24)
    expect(px(getComputedStyle(base(card.querySelector("tec-card-footer")!)).paddingTop)).toBe(24)
    expect(getComputedStyle(card.querySelector("img")!).borderTopLeftRadius).not.toBe("0px")
  })

  it("exposes a title with a level as a heading", async () => {
    const card = await fixture<TecCard>(demo)
    expect(await axNode(card.querySelector("tec-card-title")!)).toMatchObject({ role: "heading", name: "Login to your account" })
  })
})
