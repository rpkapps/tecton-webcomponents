import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axTree, expectAccessible, fixture, nextFrame } from "../../internal/test-utils.js"
import "../bubble/define.js"
import "../button/define.js"
import type { TecMessage } from "./message.js"
import "./define.js"

const rect = (el: Element) => el.getBoundingClientRect()

describe("tec-message", () => {
  it("lays out avatar and content in a row; align=end reverses it and aligns the parts to the end", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-message id="a">
        <tec-message-avatar><span style="display:block;width:32px;height:32px">A</span></tec-message-avatar>
        <tec-message-content>
          <tec-bubble variant="muted"><tec-bubble-content>Hello</tec-bubble-content></tec-bubble>
        </tec-message-content>
      </tec-message>
      <tec-message id="b" align="end">
        <tec-message-avatar><span style="display:block;width:32px;height:32px">B</span></tec-message-avatar>
        <tec-message-content>
          <tec-bubble><tec-bubble-content>Hi</tec-bubble-content></tec-bubble>
          <tec-message-footer>Delivered</tec-message-footer>
        </tec-message-content>
      </tec-message>
    </div>`)
    const a = root.querySelector<TecMessage>("#a")!
    const b = root.querySelector<TecMessage>("#b")!
    expect(rect(a.querySelector("tec-message-avatar")!).left).toBeLessThan(rect(a.querySelector("tec-bubble")!).left)
    expect(b.matches(":state(end)")).toBe(true)
    expect(getComputedStyle(b).flexDirection).toBe("row-reverse")
    // The align attribute's legacy text-align hint is neutralised.
    expect(getComputedStyle(b).textAlign).not.toBe("end")
    const bRect = rect(b)
    expect(Math.round(rect(b.querySelector("tec-message-avatar")!).right)).toBe(Math.round(bRect.right))
    const bubble = rect(b.querySelector("tec-bubble")!)
    const content = rect(b.querySelector("tec-message-content")!)
    expect(Math.round(bubble.right)).toBe(Math.round(content.right))
    const footer = b.querySelector("tec-message-footer")!
    expect(Math.round(rect(footer).right)).toBe(Math.round(content.right))
    expect(footer.matches(":state(end)")).toBe(true)
  })

  it("lifts the avatar when the message has a footer, and follows footer changes", async () => {
    const el = await fixture<TecMessage>(html`<tec-message>
      <tec-message-avatar></tec-message-avatar>
      <tec-message-content><tec-bubble><tec-bubble-content>x</tec-bubble-content></tec-bubble></tec-message-content>
    </tec-message>`)
    const avatar = el.querySelector("tec-message-avatar")!
    expect(avatar.matches(":state(footer)")).toBe(false)
    const footer = document.createElement("tec-message-footer")
    footer.textContent = "Read"
    el.querySelector("tec-message-content")!.append(footer)
    await nextFrame()
    await el.updateComplete
    await avatar.updateComplete
    expect(avatar.matches(":state(footer)")).toBe(true)
    expect(getComputedStyle(avatar).translate).toBe("0px -32px")
  })

  it("drops header/footer padding when the message holds a ghost bubble", async () => {
    const el = await fixture<TecMessage>(html`<tec-message>
      <tec-message-content>
        <tec-message-header>Mary</tec-message-header>
        <tec-bubble variant="ghost"><tec-bubble-content>Answer</tec-bubble-content></tec-bubble>
      </tec-message-content>
    </tec-message>`)
    const header = el.querySelector("tec-message-header")!
    const base = header.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(base).paddingInlineStart).toBe("0px")
    el.querySelector("tec-bubble")!.setAttribute("variant", "muted")
    await nextFrame()
    await header.updateComplete
    expect(getComputedStyle(base).paddingInlineStart).toBe("12px")
  })

  it("keeps author layout utilities on the footer (gap, justify)", async () => {
    const el = await fixture<HTMLElement>(html`<tec-message-footer style="gap: 8px"><span>a</span><span>b</span></tec-message-footer>`)
    const base = el.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(base).columnGap).toBe("8px")
  })

  it("has no role of its own and is accessible", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-message-group>
        <tec-message>
          <tec-message-content>
            <tec-message-header>Olivia</tec-message-header>
            <tec-bubble variant="muted"><tec-bubble-content>I already checked the logs.</tec-bubble-content></tec-bubble>
            <tec-message-footer><tec-button variant="ghost" size="icon" aria-label="Copy">C</tec-button></tec-message-footer>
          </tec-message-content>
        </tec-message>
      </tec-message-group>
    </div>`)
    expect(await axTree(root)).toEqual(expect.arrayContaining(["button: Copy"]))
    await expectAccessible(root)
  })
})
