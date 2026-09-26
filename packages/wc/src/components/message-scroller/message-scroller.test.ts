import { html, nothing } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, nextFrame, waitUntil } from "../../internal/test-utils.js"
import type { TecMessageScroller } from "./message-scroller.js"
import type { TecMessageScrollerButton } from "./message-scroller-parts.js"
import "./define.js"

const row = (id: string, height = 120, anchor = false) =>
  html`<tec-message-scroller-item message-id=${id} ?scroll-anchor=${anchor}><div style="height:${height}px">${id}</div></tec-message-scroller-item>`

function item(id: string, height = 120, anchor = false): HTMLElement {
  const el = document.createElement("tec-message-scroller-item")
  el.setAttribute("message-id", id)
  if (anchor) el.setAttribute("scroll-anchor", "")
  el.innerHTML = `<div style="height:${height}px">${id}</div>`
  return el
}

async function mount(opts: { position?: string; autoScroll?: boolean; rows?: number; anchors?: number[]; track?: boolean } = {}) {
  const ids = Array.from({ length: opts.rows ?? 10 }, (_, i) => `m${i + 1}`)
  const el = await fixture<TecMessageScroller>(html`<tec-message-scroller
    style="height: 400px; width: 360px"
    default-scroll-position=${opts.position ?? "end"}
    ?auto-scroll=${opts.autoScroll}
    ?track-visibility=${opts.track}
  >
    <tec-message-scroller-viewport>
      <tec-message-scroller-content>${ids.map((id, i) => row(id, 120, opts.anchors?.includes(i) ?? false))}</tec-message-scroller-content>
    </tec-message-scroller-viewport>
    <tec-message-scroller-button></tec-message-scroller-button>
    ${nothing}
  </tec-message-scroller>`)
  await waitUntil(() => !el.matches(":state(pending-scroll)"), "opening position applied")
  await nextFrame()
  await nextFrame()
  const viewport = el.querySelector("tec-message-scroller-viewport") as HTMLElement
  const content = el.querySelector("tec-message-scroller-content") as HTMLElement
  const button = el.querySelector("tec-message-scroller-button") as TecMessageScrollerButton
  return { el, viewport, content, button }
}

const atEnd = (v: HTMLElement) => Math.abs(v.scrollHeight - v.clientHeight - v.scrollTop) <= 1
const topIn = (v: HTMLElement, id: string) =>
  v.querySelector(`[message-id="${id}"]`)!.getBoundingClientRect().top - v.getBoundingClientRect().top

describe("tec-message-scroller", () => {
  it("exposes a focusable Messages region and a log", async () => {
    const { el, viewport, content } = await mount({ rows: 3 })
    expect(await axNode(viewport)).toMatchObject({ role: "region", name: "Messages", focusable: "true" })
    expect(await axNode(content)).toMatchObject({ role: "log", live: "polite", relevant: "additions" })
    await expectAccessible(el)
  })

  it("opens at the end by default, at the start, or at the last anchored turn", async () => {
    const end = await mount()
    expect(atEnd(end.viewport)).toBe(true)
    expect(end.el.scrollable).toEqual({ start: true, end: false })

    const start = await mount({ position: "start" })
    expect(start.viewport.scrollTop).toBe(0)
    expect(start.el.scrollable).toEqual({ start: false, end: true })

    const last = await mount({ position: "last-anchor", anchors: [2, 5] })
    // The last anchor (m6) sits at the top with a 64px peek of the previous row.
    expect(Math.round(topIn(last.viewport, "m6"))).toBe(64)
  })

  it("keeps the opening position while rows finish rendering, until the reader interacts", async () => {
    const last = await mount({ position: "last-anchor", anchors: [2, 5] })
    const grow = (id: string, h: number) => ((last.viewport.querySelector(`[message-id="${id}"]`)!.firstElementChild as HTMLElement).style.height = `${h}px`)
    // A row above the anchor grows late (an image, a font, a content-visibility placeholder).
    grow("m2", 300)
    await waitUntil(() => Math.round(topIn(last.viewport, "m6")) === 64, "re-anchored after late growth")
    const end = await mount()
    ;(end.viewport.querySelector('[message-id="m10"]')!.firstElementChild as HTMLElement).style.height = "300px"
    await waitUntil(() => atEnd(end.viewport), "still at the end")
    // After an interaction the view is left alone.
    end.viewport.dispatchEvent(new PointerEvent("pointerdown"))
    end.viewport.scrollTop = 200
    await aTimeout(50)
    ;(end.viewport.querySelector('[message-id="m9"]')!.firstElementChild as HTMLElement).style.height = "300px"
    await aTimeout(100)
    expect(end.viewport.scrollTop).toBe(200)
  })

  it("the button is inert until there is content in its direction, then jumps there", async () => {
    const { el, viewport, button } = await mount()
    const inner = button.shadowRoot!.querySelector("button")!
    expect(button.matches(":state(inactive)")).toBe(true)
    expect(inner.inert).toBe(true)
    expect(inner.tabIndex).toBe(-1)
    viewport.scrollTop = 0
    await waitUntil(() => el.scrollable.end, "scrollable end")
    await button.updateComplete
    expect(button.matches(":state(inactive)")).toBe(false)
    expect(inner.inert).toBe(false)
    expect(await axNode(inner)).toMatchObject({ role: "button", name: "Scroll to end" })
    button.behavior = "auto"
    await userEvent.click(button)
    await waitUntil(() => atEnd(viewport), "scrolled to end")
  })

  it("anchors an appended turn near the top, keeping a peek of the previous row", async () => {
    const { viewport, content } = await mount({ rows: 6 })
    content.append(item("q1", 80, true))
    await waitUntil(() => Math.round(topIn(viewport, "q1")) === 64, "anchored")
    // The reply streams in below without moving the turn.
    const reply = item("a1", 40)
    content.append(reply)
    await aTimeout(50)
    ;(reply.firstElementChild as HTMLElement).style.height = "600px"
    await aTimeout(100)
    expect(Math.round(topIn(viewport, "q1"))).toBe(64)
  })

  it("auto-scroll follows the live edge, and scrolling away releases it", async () => {
    const { viewport, content } = await mount({ autoScroll: true })
    expect(atEnd(viewport)).toBe(true)
    content.append(item("n1", 200))
    await waitUntil(() => atEnd(viewport), "followed")
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
    viewport.scrollTop = 100
    await aTimeout(50)
    content.append(item("n2", 200))
    await aTimeout(100)
    expect(viewport.scrollTop).toBe(100)
  })

  it("keeps the visible row in place when history is prepended", async () => {
    const { viewport, content } = await mount()
    viewport.scrollTop = 300
    await aTimeout(50)
    const before = topIn(viewport, "m4")
    content.prepend(item("old1", 150), item("old2", 150))
    await aTimeout(50)
    expect(Math.round(topIn(viewport, "m4"))).toBe(Math.round(before))
  })

  it("scrollToMessage jumps to a row, queues before rows exist, and returns false for unknown ids", async () => {
    const { el, viewport } = await mount({ position: "start" })
    expect(el.scrollToMessage("m5", { align: "start" })).toBe(true)
    await waitUntil(() => Math.round(topIn(viewport, "m5")) === 0, "jumped")
    expect(el.scrollToMessage("nope")).toBe(false)

    const empty = await fixture<TecMessageScroller>(html`<tec-message-scroller style="height:300px">
      <tec-message-scroller-viewport><tec-message-scroller-content></tec-message-scroller-content></tec-message-scroller-viewport>
    </tec-message-scroller>`)
    await aTimeout(50)
    expect(empty.scrollToMessage("later")).toBe(true)
    const c = empty.querySelector("tec-message-scroller-content")!
    c.append(item("x1", 200), item("x2", 200), item("later", 200), item("x3", 200))
    const v = empty.querySelector("tec-message-scroller-viewport") as HTMLElement
    await waitUntil(() => Math.round(topIn(v, "later")) === 0, "queued jump")
  })

  it("tracks visibility when asked", async () => {
    const { el, viewport } = await mount({ position: "start", track: true, anchors: [0, 4] })
    await waitUntil(() => el.visibility.visibleMessageIds.length > 0, "visible ids")
    expect(el.visibility.visibleMessageIds[0]).toBe("m1")
    expect(el.visibility.currentAnchorId).toBe("m1")
    const events: CustomEvent[] = []
    el.addEventListener("tec-visibility-change", (e) => events.push(e as CustomEvent))
    viewport.scrollTop = 4 * 120 + 24 * 4
    await waitUntil(() => el.visibility.currentAnchorId === "m5", "anchor m5")
    expect(events.length).toBeGreaterThan(0)
  })

  it("scroll keys on the focused viewport scroll it", async () => {
    const { viewport } = await mount({ position: "start" })
    viewport.focus()
    await userEvent.keyboard("{PageDown}")
    await waitUntil(() => viewport.scrollTop > 0, "scrolled by key")
  })
})
