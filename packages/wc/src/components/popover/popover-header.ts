import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { popoverDescriptionStyles, popoverHeaderStyles, popoverTitleStyles } from "./popover.styles.js"

/**
 * @summary Groups the title and description at the top of a popover.
 * @tag tec-popover-header
 * @slot - `tec-popover-title` and `tec-popover-description`.
 */
export class TecPopoverHeader extends TectonElement {
  static styles = [hostStyles, popoverHeaderStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The popover's heading. It names the popover dialog.
 * @tag tec-popover-title
 * @slot - The title text.
 */
export class TecPopoverTitle extends TectonElement {
  static styles = [hostStyles, popoverTitleStyles]

  /** Heading level exposed to assistive technology. */
  @property({ type: Number }) level = 3

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

/**
 * @summary Supporting text under the popover title. It describes the popover dialog.
 * @tag tec-popover-description
 * @slot - The description text.
 */
export class TecPopoverDescription extends TectonElement {
  static styles = [hostStyles, popoverDescriptionStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-popover-header": TecPopoverHeader
    "tec-popover-title": TecPopoverTitle
    "tec-popover-description": TecPopoverDescription
  }
}
