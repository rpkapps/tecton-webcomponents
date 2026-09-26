/**
 * @module popup
 * `PopupController` — everything an anchored, non-modal overlay needs (popover, dropdown menu,
 * select/combobox list, tooltip, hover card, context menu):
 *
 * - **top layer**: the popup element (rendered in the host's shadow root with `popover="manual"`) is
 *   shown with `showPopover()` — no portals, no z-index;
 * - **positioning** with `@floating-ui/dom` from shadcn-style `side` / `align` / `sideOffset` /
 *   `alignOffset` (logical sides `inline-start` / `inline-end` resolve per direction), flip + shift
 *   collision handling, optional arrow and trigger-width matching, kept up to date with `autoUpdate`;
 * - **motion**: `data-state="open|closed"` and `data-side` on the popup drive `popupMotion()`, and the
 *   exit animation finishes before the popup is hidden;
 * - **light dismiss** (Escape, outside press — composed-path aware, nested-layer aware) through
 *   `DismissController`, reported to the owner through `onRequestClose`;
 * - **focus**: optional initial focus (`"popup"`, `"first"` tabbable, a custom element, or none), an
 *   optional Tab trap, and focus restoration to the trigger when the popup closes with focus inside;
 * - **trigger ARIA**: `aria-haspopup` and `aria-expanded` on the trigger element (on a `tec-button`
 *   they are delegated to its inner `<button>` by `AriaDelegateController`).
 *
 * The owner keeps the `open` state (and emits the events); the controller only acts on it.
 * Don't reflect `align`: an `align` attribute is a legacy presentational hint (Chrome turns
 * `align="center"` into `text-align: center` on any element, inherited by the content); style by the
 * popup's `data-side` / `data-align` instead, and set `text-align: start` on the popup surface.
 *
 *
 * ```ts
 * export class TecPopover extends TectonElement {
 *   static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), styles]
 *   @property({ type: Boolean, reflect: true }) open = false
 *   @property() side: PopupSide = "bottom"      // not reflected — see the note on `align` below
 *   @property() align: PopupAlign = "center"
 *   @property({ type: Number, attribute: "side-offset" }) sideOffset = 4
 *
 *   #popup = new PopupController(this, {
 *     popup: () => this.renderRoot.querySelector(".content"),
 *     trigger: () => this.querySelector(":scope > [slot=trigger]"),
 *     haspopup: "dialog",
 *     placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset }),
 *     focus: { initial: "popup", trap: true },
 *     onRequestClose: (reason) => this.requestOpenChange(false, reason),
 *   })
 *
 *   updated(changed) { if (changed.has("open")) this.#popup.setOpen(this.open) }
 *   render() { return html`<slot name="trigger"></slot><div class="content" popover="manual">…</div>` }
 * }
 * ```
 */
import {
  arrow as arrowMiddleware,
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
  type VirtualElement,
} from "@floating-ui/dom"
import { css, type ReactiveController, type ReactiveControllerHost } from "lit"
import { animateOut } from "./animations.js"
import { isRtl } from "./direction.js"
import { DismissController, type DismissReason } from "./dismiss.js"
import { FocusTrap, containsFlat, deepActiveElement, getTabbables } from "./focus.js"

/** Side of the anchor the popup is placed on. `inline-start` / `inline-end` follow the text direction. */
export type PopupSide = "top" | "right" | "bottom" | "left" | "inline-start" | "inline-end"
/** Alignment along the anchor edge. */
export type PopupAlign = "start" | "center" | "end"

/** Placement input (the shadcn/Radix vocabulary). */
export interface PopupPlacement {
  side?: PopupSide
  align?: PopupAlign
  /** Distance from the anchor in px (`sideOffset`). Default 4. */
  sideOffset?: number
  /** Shift along the anchor edge in px (`alignOffset`). Default 0. */
  alignOffset?: number
}

/** Why a popup asked to close. */
export type PopupCloseReason = DismissReason

/** Options of {@link PopupController}. */
export interface PopupOptions {
  /** The popup element (in the host's shadow root, with the `popover` attribute). */
  popup: () => HTMLElement | null | undefined
  /**
   * The trigger: receives `aria-haspopup` / `aria-expanded`, counts as inside for light dismiss, and
   * gets focus back on close. Usually the element in `slot="trigger"`.
   */
  trigger?: () => HTMLElement | null | undefined
  /** What the popup is positioned against. Default: the trigger. May be a virtual element (a point). */
  anchor?: () => Element | VirtualElement | null | undefined
  /** `aria-haspopup` value for the trigger; `false` sets none (tooltips, hover cards). Default `"dialog"`. */
  haspopup?: "dialog" | "menu" | "listbox" | "tree" | "grid" | "true" | false
  /** Whether to set `aria-expanded` on the trigger. Default `true` (tooltips: `false`). */
  expanded?: boolean
  /** Placement, read on every position update. Default: `{ side: "bottom", align: "center", sideOffset: 4 }`. */
  placement?: () => PopupPlacement
  /** Flip to the opposite side when there is no room. Default `true`. */
  flip?: boolean
  /** Minimum distance to the viewport edges in px. Default 8. */
  collisionPadding?: number
  /** Make the popup exactly as wide as the anchor (select, combobox). Default `false`. */
  matchWidth?: boolean | (() => boolean)
  /** Arrow element inside the popup, positioned with `left`/`top` and `data-side`. */
  arrow?: () => HTMLElement | null | undefined
  /** Extra elements that count as inside for light dismiss (the host is always inside). */
  inside?: () => (EventTarget | null | undefined)[]
  /** Light dismiss switches. Defaults: escape + outside press on, focus-out off. */
  dismiss?: { escape?: boolean; outsidePress?: boolean; focusOut?: boolean }
  /**
   * Focus management:
   * - `initial`: where focus goes on open — `"popup"` (the popup itself, needs `tabindex="-1"`),
   *   `"first"` (first tabbable, else the popup), `"none"` (default), or a function returning an element;
   * - `trap`: keep Tab inside the popup while open;
   * - `restore`: on close, return focus to the trigger if focus was inside the popup (default `true`).
   */
  focus?: {
    initial?: "popup" | "first" | "none" | (() => HTMLElement | null | undefined)
    trap?: boolean
    restore?: boolean
  }
  /** Light dismiss happened; the owner closes (or not) — typically after a cancelable `tec-open-change`. */
  onRequestClose: (reason: PopupCloseReason, event: Event) => void
  /** Called after each position update with the final placement. */
  onPosition?: (info: { side: "top" | "right" | "bottom" | "left"; align: PopupAlign }) => void
}

/**
 * Base CSS for a `popover="manual"` element positioned by {@link PopupController}: removes the UA
 * popover box (centering, border, padding, canvas colours) so component styles start from zero.
 * Uses `:where()` so any component rule wins.
 */
export const popupStyles = css`
  :where([popover]) {
    position: fixed;
    inset: auto;
    top: 0;
    left: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    overflow: visible;
    width: max-content;
    height: auto;
    max-width: none;
    max-height: none;
  }
`

function toFloatingPlacement(side: PopupSide, align: PopupAlign, rtl: boolean): Placement {
  let physical: "top" | "right" | "bottom" | "left"
  if (side === "inline-start") physical = rtl ? "right" : "left"
  else if (side === "inline-end") physical = rtl ? "left" : "right"
  else physical = side
  return (align === "center" ? physical : `${physical}-${align}`) as Placement
}

/** See the module documentation. */
export class PopupController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement
  readonly #options: PopupOptions
  readonly #dismiss: DismissController
  readonly #trap: FocusTrap
  #open = false
  #cleanupAutoUpdate?: () => void
  #restoreTarget: HTMLElement | null = null
  #lastTrigger: HTMLElement | null = null

  constructor(host: ReactiveControllerHost & HTMLElement, options: PopupOptions) {
    this.#host = host
    this.#options = options
    this.#dismiss = new DismissController({
      inside: () => [host, options.trigger?.(), options.popup(), ...(options.inside?.() ?? [])],
      onDismiss: (reason, event) => options.onRequestClose(reason, event),
      escape: options.dismiss?.escape ?? true,
      outsidePress: options.dismiss?.outsidePress ?? true,
      focusOut: options.dismiss?.focusOut ?? false,
    })
    this.#trap = new FocusTrap(() => options.popup())
    host.addController(this)
  }

  /** Whether the popup is (being) shown. */
  get isOpen(): boolean {
    return this.#open
  }

  hostConnected(): void {
    if (this.#open) this.#activate()
  }

  hostDisconnected(): void {
    this.#cleanupAutoUpdate?.()
    this.#cleanupAutoUpdate = undefined
    this.#dismiss.deactivate()
    this.#trap.deactivate()
  }

  hostUpdated(): void {
    this.syncTrigger()
  }

  /** Writes `aria-haspopup` / `aria-expanded` on the current trigger (called after every host update). */
  syncTrigger(): void {
    const trigger = this.#options.trigger?.() ?? null
    if (this.#lastTrigger && this.#lastTrigger !== trigger) {
      this.#lastTrigger.removeAttribute("aria-expanded")
      this.#lastTrigger.removeAttribute("aria-haspopup")
    }
    this.#lastTrigger = trigger
    if (!trigger) return
    const haspopup = this.#options.haspopup ?? "dialog"
    if (haspopup && trigger.getAttribute("aria-haspopup") !== haspopup) trigger.setAttribute("aria-haspopup", haspopup)
    if (this.#options.expanded !== false) {
      const expanded = String(this.#open)
      if (trigger.getAttribute("aria-expanded") !== expanded) trigger.setAttribute("aria-expanded", expanded)
    }
  }

  /** Shows or hides the popup to match `open` (call it from the owner's `updated()`). */
  async setOpen(open: boolean): Promise<void> {
    if (open) await this.show()
    else await this.hide()
  }

  /** Shows the popup: top layer, position, dismiss, focus, trigger ARIA. */
  async show(): Promise<void> {
    const popup = this.#options.popup()
    if (!popup || !popup.isConnected) return
    const wasOpen = this.#open
    this.#open = true
    popup.dataset.state = "open"
    if (!wasOpen) this.#restoreTarget = (deepActiveElement() as HTMLElement | null) ?? null
    if (!popup.matches(":popover-open")) popup.showPopover()
    await this.reposition()
    if (!this.#open) return
    this.#activate()
    this.syncTrigger()
    if (!wasOpen) this.#focusInitial(popup)
  }

  /** Hides the popup: releases dismiss/trap, restores focus, plays the exit animation, leaves the top layer. */
  async hide(): Promise<void> {
    if (!this.#open) return
    this.#open = false
    const popup = this.#options.popup()
    this.#dismiss.deactivate()
    this.#trap.deactivate()
    this.syncTrigger()
    this.#restoreFocus(popup)
    if (!popup) return
    popup.dataset.state = "closed"
    await animateOut(popup)
    if (this.#open) return // re-opened while the exit animation ran
    this.#cleanupAutoUpdate?.()
    this.#cleanupAutoUpdate = undefined
    if (popup.matches(":popover-open")) popup.hidePopover()
  }

  #activate(): void {
    this.#dismiss.activate()
    if (this.#options.focus?.trap) this.#trap.activate()
    const popup = this.#options.popup()
    const anchor = this.#anchor()
    if (popup && anchor && !this.#cleanupAutoUpdate) {
      this.#cleanupAutoUpdate = autoUpdate(anchor, popup, () => void this.reposition())
    }
  }

  #anchor(): Element | VirtualElement | null {
    return this.#options.anchor?.() ?? this.#options.trigger?.() ?? null
  }

  #focusInitial(popup: HTMLElement): void {
    const initial = this.#options.focus?.initial ?? "none"
    if (initial === "none") return
    if (containsFlat(popup, deepActiveElement())) return
    let target: HTMLElement | null | undefined
    if (typeof initial === "function") target = initial()
    else if (initial === "first") target = getTabbables(popup)[0] ?? popup
    else target = popup
    target?.focus({ preventScroll: true })
  }

  #restoreFocus(popup: HTMLElement | null | undefined): void {
    if (this.#options.focus?.restore === false) return
    const active = deepActiveElement()
    const focusInside = !active || active === document.body || containsFlat(popup, active)
    if (!focusInside) return
    const target = this.#options.trigger?.() ?? this.#restoreTarget
    target?.focus({ preventScroll: true })
    this.#restoreTarget = null
  }

  /** Recomputes the position now (autoUpdate calls it on scroll/resize/anchor or popup size changes). */
  async reposition(): Promise<void> {
    const popup = this.#options.popup()
    const anchor = this.#anchor()
    if (!popup || !anchor) return
    const placement = { side: "bottom" as PopupSide, align: "center" as PopupAlign, sideOffset: 4, alignOffset: 0, ...this.#options.placement?.() }
    const rtl = isRtl(this.#host)
    const padding = this.#options.collisionPadding ?? 8
    const matchWidth = typeof this.#options.matchWidth === "function" ? this.#options.matchWidth() : !!this.#options.matchWidth
    const arrowEl = this.#options.arrow?.()
    const middleware: Middleware[] = [
      offset({ mainAxis: placement.sideOffset, crossAxis: placement.alignOffset }),
      ...(this.#options.flip === false ? [] : [flip({ padding })]),
      shift({ padding }),
      size({
        padding,
        apply({ availableWidth, availableHeight, rects }) {
          popup.style.setProperty("--tec-popup-available-width", `${Math.max(0, availableWidth)}px`)
          popup.style.setProperty("--tec-popup-available-height", `${Math.max(0, availableHeight)}px`)
          popup.style.setProperty("--tec-popup-anchor-width", `${rects.reference.width}px`)
          popup.style.setProperty("--tec-popup-anchor-height", `${rects.reference.height}px`)
          if (matchWidth) popup.style.width = `${rects.reference.width}px`
        },
      }),
      ...(arrowEl ? [arrowMiddleware({ element: arrowEl, padding: 4 })] : []),
      hide(),
    ]
    const result = await computePosition(anchor, popup, {
      strategy: "fixed",
      placement: toFloatingPlacement(placement.side, placement.align, rtl),
      middleware,
    })
    const [side, alignPart] = result.placement.split("-") as ["top" | "right" | "bottom" | "left", PopupAlign | undefined]
    const align = alignPart ?? "center"
    popup.style.left = `${result.x}px`
    popup.style.top = `${result.y}px`
    popup.dataset.side = side
    popup.dataset.align = align
    popup.toggleAttribute("data-anchor-hidden", !!result.middlewareData.hide?.referenceHidden)
    // transform-origin at the anchor, like the trigger anchor point of React Aria.
    const anchorRect = anchor.getBoundingClientRect()
    const width = popup.offsetWidth
    const height = popup.offsetHeight
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max)
    const ox = side === "left" ? width : side === "right" ? 0 : clamp(anchorRect.left + anchorRect.width / 2 - result.x, width)
    const oy = side === "top" ? height : side === "bottom" ? 0 : clamp(anchorRect.top + anchorRect.height / 2 - result.y, height)
    popup.style.setProperty("--tec-popup-transform-origin", `${ox}px ${oy}px`)
    if (arrowEl && result.middlewareData.arrow) {
      const { x, y } = result.middlewareData.arrow
      arrowEl.style.left = x != null ? `${x}px` : ""
      arrowEl.style.top = y != null ? `${y}px` : ""
      arrowEl.dataset.side = side
    }
    this.#options.onPosition?.({ side, align })
  }
}
