import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { OverflowRowLike } from "./overflow-item.js"
import { overflowDividerStyles, overflowGroupStyles, overflowSpacerStyles } from "./overflow.styles.js"

function rowOf(el: Element): OverflowRowLike | null {
  let parent = el.parentElement
  if (parent?.localName === "tec-overflow-group") parent = parent.parentElement
  return parent && typeof (parent as Partial<OverflowRowLike>).itemChanged === "function" ? (parent as OverflowRowLike) : null
}

/**
 * The group renders no box (`display: contents`): its items stay items of the row. While its
 * members are hidden they form a section of the More menu headed by `label`.
 *
 * @summary Groups overflow items: a labelled section in the More menu, optionally collapsing as one unit.
 *
 * @tag tec-overflow-group
 *
 * @slot - `tec-overflow-item`s (and dividers) of the group.
 */
export class TecOverflowGroup extends TectonElement {
  static styles = [hostStyles, overflowGroupStyles]

  /** Heading of the group's section in the More menu, and the group's accessible name in the row. */
  @property() label = ""

  /** `together` moves the whole group into the menu when its lowest-priority item would leave. */
  @property({ reflect: true }) collapse: "individually" | "together" = "individually"

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.internals.ariaLabel = this.label || null
    const row = rowOf(this)
    if (row && (changed.has("label") || changed.has("collapse"))) row.itemChanged(this)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Visible only while something visible remains on both sides of it (the More button counts for the
 * end), and never next to another divider. In the menu it becomes a separator between the hidden
 * items on either side of it.
 *
 * @summary A divider between items of an overflow row.
 *
 * @tag tec-overflow-divider
 *
 * @csspart base - The line.
 *
 * @cssstate overflowing - Hidden because one side of it is empty.
 * @cssstate vertical - The row is vertical (the divider is a horizontal line).
 */
export class TecOverflowDivider extends TectonElement {
  static styles = [hostStyles, overflowDividerStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "separator"
    rowOf(this)?.itemChanged(this)
  }

  /** Applies the row's layout decision. @internal */
  setLayoutState(overflowing: boolean, vertical: boolean): void {
    this.toggleState("overflowing", overflowing)
    this.toggleState("vertical", vertical)
    this.internals.ariaOrientation = vertical ? "horizontal" : "vertical"
  }

  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

/**
 * Costs no size. Like a divider it leaves once nothing visible remains on one side of it, so a
 * collapsed row is never pushed to the far end by an empty spacer.
 *
 * @summary Flexible space in an overflow row: what is before it sits at the start, what is after it at the end.
 *
 * @tag tec-overflow-spacer
 *
 * @cssstate overflowing - Hidden because one side of it is empty.
 */
export class TecOverflowSpacer extends TectonElement {
  static styles = [hostStyles, overflowSpacerStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
    rowOf(this)?.itemChanged(this)
  }

  /** Applies the row's layout decision. @internal */
  setLayoutState(overflowing: boolean): void {
    this.toggleState("overflowing", overflowing)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-overflow-group": TecOverflowGroup
    "tec-overflow-divider": TecOverflowDivider
    "tec-overflow-spacer": TecOverflowSpacer
  }
}
