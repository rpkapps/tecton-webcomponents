import { html } from "lit"
import { describe, expect, it } from "vitest"
import { axTree, expectAccessible, fixture } from "../../internal/test-utils.js"
import type { TecSkeleton } from "./skeleton.js"
import "./define.js"

describe("tec-skeleton", () => {
  it("is a muted block sized by the host, hidden from assistive technology", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-skeleton style="width: 250px; height: 16px"></tec-skeleton></div>`)
    const el = root.querySelector<TecSkeleton>("tec-skeleton")!
    const base = el.shadowRoot!.querySelector(".base")!
    expect(base.getBoundingClientRect()).toMatchObject({ width: 250, height: 16 })
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-muted)"
    root.append(probe)
    expect(getComputedStyle(base).backgroundColor).toBe(getComputedStyle(probe).color)
    expect(getComputedStyle(base).borderRadius).not.toBe("0px")
    expect(await axTree(root)).toEqual([])
    await expectAccessible(root)
  })

  it("inherits a radius set on the host (rounded-full)", async () => {
    const el = await fixture<TecSkeleton>(html`<tec-skeleton style="width: 48px; height: 48px; border-radius: 9999px"></tec-skeleton>`)
    expect(getComputedStyle(el.shadowRoot!.querySelector(".base")!).borderRadius).toBe("9999px")
  })

  it("pulses", async () => {
    const el = await fixture<TecSkeleton>(html`<tec-skeleton style="height: 16px"></tec-skeleton>`)
    expect(el.shadowRoot!.querySelector(".base")!.getAnimations().length).toBe(1)
  })
})
