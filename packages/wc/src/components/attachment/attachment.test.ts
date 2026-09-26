import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, nextFrame, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecAttachment, TecAttachmentGroup } from "./attachment.js"
import "./define.js"

const svg = html`<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>`
const base = (el: Element) => el.shadowRoot!.querySelector(".base") as HTMLElement
const pixel =
  "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="teal"/></svg>')

const card = (attrs: { state?: string; size?: string } = {}) => html`<tec-attachment state=${attrs.state ?? "done"} size=${attrs.size ?? "default"} style="width: 320px">
  <tec-attachment-media>${svg}</tec-attachment-media>
  <tec-attachment-content>
    <tec-attachment-title>sales-dashboard.pdf</tec-attachment-title>
    <tec-attachment-description>PDF · 2.4 MB</tec-attachment-description>
  </tec-attachment-content>
  <tec-attachment-actions>
    <tec-attachment-action aria-label="Remove sales-dashboard.pdf">${svg}</tec-attachment-action>
  </tec-attachment-actions>
</tec-attachment>`

describe("tec-attachment", () => {
  it("renders a card with media, text and a labelled ghost action", async () => {
    const el = await fixture<TecAttachment>(card())
    const b = getComputedStyle(base(el))
    expect(b.paddingTop).toBe("8px")
    expect(b.borderTopWidth).toBe("1px")
    expect(el.querySelector("tec-attachment-media")!.getBoundingClientRect().width).toBe(40)
    const action = el.querySelector("tec-attachment-action")!
    expect(action.getAttribute("variant")).toBe("ghost")
    expect(action.getBoundingClientRect().width).toBe(24)
    expect(await axNode(action.shadowRoot!.querySelector("button")!)).toMatchObject({ role: "button", name: "Remove sales-dashboard.pdf" })
    await expectAccessible(el)
  })

  it("reflects the upload state in the parts", async () => {
    const root = await fixture<HTMLElement>(html`<div>${card({ state: "uploading" })}${card({ state: "error" })}${card({ state: "idle" })}</div>`)
    const [uploading, error, idle] = root.querySelectorAll<TecAttachment>("tec-attachment")
    expect(uploading.querySelector("tec-attachment-title")!.matches(":state(busy)")).toBe(true)
    expect(getComputedStyle(base(uploading.querySelector("tec-attachment-title")!)).animationName).toBe("tec-shimmer")
    expect(error.querySelector("tec-attachment-description")!.matches(":state(error)")).toBe(true)
    expect(error.querySelector("tec-attachment-media")!.matches(":state(error)")).toBe(true)
    expect(getComputedStyle(base(idle)).borderTopStyle).toBe("dashed")
    uploading.state = "done"
    await uploading.updateComplete
    await uploading.querySelector("tec-attachment-title")!.updateComplete
    expect(uploading.querySelector("tec-attachment-title")!.matches(":state(busy)")).toBe(false)
  })

  it("sizes: sm and xs shrink the media and padding", async () => {
    const root = await fixture<HTMLElement>(html`<div>${card({ size: "sm" })}${card({ size: "xs" })}</div>`)
    const [sm, xs] = root.querySelectorAll<TecAttachment>("tec-attachment")
    expect(sm.querySelector("tec-attachment-media")!.getBoundingClientRect().width).toBe(32)
    expect(xs.querySelector("tec-attachment-media")!.getBoundingClientRect().width).toBe(28)
    expect(getComputedStyle(base(sm)).paddingTop).toBe("6px")
    expect(getComputedStyle(base(xs)).paddingTop).toBe("4px")
  })

  it("vertical image attachment with actions over the corner and a full-card link trigger", async () => {
    const el = await fixture<TecAttachment>(html`<tec-attachment orientation="vertical">
      <tec-attachment-media variant="image"><img src=${pixel} alt="Workspace" /></tec-attachment-media>
      <tec-attachment-content><tec-attachment-title>workspace.png</tec-attachment-title></tec-attachment-content>
      <tec-attachment-actions><tec-attachment-action aria-label="Remove workspace.png">${svg}</tec-attachment-action></tec-attachment-actions>
      <tec-attachment-trigger href="#open" aria-label="Open workspace.png"></tec-attachment-trigger>
    </tec-attachment>`)
    expect(el.getBoundingClientRect().width).toBe(120)
    const media = el.querySelector("tec-attachment-media")!.getBoundingClientRect()
    expect(Math.round(media.width)).toBe(Math.round(media.height))
    const trigger = el.querySelector("tec-attachment-trigger")!
    expect(Math.round(trigger.getBoundingClientRect().width)).toBe(118)
    expect(await axNode(base(trigger))).toMatchObject({ role: "link", name: "Open workspace.png" })
    // The action is above the trigger: clicking it hits the action.
    const action = el.querySelector("tec-attachment-action")!
    const clicks = recordEvents(action, "click")
    const triggerClicks = recordEvents(trigger, "click")
    await userEvent.click(action)
    expect(clicks.events.length).toBe(1)
    expect(triggerClicks.events.length).toBe(0)
    expect(el.matches(":state(has-trigger)")).toBe(true)
    await expectAccessible(el)
  })

  it("a button trigger fires click and shows the focus ring on the card", async () => {
    const el = await fixture<TecAttachment>(html`<tec-attachment>
      <tec-attachment-content><tec-attachment-title>research-summary.pdf</tec-attachment-title></tec-attachment-content>
      <tec-attachment-trigger aria-label="Preview research-summary.pdf"></tec-attachment-trigger>
    </tec-attachment>`)
    const trigger = el.querySelector("tec-attachment-trigger")!
    expect(await axNode(base(trigger))).toMatchObject({ role: "button", name: "Preview research-summary.pdf" })
    const clicks = recordEvents(trigger, "click")
    await userEvent.keyboard("{Tab}")
    await userEvent.keyboard("{Enter}")
    expect(clicks.events.length).toBe(1)
    expect(getComputedStyle(base(el)).boxShadow).not.toBe("none")
  })

  it("group scrolls horizontally with snapping and fades the far edge", async () => {
    const group = await fixture<TecAttachmentGroup>(html`<tec-attachment-group style="width: 300px">
      ${[1, 2, 3, 4].map((i) => html`<tec-attachment style="width: 200px"><tec-attachment-content><tec-attachment-title>file-${i}.pdf</tec-attachment-title></tec-attachment-content></tec-attachment>`)}
    </tec-attachment-group>`)
    expect(group.scrollWidth).toBeGreaterThan(group.clientWidth)
    expect(getComputedStyle(group).scrollSnapType).toBe("x mandatory")
    await nextFrame()
    await nextFrame()
    await waitUntil(() => getComputedStyle(group).getPropertyValue("--_fade-end").trim() !== "0px", "end fade")
    expect(getComputedStyle(group).getPropertyValue("--_fade-start").trim()).toBe("0.00px")
    group.scrollLeft = group.scrollWidth
    await waitUntil(() => getComputedStyle(group).getPropertyValue("--_fade-end").trim() === "0.00px", "end fade gone")
    expect(getComputedStyle(group).getPropertyValue("--_fade-start").trim()).not.toBe("0.00px")
  })
})
