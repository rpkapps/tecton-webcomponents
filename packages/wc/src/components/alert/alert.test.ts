import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecAlert } from "./alert.js"
import "./define.js"

const icon = html`<svg slot="icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>`
const part = (el: Element, name: string) => el.shadowRoot!.querySelector(`[part=${name}]`) as HTMLElement
const resolve = (el: Element, value: string) => {
  const probe = document.createElement("span")
  probe.style.color = value
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe("tec-alert", () => {
  it("has role=alert and lays out icon, title and description", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-alert>${icon}<tec-alert-title>Payment successful</tec-alert-title><tec-alert-description>Receipt sent.</tec-alert-description></tec-alert>
    </div>`)
    const el = root.querySelector<TecAlert>("tec-alert")!
    expect(el.hasAttribute("role")).toBe(false)
    expect(await axNode(el)).toMatchObject({ role: "alert" })
    expect(el.matches(":state(has-icon)")).toBe(true)
    const base = getComputedStyle(part(el, "base"))
    expect(base.paddingTop).toBe("12px")
    expect(base.paddingLeft).toBe("16px")
    expect(base.backgroundColor).toBe(resolve(root, "var(--tec-card)"))
    expect(base.borderTopColor).toBe(resolve(root, "var(--tec-border)"))
    // the alert box: 12 + 20 + 2 + 20 + 12 + 2 borders
    expect(el.getBoundingClientRect().height).toBe(68)
    const svg = el.querySelector("svg")!.getBoundingClientRect()
    const title = el.querySelector("tec-alert-title")!.getBoundingClientRect()
    const desc = el.querySelector("tec-alert-description")!
    expect(svg.width).toBe(16)
    expect(title.left - svg.right).toBe(10)
    expect(desc.getBoundingClientRect().left).toBe(title.left)
    expect(getComputedStyle(desc).color).toBe(resolve(root, "var(--tec-muted-foreground)"))
    expect(getComputedStyle(el.querySelector("tec-alert-title")!).fontWeight).toBe("500")
    await expectAccessible(root)
  })

  it("lets authors pick role=status", async () => {
    const el = await fixture<TecAlert>(html`<tec-alert role="status"><tec-alert-title>Saved</tec-alert-title></tec-alert>`)
    expect(await axNode(el)).toMatchObject({ role: "status" })
  })

  it("colours severities and appearances", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-alert variant="success"><tec-alert-title>a</tec-alert-title><tec-alert-description>d</tec-alert-description></tec-alert>
      <tec-alert variant="warning" appearance="outline"><tec-alert-title>b</tec-alert-title></tec-alert>
      <tec-alert variant="destructive" appearance="filled"><tec-alert-title>c</tec-alert-title><tec-alert-description>d</tec-alert-description></tec-alert>
      <tec-alert appearance="filled"><tec-alert-title>e</tec-alert-title></tec-alert>
    </div>`)
    const [success, warning, destructive, neutral] = [...root.querySelectorAll("tec-alert")]
    const b = (el: Element) => getComputedStyle(part(el, "base"))
    const t = (el: Element) => getComputedStyle(el.querySelector("tec-alert-title")!).color
    expect(b(success!).backgroundColor).toBe(resolve(root, "var(--tec-card)"))
    expect(t(success!)).toBe(resolve(root, "var(--tec-success)"))
    expect(getComputedStyle(success!.querySelector("tec-alert-description")!).color).toBe(resolve(root, "color-mix(in oklab, var(--tec-success) 90%, transparent)"))
    expect(b(warning!).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(b(warning!).borderTopColor).toBe(resolve(root, "var(--tec-warning)"))
    expect(b(destructive!).backgroundColor).toBe(resolve(root, "var(--tec-destructive-surface)"))
    expect(b(destructive!).borderTopColor).toBe("rgba(0, 0, 0, 0)")
    expect(t(destructive!)).toBe(resolve(root, "var(--tec-destructive-surface-foreground)"))
    expect(getComputedStyle(destructive!.querySelector("tec-alert-description")!).color).toBe(
      resolve(root, "color-mix(in oklab, var(--tec-destructive-surface-foreground) 85%, transparent)")
    )
    expect(b(neutral!).backgroundColor).toBe(resolve(root, "var(--tec-neutral-surface)"))
  })

  it("puts actions in the top-end corner and tints ghost buttons", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px">
      <tec-alert variant="info">
        <tec-alert-title>Model out of date</tec-alert-title>
        <tec-button slot="action" variant="ghost" size="xs">View</tec-button>
      </tec-alert>
    </div>`)
    const el = root.querySelector("tec-alert")!
    expect(el.matches(":state(has-action)")).toBe(true)
    expect(getComputedStyle(part(el, "base")).paddingRight).toBe("72px")
    const button = el.querySelector("tec-button")!
    const r = button.getBoundingClientRect()
    expect(r.height).toBe(28)
    // top-2.5 / right-3 inside the 1px border
    expect(el.getBoundingClientRect().right - r.right).toBe(13)
    expect(r.top - el.getBoundingClientRect().top).toBe(11)
    expect(getComputedStyle(button.shadowRoot!.querySelector(".base")!).color).toBe(resolve(root, "var(--tec-info)"))
  })

  it("mirrors the action corner in RTL", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 400px" dir="rtl">
      <tec-alert><tec-alert-title>عنوان</tec-alert-title><tec-button slot="action" size="xs">زر</tec-button></tec-alert>
    </div>`)
    const el = root.querySelector("tec-alert")!
    expect(el.querySelector("tec-button")!.getBoundingClientRect().left - el.getBoundingClientRect().left).toBe(13)
    expect(getComputedStyle(part(el, "base")).paddingLeft).toBe("72px")
  })

  it("dismissible: renders a named close button that fires tec-dismiss and hides the alert", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-alert dismissible variant="success"><tec-alert-title>Done</tec-alert-title></tec-alert></div>`)
    const el = root.querySelector<TecAlert>("tec-alert")!
    const { events } = recordEvents(el, "tec-dismiss")
    expect(await axTree(el)).toContain("button: Dismiss")
    const close = part(el, "dismiss")
    const stop = (e: Event) => e.preventDefault()
    el.addEventListener("tec-dismiss", stop)
    await userEvent.click(close)
    expect(events.length).toBe(1)
    expect(el.hidden).toBe(false)
    el.removeEventListener("tec-dismiss", stop)
    await userEvent.click(close)
    expect(events.length).toBe(2)
    expect(el.hidden).toBe(true)
    expect(getComputedStyle(el).display).toBe("none")
  })

  it("dismiss-label localises the close button", async () => {
    const el = await fixture<TecAlert>(html`<tec-alert dismissible dismiss-label="Fermer"><tec-alert-title>x</tec-alert-title></tec-alert>`)
    expect(await axTree(el)).toContain("button: Fermer")
    await expectAccessible(el)
  })
})
