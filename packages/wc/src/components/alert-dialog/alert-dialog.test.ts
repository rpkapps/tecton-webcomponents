import { html } from "lit"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { aTimeout, animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, waitUntil } from "../../internal/test-utils.js"
import type { TecAlertDialog } from "./alert-dialog.js"
import "./define.js"

const dlg = (el: Element) => el.shadowRoot!.querySelector("dialog")!
const panel = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

const basic = (o: { size?: string; media?: boolean; dismissable?: boolean } = {}) => html`<div>
  <tec-alert-dialog size=${o.size ?? "default"} ?dismissable=${o.dismissable}>
    <tec-button slot="trigger" variant="outline">Show Dialog</tec-button>
    <tec-alert-dialog-header>
      ${o.media ? html`<tec-alert-dialog-media><svg aria-hidden="true" viewBox="0 0 24 24"></svg></tec-alert-dialog-media>` : null}
      <tec-alert-dialog-title>Are you absolutely sure?</tec-alert-dialog-title>
      <tec-alert-dialog-description>This action cannot be undone.</tec-alert-dialog-description>
    </tec-alert-dialog-header>
    <tec-alert-dialog-footer>
      <tec-alert-dialog-cancel>Cancel</tec-alert-dialog-cancel>
      <tec-alert-dialog-action>Continue</tec-alert-dialog-action>
    </tec-alert-dialog-footer>
  </tec-alert-dialog>
</div>`

async function open(el: TecAlertDialog) {
  await userEvent.click(el.querySelector("[slot=trigger]")!)
  await waitUntil(() => dlg(el).open, "open")
  await animationsFinished(panel(el))
}

describe("tec-alert-dialog", () => {
  it("is an alertdialog named and described by its parts; pointer open focuses the dialog (no ring)", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-alert-dialog")!
    await open(el)
    expect(await axNode(dlg(el))).toMatchObject({ role: "alertdialog", name: "Are you absolutely sure?", description: "This action cannot be undone." })
    expect(deepActiveElement()).toBe(dlg(el))
    expect(el.querySelector("tec-alert-dialog-cancel")!.matches(":state(focus-visible)")).toBe(false)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-alert-dialog-cancel")!))
    expect(el.querySelector("tec-alert-dialog-cancel")!.getAttribute("variant")).toBe("outline")
    expect(el.querySelector("tec-alert-dialog-action")!.getAttribute("variant")).toBe("default")
    expect(el.shadowRoot!.querySelector(".close")).toBeNull()
    await expectAccessible(root)
  })

  it("keyboard open focuses Cancel", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-alert-dialog")!
    innerButton(el.querySelector("[slot=trigger]")!).focus()
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => dlg(el).open, "open")
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-alert-dialog-cancel")!))
  })

  it("underlines description links despite document resets", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <style>a { color: inherit; text-decoration: inherit }</style>
      <tec-alert-dialog-description>View <a href="#">Settings</a></tec-alert-dialog-description>
    </div>`)
    expect(getComputedStyle(root.querySelector("a")!).textDecorationLine).toBe("underline")
  })

  it("ignores overlay presses unless dismissable; Escape closes", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-alert-dialog")!
    await open(el)
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect(el.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("[slot=trigger]")!))

    const root2 = await fixture<HTMLElement>(basic({ dismissable: true }))
    const el2 = root2.querySelector("tec-alert-dialog")!
    await open(el2)
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect(el2.open).toBe(false)
  })

  it("action and cancel close with their reasons", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-alert-dialog")!
    await open(el)
    let change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(el.querySelector("tec-alert-dialog-action")!)
    expect((await change).detail).toEqual({ open: false, reason: "action" })
    await waitUntil(() => !dlg(el).open, "closed")
    innerButton(el.querySelector("[slot=trigger]")!).focus()
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => dlg(el).open, "open")
    change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.keyboard("{Enter}")
    expect((await change).detail).toEqual({ open: false, reason: "cancel" })
  })

  it("an action listener can keep it open", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-alert-dialog")!
    el.querySelector("tec-alert-dialog-action")!.addEventListener("click", (e) => e.preventDefault())
    await open(el)
    await userEvent.click(el.querySelector("tec-alert-dialog-action")!)
    await aTimeout(20)
    expect(el.open).toBe(true)
  })

  it("sizes: 20rem narrow, 32rem from sm (default), sm keeps 20rem with a two-column footer", async () => {
    await page.viewport(1024, 768)
    try {
      const root = await fixture<HTMLElement>(basic({ media: true }))
      const el = root.querySelector("tec-alert-dialog")!
      await open(el)
      expect(Math.round(panel(el).getBoundingClientRect().width)).toBe(512)
      const header = el.querySelector("tec-alert-dialog-header")!
      expect(getComputedStyle(header).textAlign).toBe("start")
      const media = el.querySelector("tec-alert-dialog-media")!.getBoundingClientRect()
      const title = el.querySelector("tec-alert-dialog-title")!.getBoundingClientRect()
      expect(title.left).toBeGreaterThan(media.right)
      expect(getComputedStyle(el.querySelector("tec-alert-dialog-title")!).fontSize).toBe("18px")
      el.hide()

      const root2 = await fixture<HTMLElement>(basic({ size: "sm", media: true }))
      const el2 = root2.querySelector("tec-alert-dialog")!
      await open(el2)
      expect(Math.round(panel(el2).getBoundingClientRect().width)).toBe(320)
      expect(getComputedStyle(el2.querySelector("tec-alert-dialog-header")!).textAlign).toBe("center")
      const [cancel, action] = [...el2.querySelectorAll("tec-alert-dialog-footer > *")].map((b) => b.getBoundingClientRect())
      expect(Math.round(cancel!.width)).toBe(Math.round(action!.width))
      expect(cancel!.top).toBe(action!.top)
      expect(cancel!.left).toBeLessThan(action!.left)
      await expectAccessible(root2)
    } finally {
      await page.viewport(414, 896)
    }
  })
})
