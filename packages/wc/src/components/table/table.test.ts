import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecTable } from "./table.js"
import "./define.js"

const invoices = html`<tec-table>
  <table aria-label="Invoices">
    <caption>
      A list of your recent invoices.
    </caption>
    <thead>
      <tr>
        <th scope="col">Invoice</th>
        <th scope="col">Status</th>
        <th scope="col" class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">INV001</th>
        <td>Paid</td>
        <td data-align="end">$250.00</td>
      </tr>
      <tr data-state="selected">
        <th scope="row">INV002</th>
        <td>Pending</td>
        <td data-align="end">$150.00</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total</td>
        <td data-align="end">$400.00</td>
      </tr>
    </tfoot>
  </table>
</tec-table>`

const css = (el: Element) => getComputedStyle(el)
const varColor = (el: Element, name: string) => {
  const probe = document.createElement("span")
  probe.style.color = `var(${name})`
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe("tec-table", () => {
  it("keeps native table semantics", async () => {
    const el = await fixture<TecTable>(invoices)
    const table = el.table!
    expect(await axNode(table)).toMatchObject({ role: "table", name: "Invoices" })
    expect(await axNode(table.querySelector("thead th")!)).toMatchObject({ role: "columnheader", name: "Invoice" })
    expect(await axNode(table.querySelector("tbody th")!)).toMatchObject({ role: "rowheader", name: "INV001" })
    expect(await axNode(table.querySelector("tbody td")!)).toMatchObject({ role: "cell", name: "Paid" })
    await expectAccessible(el)
  })

  it("styles the light-DOM parts with the Tecton table colours", async () => {
    const el = await fixture<TecTable>(invoices)
    const th = el.querySelector("thead th")!
    expect(css(th).backgroundColor).toBe(varColor(el, "--tec-table-header"))
    expect(css(th).height).toBe("48px")
    expect(css(th).textAlign).toBe("start")
    expect(css(th).fontWeight).toBe("500")
    const bodyTh = el.querySelector("tbody th")!
    expect(css(bodyTh).fontWeight).toBe("500")
    expect(css(bodyTh).paddingTop).toBe("12px")
    const [first, selected] = el.querySelectorAll("tbody tr")
    expect(css(first!).borderBottomWidth).toBe("1px")
    expect(css(selected!).borderBottomWidth).toBe("0px")
    expect(css(selected!).backgroundColor).toBe(varColor(el, "--tec-table-active"))
    expect(css(el.querySelector("tfoot")!).backgroundColor).toBe(varColor(el, "--tec-muted"))
    expect(css(el.querySelector("td[data-align=end]")!).textAlign).toBe("end")
    expect(css(el.querySelector("caption")!).captionSide).toBe("bottom")
  })

  it("lets utility classes and app CSS override the part styles", async () => {
    const style = document.createElement("style")
    style.textContent = "@layer components, utilities; @layer utilities { .amount { text-align: right } }"
    document.head.prepend(style)
    try {
      const el = await fixture<TecTable>(invoices)
      expect(css(el.querySelector("th.amount")!).textAlign).toBe("right")
    } finally {
      style.remove()
    }
  })

  it("supports compact density and striped rows", async () => {
    const el = await fixture<TecTable>(invoices)
    el.density = "compact"
    el.striped = true
    await el.updateComplete
    expect(css(el.querySelector("thead th")!).height).toBe("32px")
    expect(css(el.querySelector("tbody td")!).paddingTop).toBe("4px")
    const rows = el.querySelectorAll("tbody tr")
    rows[1]!.removeAttribute("data-state")
    expect(css(rows[1]!).backgroundColor).toBe(varColor(el, "--tec-surface-alt"))
  })

  it("adopts its styles into an enclosing shadow root", async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`)
    const root = host.attachShadow({ mode: "open" })
    root.innerHTML = `<tec-table><table aria-label="T"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></tec-table>`
    await (root.querySelector("tec-table") as TecTable).updateComplete
    expect(css(root.querySelector("th")!).height).toBe("48px")
  })

  it("scrolls wide tables horizontally inside its container", async () => {
    const el = await fixture<TecTable>(html`<tec-table style="width: 200px">
      <table aria-label="Wide"><tbody><tr><td>${"x".repeat(80)}</td></tr></tbody></table>
    </tec-table>`)
    const base = el.shadowRoot!.querySelector<HTMLElement>(".base")!
    expect(base.scrollWidth).toBeGreaterThan(base.clientWidth)
    expect(el.getBoundingClientRect().width).toBe(200)
  })
})
