import { css, html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { isRtl } from "../../internal/direction.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/** Direction in which the panels of a split are laid out. */
export type SplitOrientation = "horizontal" | "vertical"

/** Detail of `tec-layout-change`. */
export interface SplitLayoutChangeDetail {
  /** Size of every visible panel, in percent of the split (document order). */
  sizes: number[]
}

const KEYBOARD_STEP = 5

const splitStyles = css`
  :host {
    display: flex;
    flex: 1 1 0%;
    min-width: 0;
    min-height: 0;
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

const handleStyles = css`
  :host {
    display: flex;
    flex: 0 0 auto;
    position: relative;
    width: 1px;
    align-self: stretch;
    cursor: col-resize;
    touch-action: none;
    outline: none;
  }
  :host(:state(vertical)) {
    width: auto;
    height: 1px;
    cursor: row-resize;
  }
  .base {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    background-color: var(--tec-border-subtle);
  }
  /* A 6px hit area centred on the 1px line. */
  .base::after {
    content: "";
    position: absolute;
    z-index: 10;
    inset-block: 0;
    left: 50%;
    width: 0.375rem;
    translate: -50% 0;
  }
  :host(:state(vertical)) .base::after {
    inset-block: auto;
    inset-inline: 0;
    left: 0;
    top: 50%;
    width: auto;
    height: 0.375rem;
    translate: 0 -50%;
  }
  :host(:hover) .base {
    background-color: color-mix(in oklab, var(--tec-primary) 60%, transparent);
  }
  :host(:focus-visible) .base,
  :host(:state(dragging)) .base {
    background-color: var(--tec-primary);
  }
  :host(:focus-visible) .base {
    box-shadow: 0 0 0 1px var(--tec-ring);
  }
  .grip {
    z-index: 10;
    display: flex;
    flex-shrink: 0;
    width: 0.25rem;
    height: 1.5rem;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-border);
  }
  :host(:state(vertical)) .grip {
    rotate: 90deg;
  }
  :host(:state(disabled)) {
    cursor: default;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: background-color var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
    :host(:focus-visible) .base {
      outline: 2px solid Highlight;
    }
  }
`

/** Parses a panel size (`"240px"`, `"20rem"`, `"25%"`, `"25"`) into percent of `groupSize` px. */
function toPercent(value: string, groupSize: number, fallback: number): number {
  const v = value.trim()
  if (!v) return fallback
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return fallback
  if (v.endsWith("%") || /^[\d.]+$/.test(v)) return n
  if (groupSize <= 0) return fallback
  let px = n
  if (v.endsWith("rem")) px = n * parseFloat(getComputedStyle(document.documentElement).fontSize || "16")
  else if (!v.endsWith("px")) return fallback
  return (px / groupSize) * 100
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round = (v: number) => Math.round(v * 1000) / 1000

interface Constraints {
  min: number
  max: number
  collapsible: boolean
  collapsed: number
}

/**
 * The panels are laid out along `orientation` with a `tec-app-shell-split-handle` between each pair;
 * the user drags a handle (or focuses it and uses the arrow keys) to move the space between the
 * two panels next to it. Sizes and constraints are set on the panels in `px`, `rem` or `%`; a
 * panel hidden with CSS (`class="hidden xl:flex"`) — and the handle before it — leaves the layout
 * and the remaining panels share the space.
 *
 * @summary A resizable split inside the shell body (main area and a full-height aside or sidebar).
 *
 * @tag tec-app-shell-split
 *
 * @slot - `tec-app-shell-split-panel`s with a `tec-app-shell-split-handle` between each pair.
 *
 * @fires tec-layout-change - The user resized the panels (dragging or keyboard). `detail: { sizes }` (percent, document order of the visible panels).
 */
export class TecAppShellSplit extends TectonElement {
  static styles = [hostStyles, splitStyles]

  /** `horizontal`: panels side by side (vertical handles); `vertical`: stacked. */
  @property({ reflect: true }) orientation: SplitOrientation = "horizontal"

  #sizes = new Map<TecAppShellSplitPanel, number>()
  #expanded = new Map<TecAppShellSplitPanel, number>()
  #visible: TecAppShellSplitPanel[] = []
  #resizeObserver?: ResizeObserver
  #mutationObserver?: MutationObserver

  /** Current size of every visible panel, in percent (document order). */
  get sizes(): number[] {
    return this.#visible.map((p) => round(this.#sizes.get(p) ?? 0))
  }

  set sizes(value: number[]) {
    this.#visible.forEach((p, i) => {
      if (value[i] !== undefined) this.#sizes.set(p, value[i])
    })
    this.#normalize()
    this.#apply()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#resizeObserver ??= new ResizeObserver(() => this.#refresh())
    this.#resizeObserver.observe(this)
    this.#mutationObserver ??= new MutationObserver(() => this.#refresh(true))
    this.#mutationObserver.observe(this, { childList: true })
    for (const child of this.children) this.#resizeObserver.observe(child)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resizeObserver?.disconnect()
    this.#mutationObserver?.disconnect()
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed)
    this.#refresh(true)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("orientation") && this.hasUpdated) this.#refresh(true)
  }

  /** @internal */
  get panels(): TecAppShellSplitPanel[] {
    return [...this.children].filter((c): c is TecAppShellSplitPanel => c instanceof TecAppShellSplitPanel)
  }

  /** @internal */
  get handles(): TecAppShellSplitHandle[] {
    return [...this.children].filter((c): c is TecAppShellSplitHandle => c instanceof TecAppShellSplitHandle)
  }

  #groupSize(): number {
    const rect = this.getBoundingClientRect()
    const total = this.orientation === "vertical" ? rect.height : rect.width
    const handles = this.handles
      .filter((h) => h.checkVisibility())
      .reduce((sum, h) => sum + (this.orientation === "vertical" ? h.offsetHeight : h.offsetWidth), 0)
    return Math.max(0, total - handles)
  }

  /** @internal */
  constraints(panel: TecAppShellSplitPanel): Constraints {
    const size = this.#groupSize()
    const min = toPercent(panel.minSize, size, 0)
    return {
      min,
      max: Math.max(min, toPercent(panel.maxSize, size, 100)),
      collapsible: panel.collapsible,
      collapsed: toPercent(panel.collapsedSize, size, 0),
    }
  }

  #refresh(force = false): void {
    for (const child of this.children) this.#resizeObserver?.observe(child)
    const visible = this.panels.filter((p) => p.checkVisibility())
    const changedSet = visible.length !== this.#visible.length || visible.some((p, i) => p !== this.#visible[i])
    if (changedSet || force) {
      this.#visible = visible
      if (changedSet) this.#layoutFromDefaults()
    }
    this.#normalize()
    this.#apply()
  }

  #layoutFromDefaults(): void {
    const size = this.#groupSize()
    const visible = this.#visible
    const known = new Map<TecAppShellSplitPanel, number>()
    for (const p of visible) {
      const d = p.defaultSize ? toPercent(p.defaultSize, size, NaN) : NaN
      if (Number.isFinite(d)) known.set(p, d)
    }
    const rest = visible.filter((p) => !known.has(p))
    const used = [...known.values()].reduce((a, b) => a + b, 0)
    const share = rest.length ? Math.max(0, 100 - used) / rest.length : 0
    this.#sizes.clear()
    for (const p of visible) this.#sizes.set(p, known.get(p) ?? share)
  }

  /** Clamps every panel to its constraints and makes the sizes add up to 100. */
  #normalize(): void {
    const visible = this.#visible
    if (!visible.length) return
    const cons = new Map(visible.map((p) => [p, this.constraints(p)]))
    const isCollapsed = (p: TecAppShellSplitPanel) => {
      const c = cons.get(p)!
      return c.collapsible && Math.abs((this.#sizes.get(p) ?? 0) - c.collapsed) < 0.01
    }
    for (const p of visible) {
      const c = cons.get(p)!
      if (!isCollapsed(p)) this.#sizes.set(p, clamp(this.#sizes.get(p) ?? 0, c.min, c.max))
    }
    // Distribute the difference to 100 over the panels that can still move, from the last one.
    for (let pass = 0; pass < 3; pass++) {
      let diff = 100 - visible.reduce((sum, p) => sum + (this.#sizes.get(p) ?? 0), 0)
      if (Math.abs(diff) < 0.001) break
      for (const p of [...visible].reverse()) {
        if (isCollapsed(p) && visible.length > 1) continue
        const c = cons.get(p)!
        const current = this.#sizes.get(p) ?? 0
        const next = clamp(current + diff, c.min, c.max)
        this.#sizes.set(p, next)
        diff -= next - current
        if (Math.abs(diff) < 0.001) break
      }
    }
  }

  #apply(): void {
    for (const p of this.panels) {
      const visible = this.#visible.includes(p)
      const size = this.#sizes.get(p) ?? 0
      p.style.flexGrow = visible ? String(round(size)) : ""
      p.setCollapsed(visible && p.collapsible && size <= this.constraints(p).collapsed + 0.01)
    }
    for (const h of this.handles) h.sync(this)
  }

  /** The visible panels before and after `handle`. @internal */
  pivots(handle: TecAppShellSplitHandle): [TecAppShellSplitPanel, TecAppShellSplitPanel] | null {
    const children = [...this.children]
    const index = children.indexOf(handle)
    const before = children
      .slice(0, index)
      .reverse()
      .find((c): c is TecAppShellSplitPanel => c instanceof TecAppShellSplitPanel && this.#visible.includes(c))
    const after = children.slice(index + 1).find((c): c is TecAppShellSplitPanel => c instanceof TecAppShellSplitPanel && this.#visible.includes(c))
    return before && after ? [before, after] : null
  }

  /** @internal */
  sizeOf(panel: TecAppShellSplitPanel): number {
    return this.#sizes.get(panel) ?? 0
  }

  /**
   * Moves `delta` percent from the panel after `handle` to the one before it (negative: the other
   * way), from the `from` sizes (default: the current ones). Returns whether anything changed.
   * @internal
   */
  resize(handle: TecAppShellSplitHandle, delta: number, from?: [number, number]): boolean {
    const pivots = this.pivots(handle)
    if (!pivots) return false
    const [a, b] = pivots
    const [startA, startB] = from ?? [this.sizeOf(a), this.sizeOf(b)]
    const ca = this.constraints(a)
    const cb = this.constraints(b)
    const total = startA + startB
    const fit = (value: number, c: Constraints) => {
      if (c.collapsible && value < c.min) return value < (c.min + c.collapsed) / 2 ? c.collapsed : c.min
      return clamp(value, c.min, c.max)
    }
    let nextA = fit(startA + delta, ca)
    let nextB = fit(total - nextA, cb)
    nextA = total - nextB
    if (!ca.collapsible || nextA !== ca.collapsed) {
      const clamped = clamp(nextA, ca.min, ca.max)
      if (clamped !== nextA) {
        nextA = clamped
        nextB = total - nextA
      }
    }
    if (Math.abs(nextA - this.sizeOf(a)) < 0.001 && Math.abs(nextB - this.sizeOf(b)) < 0.001) return false
    this.#sizes.set(a, nextA)
    this.#sizes.set(b, nextB)
    this.#apply()
    this.emit<SplitLayoutChangeDetail>("tec-layout-change", { detail: { sizes: this.sizes } })
    return true
  }

  /** Collapses the panel before `handle` if it is collapsible, or expands it back. @internal */
  toggleCollapse(handle: TecAppShellSplitHandle): void {
    const pivots = this.pivots(handle)
    if (!pivots) return
    const [a] = pivots
    const c = this.constraints(a)
    if (!c.collapsible) return
    const size = this.sizeOf(a)
    if (size <= c.collapsed + 0.01) this.resize(handle, (this.#expanded.get(a) ?? c.min) - size)
    else {
      this.#expanded.set(a, size)
      this.resize(handle, c.collapsed - size)
    }
  }

  /** Width (or height) of the panels' area in px. @internal */
  get groupSize(): number {
    return this.#groupSize()
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A panel stretches its content in a column and clips it; put a `tec-app-shell-main` or a
 * `tec-app-shell-aside` inside (the aside then fills the panel and leaves the divider to the
 * handle).
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

  /** Initial size: `px`, `rem` or `%` (a bare number is percent). Panels without one share the rest. */
  @property({ attribute: "default-size" }) defaultSize = ""

  /** Smallest size (`px`, `rem` or `%`). */
  @property({ attribute: "min-size" }) minSize = ""

  /** Largest size (`px`, `rem` or `%`). */
  @property({ attribute: "max-size" }) maxSize = ""

  /** Dragging well below `min-size` (or Enter on the handle before it) collapses the panel. */
  @property({ type: Boolean, reflect: true }) collapsible = false

  /** Size of the collapsed panel (default 0). */
  @property({ attribute: "collapsed-size" }) collapsedSize = ""

  /** @internal */
  setCollapsed(collapsed: boolean): void {
    this.toggleState("collapsed", collapsed)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const split = this.parentElement
    if (split instanceof TecAppShellSplit && split.hasUpdated && changed.size) split.sizes = split.sizes
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A focusable window splitter (`role="separator"`, the WAI-ARIA window splitter pattern): its value
 * is the size of the panel before it (`aria-valuenow`, in percent, with the panel's limits as
 * `aria-valuemin` / `aria-valuemax`) and it controls that panel. Drag it with the pointer, or use
 * the arrow keys (5% steps, mirrored in right-to-left layouts), Home / End (the limits), Enter
 * (collapse / expand a `collapsible` panel) and F6 (next handle).
 *
 * @summary The draggable divider between two `tec-app-shell-split-panel`s.
 *
 * @tag tec-app-shell-split-handle
 *
 * @csspart base - The 1px line (with its 6px hit area).
 * @csspart grip - The grip shown with `with-handle`.
 *
 * @cssstate vertical - The split is vertical (a horizontal line).
 * @cssstate dragging - The user is dragging the handle.
 * @cssstate disabled - The handle is disabled.
 */
export class TecAppShellSplitHandle extends TectonElement {
  static styles = [hostStyles, handleStyles]

  /** Shows a grip on the line. */
  @property({ type: Boolean, attribute: "with-handle" }) withHandle = false

  /** Disables resizing. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Accessible name of the splitter (default: none; name it when there are several). */
  @property() label = ""

  #drag?: { pointerId: number; start: number; from: [number, number]; size: number }

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("pointerdown", this.#onPointerDown)
    this.addEventListener("pointermove", this.#onPointerMove)
    this.addEventListener("pointerup", this.#endDrag)
    this.addEventListener("pointercancel", this.#endDrag)
    this.addEventListener("lostpointercapture", this.#endDrag)
  }

  get #split(): TecAppShellSplit | null {
    return this.parentElement instanceof TecAppShellSplit ? this.parentElement : null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "separator"
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (this.#split) this.sync(this.#split)
  }

  /** Updates orientation and value from the split. @internal */
  sync(split: TecAppShellSplit): void {
    const vertical = split.orientation === "vertical"
    // A splitter between side-by-side panels is a vertical line.
    this.internals.ariaOrientation = vertical ? "horizontal" : "vertical"
    this.toggleState("vertical", vertical)
    this.toggleState("disabled", this.disabled)
    this.internals.ariaLabel = this.label || null
    this.internals.ariaDisabled = this.disabled ? "true" : null
    if (this.tabIndex < 0 && !this.hasAttribute("tabindex")) this.tabIndex = 0
    const pivots = split.pivots(this)
    if (!pivots) {
      this.internals.ariaValueNow = null
      this.internals.ariaControlsElements = null
      return
    }
    const [a, b] = pivots
    const ca = split.constraints(a)
    const cb = split.constraints(b)
    // The range the handle can actually move in: both neighbours' limits apply.
    const total = split.sizeOf(a) + split.sizeOf(b)
    const min = Math.max(ca.collapsible ? ca.collapsed : ca.min, total - cb.max)
    const max = Math.min(ca.max, total - (cb.collapsible ? cb.collapsed : cb.min))
    this.internals.ariaValueNow = String(Math.round(split.sizeOf(a)))
    this.internals.ariaValueMin = String(Math.round(min))
    this.internals.ariaValueMax = String(Math.round(max))
    this.internals.ariaControlsElements = [a]
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const split = this.#split
    if (!split || this.disabled || event.defaultPrevented) return
    const horizontal = split.orientation === "horizontal"
    const rtl = isRtl(this)
    let delta: number | null = null
    switch (event.key) {
      case "ArrowLeft":
        if (horizontal) delta = rtl ? KEYBOARD_STEP : -KEYBOARD_STEP
        break
      case "ArrowRight":
        if (horizontal) delta = rtl ? -KEYBOARD_STEP : KEYBOARD_STEP
        break
      case "ArrowUp":
        if (!horizontal) delta = -KEYBOARD_STEP
        break
      case "ArrowDown":
        if (!horizontal) delta = KEYBOARD_STEP
        break
      case "Home":
        delta = -100
        break
      case "End":
        delta = 100
        break
      case "Enter":
        event.preventDefault()
        split.toggleCollapse(this)
        return
      case "F6": {
        event.preventDefault()
        const handles = split.handles.filter((h) => h.checkVisibility() && !h.disabled)
        const i = handles.indexOf(this)
        const next = handles[(i + (event.shiftKey ? handles.length - 1 : 1)) % handles.length]
        next?.focus({ preventScroll: true })
        return
      }
      default:
        return
    }
    event.preventDefault()
    if (delta !== null) split.resize(this, delta)
  }

  #onPointerDown = (event: PointerEvent) => {
    const split = this.#split
    if (!split || this.disabled || (event.pointerType === "mouse" && event.button !== 0)) return
    const pivots = split.pivots(this)
    if (!pivots) return
    event.preventDefault()
    this.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    this.setPointerCapture(event.pointerId)
    const horizontal = split.orientation === "horizontal"
    this.#drag = {
      pointerId: event.pointerId,
      start: horizontal ? event.clientX : event.clientY,
      from: [split.sizeOf(pivots[0]), split.sizeOf(pivots[1])],
      size: split.groupSize,
    }
    this.toggleState("dragging", true)
  }

  #onPointerMove = (event: PointerEvent) => {
    const split = this.#split
    const drag = this.#drag
    if (!split || !drag || event.pointerId !== drag.pointerId || drag.size <= 0) return
    const horizontal = split.orientation === "horizontal"
    let px = (horizontal ? event.clientX : event.clientY) - drag.start
    if (horizontal && isRtl(this)) px = -px
    split.resize(this, (px / drag.size) * 100, drag.from)
  }

  #endDrag = (event: PointerEvent) => {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return
    if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId)
    this.#drag = undefined
    this.toggleState("dragging", false)
  }

  protected override render() {
    return html`<div class="base" part="base">${this.withHandle ? html`<div class="grip" part="grip"></div>` : nothing}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-app-shell-split": TecAppShellSplit
    "tec-app-shell-split-panel": TecAppShellSplitPanel
    "tec-app-shell-split-handle": TecAppShellSplitHandle
  }
}
