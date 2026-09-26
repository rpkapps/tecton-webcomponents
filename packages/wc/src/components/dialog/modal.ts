/**
 * @module modal
 * The shared core of the modal overlays — `tec-dialog`, `tec-alert-dialog`, `tec-sheet` and
 * `tec-drawer`. Not a public element: each family subclasses {@link TecModalElement} and supplies
 * its surface (`renderSurface()`) and styles.
 *
 * What it does:
 *
 * - **native `<dialog>`** in the shadow root, opened with `showModal()`: top layer, the rest of the
 *   page inert, no z-index. Non-modal subclasses (a `non-modal` drawer) use the same element as a
 *   `popover="manual"` layer instead;
 * - the `<dialog>` is a transparent full-viewport layer holding the overlay (backdrop) and the
 *   panel, so both animate with ordinary keyframes; on close the element leaves the top layer only
 *   after the exit animation (`transition: display, overlay … allow-discrete`);
 * - **open state**: `open` (reflected) + `show()` / `hide()` / `toggle()` (no events), and a cancelable
 *   `tec-open-change` (`{ open, reason }`) for every user-initiated change: the slotted trigger, Escape,
 *   a press on the overlay, the close button, `tec-*-close` parts, swipes;
 * - **focus**: moves into the dialog on open (the dialog itself, an `[autofocus]` element, or the
 *   subclass's choice), keeps Tab inside the panel, and returns focus to the element that had it
 *   before (usually the trigger) on close;
 * - **scroll lock** of the page while a modal is open (reference counted, nested modals share it);
 * - **labelling**: the `<dialog>` is named by the slotted title part and described by the slotted
 *   description part through ARIA element reflection (`label` attribute as a fallback name);
 * - **Escape / outside press** through the shared `DismissController` layer stack, so a popover or
 *   menu open inside the dialog closes first.
 *
 * Parts that close the dialog (`tec-dialog-close`, `tec-alert-dialog-action` …) dispatch
 * {@link MODAL_CLOSE_REQUEST}; the nearest modal ancestor handles it.
 */
import { html, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { X } from "lucide"
import { icon } from "../../internal/icons.js"
import { DismissController, type DismissReason } from "../../internal/dismiss.js"
import { FocusTrap, containsFlat, deepActiveElement } from "../../internal/focus.js"
import { setAriaElements } from "../../internal/aria.js"
import { lockScroll, unlockScroll } from "../../internal/scroll-lock.js"
import { TectonElement } from "../../internal/tecton-element.js"

/** Why the open state of a modal changed. */
export type ModalOpenChangeReason =
  | "trigger"
  | DismissReason
  | "close-button"
  | "close"
  | "action"
  | "cancel"
  | "swipe"

/** Detail of `tec-open-change` on the modal overlays. */
export interface ModalOpenChangeDetail {
  open: boolean
  reason: ModalOpenChangeReason
}

/**
 * Internal event a closing part dispatches (bubbles, composed, cancelable). The nearest modal
 * ancestor stops it and asks to close with `detail.reason`.
 */
export const MODAL_CLOSE_REQUEST = "tec-modal-close-request"

/** Tags of every modal family (to find the modal a part belongs to). */
export const MODAL_TAGS = "tec-dialog, tec-alert-dialog, tec-sheet, tec-drawer"

/** Asks the nearest modal around `from` to close. Returns `false` if nothing handled it. */
export function requestModalClose(from: Element, reason: ModalOpenChangeReason): boolean {
  const event = new CustomEvent(MODAL_CLOSE_REQUEST, { detail: { reason }, bubbles: true, composed: true, cancelable: true })
  from.dispatchEvent(event)
  return event.defaultPrevented
}

/** Base class of the modal overlay elements. See the module documentation. */
export class TecModalElement extends TectonElement {
  /** Whether the overlay is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Accessible name of the dialog when it has no title part. */
  @property() label = ""

  /** Accessible label of the built-in close button (it shows an ✕ icon only). */
  @property({ attribute: "close-label" }) closeLabel = "Close"

  /** @internal Title part tag (set by the subclass). */
  protected titleTag = ""
  /** @internal Description part tag (set by the subclass). */
  protected descriptionTag = ""

  #restoreTarget: HTMLElement | null = null
  #lastTrigger: HTMLElement | null = null
  #shown = false
  #bodyObserver?: MutationObserver

  #dismiss = new DismissController({
    inside: () => [this.panel, this.modal ? null : this.trigger],
    onDismiss: (reason) => {
      if (reason === "outside" && !this.dismissOnOutsidePress) return
      this.requestOpen(false, reason)
    },
    escape: true,
    outsidePress: true,
  })

  #trap = new FocusTrap(() => this.dialog)

  /** The element in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  /** @internal The `<dialog>` element. */
  protected get dialog(): HTMLDialogElement | null {
    return this.renderRoot?.querySelector?.<HTMLDialogElement>("dialog.dialog") ?? null
  }

  /** @internal The visible panel (what counts as inside for outside presses). */
  protected get panel(): HTMLElement | null {
    return this.renderRoot?.querySelector?.<HTMLElement>(".content") ?? null
  }

  /** @internal Whether this overlay is modal (drawers can be non-modal). */
  protected get modal(): boolean {
    return true
  }

  /** @internal Whether Tab is kept inside the panel. */
  protected get containsFocus(): boolean {
    return this.modal
  }

  /** @internal Whether a press outside the panel closes (subclasses: `persistent`, alert dialog). */
  protected get dismissOnOutsidePress(): boolean {
    return true
  }

  /** @internal `aria-haspopup` of the trigger (`null`: none, like React Aria's modal triggers). */
  protected get triggerHasPopup(): string | null {
    return null
  }

  /** @internal The ARIA role of the dialog. */
  protected get dialogRole(): "dialog" | "alertdialog" {
    return "dialog"
  }

  /** @internal Where focus goes on open (default: an `[autofocus]` descendant, else the dialog). */
  protected initialFocus(): HTMLElement | null {
    const auto = [...this.querySelectorAll<HTMLElement>("[autofocus]")].find((el) => this.owns(el))
    return auto ?? this.dialog
  }

  /** Opens the overlay (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the overlay (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the overlay (no event). */
  toggle(): void {
    this.open = !this.open
  }

  /**
   * @internal Emits the cancelable `tec-open-change` and applies the change unless prevented.
   * Returns whether the state changed.
   */
  protected requestOpen(open: boolean, reason: ModalOpenChangeReason): boolean {
    if (open === this.open) return false
    if (!this.emit<ModalOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return false
    this.open = open
    return true
  }

  /** @internal Whether `el` belongs to this modal (not to a nested one). */
  protected owns(el: Element): boolean {
    return el.parentElement?.closest(MODAL_TAGS) === this || el.closest(MODAL_TAGS) === this
  }

  /** @internal The own part matching `tag` (not one of a nested modal). */
  protected ownPart(tag: string): HTMLElement | null {
    if (!tag) return null
    return [...this.querySelectorAll<HTMLElement>(tag)].find((el) => el.closest(MODAL_TAGS) === this) ?? null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener(MODAL_CLOSE_REQUEST, this.#onCloseRequest as EventListener)
    this.#bodyObserver ??= new MutationObserver(() => this.syncLabelling())
    this.#bodyObserver.observe(this, { childList: true, subtree: true })
    if (this.open && this.hasUpdated) void this.#show()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.removeEventListener(MODAL_CLOSE_REQUEST, this.#onCloseRequest as EventListener)
    this.#bodyObserver?.disconnect()
    this.#dismiss.deactivate()
    this.#trap.deactivate()
    unlockScroll(this)
    this.#shown = false
  }

  #onCloseRequest = (event: CustomEvent<{ reason: ModalOpenChangeReason }>) => {
    event.stopPropagation()
    event.preventDefault()
    this.requestOpen(false, event.detail.reason)
  }

  #onTriggerClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    const trigger = this.trigger
    if (!trigger || (trigger as HTMLElement & { disabled?: boolean }).disabled) return
    this.requestOpen(!this.open, "trigger")
  }

  /** Native close requests that bypassed Escape handling (e.g. the Android back gesture). */
  #onCancel = (event: Event) => {
    event.preventDefault()
    this.requestOpen(false, "escape")
  }

  /** The browser closed the dialog on its own (a close request that could not be cancelled). */
  #onNativeClose = () => {
    if (this.open && this.#shown && this.modal) {
      this.#shown = false
      this.emit<ModalOpenChangeDetail>("tec-open-change", { detail: { open: false, reason: "escape" } })
      this.open = false
    }
  }

  /** @internal Names/describes the dialog by its title and description parts. */
  protected syncLabelling(): void {
    const dialog = this.dialog
    if (!dialog) return
    const title = this.ownPart(this.titleTag)
    const description = this.ownPart(this.descriptionTag)
    setAriaElements(dialog, "ariaLabelledByElements", title ? [title] : null)
    setAriaElements(dialog, "ariaDescribedByElements", description ? [description] : null)
  }

  /** Mirrors the open state on the trigger (`aria-expanded`; a `tec-button` delegates it to its inner button). */
  #syncTrigger(): void {
    const trigger = this.trigger
    if (this.#lastTrigger && this.#lastTrigger !== trigger) {
      this.#lastTrigger.removeAttribute("aria-expanded")
      if (this.triggerHasPopup) this.#lastTrigger.removeAttribute("aria-haspopup")
    }
    this.#lastTrigger = trigger
    const haspopup = this.triggerHasPopup
    if (trigger && haspopup && trigger.getAttribute("aria-haspopup") !== haspopup) trigger.setAttribute("aria-haspopup", haspopup)
    if (trigger && trigger.getAttribute("aria-expanded") !== String(this.open)) trigger.setAttribute("aria-expanded", String(this.open))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.syncLabelling()
    this.#syncTrigger()
    if (changed.has("open")) {
      if (this.open) void this.#show()
      else if (changed.get("open") !== undefined || this.#shown) this.#hide()
    }
  }

  async #show(): Promise<void> {
    const dialog = this.dialog
    if (!dialog || !dialog.isConnected || this.#shown) return
    this.#shown = true
    const active = deepActiveElement() as HTMLElement | null
    this.#restoreTarget = active && !containsFlat(dialog, active) ? active : this.#restoreTarget
    dialog.dataset.state = "open"
    this.willShow()
    if (this.modal) {
      if (dialog.matches(":popover-open")) dialog.hidePopover()
      if (!dialog.open) dialog.showModal()
      lockScroll(this)
    } else if (!dialog.matches(":popover-open")) {
      dialog.showPopover()
    }
    this.#dismiss.activate()
    if (this.containsFocus) this.#trap.activate()
    this.initialFocus()?.focus({ preventScroll: true })
    this.didShow()
  }

  #hide(): void {
    const dialog = this.dialog
    if (!this.#shown) return
    this.#shown = false
    this.#dismiss.deactivate()
    this.#trap.deactivate()
    unlockScroll(this)
    if (!dialog) return
    const active = deepActiveElement()
    const focusInside = !active || active === document.body || containsFlat(dialog, active)
    dialog.dataset.state = "closed"
    this.willHide()
    if (dialog.open) dialog.close()
    if (dialog.matches(":popover-open")) dialog.hidePopover()
    if (focusInside) {
      const target = this.#restoreTarget?.isConnected ? this.#restoreTarget : this.trigger
      target?.focus({ preventScroll: true })
    }
    this.#restoreTarget = null
    this.didHide()
  }

  /** @internal Hook: before the dialog opens. */
  protected willShow(): void {}
  /** @internal Hook: after the dialog opened and focus moved. */
  protected didShow(): void {}
  /** @internal Hook: before the dialog closes (after `data-state="closed"` was set). */
  protected willHide(): void {}
  /** @internal Hook: after the dialog closed. */
  protected didHide(): void {}

  /** @internal The ✕ button in the panel corner (a ghost `tec-button`). */
  protected renderCloseButton(): TemplateResult {
    return html`<tec-button
      class="close"
      part="close-button"
      variant="ghost"
      size="icon-sm"
      aria-label=${this.closeLabel}
      @click=${(e: Event) => requestModalClose(e.currentTarget as Element, "close-button")}
      >${icon(X, { size: 16 })}</tec-button
    >`
  }

  /** @internal The contents of the `<dialog>` (overlay + panel). */
  protected renderSurface(): TemplateResult {
    return html``
  }

  protected override render() {
    return html`<slot name="trigger" @click=${this.#onTriggerClick} @slotchange=${() => this.#syncTrigger()}></slot>
      <dialog
        class="dialog"
        part="dialog"
        role=${this.dialogRole === "alertdialog" ? "alertdialog" : nothing}
        aria-label=${this.label || nothing}
        aria-modal=${this.modal ? nothing : "false"}
        popover=${this.modal ? nothing : "manual"}
        tabindex="-1"
        autofocus
        data-modal=${this.modal ? "true" : "false"}
        @cancel=${this.#onCancel}
        @close=${this.#onNativeClose}
      >
        ${this.renderSurface()}
      </dialog>`
  }
}
