import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { isRtl } from "../../internal/direction.js"
import { deepActiveElement } from "../../internal/focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { Typeahead } from "../../internal/typeahead.js"
import { TecTreeViewItem } from "./tree-view-item.js"
import { treeViewStyles } from "./tree-view.styles.js"

/** Row selection of a tree. */
export type TreeViewSelectionMode = "none" | "single" | "multiple"

/** Detail of `tec-value-change`. */
export interface TreeViewValueChangeDetail {
  /** The first selected value (empty when none). */
  value: string
  /** Every selected value, in document order. */
  values: string[]
}

/**
 * A WAI-ARIA tree (`role="tree"` on the element, `treeitem` rows, nested `role="group"`s). The tree
 * is one Tab stop — the selected row, else the first — plus the focused row's `end` controls.
 *
 * Rows are nested `tec-tree-view-item` elements; `expanded`, `disabled`, `selected` and `dimmed` on
 * a row set its state. With `selection-mode`, pressing a row (click, Enter, Space) toggles its
 * selection and fires `tec-value-change`; without, pressing a parent row expands or collapses it.
 * Every press fires `tec-select` on the row.
 *
 * @summary Displays a hierarchy — a project, an inventory, a file structure — with expandable rows.
 *
 * @tag tec-tree-view
 *
 * @slot - The top-level `tec-tree-view-item` rows.
 *
 * @csspart base - The scroll container of the rows.
 *
 * @fires tec-value-change - The user changed the selection. Bubbles. Cancelable. `detail: { value, values }`.
 */
export class TecTreeView extends TectonElement {
  static styles = [hostStyles, treeViewStyles]

  /** `single` or `multiple` makes rows selectable (`aria-selected`); `none` (default) doesn't. */
  @property({ attribute: "selection-mode", reflect: true }) selectionMode: TreeViewSelectionMode = "none"

  /** Accessible name of the tree (or use `aria-label` / `aria-labelledby`). */
  @property() label = ""

  #active: TecTreeViewItem | null = null
  #typeahead = new Typeahead()
  #observer = new MutationObserver(() => this.requestUpdate())

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("focusin", this.#onFocusIn)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["expanded", "disabled", "slot"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** Every row, in document order. */
  get items(): TecTreeViewItem[] {
    return [...this.querySelectorAll("tec-tree-view-item")].filter((i): i is TecTreeViewItem => i instanceof TecTreeViewItem)
  }

  /** The rows currently shown (every ancestor expanded), in order. */
  get visibleItems(): TecTreeViewItem[] {
    const out: TecTreeViewItem[] = []
    const walk = (rows: TecTreeViewItem[]) => {
      for (const row of rows) {
        out.push(row)
        if (row.expanded) walk(row.childItems)
      }
    }
    walk(this.#topLevel())
    return out
  }

  /** The value of the first selected row (`""` when none). Setting it selects only that row. */
  get value(): string {
    return this.values[0] ?? ""
  }

  set value(value: string) {
    this.values = value ? [value] : []
  }

  /** The values of the selected rows. Setting it selects exactly those rows. */
  get values(): string[] {
    return this.items.filter((i) => i.selected && i.value).map((i) => i.value)
  }

  set values(values: string[]) {
    const set = new Set(values)
    for (const item of this.items) item.selected = set.has(item.value)
    this.requestUpdate()
  }

  /** Expands every row that has children. */
  expandAll(): void {
    for (const item of this.items) if (item.hasChildren) item.expanded = true
  }

  /** Collapses every row. */
  collapseAll(): void {
    for (const item of this.items) item.expanded = false
  }

  /** Focuses the tree's tab stop. */
  override focus(options?: FocusOptions): void {
    this.#sync()
    ;(this.#active ?? undefined)?.focus(options)
  }

  #topLevel(): TecTreeViewItem[] {
    return [...this.children].filter((c): c is TecTreeViewItem => c instanceof TecTreeViewItem)
  }

  #enabledVisible(): TecTreeViewItem[] {
    return this.visibleItems.filter((i) => !i.disabled)
  }

  /** A row was pressed (pointer, Enter, Space). @internal */
  pressItem(item: TecTreeViewItem, _source: "pointer" | "enter" | "space"): void {
    if (item.disabled) return
    this.#setActive(item)
    // With selection, a press toggles the row's selection; without, it expands or collapses a parent.
    if (this.selectionMode !== "none") this.#toggleSelection(item)
    else if (item.hasChildren) item.userSetExpanded(!item.expanded)
    item.dispatchEvent(new CustomEvent("tec-select", { detail: { value: item.value }, bubbles: true, composed: true }))
  }

  #applySelection(next: TecTreeViewItem[]): void {
    const values = next.map((i) => i.value).filter(Boolean)
    if (!this.emit<TreeViewValueChangeDetail>("tec-value-change", { detail: { value: values[0] ?? "", values }, cancelable: true })) return
    for (const item of this.items) item.selected = next.includes(item)
  }

  #toggleSelection(item: TecTreeViewItem): void {
    const selected = this.items.filter((i) => i.selected)
    if (this.selectionMode === "single") this.#applySelection(item.selected ? [] : [item])
    else this.#applySelection(item.selected ? selected.filter((i) => i !== item) : [...selected, item])
  }

  #setActive(item: TecTreeViewItem | null, focus = false): void {
    this.#active = item
    this.#applyTabIndex()
    if (item && focus) item.focus()
  }

  #applyTabIndex(): void {
    const visible = new Set(this.visibleItems)
    if (!this.#active || !visible.has(this.#active) || this.#active.disabled || !this.contains(this.#active)) {
      const candidates = [...visible].filter((i) => !i.disabled)
      this.#active = candidates.find((i) => i.selected && this.selectionMode !== "none") ?? candidates[0] ?? null
    }
    for (const item of this.items) {
      const tabIndex = item === this.#active ? 0 : -1
      if (item.tabIndex !== tabIndex) item.tabIndex = tabIndex
      item.setControlsTabbable(item === this.#active)
    }
  }

  #sync(): void {
    const selectable = this.selectionMode !== "none"
    const walk = (rows: TecTreeViewItem[], level: number) => {
      rows.forEach((row, index) => {
        row.setTreeInfo({ level, posinset: index + 1, setsize: rows.length, selectable })
        walk(row.childItems, level + 1)
      })
    }
    walk(this.#topLevel(), 1)
    // Focus inside a row that got collapsed away moves to that row.
    const active = deepActiveElement()
    if (active instanceof TecTreeViewItem && this.contains(active) && !this.visibleItems.includes(active)) {
      let row: TecTreeViewItem | null = active.parentItem
      while (row && !this.visibleItems.includes(row)) row = row.parentItem
      if (row) this.#setActive(row, true)
    }
    this.#applyTabIndex()
  }

  #onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0]
    if (target instanceof TecTreeViewItem && target.tree === this && target !== this.#active && !target.disabled) this.#setActive(target)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return
    const current = event.composedPath()[0]
    if (!(current instanceof TecTreeViewItem) || current.tree !== this) return
    const rows = this.#enabledVisible()
    const index = rows.indexOf(current)
    const move = (target: TecTreeViewItem | undefined) => {
      event.preventDefault()
      if (!target) return
      this.#setActive(target, true)
      if (event.shiftKey && this.selectionMode === "multiple" && !target.selected) this.#toggleSelection(target)
    }
    const forward = isRtl(this) ? "ArrowLeft" : "ArrowRight"
    const backward = isRtl(this) ? "ArrowRight" : "ArrowLeft"

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && this.selectionMode === "multiple") {
      event.preventDefault()
      this.#applySelection(this.items.filter((i) => !i.disabled))
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return

    switch (event.key) {
      case "ArrowDown":
        return move(rows[index + 1])
      case "ArrowUp":
        return move(index > 0 ? rows[index - 1] : undefined)
      case "Home":
        return move(rows[0])
      case "End":
        return move(rows[rows.length - 1])
      case forward:
        event.preventDefault()
        if (current.hasChildren && !current.expanded) current.userSetExpanded(true)
        else if (current.expanded) {
          const child = current.childItems.find((c) => !c.disabled)
          if (child) this.#setActive(child, true)
        }
        return
      case backward:
        event.preventDefault()
        if (current.expanded) current.userSetExpanded(false)
        else if (current.parentItem) this.#setActive(current.parentItem, true)
        return
      case "*": {
        event.preventDefault()
        const siblings = current.parentItem ? current.parentItem.childItems : this.#topLevel()
        for (const s of siblings) if (!s.expanded) s.userSetExpanded(true)
        return
      }
      case "Enter":
        event.preventDefault()
        this.pressItem(current, "enter")
        return
      case " ":
        if (this.#typeahead.isTypeaheadKey(event)) break
        event.preventDefault()
        this.pressItem(current, "space")
        return
    }
    if (this.#typeahead.isTypeaheadKey(event)) {
      event.preventDefault()
      const match = this.#typeahead.match(event, rows, current, (i) => i.labelText)
      if (match && match !== current) this.#setActive(match, true)
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "tree"
    this.internals.ariaMultiSelectable = this.selectionMode === "multiple" ? "true" : null
    this.internals.ariaLabel = this.label || null
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#sync()
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.requestUpdate()}></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tree-view": TecTreeView
  }
}
