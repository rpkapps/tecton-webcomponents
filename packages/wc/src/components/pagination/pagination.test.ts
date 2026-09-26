import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture } from "../../internal/test-utils.js"
import "./define.js"
import type { TecPaginationLink } from "./pagination.js"

const demo = html`<tec-pagination>
  <tec-pagination-content>
    <tec-pagination-item><tec-pagination-previous href="#p1"></tec-pagination-previous></tec-pagination-item>
    <tec-pagination-item><tec-pagination-link href="#p1">1</tec-pagination-link></tec-pagination-item>
    <tec-pagination-item><tec-pagination-link href="#p2" active>2</tec-pagination-link></tec-pagination-item>
    <tec-pagination-item><tec-pagination-link href="#p3">3</tec-pagination-link></tec-pagination-item>
    <tec-pagination-item><tec-pagination-ellipsis></tec-pagination-ellipsis></tec-pagination-item>
    <tec-pagination-item><tec-pagination-next href="#p3"></tec-pagination-next></tec-pagination-item>
  </tec-pagination-content>
</tec-pagination>`

const inner = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement

describe("tec-pagination", () => {
  it("is a navigation landmark with a list of links; the current page is marked", async () => {
    const el = await fixture<HTMLElement>(demo)
    expect(await axNode(el)).toMatchObject({ role: "navigation", name: "pagination" })
    const tree = await axTree(el)
    expect(tree.filter((n) => n.startsWith("link"))).toEqual([
      "link: Go to previous page",
      "link: 1",
      "link: 2",
      "link: 3",
      "link: Go to next page",
    ])
    expect(tree.filter((n) => n.startsWith("listitem"))).toHaveLength(6)
    const current = el.querySelector<TecPaginationLink>("tec-pagination-link[active]")!
    expect(inner(current).getAttribute("aria-current")).toBe("page")
    expect(current.matches(":state(active)")).toBe(true)
    await expectAccessible(el)
  })

  it("links are ghost, the active one outline; page links are square", async () => {
    const el = await fixture<HTMLElement>(demo)
    const [one, two] = [...el.querySelectorAll<TecPaginationLink>("tec-pagination-link")]
    expect(one!.variant).toBe("ghost")
    expect(two!.variant).toBe("outline")
    expect(one!.getBoundingClientRect().width).toBe(32)
    expect(one!.getBoundingClientRect().height).toBe(32)
    two!.active = false
    await two!.updateComplete
    expect(two!.variant).toBe("ghost")
    expect(inner(two!).hasAttribute("aria-current")).toBe(false)
  })

  it("previous/next take their label and text from attributes, and mirror the chevron in RTL", async () => {
    const el = await fixture<HTMLElement>(
      html`<tec-pagination-previous href="#" text="السابق" label="الصفحة السابقة"></tec-pagination-previous>`,
      { dir: "rtl" }
    )
    expect(await axNode(inner(el))).toMatchObject({ role: "link", name: "الصفحة السابقة" })
    expect(el.shadowRoot!.querySelector(".text")!.textContent).toBe("السابق")
    expect(getComputedStyle(el.shadowRoot!.querySelector(".chevron")!).transform).toBe("matrix(-1, 0, 0, 1, 0, 0)")
  })

  it("a disabled step is not a live link", async () => {
    const el = await fixture<HTMLElement>(html`<tec-pagination-previous href="#p0" disabled></tec-pagination-previous>`)
    const a = inner(el)
    expect(a.hasAttribute("href")).toBe(false)
    expect(await axNode(a)).toMatchObject({ role: "link", disabled: "true" })
  })

  it("is reachable with Tab, link by link", async () => {
    const el = await fixture<HTMLElement>(html`<div><button>before</button>${demo}</div>`)
    el.querySelector("button")!.focus()
    const hrefs: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      await userEvent.keyboard("{Tab}")
      hrefs.push((deepActiveElement() as HTMLElement).getAttribute("href"))
    }
    expect(hrefs).toEqual(["#p1", "#p1", "#p2", "#p3", "#p3"])
  })
})
