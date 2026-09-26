import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, deepActiveElement, expectAccessible, fixture, nextFrame, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { adjustLayout, initialLayout, parseSize, validateLayout, type PanelConstraints } from "./layout.js"
import type { TecResizableGroup } from "./resizable-group.js"
import type { TecResizableHandle } from "./resizable-handle.js"
import type { TecResizablePanel } from "./resizable-panel.js"
import "./define.js"

const c = (o: Partial<PanelConstraints> = {}): PanelConstraints => ({ minSize: 0, maxSize: 100, collapsible: false, collapsedSize: 0, ...o })

describe("resizable layout math", () => {
  it("parses sizes", () => {
    expect(parseSize("25%", 400)).toBe(25)
    expect(parseSize("25", 400)).toBe(25)
    expect(parseSize("100px", 400)).toBe(25)
    expect(parseSize("5rem", 400)).toBe(20)
    expect(parseSize("", 400)).toBeUndefined()
    expect(parseSize("abc", 400)).toBeUndefined()
  })

  it("initial layout: defaults, shares, constraints", () => {
    expect(initialLayout([c({ defaultSize: 25 }), c()])).toEqual([25, 75])
    expect(initialLayout([c(), c(), c(), c()])).toEqual([25, 25, 25, 25])
    expect(initialLayout([c({ defaultSize: 10, minSize: 20 }), c()])).toEqual([20, 80])
    expect(validateLayout([30, 30], [c(), c()])).toEqual([50, 50])
  })

  it("adjusts by delta within min/max, taking from the nearest panels first", () => {
    const cs = [c({ minSize: 10 }), c({ minSize: 20 }), c()]
    const base = [30, 40, 30]
    expect(adjustLayout({ delta: 10, initialLayout: base, prevLayout: base, constraints: cs, pivot: [0, 1], trigger: "pointer" })).toEqual([40, 30, 30])
    expect(adjustLayout({ delta: 40, initialLayout: base, prevLayout: base, constraints: cs, pivot: [0, 1], trigger: "pointer" })).toEqual([70, 20, 10])
    expect(adjustLayout({ delta: -50, initialLayout: base, prevLayout: base, constraints: cs, pivot: [0, 1], trigger: "pointer" })).toEqual([10, 60, 30])
  })

  it("collapses below halfway to the minimum (pointer) and at the minimum (keyboard)", () => {
    const cs = [c({ minSize: 20, collapsible: true }), c()]
    const base = [30, 70]
    expect(adjustLayout({ delta: -15, initialLayout: base, prevLayout: base, constraints: cs, pivot: [0, 1], trigger: "pointer" })).toEqual([20, 80])
    expect(adjustLayout({ delta: -25, initialLayout: base, prevLayout: base, constraints: cs, pivot: [0, 1], trigger: "pointer" })).toEqual([0, 100])
    const atMin = [20, 80]
    expect(adjustLayout({ delta: -5, initialLayout: atMin, prevLayout: atMin, constraints: cs, pivot: [0, 1], trigger: "keyboard" })).toEqual([0, 100])
    const collapsed = [0, 100]
    expect(adjustLayout({ delta: 5, initialLayout: collapsed, prevLayout: collapsed, constraints: cs, pivot: [0, 1], trigger: "keyboard" })).toEqual([20, 80])
  })
})

const two = (o: { orientation?: string; min?: string; collapsible?: boolean; disabled?: boolean } = {}) => html`<div style="width: 400px; height: 200px">
  <tec-resizable-group orientation=${o.orientation ?? "horizontal"}>
    <tec-resizable-panel default-size="25%" min-size=${o.min ?? ""} ?collapsible=${o.collapsible}>Sidebar</tec-resizable-panel>
    <tec-resizable-handle with-handle aria-label="Resize sidebar" ?disabled=${o.disabled}></tec-resizable-handle>
    <tec-resizable-panel default-size="75%">Content</tec-resizable-panel>
  </tec-resizable-group>
</div>`

const parts = (root: HTMLElement) => ({
  group: root.querySelector<TecResizableGroup>("tec-resizable-group")!,
  panels: [...root.querySelectorAll<TecResizablePanel>("tec-resizable-panel")],
  handle: root.querySelector<TecResizableHandle>("tec-resizable-handle")!,
})
const widths = (panels: Element[]) => panels.map((p) => Math.round(p.getBoundingClientRect().width))
const heights = (panels: Element[]) => panels.map((p) => Math.round(p.getBoundingClientRect().height))
const round = (layout: number[]) => layout.map((n) => Math.round(n * 10) / 10)

describe("tec-resizable-group", () => {
  it("lays out panels from default-size and exposes a window splitter", async () => {
    const root = await fixture<HTMLElement>(two())
    const { group, panels, handle } = parts(root)
    await nextFrame()
    expect(round(group.layout)).toEqual([25, 75])
    expect(widths(panels)).toEqual([100, 299])
    expect(await axNode(handle)).toMatchObject({ role: "separator", name: "Resize sidebar", orientation: "vertical", valuemin: "0", valuemax: "100" })
    expect(handle.internals.ariaValueNow).toBe("25")
    expect(handle.internals.ariaControlsElements).toEqual([panels[0]])
    expect(handle.tabIndex).toBe(0)
    expect(handle.shadowRoot!.querySelector(".grip")).not.toBeNull()
    await expectAccessible(root)
  })

  it("keyboard: arrows step 5%, Home/End, mirrored in RTL; fires tec-layout-change", async () => {
    const root = await fixture<HTMLElement>(two())
    const { group, handle } = parts(root)
    const events = recordEvents<CustomEvent>(group, "tec-layout-change")
    handle.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(round(group.layout)).toEqual([30, 70])
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(round(group.layout)).toEqual([20, 80])
    await userEvent.keyboard("{ArrowUp}")
    expect(round(group.layout)).toEqual([20, 80])
    await userEvent.keyboard("{End}")
    expect(round(group.layout)).toEqual([100, 0])
    await userEvent.keyboard("{Home}")
    expect(round(group.layout)).toEqual([0, 100])
    expect(events.events.length).toBe(5)
    expect(round(events.events[0]!.detail.layout)).toEqual([30, 70])
    expect(handle.internals.ariaValueNow).toBe("0")

    const rtl = await fixture<HTMLElement>(two(), { dir: "rtl" })
    const r = parts(rtl)
    r.handle.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(round(r.group.layout)).toEqual([30, 70])
    // RTL: the first panel is on the right.
    expect(r.panels[0]!.getBoundingClientRect().left).toBeGreaterThan(r.panels[1]!.getBoundingClientRect().left)
  })

  it("vertical: Up/Down resize, stacked panels, horizontal separator", async () => {
    const root = await fixture<HTMLElement>(two({ orientation: "vertical" }))
    const { group, panels, handle } = parts(root)
    await nextFrame()
    expect(heights(panels)).toEqual([50, 149])
    expect(await axNode(handle)).toMatchObject({ orientation: "horizontal" })
    handle.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(round(group.layout)).toEqual([30, 70])
    await userEvent.keyboard("{ArrowRight}")
    expect(round(group.layout)).toEqual([30, 70])
  })

  it("min-size in px and collapsible panels: Enter collapses and restores", async () => {
    const root = await fixture<HTMLElement>(two({ min: "80px", collapsible: true }))
    const { group, panels, handle } = parts(root)
    await nextFrame()
    handle.focus()
    await userEvent.keyboard("{Home}")
    // 80px of 399px shared space ≈ 20%: Home collapses the collapsible panel past its minimum.
    expect(round(group.layout)[0]).toBe(0)
    expect(panels[0]!.collapsed).toBe(true)
    expect(panels[0]!.matches(":state(collapsed)")).toBe(true)
    await userEvent.keyboard("{Enter}")
    expect(panels[0]!.collapsed).toBe(false)
    // Restores the size it had before collapsing.
    expect(Math.round(group.layout[0]!)).toBe(25)
    await userEvent.keyboard("{Enter}")
    expect(panels[0]!.collapsed).toBe(true)
    panels[0]!.expand()
    expect(Math.round(group.layout[0]!)).toBe(25)
    panels[0]!.resize("50%")
    expect(round(group.layout)).toEqual([50, 50])
    panels[0]!.collapse()
    expect(panels[0]!.size).toBe(0)
  })

  it("pointer drag resizes; double-click resets to default-size", async () => {
    const root = await fixture<HTMLElement>(two())
    const { group, handle } = parts(root)
    const events = recordEvents<CustomEvent>(group, "tec-layout-change")
    await nextFrame()
    const r = handle.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }))
    handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, composed: true, clientX: x + 100, clientY: y, pointerId: 1, pointerType: "mouse" }))
    expect(handle.matches(":state(active)")).toBe(true)
    handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true, clientX: x + 100, clientY: y, pointerId: 1, pointerType: "mouse" }))
    expect(Math.round(group.layout[0]!)).toBe(50)
    expect(events.events.length).toBe(1)
    expect(deepActiveElement()).toBe(handle)
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(round(group.layout)).toEqual([25, 75])
  })

  it("real mouse drag with userEvent", async () => {
    const root = await fixture<HTMLElement>(two())
    const { group, handle, panels } = parts(root)
    await nextFrame()
    await userEvent.dragAndDrop(handle, panels[1]!, { targetPosition: { x: 100, y: 50 } })
    await waitUntil(() => Math.round(group.layout[0]!) !== 25, "resized")
    expect(group.layout[0]!).toBeGreaterThan(40)
  })

  it("disabled handle: not focusable, no resize", async () => {
    const root = await fixture<HTMLElement>(two({ disabled: true }))
    const { group, handle } = parts(root)
    expect(handle.hasAttribute("tabindex")).toBe(false)
    expect(await axNode(handle)).toMatchObject({ disabled: "true" })
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
    expect(round(group.layout)).toEqual([25, 75])
  })

  it("nested groups, F6 moves between handles, layout property restores", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px; height: 200px">
      <tec-resizable-group>
        <tec-resizable-panel default-size="50%">One</tec-resizable-panel>
        <tec-resizable-handle aria-label="A"></tec-resizable-handle>
        <tec-resizable-panel default-size="25%">Two</tec-resizable-panel>
        <tec-resizable-handle aria-label="B"></tec-resizable-handle>
        <tec-resizable-panel>
          <tec-resizable-group orientation="vertical">
            <tec-resizable-panel default-size="25%">Three</tec-resizable-panel>
            <tec-resizable-handle aria-label="C"></tec-resizable-handle>
            <tec-resizable-panel>Four</tec-resizable-panel>
          </tec-resizable-group>
        </tec-resizable-panel>
      </tec-resizable-group>
    </div>`)
    const outer = root.querySelector<TecResizableGroup>("tec-resizable-group")!
    const inner = outer.querySelector<TecResizableGroup>("tec-resizable-group")!
    const [a, b] = [...outer.querySelectorAll<TecResizableHandle>(":scope > tec-resizable-handle")]
    await nextFrame()
    expect(round(outer.layout)).toEqual([50, 25, 25])
    expect(round(inner.layout)).toEqual([25, 75])
    a!.focus()
    await userEvent.keyboard("{F6}")
    expect(deepActiveElement()).toBe(b)
    await userEvent.keyboard("{Shift>}{F6}{/Shift}")
    expect(deepActiveElement()).toBe(a)
    // Growing the first panel past the second takes from the third.
    await userEvent.keyboard("{End}")
    expect(round(outer.layout)).toEqual([100, 0, 0])
    outer.layout = [20, 30, 50]
    expect(round(outer.layout)).toEqual([20, 30, 50])
    await expectAccessible(root)
  })
})
