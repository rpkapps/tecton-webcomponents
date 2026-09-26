import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecResizableGroup } from "./resizable-group.js"
import { panelStyles } from "./resizable.styles.js"

/**
 * Sizes are strings with a unit — `"25%"` (a bare number is a percentage too), `"320px"`,
 * `"20rem"` — measured along the group's axis, in the space the panels share. Pixel and rem
 * constraints stay constant when the group is resized.
 *
 * @summary One resizable region of a `tec-resizable-group`.
 *
 * @tag tec-resizable-panel
 *
 * @slot - The panel content. Give it `h-full` / `w-full` to fill the panel.
 *
 * @cssstate collapsed - The panel is collapsed (`collapsible` panels only).
 */
export class TecResizablePanel extends TectonElement {
  static styles = [hostStyles, panelStyles]

  /** The initial size (`"50%"`, `"320px"`, `"20rem"`). Panels without one share the remaining space. */
  @property({ attribute: "default-size" }) defaultSize?: string

  /** The smallest size the user can drag the panel to. Default `0%`. */
  @property({ attribute: "min-size" }) minSize?: string

  /** The largest size the user can drag the panel to. Default `100%`. */
  @property({ attribute: "max-size" }) maxSize?: string

  /** Lets the panel collapse to `collapsed-size` when dragged below half its `min-size`, or with Enter on its handle. */
  @property({ type: Boolean, reflect: true }) collapsible = false

  /** The size of the collapsed panel. Default `0%`. */
  @property({ attribute: "collapsed-size" }) collapsedSize?: string

  #group(): TecResizableGroup | null {
    const parent = this.parentElement
    return parent?.localName === "tec-resizable-group" ? (parent as TecResizableGroup) : null
  }

  /** The current size in percent of the group (0 before the group has laid out). */
  get size(): number {
    return this.#group()?.sizeOf(this) ?? 0
  }

  /** Whether the panel is collapsed. */
  get collapsed(): boolean {
    return this.matches(":state(collapsed)")
  }

  /** Collapses a `collapsible` panel (no event). */
  collapse(): void {
    this.#group()?.collapsePanel(this)
  }

  /** Expands a collapsed panel to the size it had before collapsing, or its minimum (no event). */
  expand(): void {
    this.#group()?.expandPanel(this)
  }

  /** Resizes the panel (`"30%"`, `"240px"`, or a number of percent), within its constraints (no event). */
  resize(size: string | number): void {
    this.#group()?.resizePanel(this, size)
  }

  /**
   * Applied by the group.
   * @internal
   */
  applySize(size: number, collapsed: boolean): void {
    this.style.flexGrow = String(Number(size.toFixed(4)))
    this.toggleState("collapsed", collapsed)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("minSize") || changed.has("maxSize") || changed.has("collapsible") || changed.has("collapsedSize")) {
      if (this.hasUpdated) this.#group()?.constraintsChanged()
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-resizable-panel": TecResizablePanel
  }
}
