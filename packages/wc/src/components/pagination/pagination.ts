import { html, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecButton } from "../button/button.js"
import {
  paginationContentStyles,
  paginationEllipsisStyles,
  paginationItemStyles,
  paginationStepStyles,
  paginationStyles,
} from "./pagination.styles.js"

/**
 * The host is a `navigation` landmark named "pagination" (rename it with `aria-label`). It centres
 * its content across the full width; `class="w-auto"` lets it sit beside other controls.
 *
 * @summary Pagination with page navigation, next and previous links.
 *
 * @tag tec-pagination
 *
 * @slot - A `tec-pagination-content`.
 */
export class TecPagination extends TectonElement {
  static styles = [hostStyles, paginationStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "navigation"
    this.internals.ariaLabel = "pagination"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The list (`role="list"`) of pagination items.
 *
 * @tag tec-pagination-content
 *
 * @slot - `tec-pagination-item`s.
 */
export class TecPaginationContent extends TectonElement {
  static styles = [hostStyles, paginationContentStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary One control of the pagination (`role="listitem"`).
 *
 * @tag tec-pagination-item
 *
 * @slot - A `tec-pagination-link`, `tec-pagination-previous`, `tec-pagination-next` or `tec-pagination-ellipsis`.
 */
export class TecPaginationItem extends TectonElement {
  static styles = [hostStyles, paginationItemStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "listitem"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `tec-button` link: `ghost`, or `outline` with `aria-current="page"` when `active`. It is square
 * (`size="icon"`) by default, for page numbers. Give it an `href`: a page is a URL.
 *
 * @summary A link to one page.
 *
 * @tag tec-pagination-link
 *
 * @slot - The page number.
 *
 * @csspart base - The inner `<a>` (or `<button>` without `href`).
 *
 * @cssstate active - This is the current page.
 */
export class TecPaginationLink extends TecButton {
  /** Marks the current page: the `outline` look and `aria-current="page"`. The `variant` follows it. */
  @property({ type: Boolean, reflect: true }) active = false

  constructor() {
    super()
    this.size = "icon"
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.variant = this.active ? "outline" : "ghost"
    this.toggleState("active", this.active)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const control = this.control
    if (!control || this.hasAttribute("aria-current")) return
    if (this.active) control.setAttribute("aria-current", "page")
    else control.removeAttribute("aria-current")
  }
}

/**
 * Shared rendering of Previous / Next (chevron + label hidden on small screens).
 * @hideInherited download - a page link is never a download.
 */
abstract class PaginationStep extends TecPaginationLink {
  static override styles = [...TecButton.styles, paginationStepStyles]

  /** The visible label (hidden below 640px). */
  abstract text: string
  /** The accessible name of the link. */
  abstract label: string

  constructor() {
    super()
    this.size = "default"
  }

  protected abstract content(): TemplateResult

  protected override render() {
    const content = this.content()
    const disabled = this.disabled
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${ifDefined(disabled ? undefined : this.href)}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        role=${disabled ? "link" : nothing}
        aria-disabled=${disabled ? "true" : nothing}
        aria-label=${this.label}
        >${content}</a
      >`
    }
    return html`<button class="base" part="base" type="button" ?disabled=${disabled} aria-label=${this.label}>${content}</button>`
  }
}

/**
 * A chevron and "Previous" (the label is hidden below 640px; the link keeps its accessible name
 * "Go to previous page"). The chevron mirrors in right-to-left layouts. `disabled` on the first page.
 *
 * @summary A link to the previous page.
 *
 * @tag tec-pagination-previous
 *
 * @csspart base - The inner `<a>` (or `<button>` without `href`).
 */
export class TecPaginationPrevious extends PaginationStep {
  /** The visible label (hidden below 640px). */
  @property() text = "Previous"
  /** The accessible name of the link. */
  @property() label = "Go to previous page"

  protected content() {
    return html`${icon(ChevronLeft, { size: 16, class: "chevron" })}<span class="text">${this.text}</span>`
  }
}

/**
 * "Next" and a chevron (the label is hidden below 640px; the link keeps its accessible name
 * "Go to next page"). The chevron mirrors in right-to-left layouts. `disabled` on the last page.
 *
 * @summary A link to the next page.
 *
 * @tag tec-pagination-next
 *
 * @csspart base - The inner `<a>` (or `<button>` without `href`).
 */
export class TecPaginationNext extends PaginationStep {
  /** The visible label (hidden below 640px). */
  @property() text = "Next"
  /** The accessible name of the link. */
  @property() label = "Go to next page"

  protected content() {
    return html`<span class="text">${this.text}</span>${icon(ChevronRight, { size: 16, class: "chevron" })}`
  }
}

/**
 * Decorative (hidden from assistive technology).
 *
 * @summary An ellipsis standing for pages that are not listed.
 *
 * @tag tec-pagination-ellipsis
 */
export class TecPaginationEllipsis extends TectonElement {
  static styles = [hostStyles, paginationEllipsisStyles]

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
    "tec-pagination": TecPagination
    "tec-pagination-content": TecPaginationContent
    "tec-pagination-item": TecPaginationItem
    "tec-pagination-link": TecPaginationLink
    "tec-pagination-previous": TecPaginationPrevious
    "tec-pagination-next": TecPaginationNext
    "tec-pagination-ellipsis": TecPaginationEllipsis
  }
}
