import { html, nothing } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { countBadgeStyles } from "./count-badge.styles.js"

/** Fill colour; the names match the badge `variant`s. */
export type CountBadgeColor = "default" | "secondary" | "destructive" | "success" | "warning" | "info"
/** A number pill or an 8px dot. */
export type CountBadgeVariant = "standard" | "dot"
/** The corner of the wrapped element the badge sits on. */
export type CountBadgeAnchor = "top-right" | "top-left" | "bottom-right" | "bottom-left"


/**
 * The badge is decorative (`aria-hidden`): put the count in the wrapped control's accessible name
 * (`aria-label="Messages, 4 unread"`) so it is announced once, with the control.
 *
 * With `variant="standard"` the badge hides itself when there is nothing to show: no `count`, or a
 * count of 0 without `show-zero` (unless `content` is set). `invisible` hides it in every case while
 * the wrapped element stays.
 *
 * @summary A count or status dot anchored to the corner of an avatar, icon button or tab.
 *
 * @tag tec-count-badge
 *
 * @slot - The element the badge is anchored to (an icon button, an avatar, a tab).
 *
 * @csspart badge - The pill (or dot).
 *
 * @cssstate hidden - The badge is not shown (nothing to show, or `invisible`).
 */
export class TecCountBadge extends TectonElement {
  static styles = [hostStyles, countBadgeStyles]

  /** The number to display. Hidden when 0 unless `show-zero` is set. */
  @property({ type: Number }) count?: number

  /** Counts above `max` render as `${max}+`. */
  @property({ type: Number }) max = 99

  /** Show the badge when `count` is 0. */
  @property({ type: Boolean, attribute: "show-zero" }) showZero = false

  /** Text shown instead of the count (e.g. "New"). */
  @property() content?: string

  /** Hides the badge but keeps the wrapped element. */
  @property({ type: Boolean, reflect: true }) invisible = false

  /** The fill: `default`, `secondary`, `destructive`, `success`, `warning` or `info`. */
  @property({ reflect: true }) color: CountBadgeColor = "default"

  /** `standard` shows the number, `dot` an 8px status dot. */
  @property({ reflect: true }) variant: CountBadgeVariant = "standard"

  /** The corner the badge sits on. */
  @property({ reflect: true }) anchor: CountBadgeAnchor = "top-right"

  /** The text the badge shows (`""` for a dot or a hidden badge). */
  get label(): string {
    if (this.content != null) return this.content
    if (typeof this.count !== "number" || Number.isNaN(this.count)) return ""
    return this.count > this.max ? `${this.max}+` : String(this.count)
  }

  get #hidden(): boolean {
    if (this.invisible) return true
    if (this.variant !== "standard" || this.content != null) return false
    const count = this.count
    return typeof count !== "number" || Number.isNaN(count) || (count === 0 && !this.showZero)
  }

  protected override render() {
    const hidden = this.#hidden
    this.toggleState("hidden", hidden)
    return html`<slot></slot>${hidden
        ? nothing
        : html`<span class="badge" part="badge" aria-hidden="true">${this.variant === "standard" ? this.label : nothing}</span>`}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-count-badge": TecCountBadge
  }
}
