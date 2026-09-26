import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, nextFrame } from "../../internal/test-utils.js"
import type { TecItem } from "./item.js"
import "./define.js"

const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement

describe("tec-item", () => {
  it("renders a static row with the size scale", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-item variant="outline"><tec-item-content><tec-item-title>A</tec-item-title></tec-item-content></tec-item>
      <tec-item variant="outline" size="sm"><tec-item-content><tec-item-title>B</tec-item-title></tec-item-content></tec-item>
      <tec-item variant="outline" size="xs"><tec-item-content><tec-item-title>C</tec-item-title></tec-item-content></tec-item>
    </div>`)
    const items = [...root.querySelectorAll<TecItem>("tec-item")]
    expect(items.map((i) => getComputedStyle(base(i)).padding)).toEqual(["14px 16px", "10px 12px", "8px 10px"])
    expect(items.map((i) => getComputedStyle(base(i)).columnGap)).toEqual(["14px", "10px", "8px"])
    expect(getComputedStyle(base(items[0]!)).borderTopWidth).toBe("1px")
    expect(base(items[0]!).localName).toBe("div")
    expect(items[0]!.getBoundingClientRect().width).toBe(400)
    await expectAccessible(root)
  })

  it("uses the variant surfaces", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-item>A</tec-item><tec-item variant="outline">B</tec-item><tec-item variant="muted">C</tec-item>
    </div>`)
    const [plain, outline, muted] = [...root.querySelectorAll("tec-item")].map((i) => getComputedStyle(base(i)))
    expect(plain!.borderTopColor).toBe("rgba(0, 0, 0, 0)")
    expect(outline!.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(muted!.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("becomes a real link with href", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <button>before</button>
      <tec-item href="#item-target" target="_blank"
        ><tec-item-content><tec-item-title>Docs</tec-item-title><tec-item-description>Get started</tec-item-description></tec-item-content></tec-item
      >
    </div>`)
    const item = root.querySelector<TecItem>("tec-item")!
    const link = base(item) as HTMLAnchorElement
    expect(link.localName).toBe("a")
    expect(link.getAttribute("href")).toBe("#item-target")
    expect(link.rel).toBe("noreferrer noopener")
    expect(item.matches(":state(link)")).toBe(true)
    expect(await axNode(link)).toMatchObject({ role: "link", name: "Docs Get started" })
    root.querySelector("button")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(link)
    expect(getComputedStyle(link).boxShadow).not.toBe("none")
    await expectAccessible(root)
  })

  it("aligns the media with the title when there is a description", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-item>
        <tec-item-media variant="icon"><svg viewBox="0 0 24 24"></svg></tec-item-media>
        <tec-item-content><tec-item-title>T</tec-item-title><tec-item-description>D</tec-item-description></tec-item-content>
      </tec-item>
      <tec-item size="sm">
        <tec-item-media variant="image"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /></tec-item-media>
        <tec-item-content><tec-item-title>T</tec-item-title></tec-item-content>
      </tec-item>
    </div>`)
    const [withDesc, withImage] = [...root.querySelectorAll("tec-item")]
    expect(withDesc!.matches(":state(has-description)")).toBe(true)
    const media = withDesc!.querySelector("tec-item-media")!
    expect(getComputedStyle(media).alignSelf).toBe("flex-start")
    expect(withDesc!.querySelector("svg")!.getBoundingClientRect().width).toBe(16)
    expect(withImage!.matches(":state(has-description)")).toBe(false)
    const imageMedia = withImage!.querySelector("tec-item-media")!
    expect(imageMedia.getBoundingClientRect().width).toBe(32)
    expect(withImage!.querySelector("img")!.getBoundingClientRect().width).toBe(32)
  })

  it("shrinks a second content column and the xs description", async () => {
    const item = await fixture<TecItem>(html`<tec-item size="xs" style="width: 400px">
      <tec-item-content><tec-item-title>Song</tec-item-title><tec-item-description>Artist</tec-item-description></tec-item-content>
      <tec-item-content><tec-item-description>3:45</tec-item-description></tec-item-content>
    </tec-item>`)
    const [first, second] = [...item.querySelectorAll("tec-item-content")]
    expect(second!.matches(":state(after-content)")).toBe(true)
    expect(first!.matches(":state(after-content)")).toBe(false)
    expect(second!.getBoundingClientRect().width).toBeLessThan(first!.getBoundingClientRect().width)
    expect(getComputedStyle(item.querySelector("tec-item-description")!).fontSize).toBe("12px")
    expect(getComputedStyle(first!).rowGap).toBe("0px")
  })

  it("upgrades parent-first (HTML parsed before its children upgrade) without errors", async () => {
    // innerHTML upgrades in tree order: tec-item connects while its tec-item-content children are
    // still plain HTMLElements (this threw "content.requestUpdate is not a function").
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message)
    window.addEventListener("error", onError)
    try {
      const root = await fixture<HTMLElement>(`<div class="flex w-full max-w-xs flex-col gap-4">
        <tec-item variant="muted">
          <tec-item-media><span>*</span></tec-item-media>
          <tec-item-content><tec-item-title>Processing payment...</tec-item-title></tec-item-content>
          <tec-item-content><span>$100.00</span></tec-item-content>
        </tec-item>
      </div>`)
      await nextFrame()
      const [first, second] = [...root.querySelectorAll("tec-item-content")]
      expect(second!.matches(":state(after-content)")).toBe(true)
      expect(first!.matches(":state(after-content)")).toBe(false)
      // Content added later is re-evaluated by the item.
      const third = document.createElement("tec-item-content")
      root.querySelector("tec-item")!.insertBefore(third, first!)
      await nextFrame()
      await nextFrame()
      expect(first!.matches(":state(after-content)")).toBe(true)
      expect(third.matches(":state(after-content)")).toBe(false)
    } finally {
      window.removeEventListener("error", onError)
    }
    expect(errors).toEqual([])
  })

  it("puts header and footer on full-width rows", async () => {
    const item = await fixture<TecItem>(html`<tec-item style="width: 400px">
      <tec-item-header>H</tec-item-header>
      <tec-item-content><tec-item-title>T</tec-item-title></tec-item-content>
      <tec-item-footer>F</tec-item-footer>
    </tec-item>`)
    const header = item.querySelector("tec-item-header")!.getBoundingClientRect()
    const content = item.querySelector("tec-item-content")!.getBoundingClientRect()
    expect(header.width).toBe(400 - 2 - 32)
    expect(content.top).toBeGreaterThan(header.bottom)
  })
})

describe("tec-item-group", () => {
  it("is a list of listitems and tightens with small items", async () => {
    const group = await fixture<HTMLElement>(html`<tec-item-group aria-label="People">
      <tec-item variant="outline"><tec-item-content><tec-item-title>Alex</tec-item-title></tec-item-content></tec-item>
      <tec-item-separator></tec-item-separator>
      <tec-item variant="outline" href="#"><tec-item-content><tec-item-title>Jamie</tec-item-title></tec-item-content></tec-item>
    </tec-item-group>`)
    expect(await axTree(group)).toEqual(expect.arrayContaining(["list: People", "listitem", "link: Jamie"]))
    expect(getComputedStyle(group).rowGap).toBe("16px")
    const separator = group.querySelector("tec-item-separator")!
    expect(separator.getBoundingClientRect().height).toBe(17)
    group.querySelector("tec-item")!.setAttribute("size", "sm")
    await nextFrame()
    expect(group.matches(":state(has-sm)")).toBe(true)
    expect(getComputedStyle(group).rowGap).toBe("10px")
    await expectAccessible(group)
  })

  it("exposes a standalone separator", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-item-separator></tec-item-separator></div>`)
    expect(await axNode(root.querySelector("tec-item-separator")!)).toMatchObject({ role: "separator" })
  })
})
