import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  cardActionStyles,
  cardContentStyles,
  cardDescriptionStyles,
  cardFooterStyles,
  cardHeaderStyles,
  cardStyles,
  cardTitleStyles,
} from "./card.styles.js"
import { LightDomObserver } from "./light-dom-observer.js"

export type CardSize = "default" | "sm"

/**
 * A card is a static surface: it has no role and takes no focus. Compose it from
 * `tec-card-header` (with `tec-card-title`, `tec-card-description` and `tec-card-action`),
 * `tec-card-content` and `tec-card-footer`. An `<img>` placed first sits flush with the top edge.
 *
 * The card sets `--tec-card-spacing` on itself (1.5rem, 1rem with `size="sm"`): it is the gap
 * between the parts, the card's block padding and the inline inset of every part. Override it on the
 * card (`style="--tec-card-spacing: 2rem"`), and use it in your own content to bleed to the edges
 * (`class="-mx-(--tec-card-spacing)"`).
 *
 * @summary Displays a card with header, content, and footer.
 *
 * @tag tec-card
 *
 * @slot - The card parts (`tec-card-header`, `tec-card-content`, `tec-card-footer`) and media such as an `<img>`.
 *
 * @csspart base - The card surface: background, ring, radius and block padding.
 *
 * @cssprop --tec-card-spacing - Gap between the parts, block padding of the card and inline inset of the parts (1.5rem; 1rem for `size="sm"`).
 *
 * @cssstate image-first - The first child is an `<img>`: the top padding is removed.
 */
export class TecCard extends TectonElement {
  static styles = [hostStyles, cardStyles]

  /** The density: `sm` uses 16px spacing and a smaller title. */
  @property({ reflect: true }) size: CardSize = "default"

  constructor() {
    super()
    new LightDomObserver(this, () => this.toggleState("image-first", this.firstElementChild?.localName === "img"))
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Lays out the title and description, with a `tec-card-action` in a second column when present.
 * It is a size container (`container: card-header / inline-size`), so content can use container
 * queries. With a bottom border (`class="border-b border-border"`) it adds the matching padding.
 *
 * @summary The header of a card: title, description and an optional action.
 *
 * @tag tec-card-header
 *
 * @slot - `tec-card-title`, `tec-card-description` and `tec-card-action`.
 *
 * @cssstate has-action - A `tec-card-action` is present (two columns).
 * @cssstate has-description - A `tec-card-description` is present (two rows).
 */
export class TecCardHeader extends TectonElement {
  static styles = [hostStyles, cardHeaderStyles]

  constructor() {
    super()
    new LightDomObserver(this, () => {
      this.toggleState("has-action", !!this.querySelector(":scope > tec-card-action"))
      this.toggleState("has-description", !!this.querySelector(":scope > tec-card-description"))
    })
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Plain text by default. Set `level` to expose it as a heading of that level (or put an `<h2>`… inside).
 *
 * @summary The title of a card.
 *
 * @tag tec-card-title
 *
 * @slot - The title text.
 */
export class TecCardTitle extends TectonElement {
  static styles = [hostStyles, cardTitleStyles]

  /** Exposes the title as a heading of this level (1–6) to assistive technology. */
  @property({ type: Number, reflect: true }) level?: number

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("level")) {
      const level = this.level && this.level >= 1 && this.level <= 6 ? Math.round(this.level) : null
      this.internals.role = level ? "heading" : null
      this.internals.ariaLevel = level ? String(level) : null
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary Helper text under the card title.
 *
 * @tag tec-card-description
 *
 * @slot - The description text.
 */
export class TecCardDescription extends TectonElement {
  static styles = [hostStyles, cardDescriptionStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary Content placed at the end of the card header, spanning the title and description rows (a button, a badge).
 *
 * @tag tec-card-action
 *
 * @slot - The action.
 */
export class TecCardAction extends TectonElement {
  static styles = [hostStyles, cardActionStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A flex column (0.75rem gap) inset by `--tec-card-spacing`. Layout utilities on it apply to its
 * children.
 *
 * @summary The main body of a card.
 *
 * @tag tec-card-content
 *
 * @slot - The content.
 */
export class TecCardContent extends TectonElement {
  static styles = [hostStyles, cardContentStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A flex row (items centred) inset by `--tec-card-spacing`; add `class="flex-col gap-2"` to stack
 * buttons. With a top border (`class="border-t border-border"`) it adds the matching padding.
 *
 * @summary Actions and secondary content at the bottom of a card.
 *
 * @tag tec-card-footer
 *
 * @slot - The footer content.
 */
export class TecCardFooter extends TectonElement {
  static styles = [hostStyles, cardFooterStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-card": TecCard
    "tec-card-header": TecCardHeader
    "tec-card-title": TecCardTitle
    "tec-card-description": TecCardDescription
    "tec-card-action": TecCardAction
    "tec-card-content": TecCardContent
    "tec-card-footer": TecCardFooter
  }
}
