import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture, nextFrame, oneEvent, waitUntil } from "../../internal/test-utils.js"
import type { TecAvatar, TecAvatarImage } from "./avatar.js"
import "./define.js"

// A 2×2 PNG, and a URL that fails.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNgYGD4z8DAwMDAAAAOAAHn2X3cAAAAAElFTkSuQmCC"
const BROKEN = "data:image/png;base64,broken"

const visible = (el: Element) => el.getBoundingClientRect().width > 0

describe("tec-avatar", () => {
  it("shows the picture and hides the fallback once loaded", async () => {
    const avatar = await fixture<TecAvatar>(html`<tec-avatar>
      <tec-avatar-image src=${PNG} alt="Jane Doe"></tec-avatar-image>
      <tec-avatar-fallback>JD</tec-avatar-fallback>
    </tec-avatar>`)
    const image = avatar.querySelector<TecAvatarImage>("tec-avatar-image")!
    await waitUntil(() => image.status === "loaded")
    expect(image.matches(":state(loaded)")).toBe(true)
    expect(avatar.matches(":state(image)")).toBe(true)
    expect(visible(image)).toBe(true)
    expect(visible(avatar.querySelector("tec-avatar-fallback")!)).toBe(false)
    const img = image.shadowRoot!.querySelector("img")!
    expect(await axNode(img)).toMatchObject({ role: "image", name: "Jane Doe" })
    await expectAccessible(avatar)
  })

  it("falls back when the picture fails, and recovers when src changes", async () => {
    const avatar = await fixture<TecAvatar>(html`<tec-avatar>
      <tec-avatar-image src=${BROKEN}></tec-avatar-image>
      <tec-avatar-fallback>CN</tec-avatar-fallback>
    </tec-avatar>`)
    const image = avatar.querySelector<TecAvatarImage>("tec-avatar-image")!
    await waitUntil(() => image.status === "error")
    await nextFrame()
    expect(avatar.matches(":state(image)")).toBe(false)
    expect(visible(image)).toBe(false)
    const fallback = avatar.querySelector("tec-avatar-fallback")!
    expect(visible(fallback)).toBe(true)
    expect(fallback.getBoundingClientRect().width).toBe(32)
    const loaded = oneEvent(image, "load")
    image.src = PNG
    await loaded
    await image.updateComplete
    expect(avatar.matches(":state(image)")).toBe(true)
    expect(visible(fallback)).toBe(false)
    await expectAccessible(avatar)
  })

  it("shows the fallback without an image or with an empty src", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-avatar><tec-avatar-fallback>AB</tec-avatar-fallback></tec-avatar>
      <tec-avatar><tec-avatar-image src=""></tec-avatar-image><tec-avatar-fallback>CD</tec-avatar-fallback></tec-avatar>
    </div>`)
    for (const fallback of root.querySelectorAll("tec-avatar-fallback")) expect(visible(fallback)).toBe(true)
    expect(root.querySelector<TecAvatarImage>("tec-avatar-image")!.status).toBe("error")
  })

  it("sizes the avatar, the fallback text and the badge", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-avatar size="sm"><tec-avatar-fallback>A</tec-avatar-fallback><tec-avatar-badge><svg></svg></tec-avatar-badge></tec-avatar>
      <tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback><tec-avatar-badge><svg></svg></tec-avatar-badge></tec-avatar>
      <tec-avatar size="lg"><tec-avatar-fallback>A</tec-avatar-fallback><tec-avatar-badge><svg></svg></tec-avatar-badge></tec-avatar>
    </div>`)
    const avatars = [...root.querySelectorAll("tec-avatar")]
    expect(avatars.map((a) => a.getBoundingClientRect().width)).toEqual([24, 32, 40])
    expect(avatars.map((a) => a.querySelector("tec-avatar-badge")!.getBoundingClientRect().width)).toEqual([8, 10, 12])
    expect(avatars.map((a) => getComputedStyle(a.querySelector("tec-avatar-fallback")!).fontSize)).toEqual(["12px", "14px", "14px"])
    expect(avatars.map((a) => getComputedStyle(a.querySelector("svg")!).display)).toEqual(["none", "block", "block"])
    const avatar = avatars[1]!.getBoundingClientRect()
    const badge = avatars[1]!.querySelector("tec-avatar-badge")!.getBoundingClientRect()
    expect([badge.right, badge.bottom]).toEqual([avatar.right, avatar.bottom])
  })

  it("puts the badge on the inline end in RTL and takes its colour from --tec-avatar-badge-color", async () => {
    const avatar = await fixture<TecAvatar>(
      html`<tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback><tec-avatar-badge style="--tec-avatar-badge-color: rgb(1, 2, 3)"></tec-avatar-badge></tec-avatar>`,
      { dir: "rtl" }
    )
    const badge = avatar.querySelector("tec-avatar-badge")!
    expect(badge.getBoundingClientRect().left).toBe(avatar.getBoundingClientRect().left)
    expect(getComputedStyle(badge).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("takes its corner radius from --tec-avatar-radius", async () => {
    const avatar = await fixture<TecAvatar>(
      html`<tec-avatar style="--tec-avatar-radius: 6px"><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>`
    )
    expect(getComputedStyle(avatar).borderTopLeftRadius).toBe("6px")
    expect(getComputedStyle(avatar.querySelector("tec-avatar-fallback")!).borderTopLeftRadius).toBe("6px")
    expect(getComputedStyle(avatar.shadowRoot!.querySelector(".ring")!).borderTopLeftRadius).toBe("6px")
  })

  it("announces a labelled badge", async () => {
    const avatar = await fixture<TecAvatar>(
      html`<tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback><tec-avatar-badge label="Online"></tec-avatar-badge></tec-avatar>`
    )
    expect(await axNode(avatar.querySelector("tec-avatar-badge")!)).toMatchObject({ role: "image", name: "Online" })
    await expectAccessible(avatar)
  })

  it("draws the hairline ring only in the active colour scheme", async () => {
    const light = await fixture<TecAvatar>(html`<tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>`, { theme: "light" })
    const rings = (el: TecAvatar) => [...el.shadowRoot!.querySelectorAll(".ring")].map((r) => getComputedStyle(r).borderTopColor)
    expect(rings(light)[0]).not.toBe("rgba(0, 0, 0, 0)")
    expect(rings(light)[1]).toBe("rgba(0, 0, 0, 0)")
    const dark = await fixture<TecAvatar>(html`<tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>`, { theme: "dark" })
    expect(rings(dark)[0]).toBe("rgba(0, 0, 0, 0)")
    expect(rings(dark)[1]).not.toBe("rgba(0, 0, 0, 0)")
  })
})

describe("tec-avatar-group", () => {
  it("overlaps avatars and sizes the count from them", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-avatar-group>
        <tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>
        <tec-avatar><tec-avatar-fallback>B</tec-avatar-fallback></tec-avatar>
        <tec-avatar-group-count>+3</tec-avatar-group-count>
      </tec-avatar-group>
      <tec-avatar-group>
        <tec-avatar size="lg"><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>
        <tec-avatar-group-count>+3</tec-avatar-group-count>
      </tec-avatar-group>
    </div>`)
    const [group, large] = [...root.querySelectorAll("tec-avatar-group")]
    const [a, b, count] = [...group!.children].map((c) => c.getBoundingClientRect())
    expect(b!.left - a!.right).toBe(-8)
    expect(count!.left - b!.right).toBe(-8)
    expect(count!.width).toBe(32)
    expect(getComputedStyle(group!.children[0]!).boxShadow).toContain("2px")
    expect(large!.querySelector("tec-avatar-group-count")!.getBoundingClientRect().width).toBe(40)
    large!.querySelector("tec-avatar")!.setAttribute("size", "sm")
    await nextFrame()
    expect(large!.querySelector("tec-avatar-group-count")!.getBoundingClientRect().width).toBe(24)
    await expectAccessible(root)
  })

  it("overlaps towards the start in RTL", async () => {
    const group = await fixture<HTMLElement>(
      html`<tec-avatar-group>
        <tec-avatar><tec-avatar-fallback>A</tec-avatar-fallback></tec-avatar>
        <tec-avatar><tec-avatar-fallback>B</tec-avatar-fallback></tec-avatar>
      </tec-avatar-group>`,
      { dir: "rtl" }
    )
    const [a, b] = [...group.children].map((c) => c.getBoundingClientRect())
    expect(b!.right - a!.left).toBe(8)
  })
})
