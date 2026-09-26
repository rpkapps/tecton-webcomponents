/** Any row object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableRow = Record<string, any>

/** Built-in sort functions (TanStack Table's), or a comparator of two row objects. */
export type DataTableSortFn<T extends DataTableRow = DataTableRow> =
  | "auto"
  | "alphanumeric"
  | "text"
  | "basic"
  | "datetime"
  | ((a: T, b: T, columnId: string) => number)

/** What a header renderer receives. */
export interface DataTableHeaderContext<T extends DataTableRow = DataTableRow> {
  column: DataTableColumn<T>
  /** The column id. */
  id: string
  /** The current sort direction of the column. */
  sorted: "ascending" | "descending" | false
}

/** What a cell renderer receives. */
export interface DataTableCellContext<T extends DataTableRow = DataTableRow> {
  /** The accessor's value (undefined for display columns). */
  value: unknown
  /** The row object. */
  row: T
  /** The row id (`row-id` key, `getRowId()`, or the index). */
  rowId: string
  /** Index of the row in `data`. */
  index: number
  column: DataTableColumn<T>
  /** Whether the row is selected. */
  selected: boolean
}

/**
 * A column of `tec-data-table`. Renderers return anything Lit can render: a string, a number, a DOM
 * node, or a Lit `html` template (`html` is re-exported by `@tecton/wc/data-table/data-table.js`).
 */
export interface DataTableColumn<T extends DataTableRow = DataTableRow> {
  /** Unique id. Defaults to `accessor` when it is a key. Display columns (no accessor) need one. */
  id?: string
  /** A key of the row object, or a function returning the cell value (used for sorting and filtering). */
  accessor?: (keyof T & string) | ((row: T, index: number) => unknown)
  /** Header content: text, or a renderer. */
  header?: string | ((context: DataTableHeaderContext<T>) => unknown)
  /** Name in the column visibility menu. Defaults to the header text, else the id. */
  label?: string
  /** Cell content renderer. Defaults to the value as text. */
  cell?: (context: DataTableCellContext<T>) => unknown
  /** Sortable by the header button. Defaults to the table's `sortable` for accessor columns. */
  sortable?: boolean
  /** Searched by the filter input. Default `true` for accessor columns. */
  filterable?: boolean
  /** Listed in the column visibility menu. Default `true` for accessor columns. */
  hideable?: boolean
  /** Initially hidden (the column menu can show it). */
  hidden?: boolean
  /** Text alignment of the header and the cells (`end` for numbers). */
  align?: "start" | "center" | "end"
  /** The cells are row headers (`<th scope="row">`) — usually the identifying column. */
  rowHeader?: boolean
  /** Classes on the header cell and every body cell (e.g. `hidden md:table-cell`). */
  class?: string
  /** Classes on the header cell only. */
  headerClass?: string
  /** Classes on the body cells only. */
  cellClass?: string
  /** CSS width of the column (`"100px"`, `"40%"`). */
  width?: string
  /** How the column sorts. Default `"auto"` (text for strings, numeric for numbers). */
  sortFn?: DataTableSortFn<T>
  /** Sort descending on the first press (default: descending first for numbers). */
  sortDescFirst?: boolean
}

/** One sort criterion (TanStack's `ColumnSort`). */
export interface DataTableSort {
  id: string
  desc: boolean
}

/** Detail of `tec-sort-change`. */
export interface DataTableSortChangeDetail {
  sorting: DataTableSort[]
  /** The column whose header was pressed. */
  column: string
  direction: "ascending" | "descending" | "none"
}

/** Detail of `tec-selection-change`. */
export interface DataTableSelectionChangeDetail {
  /** Ids of every selected row after the change. */
  selection: string[]
}

/** Detail of `tec-page-change`. */
export interface DataTablePageChangeDetail {
  pageIndex: number
  pageSize: number
}

/** Detail of `tec-column-visibility-change`. */
export interface DataTableColumnVisibilityChangeDetail {
  /** Visibility of every hideable column (`false` = hidden). */
  columnVisibility: Record<string, boolean>
  /** The column that was toggled. */
  column: string
  visible: boolean
}
