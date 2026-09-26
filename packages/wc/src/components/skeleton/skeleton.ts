import { html } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { skeletonStyles } from "./skeleton.styles.js"

/**
 * An empty block with no intrinsic size: give every skeleton a size from the spacing scale
 * (`class="h-4 w-full"`, `class="size-12 rounded-full"`, `class="aspect-video w-full"`) and mirror
 * the layout of the content it stands in for. The pulse stops for users who prefer reduced motion.
 *
 * The placeholder is decorative (hidden from assistive technology). Mark the region that is loading
 * with `aria-busy="true"` and announce the result, not the skeleton.
 *
 * @summary Use to show a placeholder while content is loading.
 *
 * @tag tec-skeleton
 *
 * @csspart base - The pulsing muted block.
 *
 * @cssprop --tec-skeleton-radius - Corner radius (default `--tec-radius-md`). A `rounded-*` class on the element works too.
 */
export class TecSkeleton extends TectonElement {
  static styles = [hostStyles, skeletonStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasAttribute("aria-hidden")) this.internals.ariaHidden = "true"
  }

  protected override render() {
    return html`<span class="base" part="base"></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-skeleton": TecSkeleton
  }
}
