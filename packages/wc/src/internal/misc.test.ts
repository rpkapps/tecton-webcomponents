import { html, LitElement } from "lit"
import { Check } from "lucide"
import { describe, expect, it, vi } from "vitest"
import { animateOut, animationStyles } from "./animations.js"
import { AriaDelegateController } from "./aria.js"
import { defineElement } from "./define.js"
import { horizontalStep, isRtl } from "./direction.js"
import { icon } from "./icons.js"
import { uniqueId } from "./id.js"
import { isScrollLocked, lockScroll, unlockScroll } from "./scroll-lock.js"
import { HasSlotController } from "./slot.js"
import { TectonElement } from "./tecton-element.js"
import { aTimeout, axNode, axTree, fixture } from "./test-utils.js"

class TestSlots extends TectonElement {
  slots = new HasSlotController(this, "icon", "[default]", { states: true })
  render() {
    return html`<slot name="icon"></slot><slot></slot>`
  }
}
defineElement("test-slots", TestSlots)

class TestEmitter extends TectonElement {
  fire(cancelable: boolean) {
    return this.emit("tec-test", { detail: { n: 1 }, cancelable })
  }
}
defineElement("test-emitter", TestEmitter)

class TestAnimated extends LitElement {
  static styles = [animationStyles]
  render() {
    return html`<style>
        .box[data-state="closed"] { animation: tec-exit 120ms linear forwards; --tec-exit-opacity: 0; }
      </style>
      <div class="box">box</div>`
  }
}
defineElement("test-animated", TestAnimated)

class TestDelegate extends LitElement {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }
  aria = new AriaDelegateController(this, { target: () => this.renderRoot.querySelector("button"), exclude: ["aria-pressed"] })
  render() {
    return html`<button>x</button>`
  }
}
defineElement("test-delegate", TestDelegate)

describe("internal helpers", () => {
  it("defineElement is idempotent and warns on a conflicting class", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    defineElement("test-define-twice", A)
    defineElement("test-define-twice", A)
    expect(warn).not.toHaveBeenCalled()
    defineElement("test-define-twice", B)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(customElements.get("test-define-twice")).toBe(A)
    warn.mockRestore()
  })

  it("uniqueId", () => {
    expect(uniqueId("x")).not.toBe(uniqueId("x"))
    expect(uniqueId("tab")).toMatch(/^tab-/)
  })

  it("isRtl / horizontalStep read the computed direction", async () => {
    const el = await fixture<HTMLElement>(html`<div><span id="s">x</span></div>`, { dir: "rtl" })
    const span = el.querySelector("#s")!
    expect(isRtl(span)).toBe(true)
    expect(horizontalStep("ArrowRight", span)).toBe(-1)
    expect(horizontalStep("ArrowLeft", span)).toBe(1)
    expect(horizontalStep("ArrowUp", span)).toBe(0)
  })

  it("emit returns false when a cancelable event is prevented; events bubble and are composed", async () => {
    const el = await fixture<TestEmitter>(html`<test-emitter></test-emitter>`)
    let seen: CustomEvent | undefined
    document.addEventListener("tec-test", (e) => (seen = e as CustomEvent), { once: true })
    expect(el.fire(true)).toBe(true)
    expect(seen?.detail).toEqual({ n: 1 })
    expect(seen?.composed).toBe(true)
    el.addEventListener("tec-test", (e) => e.preventDefault())
    expect(el.fire(true)).toBe(false)
    expect(el.fire(false)).toBe(true)
  })

  it("HasSlotController tracks slot content and sets has-* states", async () => {
    const el = await fixture<TestSlots>(html`<test-slots></test-slots>`)
    expect(el.slots.test("icon")).toBe(false)
    expect(el.slots.test("[default]")).toBe(false)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("slot", "icon")
    el.append(svg, "text")
    await aTimeout()
    expect(el.slots.test("icon")).toBe(true)
    expect(el.slots.test("[default]")).toBe(true)
    expect(el.matches(":state(has-icon)")).toBe(true)
    expect(el.matches(":state(has-default)")).toBe(true)
  })

  it("icon() renders a decorative lucide svg, or a labelled image", async () => {
    const el = await fixture<HTMLElement>(html`<div>${icon(Check, { size: 16 })}${icon(Check, { label: "Done" })}</div>`)
    const [a, b] = [...el.querySelectorAll("svg")]
    expect(a!.getAttribute("aria-hidden")).toBe("true")
    expect(a!.getAttribute("width")).toBe("16")
    expect(a!.querySelector("path")!.getAttribute("d")).toBe("M20 6 9 17l-5-5")
    expect(b!.getAttribute("role")).toBe("img")
    expect(b!.getAttribute("aria-label")).toBe("Done")
  })

  it("animateOut waits for the exit animation", async () => {
    const el = await fixture<TestAnimated>(html`<test-animated></test-animated>`)
    const box = el.shadowRoot!.querySelector<HTMLElement>(".box")!
    box.dataset.state = "closed"
    const start = performance.now()
    await animateOut(box)
    expect(performance.now() - start).toBeGreaterThan(80)
    expect(getComputedStyle(box).opacity).toBe("0")
    // Nothing animating → resolves immediately.
    const t = performance.now()
    await animateOut(el)
    expect(performance.now() - t).toBeLessThan(50)
  })

  it("scroll lock is reference counted", () => {
    const a = {}
    const b = {}
    lockScroll(a)
    lockScroll(b)
    expect(document.documentElement.style.overflow).toBe("hidden")
    unlockScroll(a)
    expect(isScrollLocked()).toBe(true)
    unlockScroll(b)
    expect(isScrollLocked()).toBe(false)
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("AriaDelegateController mirrors host aria-* (minus excluded) and removes what it wrote", async () => {
    const el = await fixture<TestDelegate>(html`<test-delegate aria-label="Close" aria-pressed="true"></test-delegate>`)
    const button = el.shadowRoot!.querySelector("button")!
    expect(button.getAttribute("aria-label")).toBe("Close")
    expect(button.hasAttribute("aria-pressed")).toBe(false)
    el.removeAttribute("aria-label")
    await aTimeout()
    expect(button.hasAttribute("aria-label")).toBe(false)
  })
})

describe("test-utils", () => {
  it("axNode / axTree decode non-ASCII names", async () => {
    const root = await fixture<HTMLElement>(`<div><button aria-label="1 – 10 · Ärger ✓ 日本 😀">x</button></div>`)
    const button = root.querySelector("button")!
    expect((await axNode(button)).name).toBe("1 – 10 · Ärger ✓ 日本 😀")
    expect(await axTree(root)).toEqual(["button: 1 – 10 · Ärger ✓ 日本 😀"])
  })

  it("axNode decodes non-ASCII string properties (aria-valuetext) and lists relation targets", async () => {
    const root = await fixture<HTMLElement>(
      `<div><span id="l">Größe</span><div role="spinbutton" tabindex="0" aria-labelledby="l" aria-valuenow="9" aria-valuetext="9 – September · Größe ✓"></div></div>`
    )
    expect(await axNode(root.querySelector("[role=spinbutton]")!)).toMatchObject({
      name: "Größe",
      valuetext: "9 – September · Größe ✓",
      labelledby: "Größe",
    })
  })

  it("axNode decodes non-ASCII names in a large document", async () => {
    const filler = Array.from({ length: 3000 }, (_, i) => `<span title="filler – ${i}">é ${i}</span>`).join("")
    const root = await fixture<HTMLElement>(`<div>${filler}<button aria-label="1 – 10">x</button><p>Größe – ok</p></div>`)
    expect((await axNode(root.querySelector("button")!)).name).toBe("1 – 10")
    const p = root.querySelector("p")!
    p.setAttribute("role", "note")
    p.setAttribute("aria-label", p.textContent!)
    expect((await axNode(p)).name).toBe("Größe – ok")
  })
})
