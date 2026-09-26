import { html } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { DisclosurePanel, disclosurePanelStyles } from "../collapsible/disclosure-panel.js"
import { accordionContentStyles } from "./accordion.styles.js"

/**
 * A `group` named by its trigger's text. While collapsed it stays in the document with
 * `hidden="until-found"`, so find-in-page searches it and expands the item on a match. The height
 * animates when the item expands or collapses (not under `prefers-reduced-motion: reduce`).
 *
 * @summary The panel of a `tec-accordion-item`.
 *
 * @tag tec-accordion-content
 *
 * @slot - The panel content. Top-level links are underlined; top-level paragraphs are spaced.
 *
 * @csspart region - The animated wrapper.
 * @csspart base - The padded content box.
 *
 * @cssstate open - The item is expanded.
 */
export class TecAccordionContent extends DisclosurePanel {
  static styles = [hostStyles, disclosurePanelStyles, accordionContentStyles]

  protected override render() {
    return this.renderRegion(html`<div class="base" part="base"><slot></slot></div>`)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-accordion-content": TecAccordionContent
  }
}
