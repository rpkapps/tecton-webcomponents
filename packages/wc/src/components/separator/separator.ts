import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { separatorStyles } from "./separator.styles.js"

export type SeparatorOrientation = "horizontal" | "vertical"
export type SeparatorEmphasis = "subtle" | "default" | "strong"

/**
 * Semantics: a plain separator has `role="separator"` (with `aria-orientation="vertical"` when
 * vertical), set as default semantics on the element. `decorative` removes the role for a rule that
 * is only visual (inside a menu or toolbar that already structures its content).
 *
 * **Labelled divider**: text in the default slot renders a rule on each side of the label
 * (`<tec-separator>or</tec-separator>`). A separator's content is presentational for assistive
 * technology, so a labelled divider has no separator role: the rules are decorative and the label
 * is read as ordinary text.
 *
 * A vertical separator takes its height from its flex row (`align-self: stretch`).
 *
 * @summary Visually or semantically separates content.
 *
 * @tag tec-separator
 *
 * @slot - Optional label; renders a labelled divider.
 *
 * @csspart base - The box that holds the rule(s) and the label.
 * @csspart line - The rule (both rules of a labelled divider).
 * @csspart label - The label wrapper of a labelled divider.
 *
 * @cssstate labelled - The separator has a label.
 */
export class TecSeparator extends TectonElement {
  static styles = [hostStyles, separatorStyles]

  /** The axis of the rule. */
  @property({ reflect: true }) orientation: SeparatorOrientation = "horizontal"

  /** The weight of the rule: the three Tecton divider levels (`--tec-border-subtle`, `--tec-border`, `--tec-border-strong`). */
  @property({ reflect: true }) emphasis: SeparatorEmphasis = "default"

  /** Purely visual: removes the `separator` role. */
  @property({ type: Boolean, reflect: true }) decorative = false

  /** Position of the label of a labelled divider: `center`, or `start` / `end` (a short rule before / after it). */
  @property({ reflect: true, attribute: "align-label" }) alignLabel: "start" | "center" | "end" = "center"

  #slots = new HasSlotController(this, "[default]")

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const labelled = this.#slots.test("[default]")
    this.toggleState("labelled", labelled)
    const semantic = !this.decorative && !labelled
    this.internals.role = semantic ? "separator" : "none"
    this.internals.ariaOrientation = semantic && this.orientation === "vertical" ? "vertical" : null
  }

  protected override render() {
    return html`<div class="base" part="base">
      <span class="line start" part="line"></span>
      <span class="label" part="label"><slot></slot></span>
      <span class="line end" part="line"></span>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-separator": TecSeparator
  }
}
