import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { horizontalStep, isRtl } from "../../internal/direction.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  adjustLayout,
  equal,
  initialLayout,
  layoutsEqual,
  parseSize,
  validateLayout,
  type PanelConstraints,
  type ResizeTrigger,
} from "./layout.js"
import type { TecResizableHandle } from "./resizable-handle.js"
import type { TecResizablePanel } from "./resizable-panel.js"
import { groupStyles } from "./resizable.styles.js"

export type ResizableOrientation = "horizontal" | "vertical"

/** Keyboard step, in percent. */
const KEYBOARD_STEP = 5

interface Drag {
  handle: TecResizableHandle
  pivot: [number, number]
  startLayout: number[]
  x: number
  y: number
  pointerId: number
  rtl: boolean
}

/**
 * Lays out `tec-resizable-panel`s along one axis, separated by `tec-resizable-handle`s (direct
 * children). The group fills its container (`width` / `height: 100%`): give it a height from
 * outside (`class="h-96"`, or a flex parent). Groups nest: put a vertical group inside a panel of a
 * horizontal one.
 *
 * The layout is one size per panel in percent, summing to 100. Read or restore it with the `layout`
 * property, and save it on `tec-layout-change`.
 *
 * @summary Accessible resizable panel groups and layouts with keyboard support.
 *
 * @tag tec-resizable-group
 *
 * @slot - `tec-resizable-panel` and `tec-resizable-handle` elements, alternating.
 *
 * @fires tec-layout-change - The user resized the panels (at the end of a drag, on every keyboard step, on double-click). `detail: { layout }` (percentages).
 */
export class TecResizableGroup extends TectonElement {
  static styles = [hostStyles, groupStyles]

  /** The axis the panels are laid out (and resized) along. */
  @property({ reflect: true }) orientation: ResizableOrientation = "horizontal"

  /** Disables resizing with every handle of the group. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #panels: TecResizablePanel[] = []
  #handles: TecResizableHandle[] = []
  #constraints: PanelConstraints[] = []
  #layout: number[] = []
  #pending: number[] | null = null
  #touched = false
  #available = 0
  #expandedSizes = new WeakMap<Element, number>()
  #drag: Drag | null = null

  #resizeObserver = new ResizeObserver(() => this.#measure())
  #mutationObserver = new MutationObserver(() => this.refresh())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#resizeObserver.observe(this)
    this.#mutationObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["default-size", "min-size", "max-size", "collapsible", "collapsed-size", "disabled"],
    })
    this.refresh()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resizeObserver.disconnect()
    this.#mutationObserver.disconnect()
  }

  /** The panel sizes in percent (one per panel, summing to 100). Set it to restore a saved layout. */
  get layout(): number[] {
    return [...(this.#pending ?? this.#layout)]
  }
  set layout(layout: number[]) {
    this.#touched = true
    if (!this.#panels.length || layout.length !== this.#panels.length) {
      this.#pending = [...layout]
      this.refresh()
      return
    }
    this.#setLayout(validateLayout(layout, this.#constraints))
  }

  /**
   * The size of `panel` in percent.
   * @internal
   */
  sizeOf(panel: TecResizablePanel): number {
    const i = this.#panels.indexOf(panel)
    return i < 0 ? 0 : (this.#layout[i] ?? 0)
  }

  /** Re-reads the panels, handles and constraints (called automatically on changes). */
  refresh(): void {
    const children = [...this.children]
    const panels = children.filter((c): c is TecResizablePanel => c.localName === "tec-resizable-panel")
    const handles = children.filter((c): c is TecResizableHandle => c.localName === "tec-resizable-handle")
    const changed = panels.length !== this.#panels.length || panels.some((p, i) => p !== this.#panels[i])
    this.#panels = panels
    this.#handles = handles
    this.#measure(changed)
  }

  /** @internal */
  constraintsChanged(): void {
    this.#measure()
  }

  /** The space the panels share along the axis, in px. */
  #measureAvailable(): number {
    const vertical = this.orientation === "vertical"
    const total = vertical ? this.clientHeight : this.clientWidth
    const handles = this.#handles.reduce((sum, h) => {
      const r = h.getBoundingClientRect()
      return sum + (vertical ? r.height : r.width)
    }, 0)
    return Math.max(0, total - handles)
  }

  #readConstraints(available: number): PanelConstraints[] {
    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const font = parseFloat(getComputedStyle(this).fontSize) || rootFont
    const read = (p: Element, name: string) => parseSize(p.getAttribute(name), available, font, rootFont)
    return this.#panels.map((p) => {
      const minSize = read(p, "min-size") ?? 0
      return {
        minSize,
        maxSize: read(p, "max-size") ?? 100,
        collapsible: p.hasAttribute("collapsible"),
        collapsedSize: read(p, "collapsed-size") ?? 0,
        defaultSize: read(p, "default-size"),
      }
    })
  }

  #usesAbsoluteSizes(): boolean {
    return this.#panels.some((p) =>
      ["default-size", "min-size", "max-size", "collapsed-size"].some((a) => /(px|rem|em)\s*$/.test(p.getAttribute(a) ?? ""))
    )
  }

  #measure(panelsChanged = false): void {
    if (!this.#panels.length) {
      this.#layout = []
      this.#constraints = []
      this.#syncHandles()
      return
    }
    const available = this.#measureAvailable()
    const absolute = this.#usesAbsoluteSizes()
    if (absolute && available === 0) {
      // Not laid out yet: px/rem sizes cannot be resolved. Share the space until the observer fires.
      if (!this.#layout.length || panelsChanged) this.#setLayout(this.#panels.map(() => 100 / this.#panels.length))
      return
    }
    this.#available = available
    this.#constraints = this.#readConstraints(available)
    let next: number[]
    if (this.#pending && this.#pending.length === this.#panels.length) {
      next = validateLayout(this.#pending, this.#constraints)
      this.#pending = null
    } else if (panelsChanged || !this.#layout.length || (!this.#touched && absolute)) {
      next = initialLayout(this.#constraints)
    } else {
      next = validateLayout(this.#layout, this.#constraints)
    }
    this.#setLayout(next)
  }

  #isCollapsed(i: number, size = this.#layout[i]!): boolean {
    const c = this.#constraints[i]
    return !!c && c.collapsible && equal(size, c.collapsedSize, 6)
  }

  #setLayout(layout: number[]): void {
    const prev = this.#layout
    layout.forEach((size, i) => {
      const panel = this.#panels[i]!
      if (prev.length === layout.length && !this.#isCollapsed(i, prev[i]!) && this.#isCollapsed(i, size)) {
        this.#expandedSizes.set(panel, prev[i]!)
      }
    })
    this.#layout = layout
    layout.forEach((size, i) => {
      const panel = this.#panels[i]!
      panel.style.flexGrow = String(Number(size.toFixed(4)))
      if (typeof panel.applySize === "function") panel.applySize(size, this.#isCollapsed(i, size), this.orientation === "vertical")
    })
    this.#syncHandles()
  }

  /** Indices of the panels before and after `handle`. */
  #pivot(handle: Element): [number, number] | null {
    let before: Element | null = handle.previousElementSibling
    while (before && before.localName !== "tec-resizable-panel") before = before.previousElementSibling
    let after: Element | null = handle.nextElementSibling
    while (after && after.localName !== "tec-resizable-panel") after = after.nextElementSibling
    const a = before ? this.#panels.indexOf(before as TecResizablePanel) : -1
    const b = after ? this.#panels.indexOf(after as TecResizablePanel) : -1
    return a < 0 || b < 0 ? null : [a, b]
  }

  #syncHandles(): void {
    const vertical = this.orientation === "vertical"
    for (const handle of this.#handles) {
      if (!("internals" in handle)) {
        void customElements.whenDefined("tec-resizable-handle").then(() => this.#syncHandles())
        continue
      }
      const internals = handle.internals
      internals.ariaOrientation = vertical ? "horizontal" : "vertical"
      ;(handle as unknown as { toggleState(n: string, f: boolean): void }).toggleState?.("vertical", vertical)
      const pivot = this.#pivot(handle)
      if (!pivot || !this.#layout.length) {
        internals.ariaValueNow = internals.ariaValueMin = internals.ariaValueMax = null
        internals.ariaControlsElements = null
        continue
      }
      const [a] = pivot
      const at = (delta: number) =>
        adjustLayout({ delta, initialLayout: this.#layout, prevLayout: this.#layout, constraints: this.#constraints, pivot, trigger: "api" })[a]!
      internals.ariaValueNow = String(Math.round(this.#layout[a]!))
      internals.ariaValueMin = String(Math.round(at(-100)))
      internals.ariaValueMax = String(Math.round(at(100)))
      internals.ariaControlsElements = [this.#panels[a]!]
    }
  }

  #resize(pivot: [number, number], delta: number, trigger: ResizeTrigger, from = this.#layout): boolean {
    const next = adjustLayout({ delta, initialLayout: from, prevLayout: this.#layout, constraints: this.#constraints, pivot, trigger })
    if (layoutsEqual(next, this.#layout)) return false
    this.#touched = true
    this.#setLayout(next)
    return true
  }

  #emitChange(): void {
    this.emit<{ layout: number[] }>("tec-layout-change", { detail: { layout: [...this.#layout] } })
  }

  /** @internal */
  handleKeyDown(handle: TecResizableHandle, event: KeyboardEvent): void {
    if (event.defaultPrevented || handle.isDisabled) return
    if (event.key === "F6") {
      const handles = this.#handles.filter((h) => !h.isDisabled)
      const i = handles.indexOf(handle)
      if (handles.length > 1 && i >= 0) {
        event.preventDefault()
        const next = handles[(i + (event.shiftKey ? handles.length - 1 : 1)) % handles.length]!
        next.focus({ preventScroll: true })
      }
      return
    }
    const pivot = this.#pivot(handle)
    if (!pivot) return
    const vertical = this.orientation === "vertical"
    let delta: number | null = null
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        event.preventDefault()
        if (!vertical) delta = horizontalStep(event.key, this) * KEYBOARD_STEP
        break
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault()
        if (vertical) delta = (event.key === "ArrowDown" ? 1 : -1) * KEYBOARD_STEP
        break
      case "Home":
        event.preventDefault()
        delta = -100
        break
      case "End":
        event.preventDefault()
        delta = 100
        break
      case "Enter": {
        event.preventDefault()
        const [a] = pivot
        const c = this.#constraints[a]!
        if (!c.collapsible) break
        const size = this.#layout[a]!
        const target = this.#isCollapsed(a) ? (this.#expandedSizes.get(this.#panels[a]!) ?? c.minSize) : c.collapsedSize
        delta = target - size
        break
      }
    }
    if (delta !== null && this.#resize(pivot, delta, "keyboard")) this.#emitChange()
  }

  /** @internal */
  handlePointerDown(handle: TecResizableHandle, event: PointerEvent): void {
    if (event.defaultPrevented || handle.isDisabled) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    const pivot = this.#pivot(handle)
    if (!pivot) return
    event.preventDefault()
    handle.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
    this.#available = this.#measureAvailable() || this.#available
    this.#drag = { handle, pivot, startLayout: [...this.#layout], x: event.clientX, y: event.clientY, pointerId: event.pointerId, rtl: isRtl(this) }
    ;(handle as unknown as { toggleState(n: string, f: boolean): void }).toggleState("active", true)
    handle.addEventListener("pointermove", this.#onPointerMove)
    handle.addEventListener("pointerup", this.#onPointerUp)
    handle.addEventListener("pointercancel", this.#onPointerUp)
    handle.addEventListener("lostpointercapture", this.#onPointerUp)
  }

  #onPointerMove = (event: PointerEvent) => {
    const drag = this.#drag
    if (!drag || event.pointerId !== drag.pointerId || !this.#available) return
    const vertical = this.orientation === "vertical"
    let px = vertical ? event.clientY - drag.y : event.clientX - drag.x
    if (!vertical && drag.rtl) px = -px
    this.#resize(drag.pivot, (px / this.#available) * 100, "pointer", drag.startLayout)
  }

  #onPointerUp = (event: PointerEvent) => {
    const drag = this.#drag
    if (!drag || event.pointerId !== drag.pointerId) return
    this.#drag = null
    const handle = drag.handle
    handle.removeEventListener("pointermove", this.#onPointerMove)
    handle.removeEventListener("pointerup", this.#onPointerUp)
    handle.removeEventListener("pointercancel", this.#onPointerUp)
    handle.removeEventListener("lostpointercapture", this.#onPointerUp)
    ;(handle as unknown as { toggleState(n: string, f: boolean): void }).toggleState("active", false)
    if (!layoutsEqual(drag.startLayout, this.#layout)) this.#emitChange()
  }

  /** @internal */
  handleDoubleClick(handle: TecResizableHandle): void {
    if (handle.isDisabled) return
    const pivot = this.#pivot(handle)
    if (!pivot) return
    const target = this.#constraints[pivot[0]]?.defaultSize
    if (target === undefined) return
    if (this.#resize(pivot, target - this.#layout[pivot[0]]!, "api")) this.#emitChange()
  }

  /** @internal */
  resizePanel(panel: TecResizablePanel, size: string | number): void {
    const i = this.#panels.indexOf(panel)
    const target = parseSize(size, this.#available, parseFloat(getComputedStyle(this).fontSize) || 16)
    if (i < 0 || target === undefined || this.#panels.length < 2) return
    const current = this.#layout[i]!
    const last = i === this.#panels.length - 1
    const pivot: [number, number] = last ? [i - 1, i] : [i, i + 1]
    this.#resize(pivot, last ? current - target : target - current, "api")
  }

  /** @internal */
  collapsePanel(panel: TecResizablePanel): void {
    const i = this.#panels.indexOf(panel)
    const c = this.#constraints[i]
    if (!c?.collapsible || this.#isCollapsed(i)) return
    this.resizePanel(panel, c.collapsedSize)
  }

  /** @internal */
  expandPanel(panel: TecResizablePanel): void {
    const i = this.#panels.indexOf(panel)
    const c = this.#constraints[i]
    if (!c || !this.#isCollapsed(i)) return
    this.resizePanel(panel, this.#expandedSizes.get(panel) ?? (c.minSize || c.defaultSize || 0))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("orientation")) this.#measure()
    if (changed.has("disabled") || changed.has("orientation")) for (const h of this.#handles) h.requestUpdate?.()
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.refresh()}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-resizable-group": TecResizableGroup
  }
}
