import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture } from "../../internal/test-utils.js"
import "./define.js"
import type { TecBreadcrumbItem, TecBreadcrumbLink } from "./breadcrumb.js"

const trail = html`<tec-breadcrumb>
  <tec-breadcrumb-list>
    <tec-breadcrumb-item><tec-breadcrumb-link href="#home">Home</tec-breadcrumb-link></tec-breadcrumb-item>
    <tec-breadcrumb-item><tec-breadcrumb-ellipsis></tec-breadcrumb-ellipsis></tec-breadcrumb-item>
    <tec-breadcrumb-item><tec-breadcrumb-link href="#components">Components</tec-breadcrumb-link></tec-breadcrumb-item>
    <tec-breadcrumb-item><tec-breadcrumb-page>Breadcrumb</tec-breadcrumb-page></tec-breadcrumb-item>
  </tec-breadcrumb-list>
</tec-breadcrumb>`

const separator = (item: Element) => item.shadowRoot!.querySelector(".separator")

describe("tec-breadcrumb", () => {
  it("is a named navigation landmark with a list, links and the current page", async () => {
    const el = await fixture<HTMLElement>(trail)
    expect(await axNode(el)).toMatchObject({ role: "navigation", name: "breadcrumb" })
    const tree = await axTree(el)
    expect(tree).toContain("list")
    expect(tree.filter((n) => n.startsWith("listitem"))).toHaveLength(4)
    expect(tree).toContain("link: Home")
    expect(tree).toContain("link: Components")
    const page = el.querySelector("tec-breadcrumb-page")!
    expect(await axNode(page)).toMatchObject({ role: "link", name: "Breadcrumb", disabled: "true" })
    await expectAccessible(el)
  })

  it("accepts another landmark name", async () => {
    const el = await fixture<HTMLElement>(html`<tec-breadcrumb aria-label="Fil d'Ariane"><tec-breadcrumb-list></tec-breadcrumb-list></tec-breadcrumb>`)
    expect(await axNode(el)).toMatchObject({ role: "navigation", name: "Fil d'Ariane" })
  })

  it("draws a separator after every item but the last, and follows list changes", async () => {
    const el = await fixture<HTMLElement>(trail)
    const items = [...el.querySelectorAll<TecBreadcrumbItem>("tec-breadcrumb-item")]
    expect(items.map((i) => !!separator(i))).toEqual([true, true, true, false])
    expect(items[3]!.matches(":state(current)")).toBe(true)
    // the separator is decorative
    expect(await axNode(separator(items[0]!)!)).toMatchObject({ ignored: "true" })

    items[3]!.remove()
    await items[2]!.updateComplete
    await new Promise((r) => setTimeout(r))
    await items[2]!.updateComplete
    expect(separator(items[2]!)).toBeNull()
    expect(items[2]!.current).toBe(true)
    const link = items[2]!.querySelector<TecBreadcrumbLink>("tec-breadcrumb-link")!
    await link.updateComplete
    expect(link.current).toBe(true)
    const a = link.shadowRoot!.querySelector("a")!
    expect(a.hasAttribute("href")).toBe(false)
    expect(await axNode(a)).toMatchObject({ role: "link", name: "Components", disabled: "true" })
  })

  it("uses explicit separators instead of its own", async () => {
    const el = await fixture<HTMLElement>(html`<tec-breadcrumb-list>
      <tec-breadcrumb-item><tec-breadcrumb-link href="#">Home</tec-breadcrumb-link></tec-breadcrumb-item>
      <tec-breadcrumb-separator>/</tec-breadcrumb-separator>
      <tec-breadcrumb-item><tec-breadcrumb-page>Page</tec-breadcrumb-page></tec-breadcrumb-item>
    </tec-breadcrumb-list>`)
    const first = el.querySelector<TecBreadcrumbItem>("tec-breadcrumb-item")!
    await first.updateComplete
    expect(separator(first)).toBeNull()
    expect(await axTree(el)).toEqual(["list", "listitem", "link: Home", "listitem", "link: Page [disabled]"])
    await expectAccessible(el)
  })

  it("takes a custom separator per item", async () => {
    const el = await fixture<HTMLElement>(html`<tec-breadcrumb-list>
      <tec-breadcrumb-item><tec-breadcrumb-link href="#">Home</tec-breadcrumb-link><span slot="separator">/</span></tec-breadcrumb-item>
      <tec-breadcrumb-item><tec-breadcrumb-page>Page</tec-breadcrumb-page></tec-breadcrumb-item>
    </tec-breadcrumb-list>`)
    const first = el.querySelector("tec-breadcrumb-item")!
    const slot = first.shadowRoot!.querySelector<HTMLSlotElement>("slot[name=separator]")!
    expect(slot.assignedElements()[0]!.textContent).toBe("/")
  })

  it("links are real anchors in the tab order; the page and ellipsis are not", async () => {
    const el = await fixture<HTMLElement>(html`<div><button>before</button>${trail}</div>`)
    el.querySelector("button")!.focus()
    await userEvent.keyboard("{Tab}")
    expect((deepActiveElement() as HTMLAnchorElement).getAttribute("href")).toBe("#home")
    await userEvent.keyboard("{Tab}")
    expect((deepActiveElement() as HTMLAnchorElement).getAttribute("href")).toBe("#components")
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(document.body)
  })

  it("styles a slotted router anchor as a breadcrumb link", async () => {
    const el = await fixture<HTMLElement>(html`<tec-breadcrumb-link><a href="#routed">Routed</a></tec-breadcrumb-link>`)
    const a = el.querySelector("a")!
    expect(getComputedStyle(a).color).toBe(getComputedStyle(el).color)
    expect(await axNode(a)).toMatchObject({ role: "link", name: "Routed" })
  })

  it("mirrors the chevron in RTL", async () => {
    const el = await fixture<HTMLElement>(trail, { dir: "rtl" })
    const svg = separator(el.querySelector("tec-breadcrumb-item")!)!.querySelector("svg")!
    expect(getComputedStyle(svg).transform).toBe("matrix(-1, 0, 0, 1, 0, 0)")
  })
})
