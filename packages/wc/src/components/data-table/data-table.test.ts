import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecCheckbox } from "../checkbox/checkbox.js"
import type { DataTableColumn, TecDataTable } from "./data-table.js"
import "./define.js"

type Payment = { id: string; amount: number; status: string; email: string }

const data: Payment[] = [
  { id: "m5gr84i9", amount: 316, status: "success", email: "ken99@example.com" },
  { id: "3u1reuv4", amount: 242, status: "success", email: "Abe45@example.com" },
  { id: "derv1ws0", amount: 837, status: "processing", email: "Monserrat44@example.com" },
  { id: "5kma53ae", amount: 874, status: "success", email: "Silas22@example.com" },
  { id: "bhqecj4p", amount: 721, status: "failed", email: "carmella@example.com" },
]

const columns: DataTableColumn<Payment>[] = [
  { accessor: "status", header: "Status" },
  { accessor: "email", header: "Email", rowHeader: true, sortable: true },
  {
    accessor: "amount",
    header: "Amount",
    align: "end",
    cell: ({ value }) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value as number),
  },
  { id: "actions", header: "", cell: ({ rowId }) => html`<button type="button" data-action=${rowId}>Open</button>` },
]

async function setup(attrs = "", options: { columns?: DataTableColumn<Payment>[]; rows?: Payment[] } = {}) {
  const el = await fixture<TecDataTable<Payment>>(`<tec-data-table label="Payments" ${attrs}></tec-data-table>`)
  el.columns = options.columns ?? columns
  el.data = options.rows ?? data
  await el.updateComplete
  await el.updateComplete
  return el
}

const bodyRows = (el: Element) => [...el.querySelectorAll("tbody tr")]
const emails = (el: Element) => bodyRows(el).map((tr) => tr.querySelector("th")?.textContent?.trim())
const shadow = <E extends Element = HTMLElement>(el: Element, sel: string) => el.shadowRoot!.querySelector<E>(sel)!
const checkboxInput = (cb: TecCheckbox) => cb.shadowRoot!.querySelector("input")!

describe("tec-data-table", () => {
  it("renders a native table in its light DOM", async () => {
    const el = await setup()
    const table = el.querySelector("tec-table > table")!
    expect(await axNode(table)).toMatchObject({ role: "table", name: "Payments" })
    expect([...table.querySelectorAll("thead :is(th, td)")].map((th) => th.textContent!.trim())).toEqual(["Status", "Email", "Amount", ""])
    expect(await axNode(table.querySelector("tbody th")!)).toMatchObject({ role: "rowheader", name: "ken99@example.com" })
    expect(table.querySelector("tbody td[data-align=end]")!.textContent!.trim()).toBe("$316.00")
    expect(table.querySelector("[data-action=derv1ws0]")).not.toBeNull()
    await expectAccessible(el)
  })

  it("sorts from the header button, sets aria-sort and fires tec-sort-change", async () => {
    const el = await setup()
    const events = recordEvents<CustomEvent>(el, "tec-sort-change")
    const th = el.querySelector<HTMLElement>("th[data-column=email]")!
    const button = th.querySelector("button")!
    expect(await axNode(button)).toMatchObject({ role: "button", name: "Email" })
    expect(el.querySelector("th[data-column=status] button")).toBeNull()

    await userEvent.click(button)
    await el.updateComplete
    expect(th.getAttribute("aria-sort")).toBe("ascending")
    expect(emails(el)[0]).toBe("Abe45@example.com")
    expect(events.events[0]!.detail).toMatchObject({ column: "email", direction: "ascending", sorting: [{ id: "email", desc: false }] })

    await userEvent.click(button)
    await el.updateComplete
    expect(th.getAttribute("aria-sort")).toBe("descending")
    expect(emails(el)[0]).toBe("Silas22@example.com")

    el.addEventListener("tec-sort-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(button)
    await el.updateComplete
    expect(th.getAttribute("aria-sort")).toBe("descending")
  })

  it("sorts every accessor column with the sortable attribute", async () => {
    const el = await setup("sortable")
    expect(el.querySelectorAll("thead th button").length).toBe(3)
    el.sorting = [{ id: "amount", desc: true }]
    await el.updateComplete
    expect(emails(el)[0]).toBe("Silas22@example.com")
  })

  it("filters rows from the filter input", async () => {
    const el = await setup('filterable filter-column="email" filter-placeholder="Filter emails..."')
    const input = shadow<HTMLInputElement>(el, "input.filter")
    expect(await axNode(input)).toMatchObject({ name: "Filter emails..." })
    await userEvent.click(input)
    await userEvent.keyboard("ca")
    await el.updateComplete
    expect(el.filter).toBe("ca")
    expect(emails(el)).toEqual(["carmella@example.com"])
    await userEvent.keyboard("zz")
    await el.updateComplete
    expect(el.querySelector("tbody")!.hasAttribute("data-empty")).toBe(true)
    expect(el.querySelector("tbody td")!.textContent!.trim()).toBe("No results.")
  })

  it("filters across every filterable column without filter-column", async () => {
    const el = await setup("filterable")
    el.filter = "failed"
    await el.updateComplete
    expect(emails(el)).toEqual(["carmella@example.com"])
  })

  it("selects rows with checkboxes and row clicks", async () => {
    const el = await setup("selectable")
    const events = recordEvents<CustomEvent>(el, "tec-selection-change")
    const boxes = [...el.querySelectorAll<TecCheckbox>("tbody tec-checkbox")]
    expect(await axNode(checkboxInput(boxes[0]!))).toMatchObject({ role: "checkbox", name: "Select row", checked: "false" })
    await userEvent.click(checkboxInput(boxes[1]!))
    await el.updateComplete
    expect(el.selection).toEqual(["3u1reuv4"])
    expect(bodyRows(el)[1]!.getAttribute("data-state")).toBe("selected")
    expect(events.events[0]!.detail).toEqual({ selection: ["3u1reuv4"] })
    expect(shadow(el, ".summary").textContent!.trim()).toBe("1 of 5 row(s) selected.")

    const all = el.querySelector<TecCheckbox>("thead tec-checkbox")!
    expect(all.indeterminate).toBe(true)
    await userEvent.click(checkboxInput(all))
    await el.updateComplete
    expect(el.selection).toHaveLength(5)
    expect(all.checked).toBe(true)

    // A click on the row (not on a control) toggles it; a click on a control inside does not.
    await userEvent.click(bodyRows(el)[2]!.querySelector("td")!)
    await el.updateComplete
    expect(el.selection).not.toContain("derv1ws0")
    await userEvent.click(el.querySelector("[data-action=m5gr84i9]")!)
    expect(el.selection).toContain("m5gr84i9")
  })

  it("keeps the selection when tec-selection-change is prevented", async () => {
    const el = await setup("selectable")
    el.addEventListener("tec-selection-change", (e) => e.preventDefault())
    const box = el.querySelector<TecCheckbox>("tbody tec-checkbox")!
    await userEvent.click(checkboxInput(box))
    await el.updateComplete
    expect(el.selection).toEqual([])
    expect(box.checked).toBe(false)
  })

  it("paginates with a page-size select and previous / next buttons", async () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ ...data[i % 5]!, id: `r${i}`, email: `user${String(i).padStart(2, "0")}@example.com` }))
    const el = await setup('pagination page-size="5" page-sizes="5 10 25"', { rows })
    const events = recordEvents<CustomEvent>(el, "tec-page-change")
    expect(bodyRows(el)).toHaveLength(5)
    expect(shadow(el, ".page").textContent).toBe("Page 1 of 5")
    const [prev, next] = [...el.shadowRoot!.querySelectorAll("tec-button")]
    expect(prev!.disabled).toBe(true)
    expect(await axNode(next!.control)).toMatchObject({ name: "Next page" })
    await userEvent.click(next!)
    await el.updateComplete
    expect(el.pageIndex).toBe(1)
    expect(emails(el)[0]).toBe("user05@example.com")
    expect(events.events[0]!.detail).toEqual({ pageIndex: 1, pageSize: 5 })
    const select = shadow<HTMLSelectElement>(el, "select")
    expect(await axNode(select)).toMatchObject({ name: "Rows per page" })
    await userEvent.selectOptions(select, "10")
    await el.updateComplete
    expect(el.pageSize).toBe(10)
    expect(el.pageIndex).toBe(0)
    expect(bodyRows(el)).toHaveLength(10)
    expect(shadow(el, ".page").textContent).toBe("Page 1 of 3")
    await expectAccessible(el)
  })

  it("shows and hides columns from the column menu", async () => {
    const el = await setup("column-menu")
    const events = recordEvents<CustomEvent>(el, "tec-column-visibility-change")
    const trigger = shadow(el, ".columns-trigger") as HTMLElement & { control: HTMLElement }
    await userEvent.click(trigger)
    const menu = shadow(el, ".menu")
    await waitUntil(() => menu.matches(":popover-open"))
    await animationsFinished(menu)
    const items = [...menu.querySelectorAll<HTMLElement>("[role=menuitemcheckbox]")]
    expect(items.map((i) => i.textContent!.trim())).toEqual(["Status", "Email", "Amount"])
    expect(await axNode(trigger.control)).toMatchObject({ expanded: "true", hasPopup: "menu" })
    expect(await axNode(items[0]!)).toMatchObject({ role: "menuitemcheckbox", name: "Status", checked: "true" })
    await waitUntil(() => deepActiveElement() === items[0])
    await userEvent.keyboard(" ")
    await el.updateComplete
    expect(el.querySelector("th[data-column=status]")).toBeNull()
    expect(el.columnVisibility).toEqual({ status: false })
    expect(events.events[0]!.detail).toMatchObject({ column: "status", visible: false })
    expect(menu.matches(":popover-open")).toBe(true)
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(items[1])
    await expectAccessible(el)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !menu.matches(":popover-open"))
    expect(deepActiveElement()).toBe(trigger.control)
  })

  it("hides columns marked hidden initially and renders compact / striped tables", async () => {
    const el = await setup('density="compact" striped', { columns: [...columns.slice(0, 2), { ...columns[2]!, hidden: true }] })
    expect(el.querySelector("th[data-column=amount]")).toBeNull()
    const table = el.querySelector("tec-table")!
    expect(table.density).toBe("compact")
    expect(table.striped).toBe(true)
  })

  it("does not fire events for programmatic changes", async () => {
    const el = await setup("selectable pagination sortable")
    const events = [
      recordEvents(el, "tec-selection-change"),
      recordEvents(el, "tec-sort-change"),
      recordEvents(el, "tec-page-change"),
    ]
    el.selection = ["bhqecj4p"]
    el.sorting = [{ id: "email", desc: false }]
    el.pageIndex = 0
    await el.updateComplete
    expect(el.selectedRows.map((r) => r.id)).toEqual(["bhqecj4p"])
    expect(events.every((r) => r.events.length === 0)).toBe(true)
  })

  it("keeps state when properties are set before it connects", async () => {
    const el = document.createElement("tec-data-table") as unknown as TecDataTable<Payment>
    el.selectable = true
    el.selection = ["m5gr84i9"]
    el.sorting = [{ id: "email", desc: false }]
    el.columns = columns
    el.data = data
    const root = await fixture<HTMLDivElement>(html`<div></div>`)
    root.append(el)
    await el.updateComplete
    await el.updateComplete
    expect(el.selection).toEqual(["m5gr84i9"])
    expect(emails(el)[0]).toBe("Abe45@example.com")
  })
})
