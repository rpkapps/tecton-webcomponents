import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecBadge } from "./badge.js"
import "./define.js"
import "../spinner/define.js"

const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement
const resolve = (el: Element, value: string) => {
  const probe = document.createElement("span")
  probe.style.color = value
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe("tec-badge", () => {
  it("renders a static span with defaults and no role", async () => {
    const el = await fixture<TecBadge>(html`<tec-badge>Draft</tec-badge>`)
    expect(el.variant).toBe("default")
    expect(el.appearance).toBe("solid")
    expect(el.size).toBe("default")
    expect(base(el).localName).toBe("span")
    expect(el.getBoundingClientRect().height).toBe(20)
    expect(getComputedStyle(base(el)).backgroundColor).toBe(resolve(el, "var(--tec-primary)"))
    await expectAccessible(el)
  })

  it("applies the Tecton size scale and icon sizes", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-badge><svg slot="start" viewBox="0 0 24 24"></svg>a</tec-badge>
      <tec-badge size="md"><svg slot="start" viewBox="0 0 24 24"></svg>b</tec-badge>
      <tec-badge size="lg"><svg slot="start" viewBox="0 0 24 24"></svg>c</tec-badge>
    </div>`)
    const badges = [...root.querySelectorAll("tec-badge")]
    expect(badges.map((b) => b.getBoundingClientRect().height)).toEqual([20, 24, 28])
    expect(badges.map((b) => b.querySelector("svg")!.getBoundingClientRect().width)).toEqual([12, 14, 16])
    expect(badges.map((b) => getComputedStyle(base(b)).paddingInlineStart)).toEqual(["6px", "6px", "8px"])
    expect(badges.map((b) => getComputedStyle(base(b)).paddingInlineEnd)).toEqual(["8px", "8px", "10px"])
    expect(badges[0]!.matches(":state(has-start)")).toBe(true)
  })

  it("uses status surfaces, and coloured borders with appearance=outline", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-badge variant="success">a</tec-badge>
      <tec-badge variant="warning" appearance="outline">b</tec-badge>
      <tec-badge variant="secondary" appearance="outline">c</tec-badge>
    </div>`)
    const [success, warning, secondary] = [...root.querySelectorAll("tec-badge")].map((b) => getComputedStyle(base(b)))
    expect(success!.backgroundColor).toBe(resolve(root, "var(--tec-success-surface)"))
    expect(success!.color).toBe(resolve(root, "var(--tec-success-surface-foreground)"))
    expect(warning!.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(warning!.borderTopColor).toBe(resolve(root, "var(--tec-warning)"))
    expect(warning!.color).toBe(resolve(root, "var(--tec-warning)"))
    expect(secondary!.borderTopColor).toBe(resolve(root, "var(--tec-border)"))
    expect(secondary!.color).toBe(resolve(root, "var(--tec-foreground)"))
  })

  it("renders a link with href, focusable with a visible ring", async () => {
    const root = await fixture<HTMLElement>(html`<div><button>before</button><tec-badge href="#wells" aria-label="Open wells">Wells</tec-badge></div>`)
    const el = root.querySelector("tec-badge")!
    const a = base(el) as HTMLAnchorElement
    expect(a.localName).toBe("a")
    expect(a.getAttribute("href")).toBe("#wells")
    expect(await axNode(a)).toMatchObject({ role: "link", name: "Open wells" })
    root.querySelector("button")!.focus()
    await userEvent.tab()
    expect(el.shadowRoot!.activeElement).toBe(a)
    expect(getComputedStyle(a).boxShadow).not.toBe("none")
    await expectAccessible(root)
  })

  it("sizes a slotted spinner like an icon", async () => {
    const el = await fixture<TecBadge>(html`<tec-badge variant="secondary"><tec-spinner slot="end"></tec-spinner>Generating</tec-badge>`)
    expect(el.querySelector("tec-spinner")!.getBoundingClientRect().width).toBe(12)
    expect(el.matches(":state(has-end)")).toBe(true)
  })
})
