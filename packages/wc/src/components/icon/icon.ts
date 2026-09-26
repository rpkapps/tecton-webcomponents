import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { unsafeSVG } from "lit/directives/unsafe-svg.js"
import { icon as renderIconNode } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { iconStyles } from "./icon.styles.js"
import { getIcon, isIconNode, isTectonIcon, normalizeIconName, onIconRegistered } from "./registry.js"

export { registerIcon, registerIcons, getIcon, iconNames, normalizeIconName, type IconDefinition, type SvgIconDefinition } from "./registry.js"
export type { TectonIconData, TectonIconVariant } from "../../icons/index.js"

const warned = new Set<string>()

/**
 * @summary Renders a Tecton domain icon (well, seismic, drill-bit …) or any registered Lucide / custom icon.
 *
 * @tag tec-icon
 *
 * @csspart svg - The rendered `<svg>`.
 *
 * @cssprop --tec-icon-size - Width and height (default 1.5rem = 24px). Components set it for their slotted icons (e.g. 1rem in buttons); plain `width`/`height` on the host work too.
 *
 * Decorative by default (hidden from assistive technology). Give it a `label` when the icon conveys
 * meaning on its own — it then has `role="img"` and that accessible name.
 *
 * The 18 Tecton domain icons are always available; register Lucide icons with `registerIcons` from
 * `@tecton/wc/icon/registry.js`.
 */
export class TecIcon extends TectonElement {
  static styles = [hostStyles, iconStyles]

  /** Registered icon name (kebab-case), e.g. `well`, `seismic`, or a registered Lucide name such as `chevron-down`. */
  @property({ reflect: true }) name = ""

  /** Glyph style of Tecton icons. Lucide icons have one style. */
  @property({ reflect: true }) variant: "outlined" | "filled" = "outlined"

  /** Accessible label. Without it the icon is decorative (`aria-hidden`). */
  @property() label = ""

  /** Stroke width of Lucide (stroke-drawn) icons. */
  @property({ type: Number, attribute: "stroke-width" }) strokeWidth = 2

  #unsubscribe?: () => void

  override connectedCallback(): void {
    super.connectedCallback()
    this.#unsubscribe = onIconRegistered((name) => {
      if (name === normalizeIconName(this.name)) this.requestUpdate()
    })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unsubscribe?.()
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("label")) {
      this.internals.role = this.label ? "img" : null
      this.internals.ariaLabel = this.label || null
      this.internals.ariaHidden = this.label ? null : "true"
    }
  }

  protected override render() {
    if (!this.name) return nothing
    const definition = getIcon(this.name)
    if (!definition) {
      if (!warned.has(this.name)) {
        warned.add(this.name)
        console.warn(`[tecton] <tec-icon name="${this.name}">: no icon registered under that name.`)
      }
      return nothing
    }
    if (isIconNode(definition)) {
      return renderIconNode(definition, { strokeWidth: this.strokeWidth, part: "svg" })
    }
    if (isTectonIcon(definition)) {
      const markup = this.variant === "filled" ? definition.filled : definition.outlined
      return html`<svg part="svg" xmlns="http://www.w3.org/2000/svg" viewBox=${definition.viewBox} fill="currentColor" aria-hidden="true" focusable="false">${unsafeSVG(markup)}</svg>`
    }
    const stroke = definition.paint === "stroke"
    return html`<svg
      part="svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox=${definition.viewBox}
      fill=${stroke ? "none" : "currentColor"}
      stroke=${stroke ? "currentColor" : "none"}
      stroke-width=${stroke ? this.strokeWidth : nothing}
      stroke-linecap=${stroke ? "round" : nothing}
      stroke-linejoin=${stroke ? "round" : nothing}
      aria-hidden="true"
      focusable="false"
    >${unsafeSVG(definition.svg)}</svg>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-icon": TecIcon
  }
}
