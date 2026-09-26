import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { cdp } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import "./define.js"
import { backgroundEffects, backgroundIntensities, backgroundSpeeds, backgroundTones, type TecBackground } from "./define.js"

async function container(inner: ReturnType<typeof html>, style = "position: relative; isolation: isolate; width: 480px; height: 240px") {
  const wrap = await fixture<HTMLDivElement>(html`<div style=${style}>${inner}</div>`)
  const el = wrap.querySelector("tec-background")!
  await el.updateComplete
  return { wrap, el }
}

/** Elements of the shadow root that run a CSS animation. */
function animated(el: TecBackground): Element[] {
  return [...el.shadowRoot!.querySelectorAll("*")].filter((node) => getComputedStyle(node).animationName !== "none")
}

async function emulateMedia(features: { name: string; value: string }[], media = "") {
  await cdp().send("Emulation.setEmulatedMedia", { media, features })
}

afterEach(async () => {
  await emulateMedia([])
})

describe("tec-background", () => {
  it("exposes the value lists", () => {
    expect(backgroundEffects).toHaveLength(11)
    expect(backgroundTones).toEqual(["neutral", "primary", "azure", "saffron", "lime", "blue"])
    expect(backgroundIntensities).toEqual(["low", "medium", "high"])
    expect(backgroundSpeeds).toEqual(["slow", "normal", "fast"])
  })

  it("is a full-size, pointer-transparent layer behind the content", async () => {
    const { el, wrap } = await container(html`<tec-background effect="contour"></tec-background>`)
    const style = getComputedStyle(el)
    expect(style.position).toBe("absolute")
    expect(style.pointerEvents).toBe("none")
    expect(style.zIndex).toBe("-10")
    expect(style.overflow).toBe("hidden")
    const box = el.getBoundingClientRect()
    const outer = wrap.getBoundingClientRect()
    expect(box.width).toBe(outer.width)
    expect(box.height).toBe(outer.height)
  })

  for (const effect of backgroundEffects) {
    it(`renders the ${effect} effect`, async () => {
      const { el } = await container(html`<tec-background effect=${effect} tone="azure"></tec-background>`)
      const base = el.shadowRoot!.querySelector(".base")!
      // Something visible was drawn (an SVG or the HTML layers of grid, pressure, horizon…).
      const drawn = base.querySelectorAll("svg, div, span")
      expect(drawn.length).toBeGreaterThan(0)
      if (effect !== "pressure" && effect !== "horizon" && effect !== "grid") {
        expect(base.querySelectorAll("path, line, circle").length).toBeGreaterThan(0)
      }
      expect(el.getAttribute("effect")).toBe(effect)
    })
  }

  it("draws nothing but the slot without an effect", async () => {
    const { el } = await container(html`<tec-background><svg data-custom width="10" height="10"></svg></tec-background>`)
    expect(el.shadowRoot!.querySelector(".base svg")).toBeNull()
    const slot = el.shadowRoot!.querySelector("slot")!
    expect(slot.assignedElements()[0]?.hasAttribute("data-custom")).toBe(true)
  })

  it("is hidden from assistive technology", async () => {
    const { el, wrap } = await container(html`<tec-background effect="seismic"></tec-background><p>Survey 24-B</p>`)
    expect(el.shadowRoot!.querySelector(".base")!.getAttribute("aria-hidden")).toBe("true")
    const svgNode = el.shadowRoot!.querySelector("svg")!
    expect((await axNode(svgNode)).ignored).toBe("true")
    await expectAccessible(wrap)
  })

  it("maps tone, intensity and speed to the ink variables", async () => {
    const { el } = await container(html`<tec-background effect="grid"></tec-background>`)
    const read = (name: string) => getComputedStyle(el).getPropertyValue(name).trim()
    expect(read("--bg-alpha")).toBe("0.16")
    expect(read("--bg-duration")).toBe("36s")
    const neutral = read("--bg-tone")

    el.tone = "azure"
    el.intensity = "high"
    el.speed = "fast"
    await el.updateComplete
    expect(el.getAttribute("tone")).toBe("azure")
    expect(read("--bg-alpha")).toBe("0.32")
    expect(read("--bg-duration")).toBe("18s")
    expect(read("--bg-tone")).not.toBe(neutral)

    el.setAttribute("intensity", "low")
    el.setAttribute("speed", "slow")
    await el.updateComplete
    expect(read("--bg-alpha")).toBe("0.08")
    expect(read("--bg-duration")).toBe("60s")
  })

  it("re-renders when the effect changes", async () => {
    const { el } = await container(html`<tec-background effect="drill"></tec-background>`)
    expect(el.shadowRoot!.querySelector(".drill")).not.toBeNull()
    el.setAttribute("effect", "pressure")
    await el.updateComplete
    expect(el.shadowRoot!.querySelector(".drill")).toBeNull()
    expect(el.shadowRoot!.querySelectorAll(".blob")).toHaveLength(4)
  })

  it("colours the contour map by elevation, or in the single tone", async () => {
    const { el } = await container(html`<tec-background effect="contour"></tec-background>`)
    const strokes = () => [...el.shadowRoot!.querySelectorAll("path[stroke]")].map((p) => p.getAttribute("stroke"))
    expect(strokes().every((s) => s!.startsWith("color-mix("))).toBe(true)
    expect(el.shadowRoot!.querySelectorAll("line")).toHaveLength(0)
    el.palette = "tone"
    el.grid = true
    await el.updateComplete
    expect(strokes().every((s) => s === "var(--bg-tone)")).toBe(true)
    expect(el.shadowRoot!.querySelectorAll("line").length).toBeGreaterThan(0)
  })

  it("animates by default and freezes with the static attribute", async () => {
    const { el } = await container(html`<tec-background effect="flow"></tec-background>`)
    const nodes = animated(el)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.every((n) => getComputedStyle(n).animationPlayState === "running")).toBe(true)
    el.static = true
    await el.updateComplete
    expect(nodes.every((n) => getComputedStyle(n).animationPlayState === "paused")).toBe(true)
  })

  it("pauses under prefers-reduced-motion: reduce", async () => {
    const { el } = await container(html`<tec-background effect="hexagons"></tec-background>`)
    await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }])
    const nodes = animated(el)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.every((n) => getComputedStyle(n).animationPlayState === "paused")).toBe(true)
  })

  it("pauses while it is off screen", async () => {
    const { el } = await container(
      html`<tec-background effect="seismic"></tec-background>`,
      "position: absolute; top: 300vh; left: 0; width: 200px; height: 100px; isolation: isolate"
    )
    await waitUntil(() => el.paused, "paused off screen")
    expect(el.matches(":state(paused)")).toBe(true)
    const base = el.shadowRoot!.querySelector(".base")!
    expect(base.hasAttribute("data-paused")).toBe(true)
    expect(animated(el).every((n) => getComputedStyle(n).animationPlayState === "paused")).toBe(true)
  })

  it("keeps running while it is on screen", async () => {
    const { el } = await container(html`<tec-background effect="seismic"></tec-background>`)
    await new Promise((r) => setTimeout(r, 50))
    expect(el.paused).toBe(false)
    expect(el.matches(":state(paused)")).toBe(false)
  })

  it("is hidden in print and forced colours", async () => {
    const { el } = await container(html`<tec-background effect="strata"></tec-background>`)
    expect(getComputedStyle(el).display).toBe("block")
    await emulateMedia([], "print")
    expect(getComputedStyle(el).display).toBe("none")
    await emulateMedia([{ name: "forced-colors", value: "active" }])
    expect(getComputedStyle(el).display).toBe("none")
  })

  it("reveals the pattern around the pointer over the parent when interactive", async () => {
    const { el, wrap } = await container(html`<tec-background effect="grid" interactive></tec-background>`)
    const layer = el.shadowRoot!.querySelector<HTMLElement>(".pointer")!
    expect(layer.querySelector(".reveal")).not.toBeNull()
    const rect = wrap.getBoundingClientRect()
    wrap.dispatchEvent(new PointerEvent("pointermove", { clientX: rect.left + 40, clientY: rect.top + 30, bubbles: true }))
    expect(layer.hasAttribute("data-hover")).toBe(true)
    expect(layer.style.getPropertyValue("--bg-x")).toBe("40px")
    expect(layer.style.getPropertyValue("--bg-y")).toBe("30px")
    wrap.dispatchEvent(new PointerEvent("pointerleave"))
    expect(layer.hasAttribute("data-hover")).toBe(false)
  })

  it("ignores interactive on effects without a reveal", async () => {
    const { el, wrap } = await container(html`<tec-background effect="seismic" interactive></tec-background>`)
    wrap.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10 }))
    expect(el.shadowRoot!.querySelector(".reveal")).toBeNull()
    expect(el.shadowRoot!.querySelector("[data-hover]")).toBeNull()
  })

  it("stops listening to the parent when removed", async () => {
    const { el, wrap } = await container(html`<tec-background effect="hexagons" interactive></tec-background>`)
    const layer = el.shadowRoot!.querySelector<HTMLElement>(".pointer")!
    el.remove()
    wrap.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10 }))
    expect(layer.hasAttribute("data-hover")).toBe(false)
  })

  it("draws the same geometry in every instance", async () => {
    const { wrap } = await container(
      html`<tec-background effect="terrain-grid"></tec-background><tec-background effect="terrain-grid"></tec-background>`
    )
    const [a, b] = wrap.querySelectorAll("tec-background")
    await b.updateComplete
    const d = (el: TecBackground) => [...el.shadowRoot!.querySelectorAll("path")].map((p) => p.getAttribute("d")).join("|")
    expect(d(a)).toBe(d(b))
    expect(d(a).length).toBeGreaterThan(1000)
  })
})
