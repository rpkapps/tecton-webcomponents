import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, animationsFinished, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { isScrollLocked } from "../../internal/scroll-lock.js"
import type { TecDialog } from "./dialog.js"
import "./define.js"

const dlg = (el: TecDialog) => el.shadowRoot!.querySelector("dialog")!
const panel = (el: TecDialog) => el.shadowRoot!.querySelector<HTMLElement>(".content")!
const innerButton = (b: Element) => b.shadowRoot!.querySelector("button")!

const basic = (attrs: { persistent?: boolean; hideClose?: boolean; open?: boolean } = {}) => html`<div>
  <button id="before">Before</button>
  <tec-dialog ?persistent=${attrs.persistent} ?hide-close=${attrs.hideClose} ?open=${attrs.open}>
    <tec-button slot="trigger" variant="outline">Open Dialog</tec-button>
    <tec-dialog-header>
      <tec-dialog-title>Edit profile</tec-dialog-title>
      <tec-dialog-description>Make changes to your profile here.</tec-dialog-description>
    </tec-dialog-header>
    <input aria-label="Name" value="Pedro Duarte" />
    <tec-dialog-footer>
      <tec-dialog-close id="cancel">Cancel</tec-dialog-close>
      <tec-button id="save">Save changes</tec-button>
    </tec-dialog-footer>
  </tec-dialog>
</div>`

async function open(el: TecDialog) {
  await userEvent.click(el.querySelector("[slot=trigger]")!)
  await waitUntil(() => dlg(el).open, "dialog open")
  await animationsFinished(panel(el))
}

describe("tec-dialog", () => {
  it("opens modally from the trigger, focuses the named dialog and locks scroll", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    const trigger = el.querySelector("tec-button")!
    expect(await axNode(innerButton(trigger))).toMatchObject({ role: "button", name: "Open Dialog", expanded: "false" })
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await open(el)
    expect((await change).detail).toEqual({ open: true, reason: "trigger" })
    expect(dlg(el).matches(":modal")).toBe(true)
    expect(deepActiveElement()).toBe(dlg(el))
    expect(isScrollLocked()).toBe(true)
    expect(await axNode(dlg(el))).toMatchObject({ role: "dialog", name: "Edit profile", description: "Make changes to your profile here." })
    expect(await axNode(el.querySelector("tec-dialog-title")!)).toMatchObject({ role: "heading", name: "Edit profile" })
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await expectAccessible(root)
  })

  it("centres the panel with the Tecton metrics", async () => {
    const root = await fixture<HTMLElement>(basic({ open: true }))
    const el = root.querySelector("tec-dialog")!
    await waitUntil(() => dlg(el).open, "open")
    await animationsFinished(panel(el))
    const r = panel(el).getBoundingClientRect()
    expect(Math.round(r.left + r.width / 2)).toBe(Math.round(innerWidth / 2))
    expect(Math.round(r.top + r.height / 2)).toBe(Math.round(innerHeight / 2))
    const cs = getComputedStyle(panel(el))
    expect(cs.paddingTop).toBe("24px")
    expect(cs.borderRadius).toBe("12px")
    expect(cs.rowGap).toBe("24px")
    const close = el.shadowRoot!.querySelector("tec-button.close")!.getBoundingClientRect()
    expect(Math.round(r.right - close.right)).toBe(16)
    expect(Math.round(close.top - r.top)).toBe(16)
  })

  it("keeps Tab inside the dialog", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(el.querySelector("input"))
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("#cancel")!))
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("#save")!))
    await userEvent.keyboard("{Tab}")
    const close = el.shadowRoot!.querySelector("tec-button.close")!
    expect(deepActiveElement()).toBe(innerButton(close))
    expect(await axNode(innerButton(close))).toMatchObject({ role: "button", name: "Close" })
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(el.querySelector("input"))
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()).toBe(innerButton(close))
  })

  it("Escape closes and restores focus to the trigger", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    const events = recordEvents<CustomEvent>(el, "tec-open-change")
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(false)
    expect(events.events[0]!.detail).toEqual({ open: false, reason: "escape" })
    expect(deepActiveElement()).toBe(innerButton(el.querySelector("tec-button")!))
    expect(isScrollLocked()).toBe(false)
    await waitUntil(() => getComputedStyle(dlg(el)).display === "none", "left the top layer after the exit animation")
  })

  it("closes on an overlay press unless persistent", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    await userEvent.click(el.querySelector("input")!)
    expect(el.open).toBe(true)
    const change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect((await change).detail.reason).toBe("outside")
    expect(el.open).toBe(false)

    const root2 = await fixture<HTMLElement>(basic({ persistent: true }))
    const el2 = root2.querySelector("tec-dialog")!
    await open(el2)
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect(el2.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(el2.open).toBe(false)
  })

  it("closes from the ✕ button, tec-dialog-close and footer show-close", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    let change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(el.shadowRoot!.querySelector("tec-button.close")!)
    expect((await change).detail.reason).toBe("close-button")
    await open(el)
    change = oneEvent<CustomEvent>(el, "tec-open-change")
    await userEvent.click(el.querySelector("#cancel")!)
    expect((await change).detail.reason).toBe("close")
    await waitUntil(() => !el.open, "closed")

    const footer = el.querySelector("tec-dialog-footer")!
    footer.showClose = true
    await footer.updateComplete
    await open(el)
    const close = footer.shadowRoot!.querySelector("tec-dialog-close")!
    await (close as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    expect(close.getAttribute("variant")).toBe("outline")
    await userEvent.click(close)
    await waitUntil(() => !el.open, "closed by show-close")
  })

  it("a click listener can keep it open by preventing the close part's click", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    el.querySelector("#cancel")!.addEventListener("click", (e) => e.preventDefault())
    await open(el)
    await userEvent.click(el.querySelector("#cancel")!)
    await aTimeout(20)
    expect(el.open).toBe(true)
  })

  it("tec-open-change is cancelable", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    el.addEventListener("tec-open-change", (e) => e.preventDefault())
    await userEvent.keyboard("{Escape}")
    expect(el.open).toBe(true)
    expect(dlg(el).open).toBe(true)
  })

  it("hide-close removes the ✕ button; show()/hide() fire no events", async () => {
    const root = await fixture<HTMLElement>(basic({ hideClose: true }))
    const el = root.querySelector("tec-dialog")!
    expect(el.shadowRoot!.querySelector("tec-button.close")).toBeNull()
    const events = recordEvents(el, "tec-open-change")
    el.show()
    await el.updateComplete
    expect(dlg(el).open).toBe(true)
    el.hide()
    await el.updateComplete
    expect(dlg(el).open).toBe(false)
    expect(events.events).toHaveLength(0)
  })

  it("Escape closes only the innermost of nested dialogs", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-dialog id="outer">
        <tec-button slot="trigger">Outer</tec-button>
        <tec-dialog-title>Outer</tec-dialog-title>
        <tec-dialog id="inner">
          <tec-button slot="trigger">Inner</tec-button>
          <tec-dialog-title>Inner</tec-dialog-title>
        </tec-dialog>
      </tec-dialog>
    </div>`)
    const outer = root.querySelector<TecDialog>("#outer")!
    const inner = root.querySelector<TecDialog>("#inner")!
    await open(outer)
    expect(await axNode(dlg(outer))).toMatchObject({ name: "Outer" })
    await open(inner)
    expect(await axNode(dlg(inner))).toMatchObject({ name: "Inner" })
    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    expect(inner.open).toBe(false)
    expect(outer.open).toBe(true)
    await open(inner)
    await userEvent.keyboard("{Escape}")
    expect(inner.open).toBe(false)
    expect(outer.open).toBe(true)
    expect(deepActiveElement()).toBe(innerButton(inner.querySelector("tec-button")!))
    await userEvent.keyboard("{Escape}")
    expect(outer.open).toBe(false)
  })

  it("uses the label attribute without a title, and an [autofocus] element for initial focus", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-dialog label="Share">
        <tec-button slot="trigger">Share</tec-button>
        <input aria-label="Link" autofocus />
      </tec-dialog>
    </div>`)
    const el = root.querySelector("tec-dialog")!
    await open(el)
    expect(await axNode(dlg(el))).toMatchObject({ role: "dialog", name: "Share" })
    expect(deepActiveElement()).toBe(el.querySelector("input"))
  })

  it("re-opens while the exit animation runs", async () => {
    const root = await fixture<HTMLElement>(basic())
    const el = root.querySelector("tec-dialog")!
    await open(el)
    el.hide()
    await el.updateComplete
    el.show()
    await el.updateComplete
    expect(dlg(el).open).toBe(true)
    expect(dlg(el).matches(":modal")).toBe(true)
  })
})
