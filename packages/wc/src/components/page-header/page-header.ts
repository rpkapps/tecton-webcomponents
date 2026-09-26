import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecOverflow } from "../overflow/overflow.js"

const headerStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    column-gap: 1.5rem;
    row-gap: 0.75rem;
    min-width: 0;
  }
  /* Beside the actions the content keeps its natural width up to 60% of the header. */
  :host(:state(has-actions)) ::slotted(tec-page-header-content) {
    flex: 0 1 auto;
    max-width: 60%;
  }
`

/**
 * One row at every width: the actions collapse (labels to icons, then into a More menu), so the
 * header never needs to stack. The content keeps its natural width up to 60% of the header while
 * there are actions; the actions get the rest.
 *
 * @summary The title block at the top of a page: eyebrow, title, description, section tabs and actions.
 *
 * @tag tec-page-header
 *
 * @slot - A `tec-page-header-content` and a `tec-page-header-actions`.
 *
 * @cssstate has-actions - The header has a `tec-page-header-actions`.
 */
export class TecPageHeader extends TectonElement {
  static styles = [hostStyles, headerStyles]

  #sync = () => {
    this.toggleState("has-actions", !!this.querySelector(":scope > tec-page-header-actions"))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#sync()
  }

  protected override render() {
    return html`<slot @slotchange=${this.#sync}></slot>`
  }
}

/**
 * @summary The text column of a page header: eyebrow, title and description.
 *
 * @tag tec-page-header-content
 *
 * @slot - `tec-page-header-eyebrow`, `tec-page-header-title`, `tec-page-header-description`.
 */
export class TecPageHeaderContent extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        flex: 1 1 0%;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }
    `,
  ]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary A breadcrumb or category above the page title.
 *
 * @tag tec-page-header-eyebrow
 *
 * @slot - The eyebrow (text, links, a breadcrumb).
 */
export class TecPageHeaderEyebrow extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        font-size: var(--tec-text-xs);
        line-height: var(--tec-text-xs--line-height);
        color: var(--tec-muted-foreground);
      }
    `,
  ]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * The page's heading (level 1 by default; one per page). It truncates on one line.
 *
 * @summary The page title.
 *
 * @tag tec-page-header-title
 *
 * @slot - The title (and e.g. a status badge).
 */
export class TecPageHeaderTitle extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--tec-text-2xl);
        line-height: 1.25;
        font-weight: 500;
        letter-spacing: -0.025em;
      }
    `,
  ]

  /** Heading level exposed to assistive technology. */
  @property({ type: Number }) level = 1

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "heading"
    this.internals.ariaLevel = String(this.level)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary A sentence under the page title.
 *
 * @tag tec-page-header-description
 *
 * @slot - The description.
 */
export class TecPageHeaderDescription extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        max-width: 65ch;
        font-size: var(--tec-text-sm);
        line-height: var(--tec-text-sm--line-height);
        color: var(--tec-muted-foreground);
      }
    `,
  ]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "paragraph"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `navigation` landmark: give it an `aria-label`. Between the title and the actions it keeps its
 * natural width; wrapped in a `tec-overflow-item` inside `tec-page-header-actions` it moves into the
 * More menu as a whole (a labelled section of radio items) when its priority is reached.
 *
 * @summary The section tabs of a page.
 *
 * @tag tec-page-header-nav
 *
 * @slot - The section tabs (`tec-tabs`).
 */
export class TecPageHeaderNav extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        align-self: center;
        min-width: 0;
      }
    `,
  ]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "navigation"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A plain overflow row (not a toolbar, so a tab list inside keeps its own arrow keys) at the end of
 * the header. Wrap secondary actions in `tec-overflow-item` and leave the primary action bare; put
 * section tabs first, then a `tec-overflow-spacer`, then the actions, so tabs and actions share one
 * row and priorities decide who leaves first. Accepts every `tec-overflow` attribute.
 *
 * @summary The page header's actions: an overflow row.
 *
 * @tag tec-page-header-actions
 *
 * @slot - `tec-overflow-item`s, spacers, dividers and fixed controls.
 * @slot menu-trigger - A custom More button.
 *
 * @csspart menu - The wrapper of the More button.
 * @csspart menu-trigger - The default More button.
 * @csspart menu-badge - The count badge on the More button.
 * @csspart menu-content - The More menu.
 * @csspart submenu - A submenu in the More menu.
 * @csspart menu-item - A menu entry.
 *
 * @cssprop --tec-overflow-gap - Gap between the items (default 0.5rem).
 *
 * @cssstate overflowing - At least one item is in the More menu.
 * @cssstate compact - Labels are collapsed.
 *
 * @fires tec-overflow-change - The set of items in the More menu changed. `detail: { hidden }`.
 */
export class TecPageHeaderActions extends TecOverflow {
  static styles = [
    ...TecOverflow.styles,
    css`
      :host {
        flex: 1 1 0%;
        justify-content: flex-end;
      }
    `,
  ]
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-page-header": TecPageHeader
    "tec-page-header-content": TecPageHeaderContent
    "tec-page-header-eyebrow": TecPageHeaderEyebrow
    "tec-page-header-title": TecPageHeaderTitle
    "tec-page-header-description": TecPageHeaderDescription
    "tec-page-header-nav": TecPageHeaderNav
    "tec-page-header-actions": TecPageHeaderActions
  }
}
