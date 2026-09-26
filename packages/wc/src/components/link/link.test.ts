import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecLink } from "./link.js"
import "./define.js"

const anchor = (el: TecLink) => el.anchor

describe("tec-link", () => {
  it("renders a native link", async () => {
    const el = await fixture<TecLink>(html`<tec-link href="#wells" variant="primary">34/10-A-12</tec-link>`)
    expect(anchor(el).getAttribute("href")).toBe("#wells")
    expect(await axNode(anchor(el))).toMatchObject({ role: "link", name: "34/10-A-12" })
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-link-foreground)"
    el.after(probe)
    for (const a of anchor(el).getAnimations()) a.finish()
    expect(getComputedStyle(anchor(el)).color).toBe(getComputedStyle(probe).color)
    await expectAccessible(el)
  })

  it("opens external links in a new tab with a safe rel, icon and hint", async () => {
    const el = await fixture<TecLink>(html`<tec-link href="https://example.com" external rel="nofollow">Register</tec-link>`)
    const a = anchor(el)
    expect(a.target).toBe("_blank")
    expect(a.rel).toBe("noreferrer noopener nofollow")
    expect(el.shadowRoot!.querySelector("svg.external")).not.toBeNull()
    expect((await axNode(a)).name).toBe("Register (opens in a new tab)")
    el.target = "_self"
    await el.updateComplete
    expect(a.target).toBe("_self")
  })

  it("is focusable, forwards aria and can be disabled", async () => {
    const el = await fixture<TecLink>(html`<tec-link href="#x" aria-label="Open well">Open</tec-link>`)
    await userEvent.keyboard("{Tab}")
    expect(el.shadowRoot!.activeElement).toBe(anchor(el))
    expect(anchor(el).getAttribute("aria-label")).toBe("Open well")
    el.disabled = true
    await el.updateComplete
    expect(anchor(el).hasAttribute("href")).toBe(false)
    expect(await axNode(anchor(el))).toMatchObject({ role: "link", disabled: "true" })
  })

  it("sizes text and underlines subtle links", async () => {
    const root = await fixture<HTMLElement>(html`<div style="font-size:20px"><tec-link href="#" size="sm">a</tec-link><tec-link href="#" variant="subtle">b</tec-link></div>`)
    const [sm, subtle] = [...root.querySelectorAll<TecLink>("tec-link")]
    expect(getComputedStyle(anchor(sm!)).fontSize).toBe("12px")
    expect(getComputedStyle(anchor(subtle!)).fontSize).toBe("20px")
    expect(getComputedStyle(anchor(subtle!)).textDecorationLine).toBe("underline")
    expect(getComputedStyle(anchor(sm!)).textDecorationLine).toBe("none")
  })
})
