import { html } from "lit"
import { describe, expect, it } from "vitest"
import { expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecCountBadge } from "./count-badge.js"
import "./define.js"

const pill = (el: TecCountBadge) => el.shadowRoot!.querySelector<HTMLElement>(".badge")

describe("tec-count-badge", () => {
  it("renders a decorative count anchored top-right", async () => {
    const el = await fixture<TecCountBadge>(html`<tec-count-badge count="4"><button aria-label="Notifications, 4 unread" style="width:32px;height:32px">x</button></tec-count-badge>`)
    const badge = pill(el)!
    expect(badge.textContent).toBe("4")
    expect(badge.getAttribute("aria-hidden")).toBe("true")
    const host = el.getBoundingClientRect()
    const box = badge.getBoundingClientRect()
    expect(box.height).toBe(16)
    expect(box.right).toBe(host.right + 4)
    expect(box.top).toBe(host.top - 4)
    await expectAccessible(el)
  })

  it("caps at max, hides zero unless show-zero, and shows content", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-count-badge count="128"></tec-count-badge>
      <tec-count-badge count="1250" max="999"></tec-count-badge>
      <tec-count-badge count="0"></tec-count-badge>
      <tec-count-badge count="0" show-zero></tec-count-badge>
      <tec-count-badge content="New"></tec-count-badge>
      <tec-count-badge></tec-count-badge>
      <tec-count-badge count="3" invisible></tec-count-badge>
    </div>`)
    const labels = [...root.querySelectorAll<TecCountBadge>("tec-count-badge")].map((b) => pill(b)?.textContent ?? null)
    expect(labels).toEqual(["99+", "999+", null, "0", "New", null, null])
    expect(root.querySelector<TecCountBadge>("tec-count-badge[invisible]")!.matches(":state(hidden)")).toBe(true)
  })

  it("renders an 8px dot on any corner", async () => {
    const el = await fixture<TecCountBadge>(html`<tec-count-badge variant="dot" color="success" anchor="bottom-left"><span style="display:block;width:40px;height:40px"></span></tec-count-badge>`)
    const badge = pill(el)!
    const box = badge.getBoundingClientRect()
    const host = el.getBoundingClientRect()
    expect([box.width, box.height]).toEqual([8, 8])
    expect(badge.textContent).toBe("")
    expect(box.left).toBe(host.left - 4)
    expect(box.bottom).toBe(host.bottom + 4)
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-success)"
    el.append(probe)
    expect(getComputedStyle(badge).backgroundColor).toBe(getComputedStyle(probe).color)
  })
})
