import { html, type CSSResult } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { tableLightStyles, tableStyles } from "./table.styles.js"

export type TableDensity = "default" | "compact"

const adopted = new WeakMap<CSSResult, WeakSet<Document | ShadowRoot>>()

/**
 * Adopts `styles` into the document or shadow root that contains `host`, once per root. Used for
 * styles of light-DOM content a shadow root cannot reach (the parts of a native `<table>`).
 * @internal
 */
export function adoptLightStyles(host: Element, styles: CSSResult): void {
  const root = host.getRootNode()
  if (!(root instanceof Document || root instanceof ShadowRoot)) return
  const sheet = styles.styleSheet
  if (!sheet) return
  let roots = adopted.get(styles)
  if (!roots) adopted.set(styles, (roots = new WeakSet()))
  if (roots.has(root) && root.adoptedStyleSheets.includes(sheet)) return
  roots.add(root)
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}

/**
 * Wrap a native `<table>`. The table keeps its native semantics (table, row and column headers,
 * `colspan`, `<caption>` as its name) and assistive technology's table navigation; `tec-table`
 * provides the Tecton look and a horizontally scrolling container.
 *
 * The parts are the native elements: `<thead>` (header band, `--tec-table-header`), `<tbody>`,
 * `<tfoot>` (muted band), `<tr>`, `<th scope="col">`, `<th scope="row">` (row header, rendered like a
 * cell in medium weight), `<td>` and `<caption>` (below the table). Their styles are adopted into the
 * document (or the enclosing shadow root) inside `@layer components`, so utility classes on the cells
 * (`class="text-right w-[100px]"`) and app stylesheets override them.
 *
 * States: a row with `data-state="selected"` (or `aria-selected="true"` in a grid) uses
 * `--tec-table-active`; a row containing an expanded control (`aria-expanded="true"`) is tinted; a
 * `<tbody data-empty>` renders its single cell as a centred empty state; `data-align="end"` /
 * `"center"` on a cell aligns it.
 *
 * @summary A responsive table: Tecton styling for a native HTML table.
 *
 * @tag tec-table
 *
 * @slot - One native `<table>` (with `thead`, `tbody`, `tfoot`, `caption`).
 *
 * @csspart base - The container that scrolls the table horizontally when it is too wide.
 */
export class TecTable extends TectonElement {
  static styles = [hostStyles, tableStyles]

  /** Row density: `compact` shortens rows and uses the extra-small text size. */
  @property({ reflect: true }) density: TableDensity = "default"

  /** Alternates the background of body rows (`--tec-surface-alt` on even rows). */
  @property({ type: Boolean, reflect: true }) striped = false

  override connectedCallback(): void {
    super.connectedCallback()
    adoptLightStyles(this, tableLightStyles)
  }

  /** The slotted native table. */
  get table(): HTMLTableElement | null {
    return this.querySelector(":scope > table")
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-table": TecTable
  }
}
