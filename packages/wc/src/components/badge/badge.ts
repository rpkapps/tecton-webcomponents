import { html, LitElement } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { badgeStyles } from "./badge.styles.js"

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"
  | "success"
  | "warning"
  | "info"
export type BadgeAppearance = "solid" | "outline"
export type BadgeSize = "default" | "md" | "lg"

/**
 * A static label for a status, a category or a state. It has no role and is not focusable; with
 * `href` it renders a real link (`<a>`) styled as a badge, and ARIA set on the host (`aria-label`,
 * `aria-current` …) is forwarded to that link.
 *
 * For a label the user can select or remove, use `tec-chip`, which shares these styles
 * (`badgeStyles` from `@tecton/wc/badge/badge.styles.js`).
 *
 * @summary Displays a badge or a link that looks like a badge.
 *
 * @tag tec-badge
 *
 * @slot - The label. A `tec-spinner` or an icon may be placed here too.
 * @slot start - A leading icon or `tec-spinner` (trims the leading padding).
 * @slot end - A trailing icon or `tec-spinner` (trims the trailing padding).
 *
 * @csspart base - The badge box (a `<span>`, or an `<a>` with `href`).
 *
 * @cssprop --tec-badge-radius - Corner radius (default `--tec-radius-4xl`, a pill).
 * @cssprop --tec-icon-size - Size of slotted icons and spinners (12px; 14px for `md`, 16px for `lg`).
 *
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 * @cssstate focus-visible - The link badge has keyboard focus.
 */
export class TecBadge extends TectonElement {
  static styles = [hostStyles, badgeStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The meaning and colour: `default`, `secondary`, `outline`, `ghost`, `link`, or a status (`success`, `warning`, `info`, `destructive`). */
  @property({ reflect: true }) variant: BadgeVariant = "default"

  /** The weight: `solid` (filled) or `outline` (transparent with a coloured border and text). */
  @property({ reflect: true }) appearance: BadgeAppearance = "solid"

  /** The height: `default` (20px), `md` (24px) or `lg` (28px). */
  @property({ reflect: true }) size: BadgeSize = "default"

  /** Renders the badge as a link to this URL. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  /** @internal */
  @query(".base") readonly control!: HTMLElement

  constructor() {
    super()
    new HasSlotController(this, "start", "end", { states: true })
    new AriaDelegateController(this, { target: () => (this.href !== undefined ? this.control : null) })
    new FocusVisibleController(this)
  }

  protected override render() {
    const content = html`<slot name="start"></slot><slot></slot><slot name="end"></slot>`
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${this.href}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        >${content}</a
      >`
    }
    return html`<span class="base" part="base">${content}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-badge": TecBadge
  }
}
