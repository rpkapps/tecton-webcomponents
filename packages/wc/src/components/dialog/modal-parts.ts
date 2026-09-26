/**
 * @module modal-parts
 * Base classes of the parts shared by the modal families (dialog, alert dialog, sheet, drawer):
 * title (a level-2 heading that names the dialog), description, header/footer sections, and close
 * buttons (a `tec-button` that closes the nearest modal after its click).
 */
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { TecButton } from "../button/button.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { requestModalClose, type ModalOpenChangeReason } from "./modal.js"

/** A heading part (`role="heading"`, level 2 like the React Aria dialog heading). */
export class ModalTitleBase extends TectonElement {
  static override styles = [hostStyles]

  /** Heading level exposed to assistive technology. */
  @property({ type: Number }) level = 2

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("level")) {
      this.internals.role = "heading"
      this.internals.ariaLevel = String(this.level)
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/** A text part without semantics of its own (description, media). */
export class ModalTextBase extends TectonElement {
  static override styles = [hostStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/** A section (header / footer) whose box styles live on `part="base"`. */
export class ModalSectionBase extends TectonElement {
  static override styles = [hostStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * A `tec-button` that closes the nearest modal once its `click` finished dispatching (a listener
 * that calls `preventDefault()` keeps the modal open).
 */
export class ModalCloseBase extends TecButton {
  /** @internal The `reason` of the `tec-open-change` this button causes. */
  protected closeReason: ModalOpenChangeReason = "close"

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      if (this.disabled) return
      setTimeout(() => {
        if (event.defaultPrevented) return
        requestModalClose(this, this.closeReason)
      }, 0)
    })
  }
}
