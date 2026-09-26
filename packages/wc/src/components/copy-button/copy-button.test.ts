import { html } from "lit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecCopyButton } from "./copy-button.js"
import "./define.js"

const inner = (el: TecCopyButton) => el.shadowRoot!.querySelector("tec-button")!.control
const announcer = () => document.querySelector<HTMLElement>("[data-tec-copy-button-announcer]")

describe("tec-copy-button", () => {
  afterEach(() => vi.restoreAllMocks())

  it("copies the value, shows the check and announces it", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    const el = await fixture<TecCopyButton>(html`<tec-copy-button value="34/10-A-12" timeout="200"></tec-copy-button>`)
    const events = recordEvents<CustomEvent>(el, "tec-copy")
    expect(await axNode(inner(el))).toMatchObject({ role: "button", name: "Copy" })
    expect(el.getBoundingClientRect().width).toBe(28)
    await expectAccessible(el)
    await userEvent.click(el)
    await waitUntil(() => el.status === "copied")
    expect(write).toHaveBeenCalledWith("34/10-A-12")
    expect(events.events[0]!.detail).toEqual({ value: "34/10-A-12" })
    expect(el.matches(":state(copied)")).toBe(true)
    await el.updateComplete
    expect(await axNode(inner(el))).toMatchObject({ name: "Copied" })
    await waitUntil(() => announcer()?.textContent === "Copied")
    expect(announcer()!.getAttribute("aria-live")).toBe("polite")
    await waitUntil(() => el.status === "idle", "reset", 1000)
  })

  it("shows the failure state when the clipboard refuses", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    const el = await fixture<TecCopyButton>(html`<tec-copy-button value="x"></tec-copy-button>`)
    const errors = recordEvents<CustomEvent>(el, "tec-copy-error")
    inner(el).focus()
    await userEvent.keyboard("{Enter}")
    await waitUntil(() => el.status === "error")
    expect(errors.events).toHaveLength(1)
    await el.updateComplete
    expect(await axNode(inner(el))).toMatchObject({ name: "Copy failed" })
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-destructive)"
    el.append(probe)
    for (const a of inner(el).getAnimations()) a.finish()
    expect(getComputedStyle(inner(el)).color).toBe(getComputedStyle(probe).color)
    await waitUntil(() => announcer()?.textContent === "Copy failed")
  })

  it("is labelled by its content (size sm) or by a host aria-label", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    const root = await fixture<HTMLElement>(html`<div>
      <tec-copy-button value="a" variant="outline">Copy link</tec-copy-button>
      <tec-copy-button value="b" aria-label="Copy Top Sele"></tec-copy-button>
    </div>`)
    const [labelled, named] = [...root.querySelectorAll<TecCopyButton>("tec-copy-button")]
    expect(labelled!.getBoundingClientRect().height).toBe(28)
    expect(labelled!.getBoundingClientRect().width).toBeGreaterThan(28)
    expect(await axNode(inner(labelled!))).toMatchObject({ name: "Copy link" })
    expect(await axNode(inner(named!))).toMatchObject({ name: "Copy Top Sele" })
    await userEvent.click(named!)
    await waitUntil(() => named!.status === "copied")
    await aTimeout()
    expect(await axNode(inner(named!))).toMatchObject({ name: "Copy Top Sele" })
    await expectAccessible(root)
  })

  it("does nothing when disabled", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    const el = await fixture<TecCopyButton>(html`<tec-copy-button value="x" disabled></tec-copy-button>`)
    el.click()
    await aTimeout(10)
    expect(write).not.toHaveBeenCalled()
  })
})
