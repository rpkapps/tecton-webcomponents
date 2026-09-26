import { html, LitElement, nothing } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { ExternalLink } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { linkStyles } from "./link.styles.js"

/** Colour and underline behaviour. */
export type LinkVariant = "default" | "primary" | "muted" | "subtle"
/** Font size; `inherit` follows the surrounding text. */
export type LinkSize = "inherit" | "sm" | "md" | "lg"

/**
 * Renders a real `<a href>` in its shadow root (with `delegatesFocus`), so it is announced as a link,
 * opens in a new tab with the usual modifier keys and supports `target`, `rel` and `download`.
 * `aria-*` attributes on the host are forwarded to the anchor.
 *
 * With `external` the link opens in a new tab (`target="_blank"` unless `target` is set), always
 * gets `rel="noreferrer noopener"` (a `rel` you pass, e.g. `nofollow`, is added to it) and shows an
 * external-link icon plus a visually hidden "(opens in a new tab)" hint.
 *
 * @summary An inline text link with default, primary, muted and subtle variants and an external-link marker.
 *
 * @tag tec-link
 *
 * @slot - The link text (name the destination, never "click here").
 *
 * @csspart base - The native `<a>`.
 * @csspart external-icon - The external-link icon (with `external`).
 */
export class TecLink extends TectonElement {
  static styles = [hostStyles, srOnly, linkStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The destination. Always set it: without `href` there is no link. */
  @property({ reflect: true }) href?: string

  /** Where to open the link. Defaults to `_blank` with `external`. */
  @property() target?: string

  /** Link relationship. With `external`, added to `noreferrer noopener`. */
  @property() rel?: string

  /** Download the target instead of navigating (optionally with a file name). */
  @property() download?: string

  /** Colour and underline: `default` (foreground, underline on hover), `primary`, `muted`, `subtle` (always underlined). */
  @property({ reflect: true }) variant: LinkVariant = "default"

  /** Font size. `inherit` (default) follows the surrounding text. */
  @property({ reflect: true }) size: LinkSize = "inherit"

  /** Opens in a new tab, adds `noreferrer noopener` and shows the external-link icon. */
  @property({ type: Boolean, reflect: true }) external = false

  /** Disables the link: no navigation, not focusable, dimmed. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Visually hidden hint appended to external links' accessible name. */
  @property({ attribute: "external-label" }) externalLabel = "(opens in a new tab)"

  /** The inner `<a>`. */
  @query(".base") readonly anchor!: HTMLAnchorElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.anchor })
  }

  /** Clicks the inner anchor (follows the link). */
  override click(): void {
    this.anchor?.click()
  }

  /** The `rel` that is rendered. */
  get #rel(): string | undefined {
    return [this.external && "noreferrer noopener", this.rel].filter(Boolean).join(" ") || undefined
  }

  protected override render() {
    const disabled = this.disabled
    return html`<a
      class="base"
      part="base"
      href=${ifDefined(disabled ? undefined : this.href)}
      target=${ifDefined(this.target ?? (this.external ? "_blank" : undefined))}
      rel=${ifDefined(this.#rel)}
      download=${ifDefined(this.download)}
      role=${disabled ? "link" : nothing}
      aria-disabled=${disabled ? "true" : nothing}
      ><slot></slot>${this.external
        ? html`${icon(ExternalLink, { class: "external", part: "external-icon" })}<span class="sr-only"> ${this.externalLabel}</span>`
        : nothing}</a
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-link": TecLink
  }
}
