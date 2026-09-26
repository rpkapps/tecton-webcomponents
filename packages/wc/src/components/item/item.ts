import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { focusRing, hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { LightDomObserver } from "../card/light-dom-observer.js"
import {
  itemActionsStyles,
  itemContentStyles,
  itemDescriptionStyles,
  itemGroupStyles,
  itemHeaderFooterStyles,
  itemMediaStyles,
  itemSeparatorStyles,
  itemStyles,
  itemTitleStyles,
  itemTransitionStyles,
} from "./item.styles.js"

export type ItemVariant = "default" | "outline" | "muted"
export type ItemSize = "default" | "sm" | "xs"
export type ItemMediaVariant = "default" | "icon" | "image"

/**
 * A flex row for one record: `tec-item-media`, `tec-item-content` (with `tec-item-title` and
 * `tec-item-description`), `tec-item-actions`, and full-width `tec-item-header` / `tec-item-footer`.
 *
 * With `href` the whole row is a real `<a>` in the shadow root (focusable, hover background, opens in
 * a new tab with the usual modifier keys). A linked row holds no other buttons or links. Without
 * `href` it is a static container — never make it clickable with a `click` listener.
 * Inside a `tec-item-group` it is a `listitem`.
 *
 * @summary A versatile component for displaying content with media, title, description, and actions.
 *
 * @tag tec-item
 *
 * @slot - The parts of the item.
 *
 * @csspart base - The row: a `<div>`, or the `<a>` when `href` is set. Border, padding, radius and background.
 *
 * @cssstate has-description - The item contains a `tec-item-description` (media aligns to the top).
 * @cssstate link - The item is a link (`href`).
 */
export class TecItem extends TectonElement {
  static styles = [hostStyles, itemStyles, itemTransitionStyles, focusRing(".base")]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The visual style: transparent, bordered, or a muted background. */
  @property({ reflect: true }) variant: ItemVariant = "default"

  /** The density (gap and padding). Media, content and description follow it. */
  @property({ reflect: true }) size: ItemSize = "default"

  /** Makes the whole item a link. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  /** Link `download` (with `href`). */
  @property() download?: string

  /** The inner `<a>` or `<div>`. */
  @query(".base") readonly base!: HTMLElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => (this.href !== undefined ? this.base : null) })
    new LightDomObserver(this, () => this.#syncChildren(), { childList: true, subtree: true })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = this.parentElement?.localName === "tec-item-group" ? "listitem" : null
  }

  /** Focuses the link (with `href`). */
  override focus(options?: FocusOptions): void {
    if (this.href !== undefined) this.base?.focus(options)
    else super.focus(options)
  }

  /** Clicks the link (with `href`). */
  override click(): void {
    if (this.href !== undefined) this.base?.click()
    else super.click()
  }

  #syncChildren(): void {
    this.toggleState("has-description", !!this.querySelector("tec-item-description"))
    for (const content of this.querySelectorAll<TecItemContent>(":scope > tec-item-content")) content.requestUpdate()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("link", this.href !== undefined)
  }

  protected override render() {
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${this.href}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        download=${ifDefined(this.download)}
        ><slot></slot
      ></a>`
    }
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Exposed as a `list` of its items. Name it with its visible heading (`aria-labelledby`) or an
 * `aria-label`. The gap tightens when the items use `size="sm"` or `size="xs"`; layout utilities
 * on it (`class="grid grid-cols-3 gap-4"`) replace the column.
 *
 * @summary A list of related items with consistent spacing.
 *
 * @tag tec-item-group
 *
 * @slot - `tec-item` and `tec-item-separator` elements.
 *
 * @cssstate has-sm - An item uses `size="sm"`.
 * @cssstate has-xs - An item uses `size="xs"`.
 */
export class TecItemGroup extends TectonElement {
  static styles = [hostStyles, itemGroupStyles]

  constructor() {
    super()
    new LightDomObserver(
      this,
      () => {
        this.toggleState("has-sm", !!this.querySelector("tec-item[size=sm]"))
        this.toggleState("has-xs", !!this.querySelector("tec-item[size=xs]"))
      },
      { childList: true, subtree: true, attributes: true, attributeFilter: ["size"] }
    )
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Decorative inside a `tec-item-group` (the list's items carry the structure); a `separator`
 * elsewhere.
 *
 * @summary A horizontal rule between items.
 *
 * @tag tec-item-separator
 *
 * @csspart base - The 1px line (with its vertical margin).
 */
export class TecItemSeparator extends TectonElement {
  static styles = [hostStyles, itemSeparatorStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = this.parentElement?.localName === "tec-item-group" ? "none" : "separator"
  }

  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

/**
 * `variant="icon"` sizes a slotted icon to 16px; `variant="image"` crops a slotted `<img>` into a
 * square that follows the item size (40 / 32 / 24px). Put an avatar in the default variant. When
 * the item has a description, the media aligns with the title.
 *
 * @summary The leading media of an item: an icon, an image or an avatar.
 *
 * @tag tec-item-media
 *
 * @slot - The icon, image or avatar.
 */
export class TecItemMedia extends TectonElement {
  static styles = [hostStyles, itemMediaStyles]

  /** How the media is sized. */
  @property({ reflect: true }) variant: ItemMediaVariant = "default"

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A column that takes the remaining width. A second `tec-item-content` right after another one takes
 * only its own width (a trailing duration or amount).
 *
 * @summary Wraps the title and description of an item.
 *
 * @tag tec-item-content
 *
 * @slot - `tec-item-title` and `tec-item-description`.
 *
 * @cssstate after-content - It follows another `tec-item-content` (no flex growth).
 */
export class TecItemContent extends TectonElement {
  static styles = [hostStyles, itemContentStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.requestUpdate()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("after-content", this.previousElementSibling?.localName === "tec-item-content")
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The title of an item.
 *
 * @tag tec-item-title
 *
 * @slot - The title text (and inline badges or icons).
 */
export class TecItemTitle extends TectonElement {
  static styles = [hostStyles, itemTitleStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Clamped to two lines; smaller in `size="xs"` items. Links inside are underlined.
 *
 * @summary The description of an item.
 *
 * @tag tec-item-description
 *
 * @slot - The description text.
 */
export class TecItemDescription extends TectonElement {
  static styles = [hostStyles, itemDescriptionStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary A row of actions (buttons, a switch, a chevron) at the end of an item.
 *
 * @tag tec-item-actions
 *
 * @slot - The actions.
 */
export class TecItemActions extends TectonElement {
  static styles = [hostStyles, itemActionsStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Takes the full width of the item, above the other parts (e.g. a cover image).
 *
 * @summary A full-width header row of an item.
 *
 * @tag tec-item-header
 *
 * @slot - The header content.
 */
export class TecItemHeader extends TectonElement {
  static styles = [hostStyles, itemHeaderFooterStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Takes the full width of the item, below the other parts.
 *
 * @summary A full-width footer row of an item.
 *
 * @tag tec-item-footer
 *
 * @slot - The footer content.
 */
export class TecItemFooter extends TectonElement {
  static styles = [hostStyles, itemHeaderFooterStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-item": TecItem
    "tec-item-group": TecItemGroup
    "tec-item-separator": TecItemSeparator
    "tec-item-media": TecItemMedia
    "tec-item-content": TecItemContent
    "tec-item-title": TecItemTitle
    "tec-item-description": TecItemDescription
    "tec-item-actions": TecItemActions
    "tec-item-header": TecItemHeader
    "tec-item-footer": TecItemFooter
  }
}
