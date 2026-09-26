import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecResizableGroup } from "./resizable-group.js"
import { handleStyles } from "./resizable.styles.js"

/**
 * A WAI-ARIA window splitter: a focusable `separator` whose `aria-valuenow` is the size (in percent)
 * of the panel before it, with `aria-valuemin` / `aria-valuemax` and `aria-controls` pointing at that
 * panel. Drag it with a pointer or use the keyboard (arrows, Home / End, Enter to collapse or expand a
 * `collapsible` panel, F6 to move to the next handle). Double-click resets the panel before it to its
 * `default-size`.
 *
 * Give each handle an `aria-label` naming what it resizes when a group has several.
 *
 * @summary The divider between two `tec-resizable-panel`s; drag it to resize them.
 *
 * @tag tec-resizable-handle
 *
 * @csspart base - The 1px divider line (and focus ring).
 * @csspart grip - The visible grip (with `with-handle`).
 *
 * @cssstate vertical - The group is vertical (the handle is a horizontal line).
 * @cssstate active - The handle is being dragged.
 * @cssstate disabled - The handle (or its group) is disabled.
 */
export class TecResizableHandle extends TectonElement {
  static styles = [hostStyles, handleStyles]

  /** Shows a grip on the divider. */
  @property({ type: Boolean, reflect: true, attribute: "with-handle" }) withHandle = false

  /** Disables resizing with this handle (the panels can still move when other handles are dragged). */
  @property({ type: Boolean, reflect: true }) disabled = false

  constructor() {
    super()
    this.addEventListener("keydown", (e) => this.#group()?.handleKeyDown(this, e))
    this.addEventListener("pointerdown", (e) => this.#group()?.handlePointerDown(this, e))
    this.addEventListener("dblclick", () => this.#group()?.handleDoubleClick(this))
  }

  #group(): TecResizableGroup | null {
    const parent = this.parentElement
    return parent?.localName === "tec-resizable-group" ? (parent as TecResizableGroup) : null
  }

  /** Whether the handle is disabled directly or through its group. */
  get isDisabled(): boolean {
    return this.disabled || !!this.#group()?.disabled
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "separator"
    this.internals.ariaDisabled = this.isDisabled ? "true" : null
    this.toggleState("disabled", this.isDisabled)
    this.toggleState("group-disabled", !!this.#group()?.disabled)
    if (this.isDisabled) this.removeAttribute("tabindex")
    else if (this.getAttribute("tabindex") !== "0") this.tabIndex = 0
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("disabled")) this.#group()?.refresh()
  }

  protected override render() {
    return html`<div class="base" part="base"></div><div class="hit"></div>${this.withHandle ? html`<div class="grip" part="grip"></div>` : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-resizable-handle": TecResizableHandle
  }
}
