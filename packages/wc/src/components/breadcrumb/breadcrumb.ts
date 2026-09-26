import { html, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { ChevronRight, MoreHorizontal } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  breadcrumbEllipsisStyles,
  breadcrumbItemStyles,
  breadcrumbLinkStyles,
  breadcrumbListStyles,
  breadcrumbPageStyles,
  breadcrumbSeparatorStyles,
  breadcrumbStyles,
} from "./breadcrumb.styles.js"

/**
 * The host is a `navigation` landmark named "breadcrumb" (change the name with `aria-label`, e.g.
 * for another language). Put one `tec-breadcrumb-list` inside.
 *
 * @summary Displays the path to the current resource using a hierarchy of links.
 *
 * @tag tec-breadcrumb
 *
 * @slot - A `tec-breadcrumb-list`.
 */
export class TecBreadcrumb extends TectonElement {
  static styles = [hostStyles, breadcrumbStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "navigation"
    this.internals.ariaLabel = "breadcrumb"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * An ordered list (`role="list"`) of `tec-breadcrumb-item`s. The last item is the current page: it
 * draws no separator and marks its link `aria-current="page"`.
 *
 * @summary The ordered list of breadcrumb items.
 *
 * @tag tec-breadcrumb-list
 *
 * @slot - `tec-breadcrumb-item`s, optionally with `tec-breadcrumb-separator`s between them (then the
 * items draw no separators of their own).
 */
export class TecBreadcrumbList extends TectonElement {
  static styles = [hostStyles, breadcrumbListStyles]

  #observer = new MutationObserver(() => this.#syncItems())

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
    this.#observer.observe(this, { childList: true })
    this.#syncItems()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #syncItems(): void {
    for (const item of this.querySelectorAll<TecBreadcrumbItem>(":scope > tec-breadcrumb-item")) item.requestUpdate()
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.#syncItems()}></slot>`
  }
}

/**
 * A list item (`role="listitem"`). It draws a chevron separator after its content, except in the last
 * item (the current page) or when the list contains explicit `tec-breadcrumb-separator`s. Put a custom
 * separator in `slot="separator"`. The chevron mirrors in right-to-left layouts.
 *
 * @summary One level of the breadcrumb trail.
 *
 * @tag tec-breadcrumb-item
 *
 * @slot - A `tec-breadcrumb-link`, `tec-breadcrumb-page`, `tec-breadcrumb-ellipsis` or a menu trigger.
 * @slot separator - A custom separator for this item (replaces the chevron).
 *
 * @csspart separator - The separator after the item (hidden in the current item).
 *
 * @cssstate current - This is the last item: the current page.
 */
export class TecBreadcrumbItem extends TectonElement {
  static styles = [hostStyles, breadcrumbItemStyles]

  /** Whether this is the last item of its list (the current page). */
  get current(): boolean {
    const parent = this.parentElement
    if (!parent) return false
    const items = parent.querySelectorAll(":scope > tec-breadcrumb-item")
    return items[items.length - 1] === this
  }

  get #autoSeparator(): boolean {
    return !this.current && !this.parentElement?.querySelector(":scope > tec-breadcrumb-separator")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "listitem"
    this.toggleState("current", this.current)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const current = this.current
    for (const link of this.querySelectorAll<TecBreadcrumbLink>(":scope > tec-breadcrumb-link")) link.current = current
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.requestUpdate()}></slot>${this.#autoSeparator
        ? html`<span class="separator" part="separator" role="presentation" aria-hidden="true"
            ><slot name="separator">${icon(ChevronRight, { size: 14 })}</slot></span
          >`
        : nothing}`
  }
}

/**
 * Place it between `tec-breadcrumb-item`s to use your own separators; as soon as the list contains
 * one, the items stop drawing theirs. Without content it draws the chevron (mirrored in RTL).
 * It is decorative (hidden from assistive technology).
 *
 * @summary A separator between breadcrumb items.
 *
 * @tag tec-breadcrumb-separator
 *
 * @slot - The separator glyph (default: a chevron). Slotted SVGs are sized to 0.875rem.
 */
export class TecBreadcrumbSeparator extends TectonElement {
  static styles = [hostStyles, breadcrumbSeparatorStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "presentation"
    this.internals.ariaHidden = "true"
  }

  protected override render() {
    return html`<slot>${icon(ChevronRight, { size: 14 })}</slot>`
  }
}

/**
 * With `href` it renders a real `<a>` (routers that intercept link clicks see it in
 * `event.composedPath()`). Without `href` it only styles its content, so you can slot the `<a>` your
 * routing library renders. In the last item the link is marked `aria-current="page"` and disabled.
 * ARIA attributes on the host are delegated to the inner link.
 *
 * @summary A link to an ancestor page in the breadcrumb.
 *
 * @tag tec-breadcrumb-link
 *
 * @slot - The label (and an optional leading icon). Or an `<a>` element when the host has no `href`.
 *
 * @csspart base - The inner `<a>` (or `<span>` without `href`).
 */
export class TecBreadcrumbLink extends TectonElement {
  static styles = [hostStyles, breadcrumbLinkStyles]

  /** The URL. Without it, slot your own `<a>`. */
  @property({ reflect: true }) href?: string

  /** Link target. */
  @property() target?: string

  /** Link `rel` (defaults to `noreferrer noopener` with `target="_blank"`). */
  @property() rel?: string

  /** Set by the breadcrumb item: the link points to the current page (`aria-current="page"`, not followed). */
  @property({ type: Boolean, reflect: true }) current = false

  /** The inner `<a>`/`<span>`. */
  @query(".base") readonly control!: HTMLElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: ["aria-current"] })
  }

  protected override render() {
    if (this.href === undefined) return html`<span class="base" part="base"><slot></slot></span>`
    return html`<a
      class="base"
      part="base"
      href=${ifDefined(this.current ? undefined : this.href)}
      target=${ifDefined(this.current ? undefined : this.target)}
      rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
      role=${this.current ? "link" : nothing}
      aria-current=${this.current ? "page" : nothing}
      aria-disabled=${this.current ? "true" : nothing}
      ><slot></slot></a>`
  }
}

/**
 * Not a link: the host is exposed as a disabled link with `aria-current="page"`, the pattern assistive
 * technology announces as "current page".
 *
 * @summary The current page, at the end of the breadcrumb.
 *
 * @tag tec-breadcrumb-page
 *
 * @slot - The page title (and an optional leading icon).
 */
export class TecBreadcrumbPage extends TectonElement {
  static styles = [hostStyles, breadcrumbPageStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "link"
    this.internals.ariaDisabled = "true"
    this.internals.ariaCurrent = "page"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Decorative (hidden from assistive technology): when it sits in a menu trigger, label the trigger
 * (`aria-label="Show more"`).
 *
 * @summary An ellipsis standing for collapsed breadcrumb levels.
 *
 * @tag tec-breadcrumb-ellipsis
 */
export class TecBreadcrumbEllipsis extends TectonElement {
  static styles = [hostStyles, breadcrumbEllipsisStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "presentation"
    this.internals.ariaHidden = "true"
  }

  protected override render() {
    return icon(MoreHorizontal, { size: 16 })
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-breadcrumb": TecBreadcrumb
    "tec-breadcrumb-list": TecBreadcrumbList
    "tec-breadcrumb-item": TecBreadcrumbItem
    "tec-breadcrumb-separator": TecBreadcrumbSeparator
    "tec-breadcrumb-link": TecBreadcrumbLink
    "tec-breadcrumb-page": TecBreadcrumbPage
    "tec-breadcrumb-ellipsis": TecBreadcrumbEllipsis
  }
}
