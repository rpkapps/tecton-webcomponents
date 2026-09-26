import { html, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { MODAL_TAGS, TecModalElement } from "../dialog/modal.js"
import { ModalCloseBase, ModalSectionBase, ModalTextBase, ModalTitleBase } from "../dialog/modal-parts.js"
import { modalStyles } from "../dialog/modal.styles.js"
import { drawerDescriptionStyles, drawerFooterStyles, drawerHeaderStyles, drawerStyles, drawerTitleStyles } from "./drawer.styles.js"

export type { ModalOpenChangeDetail as DrawerOpenChangeDetail, ModalOpenChangeReason as DrawerOpenChangeReason } from "../dialog/modal.js"

/** The edge the drawer is attached to, named after the gesture that dismisses it. */
export type DrawerSwipeDirection = "down" | "up" | "left" | "right"

/** A snap point: a fraction of the viewport height (0–1], pixels (> 1), or a `px` / `rem` length. */
export type DrawerSnapPoint = number | string

/** Detail of `tec-snap-point-change`. */
export interface DrawerSnapPointChangeDetail {
  snapPoint: DrawerSnapPoint
}

/** Internal: a nested drawer opened (`delta: 1`) or closed (`-1`) inside an ancestor drawer. */
const NESTED_EVENT = "tec-drawer-nested-change"

/** Minimum movement (px) along the swipe axis before a drag becomes a swipe. */
const SWIPE_SLOP = 6
/** Release velocity (px/ms) that dismisses or moves to the next snap point regardless of distance. */
const FLICK_VELOCITY = 0.5

function parseSnapPoints(value: string | null): DrawerSnapPoint[] {
  if (!value) return []
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => (/^\d*\.?\d+$/.test(token) ? Number(token) : token))
}

function isEditable(el: Element): boolean {
  return (
    el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-swipe-ignore], [data-swipe-ignore] *") ||
    (el as HTMLElement).isContentEditable
  )
}

/**
 * A panel attached to an edge of the screen that the user drags in and flicks away. Like
 * `tec-dialog` it is a native `<dialog>` opened with `showModal()` (top layer, page inert, scroll
 * locked, focus moved in and restored); with `non-modal` the page stays interactive.
 *
 * Dragging the panel towards its edge (pointer, touch or pen) moves it with the pointer; releasing
 * past half its size or with a flick dismisses it (`reason: "swipe"`), otherwise it springs back.
 * Dragging the other way stretches it slightly. Scrollable content scrolls first; text fields and
 * `[data-swipe-ignore]` never start a swipe. With `snap-points` a vertical drawer rests at preset
 * heights and a swipe moves between them. A drawer opened inside another stacks in front of it: the
 * parents scale down behind it. Motion follows `prefers-reduced-motion`.
 *
 * @summary A panel that slides in from an edge of the screen and is dismissed with a swipe.
 *
 * @tag tec-drawer
 *
 * @slot trigger - The element that opens the drawer (usually a `tec-button`). It gets `aria-haspopup="dialog"` and `aria-expanded`, and focus returns to it on close.
 * @slot - The content: `tec-drawer-header`, a body (make a scrolling body a flex item: `flex-1 overflow-y-auto p-4`), `tec-drawer-footer`.
 *
 * @csspart dialog - The native `<dialog>` element (a transparent full-viewport layer).
 * @csspart overlay - The dimmed, blurred backdrop (modal only). Its opacity follows the swipe.
 * @csspart content - The sliding panel.
 * @csspart handle - The swipe handle (with `show-swipe-handle`).
 * @csspart inner - The content column inside the panel.
 *
 * @cssprop --tec-drawer-height - Height of a vertical drawer (default `auto`: its content).
 * @cssprop --tec-drawer-max-height - Maximum height of a vertical drawer (default `calc(100dvh - 6rem)`).
 * @cssprop --tec-drawer-width - Width of a side drawer (default `75%`, `24rem` from the `sm` breakpoint).
 * @cssprop --tec-drawer-inset - Floats the drawer away from the viewport edges (default `0px`).
 * @cssprop --tec-drawer-bleed-background - Fills the gap behind the panel when it is dragged past its open position (default `--tec-popover`).
 * @cssprop --tec-drawer-overlay-min-opacity - Minimum overlay opacity while swiping (default `0`, `0.5` with snap points).
 *
 * @cssstate swiping - A swipe is in progress.
 * @cssstate expanded - The drawer rests at its full-height snap point.
 * @cssstate nested-open - A nested drawer is open in front of this one.
 *
 * @fires tec-open-change - The user opened or closed the drawer (trigger, Escape, outside press, swipe, close part). Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }` with `reason` one of `trigger`, `escape`, `outside`, `swipe`, `close`.
 * @fires tec-snap-point-change - A swipe moved the drawer to another snap point. `detail: { snapPoint }`.
 */
export class TecDrawer extends TecModalElement {
  static styles = [hostStyles, modalStyles, drawerStyles]

  /** The edge the drawer is attached to: the direction of the dismissing swipe. */
  @property({ attribute: "swipe-direction", reflect: true }) swipeDirection: DrawerSwipeDirection = "down"

  /** Shows a grab handle at the inner edge of the panel. */
  @property({ type: Boolean, attribute: "show-swipe-handle", reflect: true }) showSwipeHandle = false

  /** Keeps the page interactive while open: no overlay, no scroll lock, no focus trap (see `trap-focus`). */
  @property({ type: Boolean, attribute: "non-modal", reflect: true }) nonModal = false

  /** With `non-modal`: keeps Tab inside the drawer anyway. */
  @property({ type: Boolean, attribute: "trap-focus" }) trapFocusNonModal = false

  /** Ignores presses outside the drawer (Escape, swipes and close parts still close it). */
  @property({ type: Boolean, reflect: true }) persistent = false

  /**
   * Heights a vertical drawer snaps to, smallest first: fractions of the viewport height (`0.5`),
   * pixels (`400`), or `px` / `rem` lengths (`"31rem"`). Attribute: space-separated (`snap-points="31rem 1"`).
   */
  @property({
    attribute: "snap-points",
    reflect: true,
    converter: { fromAttribute: parseSnapPoints, toAttribute: (v: DrawerSnapPoint[]) => (v?.length ? v.join(" ") : null) },
  })
  snapPoints: DrawerSnapPoint[] = []

  /** The active snap point (defaults to the first one each time the drawer opens). */
  @property({ attribute: false }) snapPoint: DrawerSnapPoint | null = null

  @query(".content") private popup!: HTMLElement

  protected override titleTag = "tec-drawer-title"
  protected override descriptionTag = "tec-drawer-description"

  #drag: {
    id: number
    x: number
    y: number
    swiping: boolean
    samples: { t: number; d: number }[]
    base: number
    offset: number
    scroller: HTMLElement | null
  } | null = null
  #suppressClick = false
  #nested: { drawer: Element; height: number }[] = []
  #snapOffset = 0
  #resizeObserver?: ResizeObserver

  protected override get modal(): boolean {
    return !this.nonModal
  }

  protected override get triggerHasPopup(): string {
    return "dialog"
  }

  protected override get trapFocus(): boolean {
    return this.modal || this.trapFocusNonModal
  }

  protected override get dismissOnOutsidePress(): boolean {
    return !this.persistent
  }

  protected override initialFocus(): HTMLElement | null {
    const auto = [...this.querySelectorAll<HTMLElement>("[autofocus]")].find((el) => el.closest(MODAL_TAGS) === this)
    return auto ?? this.dialog
  }

  get #axis(): "x" | "y" {
    return this.swipeDirection === "left" || this.swipeDirection === "right" ? "x" : "y"
  }

  get #hasSnapPoints(): boolean {
    return this.#axis === "y" && this.snapPoints.length > 0
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener(NESTED_EVENT, this.#onNested as EventListener)
    window.addEventListener("resize", this.#onResize)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.removeEventListener(NESTED_EVENT, this.#onNested as EventListener)
    window.removeEventListener("resize", this.#onResize)
    this.#resizeObserver?.disconnect()
  }

  #onResize = () => {
    if (this.open) this.#applySnap()
  }

  /** A nested drawer opened or closed: stack behind it. */
  #onNested = (event: CustomEvent<{ drawer: Element; delta: 1 | -1; height: number }>) => {
    const { drawer, delta, height } = event.detail
    if (drawer === this) return
    this.#nested = this.#nested.filter((n) => n.drawer !== drawer)
    if (delta > 0) this.#nested.push({ drawer, height })
    this.#applyStack()
  }

  #applyStack(): void {
    const popup = this.popup
    if (!popup) return
    const count = this.#nested.length
    this.toggleState("nested-open", count > 0)
    popup.style.setProperty("--_nested", String(count))
    const front = this.#nested[this.#nested.length - 1]
    if (front) popup.style.setProperty("--_stack-height", `${front.height}px`)
    else popup.style.removeProperty("--_stack-height")
  }

  #announceNested(delta: 1 | -1): void {
    const parent = this.parentElement?.closest(MODAL_TAGS)
    if (!parent) return
    parent.dispatchEvent(
      new CustomEvent(NESTED_EVENT, { detail: { drawer: this, delta, height: this.popup?.offsetHeight ?? 0 }, bubbles: true, composed: true })
    )
  }

  /** Visible size of a snap point in px. */
  #snapPx(point: DrawerSnapPoint): number {
    if (typeof point === "number") return point <= 1 ? point * innerHeight : point
    const n = parseFloat(point)
    if (point.endsWith("rem")) return n * parseFloat(getComputedStyle(document.documentElement).fontSize || "16")
    if (point.endsWith("vh") || point.endsWith("dvh")) return (n / 100) * innerHeight
    return n
  }

  /** Offset (px from fully open) of a snap point. */
  #offsetOf(point: DrawerSnapPoint): number {
    const size = this.popup?.offsetHeight || innerHeight
    return Math.max(0, size - Math.min(size, this.#snapPx(point)))
  }

  #applySnap(): void {
    const popup = this.popup
    if (!popup) return
    if (!this.#hasSnapPoints) {
      this.#snapOffset = 0
      popup.style.removeProperty("--_snap")
      this.toggleState("expanded", false)
      popup.removeAttribute("data-expanded")
      return
    }
    const point = this.snapPoint ?? this.snapPoints[0]!
    this.#snapOffset = this.#offsetOf(point)
    popup.style.setProperty("--_snap", `${this.#snapOffset}px`)
    const expanded = this.#snapOffset < 1
    this.toggleState("expanded", expanded)
    popup.toggleAttribute("data-expanded", expanded)
  }

  protected override willShow(): void {
    this.popup?.style.removeProperty("--_exit-duration")
    this.#setMove(0)
    if (this.#hasSnapPoints && this.snapPoint === null) this.snapPoint = this.snapPoints[0]!
  }

  protected override didShow(): void {
    this.#applySnap()
    this.#announceNested(1)
  }

  protected override willHide(): void {
    this.#announceNested(-1)
  }

  protected override didHide(): void {
    this.snapPoint = null
  }

  protected override syncLabelling(): void {
    super.syncLabelling()
    for (const part of this.querySelectorAll<TecDrawerHeader>("tec-drawer-header")) {
      if (part.closest(MODAL_TAGS) === this) part.syncFromDrawer?.(this.#axis)
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (this.open && (changed.has("snapPoint") || changed.has("snapPoints") || changed.has("swipeDirection"))) this.#applySnap()
  }

  // ——— swiping ———

  /** Movement towards the closing edge for a pointer position. */
  #along(event: PointerEvent): number {
    const drag = this.#drag!
    switch (this.swipeDirection) {
      case "down":
        return event.clientY - drag.y
      case "up":
        return drag.y - event.clientY
      case "right":
        return event.clientX - drag.x
      default:
        return drag.x - event.clientX
    }
  }

  #across(event: PointerEvent): number {
    const drag = this.#drag!
    return this.#axis === "y" ? event.clientX - drag.x : event.clientY - drag.y
  }

  #size(): number {
    const popup = this.popup
    if (!popup) return 1
    return (this.#axis === "y" ? popup.offsetHeight : popup.offsetWidth) || 1
  }

  #setMove(px: number): void {
    const popup = this.popup
    if (!popup) return
    popup.style.setProperty("--_move", `${px}px`)
    const progress = Math.max(0, Math.min(1, (this.#snapOffset + px) / this.#size()))
    this.dialog?.style.setProperty("--_progress", String(this.#hasSnapPoints ? Math.max(0, px) / this.#size() : progress))
  }

  /** The nearest scrollable ancestor of `target` inside the panel, along the swipe axis. */
  #scroller(target: Element): HTMLElement | null {
    for (let el: Element | null = target; el && el !== this; el = el.assignedSlot ?? el.parentElement) {
      const h = el as HTMLElement
      const style = getComputedStyle(h)
      const overflow = this.#axis === "y" ? style.overflowY : style.overflowX
      if (!/(auto|scroll)/.test(overflow)) continue
      if (this.#axis === "y" ? h.scrollHeight > h.clientHeight : h.scrollWidth > h.clientWidth) return h
    }
    return null
  }

  /** Whether `scroller` can still scroll against the dismissing gesture (then the gesture scrolls). */
  #canScrollBack(scroller: HTMLElement, along: number): boolean {
    const dir = this.swipeDirection
    if (along > 0) {
      if (dir === "down") return scroller.scrollTop > 0
      if (dir === "up") return scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1
      if (dir === "right") return Math.abs(scroller.scrollLeft) > 0
      return Math.abs(scroller.scrollLeft) + scroller.clientWidth < scroller.scrollWidth - 1
    }
    return true
  }

  #onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || !this.open) return
    const target = event.composedPath()[0] as Element
    if (target instanceof Element && isEditable(target)) return
    this.#drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      swiping: false,
      samples: [{ t: event.timeStamp, d: 0 }],
      base: this.#snapOffset,
      offset: this.#snapOffset,
      scroller: target instanceof Element ? this.#scroller(target) : null,
    }
  }

  #onPointerMove = (event: PointerEvent) => {
    const drag = this.#drag
    if (!drag || event.pointerId !== drag.id) return
    const along = this.#along(event)
    if (!drag.swiping) {
      const across = this.#across(event)
      if (Math.abs(along) < SWIPE_SLOP && Math.abs(across) < SWIPE_SLOP) return
      if (Math.abs(across) > Math.abs(along)) {
        this.#drag = null
        return
      }
      // A scrollable region scrolls first; at its edge the drag swipes the drawer. With snap points,
      // dragging towards the full height swipes too while the drawer is not expanded.
      const expanding = along < 0 && this.#hasSnapPoints && drag.base > 0
      if (drag.scroller && !expanding && this.#canScrollBack(drag.scroller, along)) {
        this.#drag = null
        return
      }
      drag.swiping = true
      try {
        this.popup.setPointerCapture(event.pointerId)
      } catch {
        // not an active pointer (synthetic events)
      }
      this.popup.toggleAttribute("data-swiping", true)
      this.toggleState("swiping", true)
      window.getSelection()?.removeAllRanges()
    }
    event.preventDefault()
    const d = this.#along(event)
    let offset = drag.base + d
    if (offset < 0) offset = -Math.min(48, Math.sqrt(-offset) * 3) // stretch past the open position
    drag.offset = offset
    drag.samples.push({ t: event.timeStamp, d })
    if (drag.samples.length > 8) drag.samples.shift()
    this.#setMove(offset - this.#snapOffset)
  }

  #velocity(): number {
    const samples = this.#drag?.samples ?? []
    const last = samples[samples.length - 1]
    if (!last) return 0
    const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0]!
    const dt = last.t - first.t
    return dt > 0 ? (last.d - first.d) / dt : 0
  }

  #onPointerUp = (event: PointerEvent) => {
    const drag = this.#drag
    if (!drag || event.pointerId !== drag.id) return
    this.#drag = null
    if (!drag.swiping) return
    this.#suppressClick = true
    setTimeout(() => (this.#suppressClick = false), 0)
    this.popup.removeAttribute("data-swiping")
    this.toggleState("swiping", false)
    if (this.popup.hasPointerCapture(event.pointerId)) this.popup.releasePointerCapture(event.pointerId)
    const velocity = this.#velocity()
    const size = this.#size()
    const offset = drag.offset

    if (this.#hasSnapPoints) {
      const projected = offset + velocity * 200
      const targets = this.snapPoints.map((p) => ({ point: p as DrawerSnapPoint | null, offset: this.#offsetOf(p) }))
      targets.push({ point: null, offset: size })
      let best = targets[0]!
      for (const t of targets) if (Math.abs(t.offset - projected) < Math.abs(best.offset - projected)) best = t
      // A flick moves at least one step in its direction.
      if (Math.abs(velocity) > FLICK_VELOCITY && Math.abs(best.offset - drag.base) < 1) {
        const sorted = [...targets].sort((a, b) => a.offset - b.offset)
        const i = sorted.findIndex((t) => Math.abs(t.offset - drag.base) < 1)
        const next = sorted[i + (velocity > 0 ? 1 : -1)]
        if (next) best = next
      }
      if (best.point === null) {
        this.#dismissBySwipe(velocity, offset, size)
        return
      }
      this.#setMove(0)
      if (best.point !== this.snapPoint) {
        this.snapPoint = best.point
        this.emit<DrawerSnapPointChangeDetail>("tec-snap-point-change", { detail: { snapPoint: best.point } })
      }
      this.#applySnap()
      this.#setMove(0)
      return
    }

    if (offset > size / 2 || (velocity > FLICK_VELOCITY && offset > SWIPE_SLOP)) this.#dismissBySwipe(velocity, offset, size)
    else this.#setMove(0)
  }

  #dismissBySwipe(velocity: number, offset: number, size: number): void {
    const remaining = Math.max(0, size - offset)
    const ms = velocity > 0.05 ? Math.min(400, Math.max(120, remaining / velocity)) : 400
    this.popup.style.setProperty("--_exit-duration", `${Math.round(ms)}ms`)
    if (!this.requestOpen(false, "swipe")) {
      this.popup.style.removeProperty("--_exit-duration")
      this.#setMove(0)
    }
  }

  #onPointerCancel = () => {
    if (!this.#drag) return
    const swiping = this.#drag.swiping
    this.#drag = null
    if (!swiping) return
    this.popup.removeAttribute("data-swiping")
    this.toggleState("swiping", false)
    this.#setMove(0)
  }

  #onClickCapture = (event: MouseEvent) => {
    if (this.#suppressClick) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  protected override firstUpdated(): void {
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.open && this.#hasSnapPoints && !this.#drag) this.#applySnap()
    })
    if (this.popup) this.#resizeObserver.observe(this.popup)
  }

  protected override renderSurface() {
    return html`${this.modal ? html`<div class="overlay" part="overlay"></div>` : nothing}
      <div
        class="content"
        part="content"
        data-swipe-direction=${this.swipeDirection}
        data-swipe-axis=${this.#axis}
        ?data-snap-points=${this.#hasSnapPoints}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @lostpointercapture=${this.#onPointerCancel}
        @click=${{ handleEvent: this.#onClickCapture, capture: true }}
      >
        ${this.showSwipeHandle ? html`<div class="handle" part="handle" aria-hidden="true"></div>` : nothing}
        <div class="inner" part="inner"><slot></slot></div>
      </div>`
  }
}

/**
 * Centred on a vertical drawer below the `md` breakpoint (48rem), start-aligned otherwise.
 *
 * @summary Groups the title and description at the top of a drawer.
 * @tag tec-drawer-header
 * @slot - `tec-drawer-title` and `tec-drawer-description`.
 * @csspart base - The padded column.
 * @cssstate axis-y - The drawer is vertical (`swipe-direction` `down` or `up`).
 */
export class TecDrawerHeader extends ModalSectionBase {
  static override styles = [hostStyles, drawerHeaderStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    const drawer = this.closest<TecDrawer>("tec-drawer")
    if (drawer) this.syncFromDrawer(drawer.swipeDirection === "left" || drawer.swipeDirection === "right" ? "x" : "y")
  }

  /** @internal */
  syncFromDrawer(axis: "x" | "y"): void {
    this.toggleState("axis-y", axis === "y")
  }
}

/**
 * Pushed to the bottom of the drawer.
 *
 * @summary The action column at the bottom of a drawer.
 * @tag tec-drawer-footer
 * @slot - The actions.
 * @csspart base - The padded column.
 * @cssprop --tec-drawer-footer-margin - Top margin (default `auto`, which pushes the footer to the bottom).
 */
export class TecDrawerFooter extends ModalSectionBase {
  static override styles = [hostStyles, drawerFooterStyles]
}

/**
 * @summary The drawer's heading. It names the drawer.
 * @tag tec-drawer-title
 * @slot - The title text.
 */
export class TecDrawerTitle extends ModalTitleBase {
  static override styles = [hostStyles, drawerTitleStyles]
}

/**
 * @summary Supporting text under the drawer title. It describes the drawer.
 * @tag tec-drawer-description
 * @slot - The description text.
 */
export class TecDrawerDescription extends ModalTextBase {
  static override styles = [hostStyles, drawerDescriptionStyles]
}

/**
 * A `tec-button` (all of its attributes, slots and parts apply) that closes the drawer it is in once
 * its `click` finished dispatching; `preventDefault()` in a click listener keeps it open.
 * `tec-open-change` reports `reason: "close"`.
 *
 * @summary A button that closes the drawer. Outline by default.
 * @tag tec-drawer-close
 * @slot - The label.
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 * @csspart base - The native `<button>`.
 */
export class TecDrawerClose extends ModalCloseBase {
  constructor() {
    super()
    this.variant = "outline"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-drawer": TecDrawer
    "tec-drawer-header": TecDrawerHeader
    "tec-drawer-footer": TecDrawerFooter
    "tec-drawer-title": TecDrawerTitle
    "tec-drawer-description": TecDrawerDescription
    "tec-drawer-close": TecDrawerClose
  }
}
