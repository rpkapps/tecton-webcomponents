import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { markerContentStyles, markerIconStyles, markerStyles } from "./marker.styles.js"

export type MarkerVariant = "default" | "separator" | "border"

/**
 * A marker has no role by default. Choose it by intent: `role="status"` on a streaming or
 * in-progress marker ("Thinking…") so the update is announced; no role on a labelled separator
 * (never `role="separator"`, which would hide its text); `href` or `type="button"` for a marker that
 * links somewhere or runs an action (it then renders a real `<a>` / `<button>` named by its text).
 *
 * @summary Displays an inline status, a system note, a bordered row or a labelled separator in a
 * conversation.
 *
 * @tag tec-marker
 *
 * @slot - A `tec-marker-icon` and a `tec-marker-content`.
 *
 * @csspart base - The row (`<div>`, `<a>` with `href`, `<button>` with `type="button"`).
 * @csspart line - The two divider lines of the `separator` variant.
 *
 * @cssprop --tec-icon-size - Size of icons in the marker (1rem).
 */
export class TecMarker extends TectonElement {
  static styles = [hostStyles, markerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The layout: an inline row, a row with a bottom border, or a label between two lines. */
  @property({ reflect: true }) variant: MarkerVariant = "default"

  /** Renders the marker as a link to this URL. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  /** `button` renders the marker as a native `<button>` (listen for `click`). */
  @property({ reflect: true }) type?: "button"

  @query(".base") private control!: HTMLElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => (this.#interactive ? this.control : null) })
  }

  get #interactive(): boolean {
    return this.href !== undefined || this.type === "button"
  }

  /** Clicks the marker (a link navigates, a button fires `click`). */
  override click(): void {
    if (this.#interactive) this.control?.click()
    else super.click()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("variant")) {
      for (const part of this.querySelectorAll("tec-marker-content")) (part as TecMarkerContent).requestUpdate?.()
    }
  }

  protected override render() {
    const content = html`<span class="line start" part="line" aria-hidden="true"></span><slot></slot
      ><span class="line end" part="line" aria-hidden="true"></span>`
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
    if (this.type === "button") return html`<button class="base" part="base" type="button">${content}</button>`
    return html`<div class="base" part="base">${content}</div>`
  }
}

/**
 * Hidden from assistive technology: the `tec-marker-content` next to it carries the meaning. An
 * icon-only marker needs an `aria-label` on the `tec-marker`.
 *
 * @summary The decorative icon of a marker.
 * @tag tec-marker-icon
 * @slot - An icon (`<svg>`, `tec-icon`) or a `tec-spinner`.
 * @cssprop --tec-icon-size - Size of the icon (1rem).
 */
export class TecMarkerIcon extends TectonElement {
  static styles = [hostStyles, markerIconStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Add the `shimmer` utility class (`@tecton/wc/utilities.css`) for streaming text.
 *
 * @summary The text of a marker.
 * @tag tec-marker-content
 * @slot - The marker text; links inside are underlined.
 * @cssstate separator - The marker is a `separator` (the text does not shrink and is centred).
 */
export class TecMarkerContent extends TectonElement {
  static styles = [hostStyles, markerContentStyles]

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("separator", this.closest("tec-marker")?.getAttribute("variant") === "separator")
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.requestUpdate()
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-marker": TecMarker
    "tec-marker-icon": TecMarkerIcon
    "tec-marker-content": TecMarkerContent
  }
}
