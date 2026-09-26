import { css, html, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { containsFlat, deepActiveElement, getTabbables } from "../../internal/focus.js"
import { setAriaElements } from "../../internal/aria.js"
import { PopupController, popupStyles, type PopupAlign, type PopupSide } from "../../internal/popup.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { describeTrigger, HoverDelayState } from "../tooltip/hover-delay.js"

export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** Why the hover card opened or closed. */
export type HoverCardOpenChangeReason = "hover" | "focus" | "blur" | "long-press" | "escape"

/** Detail of `tec-open-change`. */
export interface HoverCardOpenChangeDetail {
  open: boolean
  reason: HoverCardOpenChangeReason
}

const LONG_PRESS = 500

const styles = css`
  :host {
    display: contents;
  }
  .content {
    box-sizing: border-box;
    width: var(--tec-hover-card-width, 16rem);
    max-width: calc(100vw - 1rem);
    padding: 1rem;
    border-radius: var(--tec-radius-lg);
    background-color: var(--tec-popover);
    color: var(--tec-popover-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    text-align: start;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent),
      var(--tec-shadow-md);
    outline: none;
  }
  .content:popover-open {
    display: block;
  }
  .content[data-instant] {
    animation: none !important;
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
  }
`

/**
 * Opens like React Aria's preview trigger: after the pointer rests on the trigger for `delay` ms,
 * after keyboard focus rests on it for the same delay, or on a long press on touch screens. It stays
 * open while the pointer is anywhere between the trigger and the card, or focus is in either; it
 * closes `close-delay` ms after both are left, and on Escape. <kbd>Tab</kbd> from the trigger moves
 * into the card when it holds focusable content. The trigger gets `aria-haspopup="dialog"`,
 * `aria-expanded`, and — while open — the card as its description.
 *
 * The card is a preview: never put the only way to do something inside it.
 *
 * @summary A card that appears on hover, focus or long press to preview content available behind a link.
 *
 * @tag tec-hover-card
 *
 * @slot trigger - A focusable element (a `tec-button variant="link"`, a link).
 * @slot - The card content.
 *
 * @csspart content - The card (a non-modal `role="dialog"` in the top layer).
 *
 * @cssprop --tec-hover-card-width - Width of the card (default `16rem`).
 *
 * @fires tec-open-change - The card opened or closed through user interaction. Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }` with `reason` one of `hover`, `focus`, `blur`, `long-press`, `escape`.
 */
export class TecHoverCard extends TectonElement {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), styles]

  /** Whether the card is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Side of the trigger to place the card on (flips when there is no room). `inline-start` / `inline-end` follow the text direction. */
  @property() side: PopupSide = "bottom"

  /** Alignment against the trigger. (Not reflected: an `align` attribute is a legacy presentational hint.) */
  @property() align: PopupAlign = "center"

  /** Distance from the trigger in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  /** Shift along the trigger edge in px. */
  @property({ type: Number, attribute: "align-offset" }) alignOffset = 0

  /** Milliseconds the pointer (or keyboard focus) must rest on the trigger before the card opens. */
  @property({ type: Number }) delay = 600

  /** Milliseconds before the card closes after the pointer and focus left. */
  @property({ type: Number, attribute: "close-delay" }) closeDelay = 200

  /** Accessible name of the card (defaults to the trigger's text). */
  @property() label = ""

  /** Never shows the card. */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".content") private panel!: HTMLElement

  #trigger: HTMLElement | null = null
  #reason: HoverCardOpenChangeReason = "hover"
  #pointerInside = false
  #longPress: ReturnType<typeof setTimeout> | null = null
  #focusOnOpen = false
  /** Suppresses re-opening when focus is restored to the trigger after Escape. */
  #ignoreFocus = false

  #popup = new PopupController(this, {
    popup: () => this.panel,
    trigger: () => this.trigger,
    haspopup: "dialog",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset, alignOffset: this.alignOffset }),
    focus: { initial: "none", trap: false, restore: false },
    dismiss: { escape: true, outsidePress: false, focusOut: false },
    onRequestClose: () => {
      this.#reason = "escape"
      this.#ignoreFocus = true
      setTimeout(() => (this.#ignoreFocus = false), 0)
      this.#state.close(true)
    },
  })

  #state = new HoverDelayState({
    delay: () => this.delay,
    closeDelay: () => this.closeDelay,
    isOpen: () => this.open,
    onOpen: (instant) => this.#requestOpen(true, instant),
    onClose: (instant) => this.#requestOpen(false, instant),
  })

  /** The element in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  /** Opens the card (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the card (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the card (no event). */
  toggle(): void {
    this.open = !this.open
  }

  /** Recomputes the position. */
  reposition(): Promise<void> {
    return this.#popup.reposition()
  }

  #requestOpen(open: boolean, instant: boolean): void {
    if (open === this.open) return
    if (open && this.disabled) return
    const reason = open ? this.#reason : this.#reason === "escape" ? "escape" : this.#reason === "blur" ? "blur" : "hover"
    if (!this.emit<HoverCardOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return
    this.panel?.toggleAttribute("data-instant", instant)
    this.open = open
  }

  /** Close unless the pointer is in the safe area or focus is in the trigger or the card. */
  #checkClose(reason: HoverCardOpenChangeReason): void {
    if (this.#pointerInside) return
    const active = deepActiveElement()
    if (active?.matches(":focus-visible") && (containsFlat(this.trigger, active) || containsFlat(this.panel, active))) return
    this.#reason = reason
    this.#state.close()
  }

  #onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    this.#pointerInside = true
    this.#reason = "hover"
    this.#state.open()
  }

  #onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch" || this.open) return
    // Before it opened: cancel the warm-up.
    this.#pointerInside = false
    this.#state.cancelWarmup()
    this.#reason = "hover"
    this.#state.close(true)
  }

  /** While open, the safe area is the box spanning the trigger and the card. */
  #onPointerMove = (event: PointerEvent) => {
    if (!this.open || event.pointerType === "touch") return
    const trigger = this.trigger?.getBoundingClientRect()
    const card = this.panel?.getBoundingClientRect()
    if (!trigger || !card) return
    const left = Math.min(trigger.left, card.left)
    const right = Math.max(trigger.right, card.right)
    const top = Math.min(trigger.top, card.top)
    const bottom = Math.max(trigger.bottom, card.bottom)
    const inTrigger = event.clientX >= trigger.left && event.clientX <= trigger.right && event.clientY >= trigger.top && event.clientY <= trigger.bottom
    const inCard = event.clientX >= card.left && event.clientX <= card.right && event.clientY >= card.top && event.clientY <= card.bottom
    const between = event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom
    // Between = in the hull, but only on the straight path (the gap), not in its empty corners.
    const gapX = event.clientX >= Math.max(trigger.left, card.left) - 1 && event.clientX <= Math.min(trigger.right, card.right) + 1
    const gapY = event.clientY >= Math.max(trigger.top, card.top) - 1 && event.clientY <= Math.min(trigger.bottom, card.bottom) + 1
    const inside = inTrigger || inCard || (between && (gapX || gapY))
    if (inside === this.#pointerInside) return
    this.#pointerInside = inside
    if (inside) this.#state.keepOpen()
    else this.#checkClose("hover")
  }

  #onFocusIn = () => {
    if (this.#ignoreFocus) {
      this.#ignoreFocus = false
      return
    }
    if (!deepActiveElement()?.matches(":focus-visible")) return
    this.#reason = "focus"
    this.#state.open()
  }

  #onFocusOut = () => {
    // Focus may be moving into the card: decide once it landed.
    setTimeout(() => this.#checkClose("blur"), 0)
  }

  #onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab" && !event.shiftKey && this.open && this.panel) {
      const first = getTabbables(this.panel)[0]
      if (first) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  #onTouchDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return
    this.#clearLongPress()
    this.#longPress = setTimeout(() => {
      this.#longPress = null
      this.#focusOnOpen = true
      this.#reason = "long-press"
      this.#state.open(true)
    }, LONG_PRESS)
  }

  #clearLongPress = () => {
    if (this.#longPress) clearTimeout(this.#longPress)
    this.#longPress = null
  }

  #onPanelFocusOut = () => {
    setTimeout(() => this.#checkClose("blur"), 0)
  }

  #bindTrigger(): void {
    const trigger = this.trigger
    if (trigger === this.#trigger) return
    const old = this.#trigger
    const events: [string, EventListener][] = [
      ["pointerenter", this.#onPointerEnter as EventListener],
      ["pointerleave", this.#onPointerLeave as EventListener],
      ["focusin", this.#onFocusIn],
      ["focusout", this.#onFocusOut],
      ["keydown", this.#onTriggerKeyDown as EventListener],
      ["pointerdown", this.#onTouchDown as EventListener],
      ["pointerup", this.#clearLongPress],
      ["pointercancel", this.#clearLongPress],
    ]
    if (old) {
      for (const [name, fn] of events) old.removeEventListener(name, fn)
      describeTrigger(old, null)
      old.style.removeProperty("-webkit-touch-callout")
    }
    this.#trigger = trigger
    if (trigger) {
      for (const [name, fn] of events) trigger.addEventListener(name, fn)
      trigger.style.setProperty("-webkit-touch-callout", "none")
    }
  }

  #content(): Node[] {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>("slot:not([name])")
    return slot ? slot.assignedNodes({ flatten: true }) : []
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener("pointermove", this.#onPointerMove, { passive: true })
    if (this.hasUpdated) this.#bindTrigger()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener("pointermove", this.#onPointerMove)
    this.#state.dispose()
    this.#clearLongPress()
    if (this.#trigger) describeTrigger(this.#trigger, null)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#bindTrigger()
    const trigger = this.trigger
    if (this.panel) setAriaElements(this.panel, "ariaLabelledByElements", !this.label && trigger ? [trigger] : null)
    if (changed.has("open")) {
      // Focus returns to the trigger only when it was inside the card (not when nothing had focus).
      if (!this.open && containsFlat(this.panel, deepActiveElement())) {
        this.#ignoreFocus = true
        setTimeout(() => (this.#ignoreFocus = false), 0)
        trigger?.focus({ preventScroll: true })
      }
      void this.#popup.setOpen(this.open).then(() => {
        if (this.open && this.#focusOnOpen) this.panel?.focus({ preventScroll: true })
        this.#focusOnOpen = false
      })
      if (!this.open) this.#pointerInside = false
      describeTrigger(trigger, this.open ? this.#content() : null)
    } else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset") || changed.has("alignOffset"))) {
      void this.#popup.reposition()
    }
  }

  protected override render() {
    return html`<slot name="trigger" @slotchange=${() => this.requestUpdate()}></slot>
      <div
        class="content"
        part="content"
        popover="manual"
        role="dialog"
        tabindex="-1"
        aria-label=${this.label || nothing}
        @focusin=${() => this.#state.keepOpen()}
        @focusout=${this.#onPanelFocusOut}
      >
        <slot></slot>
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-hover-card": TecHoverCard
  }
}
