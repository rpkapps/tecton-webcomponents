import { afterEach, describe, expect, it } from "vitest"
import { cdp } from "vitest/browser"
import { fixture } from "../internal/test-utils.js"
import "./utilities.css"

afterEach(async () => {
  await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] })
})

/** Scroll timelines are sampled on the next frames. */
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/** Resolves a length-percentage of `el` against its height, in px. */
function resolve(el: HTMLElement, name: string): number {
  const value = getComputedStyle(el).getPropertyValue(name)
  const box = document.createElement("div")
  box.style.cssText = `position: relative; height: ${el.clientHeight}px`
  const probe = document.createElement("div")
  probe.style.cssText = `position: absolute; height: ${value}`
  box.append(probe)
  document.body.append(box)
  const px = probe.getBoundingClientRect().height
  box.remove()
  return px
}

const items = Array.from({ length: 12 }, (_, i) => `<div style="height: 40px">Item ${i + 1}</div>`).join("")

describe("scroll-fade", () => {
  it("masks the scroll container and tracks the scroll position", async () => {
    const el = await fixture<HTMLDivElement>(`<div class="scroll-fade" style="height: 200px; overflow-y: auto">${items}</div>`)
    await frames()
    const style = getComputedStyle(el)
    expect(style.maskImage).toContain("linear-gradient")
    expect(style.animationName).toBe("scroll-fade-reveal-t, scroll-fade-reveal-b")
    // At rest: crisp top, faded bottom (the default depth, min(12%, 2.5rem)).
    expect(resolve(el, "--scroll-fade-t")).toBe(0)
    expect(resolve(el, "--scroll-fade-b")).toBe(24)
  })

  it("fades the top once scrolled and sharpens the bottom at the end", async () => {
    const el = await fixture<HTMLDivElement>(`<div class="scroll-fade" style="height: 200px; overflow-y: auto">${items}</div>`)
    el.scrollTop = el.scrollHeight
    await frames()
    const style = getComputedStyle(el)
    expect(style.animationName).toContain("scroll-fade-reveal-t")
    expect(resolve(el, "--scroll-fade-t")).toBe(24)
    expect(resolve(el, "--scroll-fade-b")).toBe(0)
  })

  it("takes the fade size from --scroll-fade-size", async () => {
    const el = await fixture<HTMLDivElement>(
      `<div class="scroll-fade" style="height: 200px; overflow-y: auto; --scroll-fade-size: 60px">${items}</div>`
    )
    await frames()
    expect(resolve(el, "--scroll-fade-b")).toBe(60)
  })

  it("mirrors the inline fades in RTL", async () => {
    const tags = Array.from({ length: 12 }, (_, i) => `<span style="display:inline-block; width: 80px">Tag ${i}</span>`).join("")
    const ltr = await fixture<HTMLDivElement>(`<div class="scroll-fade-x" style="width: 200px; overflow-x: auto; white-space: nowrap">${tags}</div>`)
    const rtl = await fixture<HTMLDivElement>(`<div class="scroll-fade-x" style="width: 200px; overflow-x: auto; white-space: nowrap">${tags}</div>`, {
      dir: "rtl",
    })
    expect(getComputedStyle(ltr).maskImage).toContain("to right")
    expect(getComputedStyle(rtl).maskImage).toContain("to left")
  })

  it("fades a single edge", async () => {
    const el = await fixture<HTMLDivElement>(`<div class="scroll-fade-b" style="height: 200px; overflow-y: auto">${items}</div>`)
    const style = getComputedStyle(el)
    expect(style.animationName).toBe("scroll-fade-reveal-b")
    expect(style.maskImage).toContain("linear-gradient")
  })

  it("scroll-fade-none removes the fade in any class order", async () => {
    for (const cls of ["scroll-fade scroll-fade-none", "scroll-fade-none scroll-fade-b", "scroll-fade-s scroll-fade-none"]) {
      const el = await fixture<HTMLDivElement>(`<div class="${cls}" style="height: 200px; overflow: auto">${items}</div>`)
      expect(getComputedStyle(el).maskImage, cls).toBe("none")
    }
  })

  it("no-scrollbar hides the scrollbar", async () => {
    const el = await fixture<HTMLDivElement>(`<div class="no-scrollbar" style="height: 100px; overflow: auto">${items}</div>`)
    expect(getComputedStyle(el).scrollbarWidth).toBe("none")
  })
})

describe("shimmer", () => {
  it("paints the text with a sweeping gradient", async () => {
    const el = await fixture<HTMLParagraphElement>(`<p class="shimmer">Generating response…</p>`)
    const style = getComputedStyle(el)
    expect(style.backgroundClip).toBe("text")
    expect(style.backgroundImage).toContain("linear-gradient")
    expect(style.animationName).toBe("tec-shimmer")
    expect(style.animationDuration).toBe("2s")
    expect(style.animationIterationCount).toBe("infinite")
    expect(style.webkitTextFillColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("takes duration, spread, angle and colour from custom properties", async () => {
    const el = await fixture<HTMLParagraphElement>(
      `<p class="shimmer" style="--shimmer-duration: 1000ms; --shimmer-angle: 45deg; --shimmer-color: rgb(55 138 221)">Generating…</p>`
    )
    const style = getComputedStyle(el)
    expect(style.animationDuration).toBe("1s")
    expect(style.backgroundImage).toContain("135deg")
    expect(style.backgroundImage).toMatch(/rgb\(55, 138, 221\)|color\(srgb/)
  })

  it("plays once, reverses, and follows the reading direction", async () => {
    const once = await fixture<HTMLElement>(`<p class="shimmer shimmer-once">Done</p>`)
    expect(getComputedStyle(once).animationIterationCount).toBe("1")
    const reverse = await fixture<HTMLElement>(`<p class="shimmer shimmer-reverse">Done</p>`)
    expect(getComputedStyle(reverse).animationDirection).toBe("reverse")
    const rtl = await fixture<HTMLElement>(`<p class="shimmer">جارٍ</p>`, { dir: "rtl" })
    expect(getComputedStyle(rtl).animationDirection).toBe("reverse")
  })

  it("shimmer-none renders the text normally", async () => {
    const el = await fixture<HTMLElement>(`<p class="shimmer-none shimmer">Done</p>`)
    const style = getComputedStyle(el)
    expect(style.backgroundImage).toBe("none")
    expect(style.webkitTextFillColor).toBe(style.color)
  })

  it("stops under prefers-reduced-motion: reduce", async () => {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }] })
    const el = await fixture<HTMLElement>(`<p class="shimmer">Generating…</p>`)
    const style = getComputedStyle(el)
    expect(style.animationName).toBe("none")
    expect(style.backgroundImage).toBe("none")
    expect(style.webkitTextFillColor).toBe(style.color)
  })
})
