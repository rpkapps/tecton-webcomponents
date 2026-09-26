import { html, LitElement, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { ChevronRight, Folder, FolderOpen } from "lucide"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TreeViewActionElement } from "./tree-view-action.js"
import type { TecTreeView } from "./tree-view.js"
import { treeViewItemStyles } from "./tree-view.styles.js"

/** Leading glyph of a row. */
export type TreeViewItemKind = "folder" | "item"

/** Detail of `tec-expanded-change`. */
export interface TreeViewExpandedChangeDetail {
  expanded: boolean
}

/** Detail of `tec-select` fired by a tree item. */
export interface TreeViewSelectDetail {
  value: string
}

/** Position of a row in the tree, pushed by `tec-tree-view`. @internal */
export interface TreeItemInfo {
  level: number
  posinset: number
  setsize: number
  selectable: boolean
}

const NAMED_SLOTS = ["icon", "color-tag", "suffix", "end"] as const

/**
 * The text content of the item is its label; child `tec-tree-view-item`s are its children (they
 * are shown in a `role="group"` while the item is `expanded`). Adornments go in named slots.
 *
 * The item is the `treeitem` itself (roving focus, `aria-expanded`, `aria-level`, `aria-setsize`,
 * `aria-posinset`, `aria-selected`), named by its label text (or `text-value`) only — adornments
 * don't leak into the name. Controls in the `end` slot are reachable with Tab from the focused row.
 *
 * @summary A row of a tree view, with optional nested rows.
 *
 * @tag tec-tree-view-item
 *
 * @slot - The label, then the child `tec-tree-view-item`s.
 * @slot icon - A custom leading icon (replaces the folder / dot glyph).
 * @slot color-tag - A 12px colour tag after the icon (a `tec-color-swatch`, a coloured square).
 * @slot suffix - Content after the label (a `tec-badge`, a count).
 * @slot end - Trailing controls: `tec-tree-view-visibility-toggle`, `tec-tree-view-action`.
 *
 * @csspart row - The row box (indent, hover, selection, focus ring).
 * @csspart chevron - The expand / collapse chevron (hidden without children).
 * @csspart icon - The leading icon box.
 * @csspart color-tag - The colour tag box.
 * @csspart label - The label (truncated with an ellipsis).
 * @csspart suffix - The box after the label.
 * @csspart end - The box of the trailing controls.
 * @csspart group - The container of the child rows.
 *
 * @cssstate selected - The row is selected.
 * @cssstate has-children - The row has child rows.
 *
 * @fires tec-expanded-change - The user expanded or collapsed the row (chevron, arrows, `*`, press). Bubbles. Cancelable. `detail: { expanded }`.
 * @fires tec-select - The user pressed the row (click, Enter, Space). Bubbles. `detail: { value }`.
 */
export class TecTreeViewItem extends TectonElement {
  static styles = [hostStyles, treeViewItemStyles]
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: "manual" }

  /** Identifies the row in the tree's `value` / `values`. */
  @property({ reflect: true }) value = ""

  /** `folder` rows show a folder icon (open while expanded); `item` rows a small dot. */
  @property({ reflect: true }) kind: TreeViewItemKind = "item"

  /** Whether the child rows are shown. */
  @property({ type: Boolean, reflect: true }) expanded = false

  /** Disables the row: skipped by the keyboard, cannot be selected or expanded. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Whether the row is selected (with `selection-mode` on the tree). The attribute sets the initial state. */
  @property({ type: Boolean }) selected = false

  /** The design system's dimmed *hidden* state (the object is hidden in the view, not removed from the tree). */
  @property({ type: Boolean, reflect: true }) dimmed = false

  /** Plain-text label for the accessible name and typeahead, when the text content is not it. */
  @property({ attribute: "text-value" }) textValue = ""

  #info: TreeItemInfo = { level: 1, posinset: 1, setsize: 1, selectable: false }
  #observer = new MutationObserver(() => this.#assign())
  #hasChildren = false

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, attributes: true, subtree: false, attributeFilter: ["slot"] })
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** The tree this row belongs to. @internal */
  get tree(): TecTreeView | null {
    return this.closest("tec-tree-view") as TecTreeView | null
  }

  /** The child rows. */
  get childItems(): TecTreeViewItem[] {
    return [...this.children].filter((c): c is TecTreeViewItem => c instanceof TecTreeViewItem)
  }

  /** The parent row, if any. */
  get parentItem(): TecTreeViewItem | null {
    return this.parentElement instanceof TecTreeViewItem ? this.parentElement : null
  }

  /** Whether the row has child rows. */
  get hasChildren(): boolean {
    return this.childItems.length > 0
  }

  /** The label text (for the accessible name, typeahead and the visibility toggle's name). */
  get labelText(): string {
    if (this.textValue) return this.textValue
    let text = ""
    for (const node of this.childNodes) {
      if (node instanceof TecTreeViewItem) continue
      if (node instanceof Element && node.hasAttribute("slot")) continue
      text += node.textContent ?? ""
    }
    return text.replace(/\s+/g, " ").trim()
  }

  /** Receives the row's position from the tree. @internal */
  setTreeInfo(info: TreeItemInfo): void {
    const old = this.#info
    if (old.level === info.level && old.posinset === info.posinset && old.setsize === info.setsize && old.selectable === info.selectable) return
    this.#info = info
    this.requestUpdate()
  }

  /** Makes the controls in the `end` slot tabbable while this row is the tree's tab stop. @internal */
  setControlsTabbable(tabbable: boolean): void {
    for (const el of this.children) {
      if (el.getAttribute("slot") !== "end") continue
      for (const c of [el, ...el.querySelectorAll("*")]) {
        if (c instanceof TreeViewActionElement) c.tabbable = tabbable
        else if (c instanceof HTMLElement && (c.localName === "button" || c.localName === "tec-button" || (c.localName === "a" && c.hasAttribute("href"))))
          c.tabIndex = tabbable ? 0 : -1
      }
    }
  }

  /** Expands or collapses after a cancelable `tec-expanded-change`. @internal */
  userSetExpanded(expanded: boolean): boolean {
    if (this.disabled || !this.hasChildren || expanded === this.expanded) return false
    if (!this.emit<TreeViewExpandedChangeDetail>("tec-expanded-change", { detail: { expanded }, cancelable: true })) return false
    this.expanded = expanded
    return true
  }

  #onClick = (event: MouseEvent) => {
    const path = event.composedPath()
    if (this.disabled) return
    // A click dispatched on the host itself (`item.click()`, assistive technology) presses the row.
    if (path[0] === this) {
      this.tree?.focusItem(this)
      this.tree?.pressItem(this, "pointer")
      return
    }
    // Otherwise only presses on this row (not on a nested row, not on the end controls).
    const row = this.renderRoot.querySelector(".row")
    if (!row || !path.includes(row)) return
    const end = this.renderRoot.querySelector(".end")
    if (end && path.includes(end)) return
    if (this.disabled) return
    const chevron = this.renderRoot.querySelector(".chevron")
    if (chevron && path.includes(chevron)) {
      this.tree?.focusItem(this)
      this.userSetExpanded(!this.expanded)
      return
    }
    this.tree?.focusItem(this)
    this.tree?.pressItem(this, "pointer")
  }

  #assign(): void {
    const root = this.shadowRoot
    if (!root) return
    const buckets = new Map<string, (Element | Text)[]>([["", []], ["children", []], ...NAMED_SLOTS.map((n) => [n, []] as [string, (Element | Text)[]])])
    for (const node of this.childNodes) {
      if (node instanceof TecTreeViewItem) buckets.get("children")!.push(node)
      else if (node instanceof Element && buckets.has(node.getAttribute("slot") ?? "") && node.getAttribute("slot")) buckets.get(node.getAttribute("slot")!)!.push(node)
      else if (node instanceof Element || node instanceof Text) buckets.get("")!.push(node)
    }
    for (const slot of root.querySelectorAll("slot")) slot.assign(...(buckets.get(slot.name) ?? []))
    for (const name of NAMED_SLOTS) this.toggleState(`has-${name}`, buckets.get(name)!.length > 0)
    const hasChildren = buckets.get("children")!.length > 0
    if (hasChildren !== this.#hasChildren) {
      this.#hasChildren = hasChildren
      this.requestUpdate()
    }
    this.toggleState("has-children", hasChildren)
    this.internals.ariaLabel = this.labelText || null
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const info = this.#info
    const hasChildren = this.hasChildren
    this.#hasChildren = hasChildren
    this.internals.role = "treeitem"
    this.internals.ariaLevel = String(info.level)
    this.internals.ariaPosInSet = String(info.posinset)
    this.internals.ariaSetSize = String(info.setsize)
    this.internals.ariaExpanded = hasChildren ? String(this.expanded) : null
    this.internals.ariaSelected = info.selectable ? String(this.selected) : null
    this.internals.ariaDisabled = this.disabled ? "true" : null
    this.toggleState("selected", info.selectable && this.selected)
    this.style.setProperty("--_level", String(info.level))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#assign()
  }

  protected override render() {
    const glyph = this.kind === "folder" ? icon(this.expanded ? FolderOpen : Folder, { size: 16 }) : html`<span class="dot"></span>`
    return html`<div class="row" part="row">
        <span class="chevron" part="chevron" aria-hidden="true">${icon(ChevronRight, { size: 16 })}</span>
        <span class="icon" part="icon" aria-hidden="true"><slot name="icon">${glyph}</slot></span>
        <span class="color-tag" part="color-tag"><slot name="color-tag"></slot></span>
        <span class="label" part="label"><slot></slot></span>
        <span class="suffix" part="suffix"><slot name="suffix"></slot></span>
        <span class="end" part="end"><slot name="end"></slot></span>
      </div>
      ${this.#hasChildren
        ? html`<div class="group" part="group" role="group" ?hidden=${!this.expanded}><slot name="children"></slot></div>`
        : html`<slot name="children" hidden></slot>`}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tree-view-item": TecTreeViewItem
  }
}
