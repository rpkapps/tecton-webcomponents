import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, expectAccessible, fixture, nextFrame, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecCarousel } from "./carousel.js"
import "./define.js"

const slides = (n = 5, style = "") =>
  Array.from({ length: n }, (_, i) => html`<tec-carousel-item style=${style}><div style="height: 100px; border: 1px solid">${i + 1}</div></tec-carousel-item>`)

const carousel = (attrs: { orientation?: string; loop?: boolean; autoplay?: boolean; basis?: string; delay?: number } = {}) => html`
  <div style="padding: 0 4rem; width: 360px">
    <tec-carousel
      aria-label="Featured wells"
      orientation=${attrs.orientation ?? "horizontal"}
      ?loop=${attrs.loop}
      ?autoplay=${attrs.autoplay}
      autoplay-delay=${attrs.delay ?? 4000}
      snap-align="start"
    >
      <tec-carousel-content style=${attrs.orientation === "vertical" ? "height: 200px" : ""}>${slides(5, attrs.basis ?? "")}</tec-carousel-content>
      <tec-carousel-previous></tec-carousel-previous>
      <tec-carousel-next></tec-carousel-next>
      <tec-carousel-autoplay-toggle></tec-carousel-autoplay-toggle>
    </tec-carousel>
  </div>
`

async function setup(attrs: Parameters<typeof carousel>[0] = {}, dir?: "rtl") {
  const root = await fixture<HTMLElement>(carousel(attrs), dir ? { dir } : {})
  const el = root.querySelector("tec-carousel")!
  await waitUntil(() => el.snapCount > 0, "measured")
  await nextFrame()
  return {
    el,
    viewport: el.querySelector("tec-carousel-content")!.viewport!,
    prev: el.querySelector("tec-carousel-previous")!,
    next: el.querySelector("tec-carousel-next")!,
    toggle: el.querySelector("tec-carousel-autoplay-toggle")!,
    items: [...el.querySelectorAll("tec-carousel-item")],
  }
}

describe("tec-carousel", () => {
  it("is a named carousel region with labelled slides", async () => {
    const { el, items, prev, next, toggle } = await setup()
    expect(await axNode(el)).toMatchObject({ role: "region", name: "Featured wells", roledescription: "carousel" })
    expect(await axNode(items[0]!)).toMatchObject({ role: "group", name: "1 of 5", roledescription: "slide" })
    expect(await axNode(prev.control)).toMatchObject({ role: "button", name: "Previous slide", disabled: "true" })
    expect(await axNode(next.control)).toMatchObject({ role: "button", name: "Next slide" })
    expect(toggle.hidden).toBe(true)
    expect(el.snapCount).toBe(5)
    await expectAccessible(el.parentElement!)
  })

  it("moves with the next / previous buttons and fires tec-slide-change", async () => {
    const { el, prev, next, viewport } = await setup()
    const events = recordEvents<CustomEvent>(el, "tec-slide-change")
    await userEvent.click(next)
    await waitUntil(() => el.selectedIndex === 1, "slide 2")
    await waitUntil(() => Math.abs(viewport.scrollLeft - el.items[1]!.offsetLeft) < 20, "scrolled")
    expect(events.events[0]!.detail).toEqual({ index: 1, previousIndex: 0 })
    await el.updateComplete
    expect(prev.disabled).toBe(false)
    await userEvent.click(prev)
    await waitUntil(() => el.selectedIndex === 0, "slide 1")
  })

  it("announces the slide after a button press", async () => {
    const { el, next } = await setup()
    await userEvent.click(next)
    const live = el.shadowRoot!.querySelector("[aria-live]")!
    await waitUntil(() => live.textContent === "Slide 2 of 5", "announced")
  })

  it("disables next on the last slide unless loop", async () => {
    const { el, next } = await setup()
    el.goTo(4, { instant: true })
    await waitUntil(() => el.selectedIndex === 4)
    await el.updateComplete
    await next.updateComplete
    expect(next.disabled).toBe(true)

    const looping = await setup({ loop: true })
    looping.el.goTo(4, { instant: true })
    await waitUntil(() => looping.el.selectedIndex === 4)
    await looping.next.updateComplete
    expect(looping.next.disabled).toBe(false)
    await userEvent.click(looping.next)
    await waitUntil(() => looping.el.selectedIndex === 0, "wrapped")
  })

  it("moves with the arrow keys, mirrored in RTL", async () => {
    const { el, next } = await setup()
    next.focus()
    await userEvent.keyboard("{ArrowRight}")
    await waitUntil(() => el.selectedIndex === 1)
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => el.selectedIndex === 0)

    const rtl = await setup({}, "rtl")
    rtl.next.focus()
    await userEvent.keyboard("{ArrowLeft}")
    await waitUntil(() => rtl.el.selectedIndex === 1, "rtl next")
    expect(rtl.viewport.scrollLeft).toBeLessThan(0)
    // Previous sits on the right in RTL.
    expect(rtl.prev.getBoundingClientRect().left).toBeGreaterThan(rtl.next.getBoundingClientRect().left)
  })

  it("scrolls vertically", async () => {
    const { el, viewport, next, prev } = await setup({ orientation: "vertical", basis: "flex-basis: 50%" })
    expect(el.snapCount).toBeGreaterThan(1)
    await userEvent.click(next)
    await waitUntil(() => el.selectedIndex === 1)
    await waitUntil(() => viewport.scrollTop > 50, "scrolled down")
    expect(prev.getBoundingClientRect().bottom).toBeLessThanOrEqual(el.getBoundingClientRect().top)
  })

  it("groups slides that share the end position", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 300px">
      <tec-carousel aria-label="Cards" snap-align="start">
        <tec-carousel-content>
          ${Array.from({ length: 5 }, (_, i) => html`<tec-carousel-item style="flex-basis: 50%"><div>${i}</div></tec-carousel-item>`)}
        </tec-carousel-content>
      </tec-carousel>
    </div>`)
    const el = root.querySelector("tec-carousel")!
    await waitUntil(() => el.snapCount > 0)
    expect(el.snapCount).toBe(4)
  })

  it("autoplays, pauses on hover and stops with the toggle", async () => {
    const { el, toggle } = await setup({ autoplay: true, delay: 500 })
    expect(toggle.hidden).toBe(false)
    expect(el.playing).toBe(true)
    expect(el.matches(":state(playing)")).toBe(true)
    expect(await axNode(toggle.control)).toMatchObject({ name: "Stop automatic slide show" })
    await waitUntil(() => el.selectedIndex === 1, "advanced", 3000)
    await userEvent.click(toggle)
    expect(el.playing).toBe(false)
    await toggle.updateComplete
    expect(await axNode(toggle.control)).toMatchObject({ name: "Start automatic slide show" })
    await userEvent.click(toggle)
    expect(el.playing).toBe(true)
  })

  it("stops autoplay when the user navigates", async () => {
    const { el, next } = await setup({ autoplay: true, delay: 10000 })
    await userEvent.click(next)
    expect(el.playing).toBe(false)
  })

  it("lets an aria-label on a slide replace the default name", async () => {
    const root = await fixture<HTMLElement>(html`<tec-carousel aria-label="Wells">
      <tec-carousel-content><tec-carousel-item aria-label="Gullfaks A-12">A</tec-carousel-item></tec-carousel-content>
    </tec-carousel>`)
    expect(await axTree(root)).toContain("group: Gullfaks A-12")
  })
})
