import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { EllipsisVertical, Eye, EyeOff } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { treeViewActionStyles } from "./tree-view.styles.js"

/** Detail of `tec-visibility-change`. */
export interface TreeViewVisibilityChangeDetail {
  visible: boolean
}

/**
 * Base of the row controls: a 24px icon `<button>` that is only tabbable while its row is the tree's
 * tab stop (so the tree stays a single Tab stop plus the focused row's controls).
 */
export class TreeViewActionElement extends TectonElement {
  static styles = [hostStyles, treeViewActionStyles]
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Whether the inner button is in the Tab order (set by the row). @internal */
  @property({ attribute: false }) tabbable = false

  @query("button") protected control!: HTMLButtonElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: this.managedAria() })
  }

  /** ARIA attributes the element writes itself on the button. @internal */
  protected managedAria(): string[] {
    return []
  }

  /** Presses the button. */
  override click(): void {
    this.control?.click()
  }

  protected override render() {
    return html`<button class="base" part="base" type="button" tabindex=${this.tabbable ? 0 : -1}><slot>${icon(EllipsisVertical, { size: 16 })}</slot></button>`
  }
}

/**
 * Give it an `aria-label` ("Top Balder actions") and listen for `click`, or put it in the `slot="trigger"`
 * of a `tec-dropdown-menu` for a row menu.
 *
 * @summary A 24px icon button for row actions; shows a vertical ellipsis by default.
 *
 * @tag tec-tree-view-action
 *
 * @slot - A custom icon.
 *
 * @csspart base - The button.
 */
export class TecTreeViewAction extends TreeViewActionElement {}

/**
 * A toggle button whose name stays "Hide …" while `aria-pressed` carries the state (pressed while the
 * row is hidden), so a screen reader announces "Hide Faults, toggle button, pressed". Its name is
 * `hide-label` followed by `name`, or by the row's label when `name` is not set; an `aria-label` on
 * the element replaces it.
 *
 * Pressing it fires the cancelable `tec-visibility-change`; unless canceled it flips `pressed` and
 * sets `dimmed` on its row.
 *
 * @summary An eye / eye-off toggle that shows or hides a row's object.
 *
 * @tag tec-tree-view-visibility-toggle
 *
 * @csspart base - The button.
 *
 * @fires tec-visibility-change - The user toggled visibility. Bubbles. Cancelable. `detail: { visible }` (the new state).
 */
export class TecTreeViewVisibilityToggle extends TreeViewActionElement {
  /** Whether the object is hidden (the toggle is pressed). */
  @property({ type: Boolean, reflect: true }) pressed = false

  /** What the toggle hides, for its name (`"Hide {name}"`). Default: the row's label. */
  @property() name = ""

  /** The verb of the accessible name (localise it). */
  @property({ attribute: "hide-label" }) hideLabel = "Hide"

  /** Whether the object is visible (the inverse of `pressed`). */
  get visible(): boolean {
    return !this.pressed
  }

  set visible(visible: boolean) {
    this.pressed = !visible
  }

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
  }

  protected override managedAria(): string[] {
    return ["aria-pressed"]
  }

  #row(): (Element & { dimmed?: boolean; labelText?: string }) | null {
    return this.closest("tec-tree-view-item")
  }

  #onClick = (event: MouseEvent) => {
    if (!event.composedPath().includes(this.control)) return
    const visible = this.pressed
    if (!this.emit<TreeViewVisibilityChangeDetail>("tec-visibility-change", { detail: { visible }, cancelable: true })) return
    this.pressed = !visible
    const row = this.#row()
    if (row && "dimmed" in row) row.dimmed = !visible
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const button = this.control
    if (!button) return
    button.setAttribute("aria-pressed", String(this.pressed))
    if (!this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
      const what = this.name || this.#row()?.labelText || ""
      button.setAttribute("aria-label", what ? `${this.hideLabel} ${what}` : this.hideLabel)
    }
  }

  protected override render() {
    return html`<button class="base" part="base" type="button" tabindex=${this.tabbable ? 0 : -1}>
      ${icon(this.pressed ? EyeOff : Eye, { size: 16 })}
    </button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tree-view-action": TecTreeViewAction
    "tec-tree-view-visibility-toggle": TecTreeViewVisibilityToggle
  }
}
