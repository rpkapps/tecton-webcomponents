import { css, html, nothing, type PropertyValues } from "lit"
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
} from "../resizable/layout.js"
import { handleStyles as resizableHandleStyles } from "../resizable/resizable.styles.js"

/*
 * The split is a `tec-resizable-group` specialised for the shell body: the same layout engine
 * (`resizable/layout.js`), keyboard model, window-splitter semantics and handle drawing, plus two
 * things the shell needs — a panel hidden with CSS (`class="hidden xl:flex"`) leaves the layout, and
 * the divider takes the shell's colours (subtle line, primary while hovered, focused or dragged).
 */

/** Direction in which the panels of a split are laid out. */
export type SplitOrientation = "horizontal" | "vertical"

/** Detail of `tec-layout-change`. */
export interface SplitLayoutChangeDetail {
  /** Size of every visible panel, in percent of the split (document order). */
  layout: number[]
  /** The same array as `layout` (kept for compatibility). */
  sizes: number[]
}

/** Keyboard step, in percent (as `tec-resizable-group`). */
const KEYBOARD_STEP = 5

const round = (v: number) => Math.round(v * 1000) / 1000

interface Drag {
  handle: TecAppShellSplitHandle
  pivot: [number, number]
  startLayout: number[]
  x: number
  y: number
  pointerId: number
  rtl: boolean
}

const splitStyles = css`
  :host {
    display: flex;
    flex: 1 1 0%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
  }
`

const panelStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1 1 0px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  :host(:state(collapsed)) {
    visibility: hidden;
  }
`

/* The resizable handle, in the shell's colours. */
const handleStyles = css`
  .base {
    background-color: var(--tec-border-subtle);
  }
  :host(:hover) .base {
    background-color: color-mix(in oklab, var(--tec-primary) 60%, transparent);
  }
  :host(:focus-visible) .base,
  :host(:state(active)) .base {
    background-color: var(--tec-primary);
  }
  :host(:state(disabled)) .base {
    background-color: var(--tec-border-subtle);
  }
  /* A 6px hit area centred on the line, above the neighbouring panels. */
  .hit {
    z-index: 10;
    width: 0.375rem;
  }
  :host(:state(vertical)) .hit {
    height: 0.375rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: background-color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base,
    :host(:hover) .base,
    :host(:state(active)) .base {
      background-color: CanvasText;
    }
    :host(:focus-visible) .base {
      background-color: Highlight;
    }
  }
`

const isPanel = (el: Element): el is TecAppShellSplitPanel => el.localName === "tec-app-shell-split-panel"
const isHandle = (el: Element): el is TecAppShellSplitHandle => el.localName === "tec-app-shell-split-handle"

/**
 * The panels are laid out along `orientation` with a `tec-app-shell-split-handle` between each pair;
 * the user drags a handle (or focuses it and uses the keyboard) to move the space between the
 * panels. It works like `tec-resizable-group` — same layout rules, keyboard model and
 * `tec-layout-change` event — and adds what the shell body needs: a panel hidden with CSS
 * (`class="hidden xl:flex"`) — and the handle before it — leaves the layout, and the remaining panels
 * share the space. Sizes and constraints are set on the panels in `px`, `rem` or `%`; `px` / `rem`
 * sizes stay constant when the window resizes until the user moves a divider.
 *
 * @summary A resizable split inside the shell body (main area and a full-height aside or sidebar).
 *
 * @tag tec-app-shell-split
 *
 * @slot - `tec-app-shell-split-panel`s with a `tec-app-shell-split-handle` between each pair.
 *
 * @fires tec-layout-change - The user resized the panels (at the end of a drag, on every keyboard step, on double-click). `detail: { layout, sizes }` (the same array: percent, document order of the visible panels).
 */
export class TecAppShellSplit extends TectonElement {
  static styles = [hostStyles, splitStyles]

  /** `horizontal`: panels side by side (vertical handles); `vertical`: stacked. */
  @property({ reflect: true }) orientation: SplitOrientation = "horizontal"

  /** Disables resizing with every handle of the split. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The visible panels, in document order. */
  #panels: TecAppShellSplitPanel[] = []
  #handles: TecAppShellSplitHandle[] = []
  #constraints: PanelConstraints[] = []
  #layout: number[] = []
  #pending: number[] | null = null
  #touched = false
  #available = 0
  #expandedSizes = new WeakMap<Element, number>()
  #drag: Drag | null = null

  #resizeObserver = new ResizeObserver(() => this.refresh())
  #mutationObserver = new MutationObserver(() => this.refresh())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#resizeObserver.observe(this)
    // Direct children only: the split holds the whole work area, whose own changes are not its business.
    this.#mutationObserver.observe(this, { childList: true })
    this.refresh()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resizeObserver.disconnect()
    this.#mutationObserver.disconnect()
  }

  /** The size of every visible panel in percent (document order, summing to 100). Set it to restore a saved layout. */
  get layout(): number[] {
    return (this.#pending ?? this.#layout).map(round)
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

  /** The same as `layout`. */
  get sizes(): number[] {
    return this.layout
  }
  set sizes(sizes: number[]) {
    this.layout = sizes
  }

  /** Re-reads the panels, handles, visibility and constraints (called automatically on changes). */
  refresh(): void {
    const children = [...this.children]
    // Hiding a panel with CSS resizes it: the observer notices panels leaving and entering the layout.
    for (const child of children) this.#resizeObserver.observe(child)
    const panels = children.filter(isPanel).filter((p) => p.checkVisibility())
    const changed = panels.length !== this.#panels.length || panels.some((p, i) => p !== this.#panels[i])
    this.#panels = panels
    this.#handles = children.filter(isHandle)
    for (const p of children.filter(isPanel)) if (!panels.includes(p)) p.applySize?.(null, false)
    this.#measure(changed)
  }

  /** @internal */
  constraintsChanged(): void {
    this.#measure()
  }

  /** The size of `panel` in percent (0 when it is hidden). @internal */
  sizeOf(panel: TecAppShellSplitPanel): number {
    const i = this.#panels.indexOf(panel)
    return i < 0 ? 0 : (this.#layout[i] ?? 0)
  }

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
    const read = (value: string | undefined) => parseSize(value, available, font, rootFont)
    return this.#panels.map((p) => ({
      minSize: read(p.minSize) ?? 0,
      maxSize: read(p.maxSize) ?? 100,
      collapsible: p.collapsible,
      collapsedSize: read(p.collapsedSize) ?? 0,
      defaultSize: read(p.defaultSize),
    }))
  }

  #usesAbsoluteSizes(): boolean {
    return this.#panels.some((p) => [p.defaultSize, p.minSize, p.maxSize, p.collapsedSize].some((v) => /(px|rem|em)\s*$/.test(v ?? "")))
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
    } else if (panelsChanged || !this.#layout.length || this.#layout.length !== this.#panels.length || (!this.#touched && absolute)) {
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
      if (prev.length === layout.length && !this.#isCollapsed(i, prev[i]!) && this.#isCollapsed(i, size)) {
        this.#expandedSizes.set(this.#panels[i]!, prev[i]!)
      }
    })
    this.#layout = layout
    layout.forEach((size, i) => this.#panels[i]!.applySize?.(size, this.#isCollapsed(i, size)))
    this.#syncHandles()
  }

  /** Indices (in the visible panels) of the panels before and after `handle`. */
  #pivot(handle: Element): [number, number] | null {
    const children = [...this.children]
    const index = children.indexOf(handle)
    if (index < 0) return null
    const before = children
      .slice(0, index)
      .reverse()
      .find((c): c is TecAppShellSplitPanel => isPanel(c) && this.#panels.includes(c))
    const after = children.slice(index + 1).find((c): c is TecAppShellSplitPanel => isPanel(c) && this.#panels.includes(c))
    return before && after ? [this.#panels.indexOf(before), this.#panels.indexOf(after)] : null
  }

  #syncHandles(): void {
    const vertical = this.orientation === "vertical"
    for (const handle of this.#handles) {
      if (typeof handle.syncFromSplit !== "function") continue
      const pivot = this.#pivot(handle)
      if (!pivot || !this.#layout.length) {
        handle.syncFromSplit(vertical, null)
        continue
      }
      const [a] = pivot
      const at = (delta: number) =>
        adjustLayout({ delta, initialLayout: this.#layout, prevLayout: this.#layout, constraints: this.#constraints, pivot, trigger: "api" })[a]!
      handle.syncFromSplit(vertical, { now: this.#layout[a]!, min: at(-100), max: at(100), controls: this.#panels[a]! })
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
    const layout = this.layout
    this.emit<SplitLayoutChangeDetail>("tec-layout-change", { detail: { layout, sizes: layout } })
  }

  /** @internal */
  handleKeyDown(handle: TecAppShellSplitHandle, event: KeyboardEvent): void {
    if (event.defaultPrevented || handle.isDisabled) return
    if (event.key === "F6") {
      const handles = this.#handles.filter((h) => !h.isDisabled && h.checkVisibility())
      const i = handles.indexOf(handle)
      if (handles.length > 1 && i >= 0) {
        event.preventDefault()
        handles[(i + (event.shiftKey ? handles.length - 1 : 1)) % handles.length]!.focus({ preventScroll: true })
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
  handlePointerDown(handle: TecAppShellSplitHandle, event: PointerEvent): void {
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
    handle.setDragging(true)
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
    handle.setDragging(false)
    if (!layoutsEqual(drag.startLayout, this.#layout)) this.#emitChange()
  }

  /** @internal */
  handleDoubleClick(handle: TecAppShellSplitHandle): void {
    if (handle.isDisabled) return
    const pivot = this.#pivot(handle)
    if (!pivot) return
    const target = this.#constraints[pivot[0]]?.defaultSize
    if (target === undefined) return
    if (this.#resize(pivot, target - this.#layout[pivot[0]]!, "api")) this.#emitChange()
  }

  /** @internal */
  resizePanel(panel: TecAppShellSplitPanel, size: string | number): void {
    const i = this.#panels.indexOf(panel)
    const target = parseSize(size, this.#available, parseFloat(getComputedStyle(this).fontSize) || 16)
    if (i < 0 || target === undefined || this.#panels.length < 2) return
    const current = this.#layout[i]!
    const last = i === this.#panels.length - 1
    const pivot: [number, number] = last ? [i - 1, i] : [i, i + 1]
    this.#resize(pivot, last ? current - target : target - current, "api")
  }

  /** @internal */
  collapsePanel(panel: TecAppShellSplitPanel): void {
    const i = this.#panels.indexOf(panel)
    const c = this.#constraints[i]
    if (!c?.collapsible || this.#isCollapsed(i)) return
    this.resizePanel(panel, c.collapsedSize)
  }

  /** @internal */
  expandPanel(panel: TecAppShellSplitPanel): void {
    const i = this.#panels.indexOf(panel)
    const c = this.#constraints[i]
    if (!c || !this.#isCollapsed(i)) return
    this.resizePanel(panel, this.#expandedSizes.get(panel) ?? (c.minSize || c.defaultSize || 0))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("orientation") && this.hasUpdated) this.#measure()
    if (changed.has("disabled") || changed.has("orientation")) for (const h of this.#handles) h.requestUpdate?.()
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.refresh()}></slot>`
  }
}

/**
 * A panel stretches its content in a column and clips it; put a `tec-app-shell-main` or a
 * `tec-app-shell-aside` inside (the aside then fills the panel and leaves the divider to the
 * handle). Sizes are strings with a unit — `"25%"` (a bare number is a percentage too), `"320px"`,
 * `"20rem"` — measured in the space the visible panels share.
 *
 * @summary One resizable region of a `tec-app-shell-split`.
 *
 * @tag tec-app-shell-split-panel
 *
 * @slot - The region (`tec-app-shell-main`, `tec-app-shell-aside`, …).
 *
 * @cssstate collapsed - A `collapsible` panel is collapsed.
 */
export class TecAppShellSplitPanel extends TectonElement {
  static styles = [hostStyles, panelStyles]

  /** Initial size: `px`, `rem` or `%` (a bare number is percent). Panels without one share the rest. Double-clicking the handle before the panel restores it. */
  @property({ attribute: "default-size" }) defaultSize = ""

  /** Smallest size (`px`, `rem` or `%`). Default `0%`. */
  @property({ attribute: "min-size" }) minSize = ""

  /** Largest size (`px`, `rem` or `%`). Default `100%`. */
  @property({ attribute: "max-size" }) maxSize = ""

  /** Dragging below half of `min-size` (or Enter on the handle before it) collapses the panel. */
  @property({ type: Boolean, reflect: true }) collapsible = false

  /** Size of the collapsed panel. Default `0%`. */
  @property({ attribute: "collapsed-size" }) collapsedSize = ""

  #split(): TecAppShellSplit | null {
    const parent = this.parentElement
    return parent?.localName === "tec-app-shell-split" ? (parent as TecAppShellSplit) : null
  }

  /** The current size in percent of the split (0 while hidden or before the split has laid out). */
  get size(): number {
    return this.#split()?.sizeOf(this) ?? 0
  }

  /** Whether the panel is collapsed. */
  get collapsed(): boolean {
    return this.matches(":state(collapsed)")
  }

  /** Collapses a `collapsible` panel (no event). */
  collapse(): void {
    this.#split()?.collapsePanel(this)
  }

  /** Expands a collapsed panel to the size it had before collapsing, or its minimum (no event). */
  expand(): void {
    this.#split()?.expandPanel(this)
  }

  /** Resizes the panel (`"30%"`, `"240px"`, or a number of percent), within its constraints (no event). */
  resize(size: string | number): void {
    this.#split()?.resizePanel(this, size)
  }

  /**
   * Applied by the split (`null`: the panel is hidden and out of the layout).
   * @internal
   */
  applySize(size: number | null, collapsed: boolean): void {
    this.style.flexGrow = size === null ? "" : String(Number(size.toFixed(4)))
    this.toggleState("collapsed", collapsed)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const constraints = ["defaultSize", "minSize", "maxSize", "collapsible", "collapsedSize"] as const
    if (this.hasUpdated && constraints.some((k) => changed.has(k))) this.#split()?.constraintsChanged()
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A focusable window splitter (`role="separator"`, the WAI-ARIA window splitter pattern), drawn and
 * operated like `tec-resizable-handle`: its value is the size of the panel before it
 * (`aria-valuenow`, in percent, with the limits it can move between as `aria-valuemin` /
 * `aria-valuemax`) and it controls that panel. Drag it with the pointer, or use the arrow keys (5%
 * steps, mirrored in right-to-left layouts), Home / End (the limits), Enter (collapse / expand a
 * `collapsible` panel) and F6 (next handle); a double-click restores the panel's `default-size`.
 *
 * @summary The draggable divider between two `tec-app-shell-split-panel`s.
 *
 * @tag tec-app-shell-split-handle
 *
 * @csspart base - The 1px line (with its 6px hit area).
 * @csspart grip - The grip shown with `with-handle`.
 *
 * @cssstate vertical - The split is vertical (a horizontal line).
 * @cssstate active - The user is dragging the handle.
 * @cssstate dragging - The same as `active`.
 * @cssstate disabled - The handle (or its split) is disabled.
 */
export class TecAppShellSplitHandle extends TectonElement {
  static styles = [hostStyles, resizableHandleStyles, handleStyles]

  /** Shows a grip on the line. */
  @property({ type: Boolean, reflect: true, attribute: "with-handle" }) withHandle = false

  /** Disables resizing with this handle. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Accessible name of the splitter (or use `aria-label`); name it when there are several. */
  @property() label = ""

  constructor() {
    super()
    this.addEventListener("keydown", (e) => this.#split()?.handleKeyDown(this, e))
    this.addEventListener("pointerdown", (e) => this.#split()?.handlePointerDown(this, e))
    this.addEventListener("dblclick", () => this.#split()?.handleDoubleClick(this))
  }

  #split(): TecAppShellSplit | null {
    const parent = this.parentElement
    return parent?.localName === "tec-app-shell-split" ? (parent as TecAppShellSplit) : null
  }

  /** Whether the handle is disabled directly or through its split. */
  get isDisabled(): boolean {
    return this.disabled || !!this.#split()?.disabled
  }

  /**
   * Orientation and value, from the split.
   * @internal
   */
  syncFromSplit(vertical: boolean, value: { now: number; min: number; max: number; controls: Element } | null): void {
    const internals = this.internals
    // A splitter between side-by-side panels is a vertical line.
    internals.ariaOrientation = vertical ? "horizontal" : "vertical"
    this.toggleState("vertical", vertical)
    internals.ariaValueNow = value ? String(Math.round(value.now)) : null
    internals.ariaValueMin = value ? String(Math.round(value.min)) : null
    internals.ariaValueMax = value ? String(Math.round(value.max)) : null
    internals.ariaControlsElements = value ? [value.controls] : null
  }

  /** @internal */
  setDragging(dragging: boolean): void {
    this.toggleState("active", dragging)
    this.toggleState("dragging", dragging)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "separator"
    this.internals.ariaLabel = this.label || null
    this.internals.ariaDisabled = this.isDisabled ? "true" : null
    this.toggleState("disabled", this.isDisabled)
    this.toggleState("group-disabled", !!this.#split()?.disabled)
    if (this.isDisabled) this.removeAttribute("tabindex")
    else if (this.getAttribute("tabindex") !== "0") this.tabIndex = 0
  }

  protected override render() {
    return html`<div class="base" part="base"></div>
      <div class="hit"></div>
      ${this.withHandle ? html`<div class="grip" part="grip"></div>` : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-app-shell-split": TecAppShellSplit
    "tec-app-shell-split-panel": TecAppShellSplitPanel
    "tec-app-shell-split-handle": TecAppShellSplitHandle
  }
}
