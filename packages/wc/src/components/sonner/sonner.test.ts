import { html } from "lit"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, deepActiveElement, expectAccessible, fixture, nextFrame, waitUntil } from "../../internal/test-utils.js"
import type { TecToaster } from "./toaster.js"
import { toast } from "./define.js"

const toasts = (el: TecToaster) => [...el.shadowRoot!.querySelectorAll<HTMLLIElement>("li")]
const live = (el: TecToaster) => toasts(el).filter((li) => li.dataset.removed === "false")
const region = (el: TecToaster) => el.shadowRoot!.querySelector<HTMLElement>(".region")!
const mounted = async (el: TecToaster, count = 1) => {
  await waitUntil(() => live(el).length === count && live(el).every((li) => li.dataset.mounted === "true"), `${count} mounted toasts`)
  await el.updateComplete
}

afterEach(async () => {
  toast.dismiss()
  await aTimeout(250)
})

describe("tec-toaster", () => {
  it("shows a toast with title, description and action in a named region, in the top layer", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    let undone = 0
    toast("Event has been created", { description: "Sunday, December 03 at 9:00", action: { label: "Undo", onClick: () => undone++ } })
    await mounted(el)
    const li = live(el)[0]!
    expect(region(el).matches(":popover-open")).toBe(true)
    expect(li.querySelector("[data-title]")!.textContent).toBe("Event has been created")
    expect(li.querySelector("[data-description]")!.textContent).toBe("Sunday, December 03 at 9:00")
    expect(await axNode(region(el))).toMatchObject({ role: "region", name: "Notifications alt+T" })
    // Bottom-right by default, 356px wide (full width minus 16px gutters below 600px).
    const r = li.getBoundingClientRect()
    expect(Math.round(r.width)).toBe(window.innerWidth > 600 ? 356 : window.innerWidth - 32)
    expect(window.innerHeight - r.bottom).toBeLessThan(40)
    await userEvent.click(li.querySelector("[data-action]")!)
    expect(undone).toBe(1)
    await waitUntil(() => toasts(el).length === 0, "toast removed")
  })

  it("announces through live regions: status for normal toasts, alert for errors", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    const status = el.shadowRoot!.querySelector('[role="status"]')!
    const alert = el.shadowRoot!.querySelector('[role="alert"]')!
    toast.success("Saved", { description: "Model v2" })
    await waitUntil(() => status.textContent === "Saved. Model v2", "polite announcement")
    toast.error("Simulation failed")
    await waitUntil(() => alert.textContent === "Simulation failed", "assertive announcement")
    expect(status.textContent).toBe("")
  })

  it("typed toasts get icons and Tecton outlined status colours", async () => {
    const el = await fixture<TecToaster>(html`<div style="background: var(--tec-background)" data-theme="dark"><tec-toaster expand></tec-toaster></div>`)
    const toaster = el.querySelector("tec-toaster")!
    toast.success("Success")
    toast.error("Error")
    toast("Default")
    await mounted(toaster, 3)
    const [plain, error, success] = live(toaster)
    expect(plain!.querySelector("[data-icon]")).toBeNull()
    expect(success!.querySelector("[data-icon] svg")).not.toBeNull()
    const s = getComputedStyle(success!)
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-success)"
    toaster.parentElement!.append(probe)
    expect(s.borderTopColor).toBe(getComputedStyle(probe).color)
    expect(s.color).toBe(getComputedStyle(probe).color)
    probe.style.color = "var(--tec-popover)"
    expect(s.backgroundColor).toBe(getComputedStyle(probe).color)
    probe.style.color = "var(--tec-destructive)"
    expect(getComputedStyle(error!).borderTopColor).toBe(getComputedStyle(probe).color)
    await aTimeout(450)
    await expectAccessible(toaster.shadowRoot!.querySelector("ol")!)
  })

  it("closes after its duration; pauses while hovered", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    let autoClosed = 0
    toast("Short", { duration: 1200, onAutoClose: () => autoClosed++ })
    await mounted(el)
    await userEvent.hover(live(el)[0]!)
    await aTimeout(1500)
    expect(live(el).length).toBe(1)
    await userEvent.unhover(live(el)[0]!)
    await userEvent.hover(document.body, { position: { x: 5, y: 5 } })
    await waitUntil(() => live(el).length === 0, "auto closed", 2000)
    expect(autoClosed).toBe(1)
  })

  it("stacks: newest in front, only visible-toasts shown, expands on hover", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster visible-toasts="2"></tec-toaster>`)
    toast("One", { duration: Infinity })
    toast("Two", { duration: Infinity })
    toast("Three", { duration: Infinity })
    await mounted(el, 3)
    const [front, second, third] = live(el)
    expect(front!.textContent).toContain("Three")
    expect(front!.dataset.front).toBe("true")
    expect(third!.dataset.visible).toBe("false")
    expect(second!.dataset.expanded).toBe("false")
    await userEvent.hover(front!)
    await el.updateComplete
    expect(second!.dataset.expanded).toBe("true")
    await aTimeout(450)
    expect(second!.getBoundingClientRect().bottom).toBeLessThan(front!.getBoundingClientRect().top)
  })

  it("updates a toast in place by id; loading → success via promise", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    let resolve!: (v: { name: string }) => void
    const { id } = toast.promise(new Promise<{ name: string }>((r) => (resolve = r)), {
      loading: "Loading...",
      success: (data) => `${data.name} has been created`,
      error: "Error",
    })
    await mounted(el)
    expect(live(el)[0]!.dataset.type).toBe("loading")
    expect(live(el)[0]!.querySelector(".loader")).not.toBeNull()
    resolve({ name: "Event" })
    await waitUntil(() => live(el)[0]?.dataset.type === "success", "resolved")
    expect(live(el)[0]!.textContent).toContain("Event has been created")
    toast.info("Replaced", { id })
    await el.updateComplete
    expect(live(el).length).toBe(1)
    expect(live(el)[0]!.dataset.type).toBe("info")
  })

  it("close button, cancel button and toast.dismiss()", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster close-button></tec-toaster>`)
    let dismissed = 0
    let cancelled = 0
    toast("Closable", { onDismiss: () => dismissed++, duration: Infinity })
    await mounted(el)
    const close = live(el)[0]!.querySelector<HTMLButtonElement>("[data-close-button]")!
    expect(await axNode(close)).toMatchObject({ role: "button", name: "Close toast" })
    await userEvent.click(close)
    await waitUntil(() => live(el).length === 0, "closed")
    expect(dismissed).toBe(1)
    toast("Cancelable", { cancel: { label: "Cancel", onClick: () => cancelled++ }, duration: Infinity })
    await mounted(el)
    await userEvent.click(live(el)[0]!.querySelector("[data-cancel]")!)
    expect(cancelled).toBe(1)
    const id = toast("Programmatic", { duration: Infinity })
    await mounted(el)
    toast.dismiss(id)
    await waitUntil(() => live(el).length === 0, "dismissed")
  })

  it("Alt+T focuses the toasts, Escape returns focus; timers pause while focused", async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="start">Start</button><tec-toaster></tec-toaster></div>`)
    const el = root.querySelector("tec-toaster")!
    root.querySelector<HTMLButtonElement>("#start")!.focus()
    toast("Focus me", { duration: 400, action: { label: "Undo" } })
    await mounted(el)
    await userEvent.keyboard("{Alt>}t{/Alt}")
    await waitUntil(() => el.shadowRoot!.activeElement?.localName === "ol", "list focused")
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(live(el)[0])
    await aTimeout(600)
    expect(live(el).length).toBe(1)
    await userEvent.keyboard("{Escape}")
    expect(deepActiveElement()).toBe(root.querySelector("#start"))
    await waitUntil(() => live(el).length === 0, "closes once focus left", 2000)
  })

  it("F6 also moves focus to the toasts; Delete closes the focused toast", async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="start">Start</button><tec-toaster></tec-toaster></div>`)
    const el = root.querySelector("tec-toaster")!
    root.querySelector<HTMLButtonElement>("#start")!.focus()
    toast("One", { duration: Infinity })
    await mounted(el)
    await userEvent.keyboard("{F6}")
    await waitUntil(() => el.shadowRoot!.activeElement?.localName === "ol", "list focused")
    await userEvent.keyboard("{Tab}")
    await userEvent.keyboard("{Delete}")
    await waitUntil(() => live(el).length === 0, "deleted")
    await waitUntil(() => deepActiveElement() === root.querySelector("#start"), "focus restored")
  })

  it("positions: per toast and per toaster", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster position="top-center"></tec-toaster>`)
    toast("Top center")
    toast("Top left", { position: "top-left" })
    await mounted(el, 2)
    const lists = [...el.shadowRoot!.querySelectorAll("ol")]
    expect(lists.map((l) => `${l.dataset.yPosition}-${l.dataset.xPosition}`)).toEqual(["top-center", "top-left"])
    const [center, left] = lists.map((l) => l.querySelector("li")!.getBoundingClientRect())
    expect(center!.top).toBeLessThan(60)
    expect(left!.left).toBeLessThan(40)
    expect(Math.abs(center!.left + center!.width / 2 - window.innerWidth / 2)).toBeLessThan(2)
  })

  it("swipe to dismiss in the direction of the position", async () => {
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    let dismissed = 0
    toast("Swipe me", { duration: Infinity, onDismiss: () => dismissed++ })
    await mounted(el)
    const li = live(el)[0]!
    const r = li.getBoundingClientRect()
    const x = r.left + 40
    const y = r.top + r.height / 2
    const fire = (type: string, dx: number) =>
      li.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, clientX: x + dx, clientY: y, pointerId: 7, button: 0, pointerType: "touch" }))
    fire("pointerdown", 0)
    fire("pointermove", 10)
    fire("pointermove", 80)
    expect(li.style.getPropertyValue("--swipe-amount-x")).toBe("80px")
    fire("pointerup", 80)
    expect(dismissed).toBe(1)
    await waitUntil(() => toasts(el).length === 0, "swiped out")
  })

  it("only the first toaster of a page shows toasts; the next one takes over", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-toaster id="a"></tec-toaster><tec-toaster id="b"></tec-toaster></div>`)
    const [a, b] = [...root.querySelectorAll("tec-toaster")]
    toast("Once", { duration: Infinity })
    await mounted(a!)
    expect(toasts(b!).length).toBe(0)
    a!.remove()
    await nextFrame()
    await mounted(b!)
    expect(b!.active).toBe(true)
  })

  it("a toast created before the toaster connects is shown", async () => {
    toast("Early", { duration: Infinity })
    const el = await fixture<TecToaster>(html`<tec-toaster></tec-toaster>`)
    await mounted(el)
    expect(live(el)[0]!.textContent).toContain("Early")
  })
})
