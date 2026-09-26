import { html, type PropertyValues } from "lit"
import { LoaderCircle } from "lucide"
import { property } from "lit/decorators.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { spinnerStyles } from "./spinner.styles.js"

/**
 * The element is a live region: it has `role="status"` and the accessible name `label`
 * (`"Loading"`), both set as default semantics, so an `aria-label` or `role` attribute on the element
 * overrides them. Don't wrap it in another live region.
 *
 * The stroke is `currentColor`: colour it through its parent (`text-muted-foreground`). The size
 * follows `--tec-icon-size` (1rem), so inside a `tec-button`, `tec-badge` or an input group addon it
 * takes the size of the other icons; a `size-*` class (`class="size-6"`) resizes it anywhere.
 *
 * @summary An indicator that shows that something is loading.
 *
 * @tag tec-spinner
 *
 * @slot - A custom icon that replaces the default loader circle (it spins the same way).
 *
 * @csspart icon - The rotating box that holds the icon.
 *
 * @cssprop --tec-icon-size - Width and height (default 1rem). Buttons and badges set it for their icons.
 * @cssprop --tec-spinner-duration - Time of one turn (default 1s; three times longer under reduced motion).
 */
export class TecSpinner extends TectonElement {
  static styles = [hostStyles, spinnerStyles]

  /** Accessible name announced for the spinner. Localise it (`label="Chargement"`). */
  @property() label = "Loading"

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "status"
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("label")) this.internals.ariaLabel = this.label || null
  }

  protected override render() {
    return html`<span class="icon" part="icon"><slot>${icon(LoaderCircle, { size: 16 })}</slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-spinner": TecSpinner
  }
}
