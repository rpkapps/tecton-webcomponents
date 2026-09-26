import { html, nothing } from "lit"
import { property } from "lit/decorators.js"
import { animationStyles } from "../../internal/animations.js"
import { hostStyles } from "../../internal/styles.js"
import { TecModalElement } from "../dialog/modal.js"
import { ModalCloseBase, ModalSectionBase, ModalTextBase, ModalTitleBase } from "../dialog/modal-parts.js"
import { modalStyles } from "../dialog/modal.styles.js"
import { sheetDescriptionStyles, sheetFooterStyles, sheetHeaderStyles, sheetStyles, sheetTitleStyles } from "./sheet.styles.js"

export type { ModalOpenChangeDetail as SheetOpenChangeDetail, ModalOpenChangeReason as SheetOpenChangeReason } from "../dialog/modal.js"

export type SheetSide = "top" | "right" | "bottom" | "left"

/**
 * A modal panel that slides in from an edge of the screen. It is a native `<dialog>` opened with
 * `showModal()` (top layer, page inert, scroll locked); focus moves in on open, Tab stays inside,
 * and focus returns to the trigger on close. Escape, a press on the overlay, the ✕ button and any
 * `tec-sheet-close` close it.
 *
 * @summary Extends the dialog to display content that complements the main content of the screen.
 *
 * @tag tec-sheet
 *
 * @slot trigger - The element that opens the sheet (usually a `tec-button`). It gets `aria-expanded`, and focus returns to it on close.
 * @slot - The content: `tec-sheet-header`, a body (give it `px-4` and `flex-1`), `tec-sheet-footer`.
 *
 * @csspart dialog - The native `<dialog>` element (a transparent full-viewport layer).
 * @csspart overlay - The dimmed, blurred backdrop.
 * @csspart content - The sliding panel.
 * @csspart close-button - The ✕ button in the corner (a `tec-button`).
 *
 * @cssprop --tec-sheet-width - Width of a `left` / `right` sheet (default `75%`).
 * @cssprop --tec-sheet-max-width - Maximum width of a `left` / `right` sheet from the `sm` breakpoint (default `24rem`).
 * @cssprop --tec-sheet-max-height - Maximum height of a `top` / `bottom` sheet (default `100%`).
 *
 * @fires tec-open-change - The user opened or closed the sheet (trigger, Escape, overlay press, close button or part). Cancelable: `preventDefault()` keeps the current state. `detail: { open, reason }`.
 */
export class TecSheet extends TecModalElement {
  static styles = [hostStyles, animationStyles, modalStyles, sheetStyles]

  /** The edge of the screen the sheet slides in from. */
  @property({ reflect: true }) side: SheetSide = "right"

  /** Hides the ✕ close button in the corner. */
  @property({ type: Boolean, attribute: "hide-close", reflect: true }) hideClose = false

  /** Ignores presses on the overlay (Escape and the close buttons still close the sheet). */
  @property({ type: Boolean, reflect: true }) persistent = false

  protected override titleTag = "tec-sheet-title"
  protected override descriptionTag = "tec-sheet-description"

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
 * @summary Groups the title and description at the top of a sheet (with 1rem padding).
 * @tag tec-sheet-header
 * @slot - `tec-sheet-title` and `tec-sheet-description`.
 * @csspart base - The padded column.
 */
export class TecSheetHeader extends ModalSectionBase {
  static override styles = [hostStyles, sheetHeaderStyles]
}

/**
 * Pushed to the bottom of the sheet (`margin-block-start: auto`).
 *
 * @summary The action column at the bottom of a sheet (with 1rem padding).
 * @tag tec-sheet-footer
 * @slot - The actions.
 * @csspart base - The padded column.
 * @cssprop --tec-sheet-footer-margin - Top margin (default `auto`, which pushes the footer to the bottom).
 */
export class TecSheetFooter extends ModalSectionBase {
  static override styles = [hostStyles, sheetFooterStyles]
}

/**
 * @summary The sheet's heading. It names the sheet.
 * @tag tec-sheet-title
 * @slot - The title text.
 */
export class TecSheetTitle extends ModalTitleBase {
  static override styles = [hostStyles, sheetTitleStyles]
}

/**
 * @summary Supporting text under the sheet title. It describes the sheet.
 * @tag tec-sheet-description
 * @slot - The description text.
 */
export class TecSheetDescription extends ModalTextBase {
  static override styles = [hostStyles, sheetDescriptionStyles]
}

/**
 * A `tec-button` (all of its attributes, slots and parts apply) that closes the sheet it is in once
 * its `click` finished dispatching; `preventDefault()` in a click listener keeps it open.
 * `tec-open-change` reports `reason: "close"`.
 *
 * @summary A button that closes the sheet. Outline by default.
 * @tag tec-sheet-close
 * @slot - The label.
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 * @csspart base - The native `<button>`.
 */
export class TecSheetClose extends ModalCloseBase {
  constructor() {
    super()
    this.variant = "outline"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-sheet": TecSheet
    "tec-sheet-header": TecSheetHeader
    "tec-sheet-footer": TecSheetFooter
    "tec-sheet-title": TecSheetTitle
    "tec-sheet-description": TecSheetDescription
    "tec-sheet-close": TecSheetClose
  }
}
