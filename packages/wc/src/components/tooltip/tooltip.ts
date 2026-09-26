import { css, html, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { deepActiveElement } from "../../internal/focus.js"
import { PopupController, popupStyles, type PopupAlign, type PopupSide } from "../../internal/popup.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { describeTrigger, HoverDelayState } from "../../internal/hover-delay.js"

export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** Why the tooltip opened or closed. */
export type TooltipOpenChangeReason = "hover" | "focus" | "blur" | "press" | "escape"

/** Detail of `tec-open-change`. */
export interface TooltipOpenChangeDetail {
  open: boolean
  reason: TooltipOpenChangeReason
}

const styles = css`
  :host {
    display: contents;
  }
  .content {
    align-items: center;
    gap: 0.375rem;
    box-sizing: border-box;
    width: fit-content;
    max-width: var(--tec-tooltip-max-width, 20rem);
    padding: 0.375rem 0.75rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-foreground);
    color: var(--tec-background);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-normal);
    text-align: start;
    white-space: normal;
    overflow-wrap: break-word;
  }
  .content:popover-open {
    display: inline-flex;
  }
  :host(:state(has-kbd)) .content {
    padding-inline-end: 0.375rem;
  }
  ::slotted(tec-kbd) {
    position: relative;
    isolation: isolate;
    z-index: 50;
  }
  .content[data-instant] {
    animation: none !important;
  }
  .arrow {
    position: absolute;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 2px;
    background-color: var(--tec-foreground);
    pointer-events: none;
  }
  .arrow[data-side="top"] {
    top: 100%;
    transform: translateY(calc(-50% - 2px)) rotate(45deg);
  }
  .arrow[data-side="bottom"] {
    bottom: 100%;
    transform: translateY(calc(50% + 2px)) rotate(45deg);
  }
  .arrow[data-side="left"] {
    left: 100%;
    transform: translateX(calc(-50% - 2px)) rotate(45deg);
  }
  .arrow[data-side="right"] {
    right: 100%;
    transform: translateX(calc(50% + 2px)) rotate(45deg);
  }
  @media (forced-colors: active) {
    .content {
      border: 1px solid CanvasText;
    }
    .arrow {
      display: none;
    }
  }
`

/**
 * Follows the WAI-ARIA tooltip pattern the way React Aria does: the tooltip opens when the pointer
 * rests on the trigger (after `delay`, immediately while another tooltip was just shown) and when
 * the trigger receives **keyboard** focus; it closes when the pointer leaves (after `close-delay`,
 * hovering the tooltip itself keeps it open), on blur, on a press or key press on the trigger, and on
 * Escape. While open, the tooltip describes the trigger (`aria-describedby` through element
 * reflection; a `tec-button` trigger gets it on its inner `<button>`). Only one tooltip is open at a
 * time.
 *
 * The tooltip is a description, never the name: give an icon-only trigger its own `aria-label`.
 * Keep it plain text — it cannot hold focusable content.
 *
 * @summary A popup that displays information related to an element when it receives keyboard focus or the pointer hovers it.
 *
 * @tag tec-tooltip
 *
 * @slot trigger - The element the tooltip describes (a `tec-button`, a link, or a focusable wrapper such as `<span tabindex="0">` around a disabled button).
 * @slot - The tooltip text (may contain a `tec-kbd`).
 *
 * @csspart content - The tooltip bubble (`role="tooltip"`, top layer).
 * @csspart arrow - The arrow pointing at the trigger.
 *
 * @cssprop --tec-tooltip-max-width - Maximum width of the bubble (default `20rem`).
 *
 * @cssstate has-kbd - The tooltip contains a `tec-kbd` (tighter end padding).
 *
 * @fires tec-open-change - The tooltip opened or closed through user interaction. Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }` with `reason` one of `hover`, `focus`, `blur`, `press`, `escape`.
 */
export class TecTooltip extends TectonElement {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".content", "var(--tec-duration)"), styles]

  /** Whether the tooltip is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Side of the trigger to place the tooltip on (flips when there is no room). `inline-start` / `inline-end` follow the text direction. */
  @property() side: PopupSide = "top"

  /** Alignment against the trigger. (Not reflected: an `align` attribute is a legacy presentational hint.) */
  @property() align: PopupAlign = "center"

  /** Distance from the trigger in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  /** Shift along the trigger edge in px. */
  @property({ type: Number, attribute: "align-offset" }) alignOffset = 0

  /** Milliseconds the pointer must rest on the trigger before the first tooltip opens. */
  @property({ type: Number }) delay = 0

  /** Milliseconds before the tooltip closes after the pointer left. */
  @property({ type: Number, attribute: "close-delay" }) closeDelay = 500

  /** Never shows the tooltip. */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".content") private panel!: HTMLElement
  @query(".arrow") private arrowEl!: HTMLElement

  #hovered = false
  #focused = false
  #trigger: HTMLElement | null = null
  #reason: TooltipOpenChangeReason = "hover"

  #popup = new PopupController(this, {
    popup: () => this.panel,
    trigger: () => this.trigger,
    haspopup: false,
    expanded: false,
    arrow: () => this.arrowEl,
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset, alignOffset: this.alignOffset }),
    focus: { initial: "none", trap: false, restore: false },
    dismiss: { escape: true, outsidePress: false, focusOut: false },
    onRequestClose: (reason) => this.#close(reason === "escape" ? "escape" : "press"),
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

  /** Opens the tooltip (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the tooltip (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the tooltip (no event). */
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
    const reason: TooltipOpenChangeReason = open ? (this.#focused && !this.#hovered ? "focus" : "hover") : this.#reason
    if (!this.emit<TooltipOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return
    this.panel?.toggleAttribute("data-instant", instant)
    this.open = open
  }

  #close(reason: TooltipOpenChangeReason, immediate = true): void {
    this.#reason = reason
    this.#state.close(immediate)
  }

  #onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    this.#hovered = true
    this.#state.open(false)
  }

  #onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    this.#hovered = false
    this.#focused = false
    if (!this.open) this.#state.cancelWarmup()
    this.#close("hover", false)
  }

  #onFocusIn = () => {
    const active = deepActiveElement()
    if (!active?.matches(":focus-visible")) return
    this.#focused = true
    this.#state.open(true)
  }

  #onFocusOut = () => {
    this.#focused = false
    this.#hovered = false
    this.#close("blur")
  }

  #onPress = (event: Event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") return
    this.#focused = false
    this.#hovered = false
    this.#close("press")
  }

  #bindTrigger(): void {
    const trigger = this.trigger
    if (trigger === this.#trigger) return
    const old = this.#trigger
    if (old) {
      old.removeEventListener("pointerenter", this.#onPointerEnter)
      old.removeEventListener("pointerleave", this.#onPointerLeave)
      old.removeEventListener("focusin", this.#onFocusIn)
      old.removeEventListener("focusout", this.#onFocusOut)
      old.removeEventListener("pointerdown", this.#onPress)
      old.removeEventListener("keydown", this.#onPress)
      describeTrigger(old, null)
    }
    this.#trigger = trigger
    if (trigger) {
      trigger.addEventListener("pointerenter", this.#onPointerEnter)
      trigger.addEventListener("pointerleave", this.#onPointerLeave)
      trigger.addEventListener("focusin", this.#onFocusIn)
      trigger.addEventListener("focusout", this.#onFocusOut)
      trigger.addEventListener("pointerdown", this.#onPress)
      trigger.addEventListener("keydown", this.#onPress)
    }
  }

  #content(): Node[] {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>("slot:not([name])")
    return slot ? slot.assignedNodes({ flatten: true }) : []
  }

  #syncKbd = () => {
    this.toggleState("has-kbd", !!this.querySelector(":scope > tec-kbd, :scope > kbd"))
    if (this.open) describeTrigger(this.trigger, this.#content())
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.hasUpdated) this.#bindTrigger()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#state.dispose()
    if (this.#trigger) describeTrigger(this.#trigger, null)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#bindTrigger()
    if (changed.has("open")) {
      void this.#popup.setOpen(this.open)
      describeTrigger(this.trigger, this.open ? this.#content() : null)
    } else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset") || changed.has("alignOffset"))) {
      void this.#popup.reposition()
    }
    if (changed.has("disabled") && this.disabled && this.open) this.#close("press")
  }

  protected override render() {
    return html`<slot name="trigger" @slotchange=${() => this.#bindTrigger()}></slot>
      <div
        class="content"
        part="content"
        popover="manual"
        role="tooltip"
        @pointerenter=${() => this.#state.keepOpen()}
        @pointerleave=${(e: PointerEvent) => e.pointerType !== "touch" && !this.#hovered && this.#close("hover", false)}
      >
        <slot @slotchange=${this.#syncKbd}></slot>
        <div class="arrow" part="arrow" aria-hidden="true"></div>
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tooltip": TecTooltip
  }
}
