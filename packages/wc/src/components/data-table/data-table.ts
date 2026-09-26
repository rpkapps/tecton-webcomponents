import {
  columnFilteringFeature,
  columnVisibilityFeature,
  constructTable,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/table-core"
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings"
import { html, nothing, render, type PropertyValues, type TemplateResult } from "lit"
import { property, query, state } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { repeat } from "lit/directives/repeat.js"
import { styleMap } from "lit/directives/style-map.js"
import { unsafeSVG } from "lit/directives/unsafe-svg.js"
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, type IconNode } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { iconNodeMarkup } from "../../internal/icons.js"
import { PopupController, popupStyles } from "../../internal/popup.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { localeOf } from "../../internal/locale.js"
import { adoptLightStyles, type TableDensity, type TecTable } from "../table/table.js"
import { tableLightStyles } from "../table/table.styles.js"
import type {
  DataTableCellContext,
  DataTableColumn,
  DataTableColumnVisibilityChangeDetail,
  DataTablePageChangeDetail,
  DataTableRow,
  DataTableSelectionChangeDetail,
  DataTableSort,
  DataTableSortChangeDetail,
} from "./data-table-types.js"
import { dataTableLightStyles, dataTableStyles } from "./data-table.styles.js"

export type * from "./data-table-types.js"
/** Lit's `html`, re-exported so cell renderers can return templates without a direct `lit` dependency. */
export { html, nothing } from "lit"

const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic, datetime: sortFn_datetime },
})

/* The TanStack generics are precise per feature set; this element works with its one fixed set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = any

const svgIcon = (node: IconNode, slot?: string) =>
  html`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    slot=${slot ?? nothing}
  >
    ${unsafeSVG(iconNodeMarkup(node))}
  </svg>`

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key]! : match))

/** Elements whose clicks don't toggle the row selection. */
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), tec-button, tec-checkbox'

const columnId = <T extends DataTableRow>(column: DataTableColumn<T>) => column.id ?? (typeof column.accessor === "string" ? column.accessor : "")

/**
 * A data table driven by [TanStack Table](https://tanstack.com/table): give it `columns` and `data`
 * (properties) and it renders a `tec-table` with sortable headers, a filter input, a column
 * visibility menu, row selection checkboxes and pagination — each switched on by an attribute.
 *
 * The table itself is rendered into the element's **light DOM** (a managed `tec-table` child), so
 * cell renderers can return markup styled by the page (utility classes, other `tec-*` elements),
 * and it keeps native table semantics: sortable columns are `<th aria-sort>` with a button, the
 * row-header column is `<th scope="row">`, selection is a column of `tec-checkbox`es. The toolbar,
 * menu and pagination controls live in the shadow root.
 *
 * State is uncontrolled by default. Every user change fires a cancelable event first
 * (`tec-sort-change`, `tec-selection-change`, `tec-page-change`, `tec-column-visibility-change`);
 * `preventDefault()` keeps the current state. Set `sorting`, `selection`, `columnVisibility`,
 * `pageIndex`, `pageSize` or `filter` to change it from code (no events). The TanStack table
 * instance is available as `tanstack` for anything else.
 *
 * @summary A table with sorting, filtering, column visibility, row selection and pagination.
 *
 * @tag tec-data-table
 *
 * @slot toolbar - Extra controls in the toolbar, after the filter input (buttons, a density toggle).
 * @slot summary - Replaces the footer's start text (default: "n of m row(s) selected." when `selectable`).
 *
 * @csspart toolbar - The row above the table (filter input, toolbar slot, column menu).
 * @csspart filter - The filter `<input type="search">`.
 * @csspart columns-button - The "Columns" menu button (a `tec-button`).
 * @csspart columns-menu - The column visibility menu (`role="menu"`, top layer).
 * @csspart table-container - The bordered, rounded box around the table.
 * @csspart footer - The row below the table (summary and pagination).
 * @csspart summary - The footer's start text.
 * @csspart pagination - Rows-per-page select, page label and previous / next buttons.
 * @csspart page-size - The rows-per-page `<select>`.
 *
 * @cssprop --tec-data-table-filter-width - Maximum width of the filter input (default 24rem).
 * @cssprop --tec-data-table-menu-width - Width of the column menu (default 11rem).
 *
 * @fires tec-sort-change - A sortable header was pressed. Cancelable. `detail: { sorting, column, direction }`.
 * @fires tec-selection-change - The user selected or deselected rows. Cancelable. `detail: { selection }` (row ids).
 * @fires tec-page-change - The user changed the page or the page size. Cancelable. `detail: { pageIndex, pageSize }`.
 * @fires tec-column-visibility-change - The user showed or hid a column. Cancelable. `detail: { columnVisibility, column, visible }`.
 * @fires input - The filter text changed (from the filter input; read `filter`).
 */
export class TecDataTable<T extends DataTableRow = DataTableRow> extends TectonElement {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".menu"), dataTableStyles]

  /** The rows. Replace the array to update (it is not observed for mutations). */
  @property({ attribute: false }) data: T[] = []

  /** The column definitions (see the Columns section of the docs). */
  @property({ attribute: false }) columns: DataTableColumn<T>[] = []

  /** Key of the row objects that identifies a row (`selection` holds these ids). Falls back to the index. */
  @property({ attribute: "row-id" }) rowId = "id"

  /** Custom row id function (takes precedence over `row-id`). */
  @property({ attribute: false }) getRowId?: (row: T, index: number) => string

  /** Accessible name of the table. */
  @property() label = ""

  /** Makes every accessor column sortable (a column's `sortable` overrides it). */
  @property({ type: Boolean, reflect: true }) sortable = false

  /** Adds a checkbox column: rows (and all rows, from the header) can be selected. */
  @property({ type: Boolean, reflect: true }) selectable = false

  /** Shows the filter input. */
  @property({ type: Boolean, reflect: true }) filterable = false

  /** Filters only this column; otherwise the filter searches every `filterable` column. */
  @property({ attribute: "filter-column" }) filterColumn = ""

  /** Placeholder of the filter input. */
  @property({ attribute: "filter-placeholder" }) filterPlaceholder = "Filter…"

  /** Accessible name of the filter input (defaults to the placeholder). */
  @property({ attribute: "filter-label" }) filterLabel = ""

  /** Shows the column visibility menu button. */
  @property({ type: Boolean, attribute: "column-menu", reflect: true }) columnMenu = false

  /** Label of the column menu button. */
  @property({ attribute: "columns-label" }) columnsLabel = "Columns"

  /** Paginates the rows and shows the pagination controls. */
  @property({ type: Boolean, reflect: true }) pagination = false

  /**
   * Pagination controls: `icons` — "Page x of y" and icon previous / next buttons; `text` — "Previous" /
   * "Next" text buttons only (the shadcn/ui data table).
   */
  @property({ reflect: true }) pager: "icons" | "text" = "icons"

  /** Visible text of the previous-page button with `pager="text"`. */
  @property({ attribute: "previous-text" }) previousText = "Previous"

  /** Visible text of the next-page button with `pager="text"`. */
  @property({ attribute: "next-text" }) nextText = "Next"

  /** Page size choices, space- or comma-separated (`"5 10 25"`). With two or more a rows-per-page select appears. */
  @property({ attribute: "page-sizes" }) pageSizes = ""

  /** Row density of the table. */
  @property({ reflect: true }) density: TableDensity = "default"

  /** Alternating row backgrounds. */
  @property({ type: Boolean, reflect: true }) striped = false

  /** Text of the empty state. */
  @property({ attribute: "empty-label" }) emptyLabel = "No results."

  /** Footer text when `selectable`; `{selected}` and `{total}` are replaced. */
  @property({ attribute: "selection-label" }) selectionLabel = "{selected} of {total} row(s) selected."

  /** Page label; `{page}` and `{count}` are replaced. */
  @property({ attribute: "page-label" }) pageLabel = "Page {page} of {count}"

  /** Label of the rows-per-page select. */
  @property({ attribute: "rows-per-page-label" }) rowsPerPageLabel = "Rows per page"

  /** Accessible name of the icon previous-page button. */
  @property({ attribute: "previous-label" }) previousLabel = "Previous page"

  /** Accessible name of the icon next-page button. */
  @property({ attribute: "next-label" }) nextLabel = "Next page"

  /** Accessible name of the select-all checkbox. */
  @property({ attribute: "select-all-label" }) selectAllLabel = "Select all"

  /** Accessible name of each row checkbox. */
  @property({ attribute: "select-row-label" }) selectRowLabel = "Select row"

  @state() private _menuOpen = false

  @query(".menu") private _menu!: HTMLElement
  @query(".columns-trigger") private _menuTrigger!: HTMLElement

  #table: AnyTable = null
  #unsubscribe: (() => void) | null = null
  #host: TecTable | null = null
  #pending: {
    sorting?: DataTableSort[]
    selection?: string[]
    columnVisibility?: Record<string, boolean>
    pageIndex?: number
    pageSize?: number
    filter?: string
  } = {}

  #popup = new PopupController(this, {
    popup: () => this._menu,
    trigger: () => this._menuTrigger,
    haspopup: "menu",
    placement: () => ({ side: "bottom", align: "end", sideOffset: 4 }),
    focus: { initial: () => this.#menuItems()[0], restore: true },
    dismiss: { escape: true, outsidePress: true, focusOut: true },
    onRequestClose: () => (this._menuOpen = false),
  })

  #roving = new RovingFocusController<HTMLElement>(this, {
    items: () => this.#menuItems(),
    orientation: "vertical",
    loop: true,
    typeahead: true,
  })

  /* ------------------------------------------------------------- state API */

  /** The TanStack Table instance (for features the element does not expose). */
  get tanstack(): AnyTable {
    return this.#ensureTable()
  }

  /** Current sorting (`[{ id, desc }]`). Setting it fires no event. */
  get sorting(): DataTableSort[] {
    return this.#table ? [...this.#table.atoms.sorting.get()] : (this.#pending.sorting ?? [])
  }
  set sorting(value: DataTableSort[]) {
    this.#write("sorting", value ?? [])
  }

  /** Ids of the selected rows. Setting it fires no event. */
  get selection(): string[] {
    if (!this.#table) return this.#pending.selection ?? []
    const state = this.#table.atoms.rowSelection.get() as Record<string, boolean>
    return Object.keys(state).filter((id) => state[id])
  }
  set selection(ids: string[]) {
    this.#write("selection", ids ?? [])
  }

  /** Visibility per column id (`false` = hidden). Setting it fires no event. */
  get columnVisibility(): Record<string, boolean> {
    return this.#table ? { ...this.#table.atoms.columnVisibility.get() } : (this.#pending.columnVisibility ?? {})
  }
  set columnVisibility(value: Record<string, boolean>) {
    this.#write("columnVisibility", value ?? {})
  }

  /** The current page (0-based, with `pagination`). */
  get pageIndex(): number {
    return this.#table ? this.#table.atoms.pagination.get().pageIndex : (this.#pending.pageIndex ?? 0)
  }
  set pageIndex(value: number) {
    this.#write("pageIndex", Math.max(0, Number(value) || 0))
  }

  /** Rows per page (with `pagination`). The `page-size` attribute sets the initial value. */
  @property({ type: Number, attribute: "page-size" })
  get pageSize(): number {
    return this.#table ? this.#table.atoms.pagination.get().pageSize : (this.#pending.pageSize ?? 10)
  }
  set pageSize(value: number) {
    const old = this.pageSize
    this.#write("pageSize", Math.max(1, Number(value) || 10))
    this.requestUpdate("pageSize", old)
  }

  /** The filter text. Setting it filters (no event). */
  get filter(): string {
    return this.#pending.filter ?? ""
  }
  set filter(value: string) {
    this.#write("filter", value ?? "")
  }

  /** The number of pages (1 when not paginated). */
  get pageCount(): number {
    return this.pagination ? Math.max(1, this.#ensureTable().getPageCount()) : 1
  }

  /** The selected row objects. */
  get selectedRows(): T[] {
    const table = this.#ensureTable()
    return table.getSelectedRowModel().rows.map((row: AnyRow) => row.original as T)
  }

  /** The rows after filtering and sorting (all pages). */
  get filteredRows(): T[] {
    return this.#ensureTable()
      .getSortedRowModel()
      .rows.map((row: AnyRow) => row.original as T)
  }

  #write(key: "sorting" | "selection" | "columnVisibility" | "pageIndex" | "pageSize" | "filter", value: unknown): void {
    ;(this.#pending as Record<string, unknown>)[key] = value
    if (this.#table) this.#applyPending(this.#table)
    this.requestUpdate()
  }

  #applyPending(table: AnyTable): void {
    const p = this.#pending
    if (p.sorting) table.baseAtoms.sorting.set(p.sorting)
    if (p.selection) table.baseAtoms.rowSelection.set(Object.fromEntries(p.selection.map((id) => [id, true])))
    if (p.columnVisibility) table.baseAtoms.columnVisibility.set(p.columnVisibility)
    if (p.pageIndex !== undefined || p.pageSize !== undefined) {
      const current = table.atoms.pagination.get()
      table.baseAtoms.pagination.set({ pageIndex: p.pageIndex ?? current.pageIndex, pageSize: p.pageSize ?? current.pageSize })
    }
    if (p.filter !== undefined) this.#applyFilter(table, p.filter)
    const filter = p.filter
    this.#pending = filter === undefined ? {} : { filter }
  }

  #applyFilter(table: AnyTable, text: string): void {
    const id = this.filterColumn
    if (id && table.getColumn(id)) {
      table.baseAtoms.globalFilter.set("")
      table.baseAtoms.columnFilters.set(text ? [{ id, value: text }] : [])
    } else {
      table.baseAtoms.columnFilters.set([])
      table.baseAtoms.globalFilter.set(text)
    }
  }

  /* -------------------------------------------------------- TanStack setup */

  #columnDefs(): AnyColumn[] {
    return this.columns.map((column) => {
      const id = columnId(column)
      const accessor = column.accessor
      const isAccessor = accessor !== undefined
      const sortFn = column.sortFn
      const def: Record<string, unknown> = {
        id: id || undefined,
        header: typeof column.header === "string" ? column.header : id,
        enableSorting: isAccessor && (column.sortable ?? this.sortable),
        enableHiding: column.hideable ?? isAccessor,
        enableColumnFilter: isAccessor && column.filterable !== false,
        enableGlobalFilter: isAccessor && column.filterable !== false,
        filterFn: "includesString",
        sortFn: typeof sortFn === "function" ? (a: AnyRow, b: AnyRow, cid: string) => sortFn(a.original, b.original, cid) : (sortFn ?? "auto"),
        meta: { column },
      }
      if (column.sortDescFirst !== undefined) def.sortDescFirst = column.sortDescFirst
      if (typeof accessor === "string") def.accessorKey = accessor
      else if (typeof accessor === "function") def.accessorFn = accessor
      return def
    })
  }

  #rowIdFn = (row: T, index: number): string => {
    if (this.getRowId) return this.getRowId(row, index)
    const value = this.rowId ? row?.[this.rowId] : undefined
    return value === undefined || value === null ? String(index) : String(value)
  }

  #ensureTable(): AnyTable {
    if (this.#table) return this.#table
    const hidden = Object.fromEntries(this.columns.filter((c) => c.hidden).map((c) => [columnId(c), false]))
    if (this.#pending.columnVisibility) this.#pending.columnVisibility = { ...hidden, ...this.#pending.columnVisibility }
    const table = constructTable({
      features,
      data: this.data,
      columns: this.#columnDefs(),
      getRowId: this.#rowIdFn,
      enableRowSelection: true,
      globalFilterFn: "includesString",
      getColumnCanGlobalFilter: (column: AnyColumn) => column.columnDef.enableGlobalFilter !== false,
      initialState: {
        pagination: { pageIndex: 0, pageSize: this.#pending.pageSize ?? 10 },
        columnVisibility: hidden,
      },
    } as AnyTable)
    this.#table = table
    this.#applyPending(table)
    const subscription = table.store.subscribe(() => this.requestUpdate())
    this.#unsubscribe = typeof subscription === "function" ? subscription : () => subscription?.unsubscribe?.()
    return table
  }

  #rebuild(): void {
    if (!this.#table) return
    // Keep the state across a rebuild (new columns): read it back into #pending.
    const filter = this.#pending.filter
    this.#pending = {
      sorting: this.sorting,
      selection: this.selection,
      columnVisibility: this.columnVisibility,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      filter: filter ?? "",
    }
    this.#unsubscribe?.()
    this.#table = null
    this.#ensureTable()
  }

  /* ------------------------------------------------------ user state changes */

  #emit<D>(name: string, detail: D): boolean {
    return this.emit<D>(name, { detail, cancelable: true })
  }

  #setSelection(ids: string[]): void {
    const unique = [...new Set(ids)]
    if (!this.#emit<DataTableSelectionChangeDetail>("tec-selection-change", { selection: unique })) {
      this.requestUpdate()
      return
    }
    this.#table.baseAtoms.rowSelection.set(Object.fromEntries(unique.map((id) => [id, true])))
  }

  #toggleRow(id: string, selected: boolean): void {
    const current = this.selection.filter((s) => s !== id)
    this.#setSelection(selected ? [...current, id] : current)
  }

  #toggleAll(selected: boolean): void {
    const visible = this.#table.getFilteredRowModel().rows.map((row: AnyRow) => row.id as string)
    const others = this.selection.filter((id) => !visible.includes(id))
    this.#setSelection(selected ? [...others, ...visible] : others)
  }

  #toggleSort(column: AnyColumn): void {
    const next = column.getNextSortingOrder() as "asc" | "desc" | false
    const sorting: DataTableSort[] = next ? [{ id: column.id, desc: next === "desc" }] : []
    const direction = next === "asc" ? "ascending" : next === "desc" ? "descending" : "none"
    if (!this.#emit<DataTableSortChangeDetail>("tec-sort-change", { sorting, column: column.id, direction })) return
    this.#table.baseAtoms.sorting.set(sorting)
  }

  #setPage(pageIndex: number, pageSize = this.pageSize): void {
    if (!this.#emit<DataTablePageChangeDetail>("tec-page-change", { pageIndex, pageSize })) {
      this.requestUpdate()
      return
    }
    this.#table.baseAtoms.pagination.set({ pageIndex, pageSize })
  }

  #toggleColumn(id: string): void {
    const column = this.#table.getColumn(id)
    if (!column) return
    const visible = !column.getIsVisible()
    const columnVisibility = { ...this.columnVisibility, [id]: visible }
    if (!this.#emit<DataTableColumnVisibilityChangeDetail>("tec-column-visibility-change", { columnVisibility, column: id, visible })) return
    this.#table.baseAtoms.columnVisibility.set(columnVisibility)
  }

  #onFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    this.#pending.filter = value
    this.#applyFilter(this.#table, value)
  }

  #onRowClick(event: MouseEvent, id: string, selected: boolean): void {
    if (!this.selectable || event.defaultPrevented) return
    for (const node of event.composedPath()) {
      if (node instanceof HTMLTableRowElement) break
      if (node instanceof Element && node.matches(INTERACTIVE)) return
    }
    if (getSelection()?.toString()) return
    this.#toggleRow(id, !selected)
  }

  /* ----------------------------------------------------------- column menu */

  #menuItems(): HTMLElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLElement>(".menu-item") ?? [])]
  }

  #onMenuKeyDown(event: KeyboardEvent): void {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".menu-item")
    if (!item) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      this.#toggleColumn(item.dataset.column!)
    } else if (event.key === "Tab") {
      this._menuOpen = false
    }
  }

  /* -------------------------------------------------------------- lifecycle */

  override connectedCallback(): void {
    super.connectedCallback()
    adoptLightStyles(this, tableLightStyles)
    adoptLightStyles(this, dataTableLightStyles)
    this.#ensureHost()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._menuOpen = false
  }

  #ensureHost(): TecTable {
    if (!this.#host) {
      this.#host = document.createElement("tec-table") as TecTable
      this.#host.slot = "table"
    }
    if (this.#host.parentNode !== this) this.append(this.#host)
    return this.#host
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("columns") || changed.has("sortable") || changed.has("rowId") || changed.has("getRowId")) this.#rebuild()
    const table = this.#ensureTable()
    if (changed.has("data")) table.setOptions((prev: AnyTable) => ({ ...prev, data: this.data }))
    if (changed.has("filterColumn") && this.#pending.filter !== undefined) this.#applyFilter(table, this.#pending.filter)
    if (!this.pagination && changed.has("pagination")) table.baseAtoms.pagination.set({ ...table.atoms.pagination.get(), pageIndex: 0 })
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const host = this.#ensureHost()
    host.density = this.density
    host.striped = this.striped
    render(this.#renderTable(), host, { host: this })
    if (changed.has("_menuOpen")) void this.#popup.setOpen(this._menuOpen)
    if (this._menuOpen) this.#roving.update()
  }

  /* -------------------------------------------------------------- rendering */

  #lang(): string | undefined {
    return localeOf(this)
  }

  #renderHeaderContent(column: DataTableColumn<T>, tcol: AnyColumn): unknown {
    const sorted = tcol.getIsSorted() as "asc" | "desc" | false
    const direction = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : false
    const content =
      typeof column.header === "function" ? column.header({ column, id: tcol.id, sorted: direction }) : (column.header ?? "")
    if (!tcol.getCanSort()) return content
    return html`<button type="button" class="tec-data-table-sort" @click=${() => this.#toggleSort(tcol)}>
      ${content}${svgIcon(sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown)}
    </button>`
  }

  #renderTable(): TemplateResult {
    const table = this.#table
    const headers = table.getFlatHeaders().filter((h: AnyRow) => h.column.getIsVisible())
    const rows = table.getRowModel().rows as AnyRow[]
    const selectable = this.selectable
    const allSelected = selectable && table.getIsAllRowsSelected()
    const someSelected = selectable && !allSelected && table.getIsSomeRowsSelected()
    const colCount = headers.length + (selectable ? 1 : 0)

    const headerRow = html`<tr>
      ${selectable
        ? html`<th scope="col" data-tec-select>
            <tec-checkbox
              aria-label=${this.selectAllLabel}
              .checked=${live(allSelected)}
              .indeterminate=${live(someSelected)}
              ?disabled=${!table.getFilteredRowModel().rows.length}
              @change=${(e: Event) => this.#toggleAll((e.target as HTMLInputElement).checked)}
            ></tec-checkbox>
          </th>`
        : nothing}
      ${headers.map((header: AnyRow) => {
        const column = header.column.columnDef.meta.column as DataTableColumn<T>
        const sorted = header.column.getIsSorted()
        const classes = [column.class, column.headerClass].filter(Boolean).join(" ")
        if (!column.header && !header.column.getCanSort()) {
          // A column without a header (row actions): a hidden label names it, else it is not a header.
          return column.label
            ? html`<th scope="col" class=${classes || nothing} data-column=${header.column.id}><span class="tec-data-table-sr-only">${column.label}</span></th>`
            : html`<td class=${classes || nothing} data-column=${header.column.id}></td>`
        }
        return html`<th
          scope="col"
          class=${classes || nothing}
          data-column=${header.column.id}
          data-align=${column.align && column.align !== "start" ? column.align : nothing}
          aria-sort=${sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : nothing}
          style=${column.width ? styleMap({ width: column.width }) : nothing}
        >
          ${this.#renderHeaderContent(column, header.column)}
        </th>`
      })}
    </tr>`

    const body = rows.length
      ? repeat(
          rows,
          (row) => row.id,
          (row) => {
            const selected = selectable && row.getIsSelected()
            return html`<tr data-state=${selected ? "selected" : nothing} data-row-id=${row.id} @click=${(e: MouseEvent) => this.#onRowClick(e, row.id, selected)}>
              ${selectable
                ? html`<td>
                    <tec-checkbox
                      aria-label=${this.selectRowLabel}
                      .checked=${live(selected)}
                      @change=${(e: Event) => this.#toggleRow(row.id, (e.target as HTMLInputElement).checked)}
                    ></tec-checkbox>
                  </td>`
                : nothing}
              ${row.getVisibleCells().map((cell: AnyRow) => this.#renderCell(cell, row, selected))}
            </tr>`
          }
        )
      : html`<tr data-empty-row>
          <td colspan=${colCount}>${this.emptyLabel}</td>
        </tr>`

    return html`<table aria-label=${this.label || nothing}>
      <thead>
        ${headerRow}
      </thead>
      <tbody ?data-empty=${!rows.length} ?data-selectable=${selectable}>
        ${body}
      </tbody>
    </table>`
  }

  #renderCell(cell: AnyRow, row: AnyRow, selected: boolean): TemplateResult {
    const column = cell.column.columnDef.meta.column as DataTableColumn<T>
    const value = column.accessor !== undefined ? cell.getValue() : undefined
    const context: DataTableCellContext<T> = { value, row: row.original, rowId: row.id, index: row.index, column, selected }
    const content = column.cell ? column.cell(context) : (value ?? "")
    const classes = [column.class, column.cellClass].filter(Boolean).join(" ") || nothing
    const align = column.align && column.align !== "start" ? column.align : nothing
    return column.rowHeader
      ? html`<th scope="row" class=${classes} data-align=${align}>${content}</th>`
      : html`<td class=${classes} data-align=${align}>${content}</td>`
  }

  #renderToolbar() {
    const hideable = this.columnMenu ? (this.#table.getAllLeafColumns() as AnyColumn[]).filter((c) => c.getCanHide()) : []
    return html`<div class="toolbar" part="toolbar">
      ${this.filterable
        ? html`<input
            class="filter"
            part="filter"
            type="search"
            autocomplete="off"
            .value=${live(this.filter)}
            placeholder=${this.filterPlaceholder}
            aria-label=${this.filterLabel || this.filterPlaceholder}
            @input=${this.#onFilterInput}
          />`
        : nothing}
      <slot name="toolbar"></slot>
      ${this.columnMenu
        ? html`<div class="toolbar-end">
            <tec-button class="columns-trigger" part="columns-button" variant="outline" @click=${() => (this._menuOpen = !this._menuOpen)}>
              ${this.columnsLabel}${svgIcon(ChevronDown, "end")}
            </tec-button>
            <div class="menu" part="columns-menu" popover="manual" role="menu" aria-label=${this.columnsLabel} @keydown=${this.#onMenuKeyDown}>
              ${hideable.map((column) => {
                const def = column.columnDef.meta.column as DataTableColumn<T>
                const label = def.label ?? (typeof def.header === "string" ? def.header : column.id)
                return html`<div
                  class="menu-item"
                  role="menuitemcheckbox"
                  tabindex="-1"
                  data-column=${column.id}
                  aria-checked=${column.getIsVisible() ? "true" : "false"}
                  @click=${() => this.#toggleColumn(column.id)}
                >
                  ${label}<span class="menu-check">${svgIcon(Check)}</span>
                </div>`
              })}
            </div>
          </div>`
        : nothing}
    </div>`
  }

  #renderFooter() {
    const table = this.#table
    const format = new Intl.NumberFormat(this.#lang())
    const summary = this.selectable
      ? fill(this.selectionLabel, {
          selected: format.format(table.getFilteredSelectedRowModel().rows.length),
          total: format.format(table.getFilteredRowModel().rows.length),
        })
      : ""
    const sizes = this.pageSizes
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => n > 0)
    const pageSize = this.pageSize
    if (sizes.length && !sizes.includes(pageSize)) sizes.push(pageSize)
    sizes.sort((a, b) => a - b)
    const pageIndex = this.pageIndex
    const pageCount = this.pageCount
    return html`<div class="footer" part="footer">
      <div class="summary" part="summary"><slot name="summary">${summary}</slot></div>
      ${this.pagination
        ? html`<div class="pagination" part="pagination">
            ${sizes.length > 1
              ? html`<label class="page-size">
                  <span>${this.rowsPerPageLabel}</span>
                  <span class="select">
                    <select part="page-size" @change=${(e: Event) => this.#setPage(0, Number((e.target as HTMLSelectElement).value))}>
                      ${sizes.map((n) => html`<option value=${n} ?selected=${n === pageSize}>${format.format(n)}</option>`)}
                    </select>
                    ${svgIcon(ChevronDown)}
                  </span>
                </label>`
              : nothing}
            ${this.pager === "text"
              ? html`<span class="pager pager-text">
                  <tec-button variant="outline" size="sm" ?disabled=${!table.getCanPreviousPage()} @click=${() => this.#setPage(pageIndex - 1)}
                    >${this.previousText}</tec-button
                  >
                  <tec-button variant="outline" size="sm" ?disabled=${!table.getCanNextPage()} @click=${() => this.#setPage(pageIndex + 1)}
                    >${this.nextText}</tec-button
                  >
                </span>`
              : html`<span class="page">${fill(this.pageLabel, { page: format.format(pageIndex + 1), count: format.format(pageCount) })}</span>
                  <span class="pager">
                    <tec-button
                      variant="outline"
                      size="icon-sm"
                      aria-label=${this.previousLabel}
                      ?disabled=${!table.getCanPreviousPage()}
                      @click=${() => this.#setPage(pageIndex - 1)}
                      >${svgIcon(ChevronLeft)}</tec-button
                    >
                    <tec-button
                      variant="outline"
                      size="icon-sm"
                      aria-label=${this.nextLabel}
                      ?disabled=${!table.getCanNextPage()}
                      @click=${() => this.#setPage(pageIndex + 1)}
                      >${svgIcon(ChevronRight)}</tec-button
                    >
                  </span>`}
          </div>`
        : nothing}
    </div>`
  }

  protected override render() {
    this.#ensureTable()
    const toolbar = this.filterable || this.columnMenu || this.querySelector(":scope > [slot='toolbar']")
    const footer = this.selectable || this.pagination || this.querySelector(":scope > [slot='summary']")
    return html`${toolbar ? this.#renderToolbar() : nothing}
      <div class="container" part="table-container"><slot name="table"></slot></div>
      ${footer ? this.#renderFooter() : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-data-table": TecDataTable
  }
}
