import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { bubbleContentStyles, bubbleGroupStyles, bubbleReactionsStyles, bubbleStyles } from "./bubble.styles.js"

export type BubbleVariant = "default" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive"
export type BubbleAlign = "start" | "end"
export type BubbleReactionsSide = "top" | "bottom"

/**
 * @summary Groups consecutive bubbles from the same sender.
 * @tag tec-bubble-group
 * @slot - `tec-bubble` elements.
 */
export class TecBubbleGroup extends TectonElement {
  static styles = [hostStyles, bubbleGroupStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * The bubble sizes to its content, up to 80% of the row (the `ghost` variant spans the full row).
 * Put the text in a `tec-bubble-content`: every variant paints that part, not the bubble itself.
 * Inside an end-aligned `tec-message` the bubble follows the message side on its own.
 *
 * @summary Displays conversational content in a message bubble.
 *
 * @tag tec-bubble
 *
 * @slot - A `tec-bubble-content`, optionally followed by `tec-bubble-reactions`.
 *
 * @cssstate end - The bubble is aligned to the end (`align="end"`).
 */
export class TecBubble extends TectonElement {
  static styles = [hostStyles, bubbleStyles]

  /** The visual treatment of the surface. */
  @property({ reflect: true }) variant: BubbleVariant = "default"

  /**
   * Aligns the bubble to the start or end of the conversation. (Not reflected: an `align` attribute
   * is a legacy presentational hint for text-align, which the element neutralises.)
   */
  @property() align: BubbleAlign = "start"

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("end", this.align === "end")
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * By default the content is a plain block. Set `href` to render a real link, or `type="button"` to
 * render a native button (listen for `click`): the surface gets hover and focus-visible styles and is
 * named by its text.
 *
 * @summary The surface of a bubble: the message text or rich content.
 *
 * @tag tec-bubble-content
 *
 * @slot - The message content.
 *
 * @csspart base - The surface (`<div>`, `<a>` with `href`, `<button>` with `type="button"`).
 */
export class TecBubbleContent extends TectonElement {
  static styles = [hostStyles, bubbleContentStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Renders the surface as a link to this URL. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  /** `button` renders the surface as a native `<button>` (a quick reply, a suggestion). */
  @property({ reflect: true }) type?: "button"

  @query(".base") private control!: HTMLElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => (this.href !== undefined || this.type === "button" ? this.control : null) })
  }

  /** Clicks the surface (a link navigates, a button fires `click`). */
  override click(): void {
    if (this.href !== undefined || this.type === "button") this.control?.click()
    else super.click()
  }

  protected override render() {
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${this.href}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        ><slot></slot
      ></a>`
    }
    if (this.type === "button") return html`<button class="base" part="base" type="button"><slot></slot></button>`
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * The row overlaps the bubble edge, so leave vertical space between bubbles that carry reactions.
 * A static row of emoji reads glyph by glyph: give it `role="img"` and an `aria-label`
 * ("Reactions: thumbs up, fire"). Interactive reactions are buttons with their own labels; the
 * row then drops its padding and rounds the buttons.
 *
 * @summary Reactions or quick actions anchored to the edge of a bubble.
 *
 * @tag tec-bubble-reactions
 *
 * @slot - Emoji (`<span>👍</span>`), counters, or buttons.
 *
 * @csspart base - The pill.
 *
 * @cssstate align-start - The row sits at the start edge of the bubble (`align="start"`).
 * @cssstate has-button - The row contains buttons (no padding).
 */
export class TecBubbleReactions extends TectonElement {
  static styles = [hostStyles, bubbleReactionsStyles]

  /** The edge of the bubble the row is anchored to. */
  @property({ reflect: true }) side: BubbleReactionsSide = "bottom"

  /**
   * The inline edge the row sits at. (Not reflected: an `align` attribute is a legacy presentational
   * hint for text-align, which the element neutralises.)
   */
  @property() align: BubbleAlign = "end"

  #sync = () => this.toggleState("has-button", !!this.querySelector("button, tec-button, [role='button']"))

  override connectedCallback(): void {
    super.connectedCallback()
    this.#sync()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("align-start", this.align === "start")
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${this.#sync}></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-bubble-group": TecBubbleGroup
    "tec-bubble": TecBubble
    "tec-bubble-content": TecBubbleContent
    "tec-bubble-reactions": TecBubbleReactions
  }
}
