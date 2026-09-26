import { html } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { DisclosurePanel, disclosurePanelStyles } from "./disclosure-panel.js"

/**
 * While collapsed the content stays in the document with `hidden="until-found"`: it is not rendered
 * and not exposed to assistive technology, but the browser's find-in-page searches it and expands the
 * collapsible when it finds a match. Expanding and collapsing animate the height (not under
 * `prefers-reduced-motion: reduce`).
 *
 * @summary The region a `tec-collapsible` shows and hides.
 *
 * @tag tec-collapsible-content
 *
 * @slot - The content revealed by the trigger.
 *
 * @csspart region - The animated wrapper around the content.
 *
 * @cssstate open - The content is expanded.
 */
export class TecCollapsibleContent extends DisclosurePanel {
  static styles = [hostStyles, disclosurePanelStyles]

  protected override render() {
    return this.renderRegion(html`<slot></slot>`)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-collapsible-content": TecCollapsibleContent
  }
}
