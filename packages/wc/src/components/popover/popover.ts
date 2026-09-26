import { html, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { setAriaElements } from "../../internal/aria.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupSide } from "../../internal/popup.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { popoverStyles } from "./popover.styles.js"

export { TecPopoverDescription, TecPopoverHeader, TecPopoverTitle } from "./popover-header.js"
export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** Why the open state changed. */
export type PopoverOpenChangeReason = "trigger" | PopupCloseReason | "dismiss-button"

/** Detail of `tec-open-change`. */
export interface PopoverOpenChangeDetail {
  open: boolean
  reason: PopoverOpenChangeReason
}

/**
 * The panel is a non-modal `role="dialog"` in the top layer, named by `tec-popover-title` (or the
 * `label` attribute, else the trigger). Opening moves focus to the panel and keeps Tab inside it;
 * Escape or a press outside closes it and focus returns to the trigger.
 *
 * @summary Displays rich content in a portal, triggered by a button.
 *
 * @tag tec-popover
 *
 * @slot trigger - The element that toggles the popover (usually a `tec-button`). It gets `aria-haspopup="dialog"` and `aria-expanded`.
 * @slot - The popover content (`tec-popover-header` and anything else).
 *
 * @csspart content - The floating dialog panel (top layer).
 *
 * @cssprop --tec-popover-width - Width of the panel (default 18rem).
 *
 * @fires tec-open-change - The user opened or closed the popover (trigger press, Escape, outside press). Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }`.
 */
export class TecPopover extends TectonElement {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".content"), popoverStyles]

  /** Whether the popover is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Side of the trigger to place the panel on (flips when there is no room). */
  @property() side: PopupSide = "bottom"

  /** Alignment against the trigger. (Not reflected: an `align` attribute is a legacy presentational hint for text-align.) */
  @property() align: PopupAlign = "center"

  /** Distance from the trigger in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  /** Shift along the trigger edge in px. */
  @property({ type: Number, attribute: "align-offset" }) alignOffset = 0

  /** Accessible name of the dialog when there is no `tec-popover-title`. */
  @property() label = ""

  /** Label of the visually hidden dismiss button that screen reader users can reach at the end of the panel. */
  @property({ attribute: "close-label" }) closeLabel = "Dismiss"

  @query(".content") private panel!: HTMLElement

  #popup = new PopupController(this, {
    popup: () => this.panel,
    trigger: () => this.trigger,
    haspopup: "dialog",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset, alignOffset: this.alignOffset }),
    focus: { initial: "popup", trap: true, restore: true },
    onRequestClose: (reason) => this.#requestOpen(false, reason),
  })

  /** The element in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  /** Opens the popover (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the popover (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the popover (no event). */
  toggle(): void {
    this.open = !this.open
  }

  /** Recomputes the panel position (e.g. after the trigger moved without a resize/scroll). */
  reposition(): Promise<void> {
    return this.#popup.reposition()
  }

  #requestOpen(open: boolean, reason: PopoverOpenChangeReason): void {
    if (open === this.open) return
    if (this.emit<PopoverOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) this.open = open
  }

  #onTriggerClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    const trigger = this.trigger
    if (!trigger || (trigger as HTMLElement & { disabled?: boolean }).disabled) return
    this.#requestOpen(!this.open, "trigger")
  }

  #syncLabelling(): void {
    const panel = this.panel
    if (!panel) return
    const own = (selector: string) => [...this.querySelectorAll(selector)].find((el) => el.closest("tec-popover") === this) ?? null
    const title = own("tec-popover-title")
    const description = own("tec-popover-description")
    const trigger = this.trigger
    setAriaElements(panel, "ariaLabelledByElements", title ? [title] : !this.label && trigger ? [trigger] : null)
    setAriaElements(panel, "ariaDescribedByElements", description ? [description] : null)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#syncLabelling()
    if (changed.has("open")) void this.#popup.setOpen(this.open)
    else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset") || changed.has("alignOffset"))) void this.#popup.reposition()
  }

  protected override render() {
    return html`<slot name="trigger" @click=${this.#onTriggerClick} @slotchange=${() => this.requestUpdate()}></slot>
      <div class="content" part="content" popover="manual" role="dialog" tabindex="-1" aria-label=${this.label || nothing}>
        <slot @slotchange=${() => this.#syncLabelling()}></slot>
        <button class="sr-only" type="button" tabindex="-1" @click=${() => this.#requestOpen(false, "dismiss-button")}>${this.closeLabel}</button>
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-popover": TecPopover
  }
}
