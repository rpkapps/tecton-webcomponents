import { html } from "lit"
import { property } from "lit/decorators.js"
import { animationStyles } from "../../internal/animations.js"
import { hostStyles } from "../../internal/styles.js"
import { dialogPanelStyles } from "../dialog/dialog.styles.js"
import { lastInteractionWasPointer, MODAL_TAGS, TecModalElement } from "../dialog/modal.js"
import { ModalCloseBase, ModalSectionBase, ModalTextBase, ModalTitleBase } from "../dialog/modal-parts.js"
import { modalStyles } from "../dialog/modal.styles.js"
import {
  alertDialogDescriptionStyles,
  alertDialogFooterStyles,
  alertDialogHeaderStyles,
  alertDialogMediaStyles,
  alertDialogStyles,
  alertDialogTitleStyles,
} from "./alert-dialog.styles.js"

export type { ModalOpenChangeDetail as AlertDialogOpenChangeDetail, ModalOpenChangeReason as AlertDialogOpenChangeReason } from "../dialog/modal.js"

export type AlertDialogSize = "default" | "sm"

const PART_TAGS = "tec-alert-dialog-header, tec-alert-dialog-footer, tec-alert-dialog-media"

/** Parts that follow the dialog's `size` (and, for the header, whether it holds a media part). */
interface SizedPart extends HTMLElement {
  syncFromDialog(size: AlertDialogSize): void
}

/**
 * A modal dialog with `role="alertdialog"` that interrupts the user and expects an answer. Unlike
 * `tec-dialog` it has no ✕ button and a press on the overlay does not close it; Escape, the cancel
 * part and the action part do. Opening moves focus to the cancel part (the least destructive
 * choice) when it was opened with the keyboard, and to the dialog itself after a pointer press (no
 * focus ring; Tab then reaches Cancel first). Tab stays inside, and closing returns focus to the trigger.
 *
 * @summary A modal dialog that interrupts the user with important content and expects a response.
 *
 * @tag tec-alert-dialog
 *
 * @slot trigger - The element that opens the alert dialog (usually a `tec-button`). It gets `aria-expanded`, and focus returns to it on close.
 * @slot - The content: `tec-alert-dialog-header` and `tec-alert-dialog-footer`.
 *
 * @csspart dialog - The native `<dialog>` element (a transparent full-viewport layer).
 * @csspart overlay - The dimmed, blurred backdrop.
 * @csspart content - The dialog panel.
 *
 * @cssprop --tec-alert-dialog-max-width - Maximum width of the panel (default `20rem`; `32rem` from the `sm` breakpoint for `size="default"`).
 *
 * @fires tec-open-change - The user opened or closed the alert dialog (trigger, Escape, action, cancel). Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }` with `reason` one of `trigger`, `escape`, `action`, `cancel`, `close` (and `outside` with `dismissable`).
 */
export class TecAlertDialog extends TecModalElement {
  static styles = [hostStyles, animationStyles, modalStyles, dialogPanelStyles, alertDialogStyles]

  /** The size: `sm` is a narrow, centred prompt with a two-column footer. */
  @property({ reflect: true }) size: AlertDialogSize = "default"

  /** Lets a press on the overlay close the alert dialog (off by default: the user must answer). */
  @property({ type: Boolean, reflect: true }) dismissable = false

  protected override titleTag = "tec-alert-dialog-title"
  protected override descriptionTag = "tec-alert-dialog-description"

  protected override get dialogRole(): "alertdialog" {
    return "alertdialog"
  }

  protected override get dismissOnOutsidePress(): boolean {
    return this.dismissable
  }

  protected override initialFocus(): HTMLElement | null {
    const own = (sel: string) => [...this.querySelectorAll<HTMLElement>(sel)].find((el) => el.closest(MODAL_TAGS) === this) ?? null
    // Keyboard open: the least destructive choice. Pointer open: the dialog itself (no focus ring),
    // like React Aria; Tab then reaches Cancel first.
    return own("[autofocus]") ?? (lastInteractionWasPointer() ? null : own("tec-alert-dialog-cancel")) ?? this.dialog
  }

  protected override syncLabelling(): void {
    super.syncLabelling()
    for (const part of this.querySelectorAll<SizedPart>(PART_TAGS)) {
      if (part.closest(MODAL_TAGS) === this) part.syncFromDialog?.(this.size)
    }
  }

  protected override renderSurface() {
    return html`<div class="overlay" part="overlay"></div>
      <div class="content" part="content"><slot></slot></div>`
  }
}

/** Parts that mirror the dialog size as the custom state `size-sm`. */
class AlertDialogSizedSection extends ModalSectionBase implements SizedPart {
  connectedCallback(): void {
    super.connectedCallback()
    const dialog = this.closest<TecAlertDialog>("tec-alert-dialog")
    if (dialog) this.syncFromDialog(dialog.size)
  }

  /** @internal */
  syncFromDialog(size: AlertDialogSize): void {
    this.toggleState("size-sm", size === "sm")
    this.toggleState("has-media", !!this.querySelector(":scope > tec-alert-dialog-media"))
  }
}

/**
 * Centred; from the `sm` breakpoint a default-size dialog aligns it to the start, with a
 * `tec-alert-dialog-media` spanning two rows beside the title and description.
 *
 * @summary Groups the media, title and description of an alert dialog.
 * @tag tec-alert-dialog-header
 * @slot - `tec-alert-dialog-media` (optional), `tec-alert-dialog-title`, `tec-alert-dialog-description`.
 * @cssstate has-media - The header holds a `tec-alert-dialog-media`.
 * @cssstate size-sm - The alert dialog has `size="sm"`.
 */
export class TecAlertDialogHeader extends AlertDialogSizedSection {
  static override styles = [hostStyles, alertDialogHeaderStyles]
  protected override render() {
    return html`<slot @slotchange=${() => this.syncFromDialog(this.closest<TecAlertDialog>("tec-alert-dialog")?.size ?? "default")}></slot>`
  }
}

/**
 * Stacked (last child on top) on narrow screens, a right-aligned row from the `sm` breakpoint, and
 * two equal columns in a `size="sm"` dialog. Put the cancel part first.
 *
 * @summary The action row of an alert dialog.
 * @tag tec-alert-dialog-footer
 * @slot - `tec-alert-dialog-cancel` then `tec-alert-dialog-action`.
 * @cssstate size-sm - The alert dialog has `size="sm"`.
 */
export class TecAlertDialogFooter extends AlertDialogSizedSection {
  static override styles = [hostStyles, alertDialogFooterStyles]
}

/**
 * @summary An icon or image above (or, in a default-size dialog from `sm` up, beside) the title.
 * @tag tec-alert-dialog-media
 * @slot - An icon (sized to 2rem) or an image.
 * @csspart base - The 4rem tile.
 * @cssprop --tec-alert-dialog-media-background - Background of the tile (default `--tec-muted`).
 * @cssprop --tec-alert-dialog-media-foreground - Colour of the icon (default: the inherited text colour).
 * @cssstate size-sm - The alert dialog has `size="sm"`.
 */
export class TecAlertDialogMedia extends AlertDialogSizedSection {
  static override styles = [hostStyles, alertDialogMediaStyles]
}

/**
 * @summary The alert dialog's heading. It names the alert dialog.
 * @tag tec-alert-dialog-title
 * @slot - The title text, ideally a question.
 */
export class TecAlertDialogTitle extends ModalTitleBase {
  static override styles = [hostStyles, alertDialogTitleStyles]
}

/**
 * @summary States the consequence. It describes the alert dialog.
 * @tag tec-alert-dialog-description
 * @slot - The description text. Direct child links are underlined.
 */
export class TecAlertDialogDescription extends ModalTextBase {
  static override styles = [hostStyles, alertDialogDescriptionStyles]
}

/**
 * A `tec-button` (default variant; use `variant="destructive"` for destructive actions) that closes
 * the alert dialog once its `click` finished dispatching. Run the action in a `click` listener;
 * `preventDefault()` keeps the dialog open (e.g. while validating). `tec-open-change` reports
 * `reason: "action"`.
 *
 * @summary The confirming action of an alert dialog.
 * @tag tec-alert-dialog-action
 * @slot - The label: name the action and its object ("Delete well").
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 * @csspart base - The native `<button>`.
 */
export class TecAlertDialogAction extends ModalCloseBase {
  protected override closeReason = "action" as const
}

/**
 * A `tec-button` (outline by default) that closes the alert dialog. It receives focus when the alert
 * dialog opens. `tec-open-change` reports `reason: "cancel"`.
 *
 * @summary The cancelling action of an alert dialog.
 * @tag tec-alert-dialog-cancel
 * @slot - The label.
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 * @csspart base - The native `<button>`.
 */
export class TecAlertDialogCancel extends ModalCloseBase {
  protected override closeReason = "cancel" as const
  constructor() {
    super()
    this.variant = "outline"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-alert-dialog": TecAlertDialog
    "tec-alert-dialog-header": TecAlertDialogHeader
    "tec-alert-dialog-footer": TecAlertDialogFooter
    "tec-alert-dialog-media": TecAlertDialogMedia
    "tec-alert-dialog-title": TecAlertDialogTitle
    "tec-alert-dialog-description": TecAlertDialogDescription
    "tec-alert-dialog-action": TecAlertDialogAction
    "tec-alert-dialog-cancel": TecAlertDialogCancel
  }
}
