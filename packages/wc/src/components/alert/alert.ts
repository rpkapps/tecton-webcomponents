import { html, nothing } from "lit"
import { X } from "lucide"
import { property } from "lit/decorators.js"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { alertDescriptionStyles, alertStyles, alertTitleStyles } from "./alert.styles.js"

export type AlertVariant = "default" | "destructive" | "success" | "warning" | "info"
export type AlertAppearance = "default" | "outline" | "filled"

/**
 * Compose `tec-alert > [slot=icon], tec-alert-title, tec-alert-description, [slot=action]`. The icon
 * goes in the `icon` slot (it makes the alert a two-column grid, the text aligned beside it) and
 * buttons go in the `action` slot, which sits in the top-end corner; ghost and link `tec-button`s
 * there take the alert's text colour.
 *
 * The element has `role="alert"` (default semantics), so its content is announced when it is added to
 * the page. For a message that is not urgent (info, success) set `role="status"` on the element; for
 * an alert that is on the page from the start, the role does no harm.
 *
 * `dismissible` adds a close button to the action area. Pressing it fires the cancelable
 * `tec-dismiss` event and then hides the alert (`hidden`); move focus somewhere sensible in your
 * listener if the alert had it.
 *
 * @summary Displays a callout for user attention.
 *
 * @tag tec-alert
 *
 * @slot - `tec-alert-title` and `tec-alert-description`.
 * @slot icon - A leading icon (lucide SVG or `tec-icon`, 16px); coloured with the severity.
 * @slot action - Buttons shown in the top-end corner (e.g. `<tec-button slot="action" variant="ghost" size="xs">`).
 *
 * @csspart base - The alert box.
 * @csspart icon - The icon column.
 * @csspart content - The column holding the title and description.
 * @csspart action - The action area in the top-end corner.
 * @csspart dismiss - The close button of a `dismissible` alert (a `tec-button`).
 *
 * @cssprop --tec-alert-radius - Corner radius (default `--tec-radius-md`).
 *
 * @cssstate has-icon - The `icon` slot has content.
 * @cssstate has-action - The `action` slot has content.
 *
 * @fires tec-dismiss - The user pressed the close button of a `dismissible` alert. Cancelable: `preventDefault()` keeps the alert visible.
 */
export class TecAlert extends TectonElement {
  static styles = [hostStyles, alertStyles]

  /** The severity: `default`, `info`, `success`, `warning` or `destructive`. */
  @property({ reflect: true }) variant: AlertVariant = "default"

  /** The surface: `default` (card background, status-coloured text), `outline` (coloured border, transparent) or `filled` (the Tecton status surface). */
  @property({ reflect: true }) appearance: AlertAppearance = "default"

  /** Adds a close button to the action area. */
  @property({ type: Boolean, reflect: true }) dismissible = false

  /** Accessible name of the close button. */
  @property({ attribute: "dismiss-label" }) dismissLabel = "Dismiss"

  constructor() {
    super()
    new HasSlotController(this, "icon", "action", { states: true })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "alert"
  }

  /** Hides the alert as the close button does (fires `tec-dismiss`; returns `false` if it was prevented). */
  dismiss(): boolean {
    if (!this.emit("tec-dismiss", { cancelable: true })) return false
    this.hidden = true
    return true
  }


  protected override render() {
    return html`<div class="base" part="base">
      <span class="icon" part="icon"><slot name="icon"></slot></span>
      <div class="content" part="content"><slot></slot></div>
      <div class="action" part="action">
        <slot name="action"></slot>
        ${this.dismissible
          ? html`<tec-button
              class="dismiss"
              part="dismiss"
              variant="ghost"
              size="icon-sm"
              aria-label=${this.dismissLabel}
              @click=${() => this.dismiss()}
              >${icon(X, { size: 16 })}</tec-button
            >`
          : nothing}
      </div>
    </div>`
  }
}

/**
 * @summary The title of an alert: a few words naming what happened.
 *
 * @tag tec-alert-title
 *
 * @slot - The title text. Links are underlined.
 */
export class TecAlertTitle extends TectonElement {
  static styles = [hostStyles, alertTitleStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The description of an alert: the cause and the fix.
 *
 * @tag tec-alert-description
 *
 * @slot - The description text or paragraphs. Links are underlined.
 */
export class TecAlertDescription extends TectonElement {
  static styles = [hostStyles, alertDescriptionStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-alert": TecAlert
    "tec-alert-title": TecAlertTitle
    "tec-alert-description": TecAlertDescription
  }
}
