import { html, nothing } from "lit"
import { property } from "lit/decorators.js"
import { animationStyles } from "../../internal/animations.js"
import { hostStyles } from "../../internal/styles.js"
import { ModalCloseBase, ModalSectionBase, ModalTextBase, ModalTitleBase } from "./modal-parts.js"
import { TecModalElement } from "./modal.js"
import { modalStyles } from "./modal.styles.js"
import {
  dialogDescriptionStyles,
  dialogFooterStyles,
  dialogHeaderStyles,
  dialogPanelStyles,
  dialogStyles,
  dialogTitleStyles,
} from "./dialog.styles.js"

export type { ModalOpenChangeDetail as DialogOpenChangeDetail, ModalOpenChangeReason as DialogOpenChangeReason } from "./modal.js"

/**
 * A modal dialog: a native `<dialog>` opened with `showModal()`, so it sits in the top layer and the
 * rest of the page is inert. Opening moves focus into the dialog, Tab stays inside it, the page
 * does not scroll, and closing returns focus to the trigger. Escape, a press on the overlay, the ✕
 * button and any `tec-dialog-close` close it.
 *
 * @summary A window overlaid on the primary window, rendering the content underneath inert.
 *
 * @tag tec-dialog
 *
 * @slot trigger - The element that opens the dialog (usually a `tec-button`). It gets `aria-expanded`, and focus returns to it on close.
 * @slot - The dialog content: `tec-dialog-header`, your body, `tec-dialog-footer`.
 *
 * @csspart dialog - The native `<dialog>` element (a transparent full-viewport layer).
 * @csspart overlay - The dimmed, blurred backdrop.
 * @csspart content - The dialog panel.
 * @csspart close-button - The ✕ button in the corner (a `tec-button`).
 *
 * @cssprop --tec-dialog-max-width - Maximum width of the panel from the `sm` breakpoint (40rem) up. Default `28rem`; below `sm` the panel is the viewport width minus 2rem.
 *
 * @fires tec-open-change - The user opened or closed the dialog (trigger, Escape, overlay press, close button or part). Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }` with `reason` one of `trigger`, `escape`, `outside`, `close-button`, `close`.
 */
export class TecDialog extends TecModalElement {
  static styles = [hostStyles, animationStyles, modalStyles, dialogPanelStyles, dialogStyles]

  /** Hides the ✕ close button in the corner. */
  @property({ type: Boolean, attribute: "hide-close", reflect: true }) hideClose = false

  /** Ignores presses on the overlay (Escape and the close buttons still close the dialog). */
  @property({ type: Boolean, reflect: true }) persistent = false

  protected override titleTag = "tec-dialog-title"
  protected override descriptionTag = "tec-dialog-description"

  protected override get dismissOnOutsidePress(): boolean {
    return !this.persistent
  }

  protected override renderSurface() {
    return html`<div class="overlay" part="overlay"></div>
      <div class="content" part="content">
        <slot></slot>
        ${this.hideClose ? nothing : this.renderCloseButton()}
      </div>`
  }
}

/**
 * @summary Groups the title and description at the top of a dialog.
 * @tag tec-dialog-header
 * @slot - `tec-dialog-title` and `tec-dialog-description`.
 */
export class TecDialogHeader extends ModalTextBase {
  static override styles = [hostStyles, dialogHeaderStyles]
}

/**
 * Stacked (last child on top) on narrow screens, a right-aligned row from the `sm` breakpoint.
 *
 * @summary The action row at the bottom of a dialog.
 * @tag tec-dialog-footer
 * @slot - The actions (`tec-dialog-close`, `tec-button`).
 * @csspart close - The "Close" button rendered with `show-close`.
 */
export class TecDialogFooter extends ModalSectionBase {
  static override styles = [hostStyles, dialogFooterStyles]

  /** Adds an outline "Close" button (a `tec-dialog-close`) after the slotted actions. */
  @property({ type: Boolean, attribute: "show-close" }) showClose = false

  /** Label of the `show-close` button. */
  @property({ attribute: "close-label" }) closeLabel = "Close"

  protected override render() {
    return html`<div class="base" part="base">
      <slot></slot>
      ${this.showClose ? html`<tec-dialog-close part="close">${this.closeLabel}</tec-dialog-close>` : nothing}
    </div>`
  }
}

/**
 * @summary The dialog's heading. It names the dialog.
 * @tag tec-dialog-title
 * @slot - The title text.
 */
export class TecDialogTitle extends ModalTitleBase {
  static override styles = [hostStyles, dialogTitleStyles]
}

/**
 * @summary Supporting text under the dialog title. It describes the dialog.
 * @tag tec-dialog-description
 * @slot - The description text. Direct child links are underlined.
 */
export class TecDialogDescription extends ModalTextBase {
  static override styles = [hostStyles, dialogDescriptionStyles]
}

/**
 * A `tec-button` (all of its attributes, slots and parts apply) that closes the dialog it is in once
 * its `click` finished dispatching; call `preventDefault()` in a click listener to keep the dialog
 * open. `tec-open-change` reports `reason: "close"`.
 *
 * @summary A button that closes the dialog. Outline by default.
 * @tag tec-dialog-close
 * @slot - The label.
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 * @csspart base - The native `<button>`.
 */
export class TecDialogClose extends ModalCloseBase {
  constructor() {
    super()
    this.variant = "outline"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-dialog": TecDialog
    "tec-dialog-header": TecDialogHeader
    "tec-dialog-footer": TecDialogFooter
    "tec-dialog-title": TecDialogTitle
    "tec-dialog-description": TecDialogDescription
    "tec-dialog-close": TecDialogClose
  }
}
