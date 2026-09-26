import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import type { TecScrollArea } from "./scroll-area.js"
import "./define.js"

const tags = Array.from({ length: 30 }, (_, i) => html`<div>v1.2.0-beta.${30 - i}</div>`)

describe("tec-scroll-area", () => {
  it("scrolls its overflowing content with a thin themed scrollbar", async () => {
    const area = await fixture<TecScrollArea>(html`<tec-scroll-area style="height: 120px; width: 160px">${tags}</tec-scroll-area>`)
    const cs = getComputedStyle(area)
    expect(cs.overflowY).toBe("auto")
    expect(cs.scrollbarWidth).toBe("thin")
    expect(area.scrollHeight).toBeGreaterThan(area.clientHeight)
    area.scrollTop = 50
    expect(area.scrollTop).toBe(50)
  })

  it("becomes a tab stop while it overflows without focusable content", async () => {
    const area = await fixture<TecScrollArea>(
      html`<tec-scroll-area aria-label="Tags" style="height: 120px; width: 160px">${tags}</tec-scroll-area>`
    )
    await waitUntil(() => area.getAttribute("tabindex") === "0")
    expect(await axNode(area)).toMatchObject({ role: "region", name: "Tags" })
    await userEvent.keyboard("{Tab}")
    expect(document.activeElement).toBe(area)
    expect(getComputedStyle(area).boxShadow).not.toBe("none")
    await userEvent.keyboard("{ArrowDown}")
    await waitUntil(() => area.scrollTop > 0)
    await expectAccessible(area)
    area.style.height = "2000px"
    await waitUntil(() => !area.hasAttribute("tabindex"))
  })

  it("leaves the tab order alone when the content is focusable or tabindex is authored", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-scroll-area style="height: 60px">${tags}<button>Load more</button></tec-scroll-area>
      <tec-scroll-area tabindex="-1" style="height: 60px">${tags}</tec-scroll-area>
    </div>`)
    await new Promise((r) => setTimeout(r, 50))
    const [withButton, authored] = [...root.querySelectorAll("tec-scroll-area")]
    expect(withButton!.hasAttribute("tabindex")).toBe(false)
    expect(authored!.getAttribute("tabindex")).toBe("-1")
    expect(await axNode(withButton!)).not.toMatchObject({ role: "region" })
  })

  it("scrolls horizontally, starting from the right in RTL", async () => {
    const area = await fixture<TecScrollArea>(
      html`<tec-scroll-area style="width: 100px; white-space: nowrap"><div style="width: 400px; display: flex">wide</div></tec-scroll-area>`,
      { dir: "rtl" }
    )
    expect(area.scrollWidth).toBe(400)
    expect(area.scrollLeft).toBe(0)
    area.scrollLeft = -100
    expect(area.scrollLeft).toBe(-100)
  })
})
