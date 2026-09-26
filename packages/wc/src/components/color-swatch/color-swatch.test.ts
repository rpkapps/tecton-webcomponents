import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import { parseHex, resolveColorToHex, type TecColorSwatch } from "./color-swatch.js"
import "./define.js"

const q = <T extends Element = HTMLElement>(el: TecColorSwatch, sel: string) => el.shadowRoot!.querySelector<T>(sel)!
const qa = (el: TecColorSwatch, sel: string) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(sel)]

describe("tec-color-swatch", () => {
  it("renders a named colour image in the Tecton sizes", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-color-swatch color="#f59e0b" aria-label="Sandstone"></tec-color-swatch>
      <tec-color-swatch color="#38bdf8" size="xs"></tec-color-swatch>
      <tec-color-swatch color="#38bdf8" size="xl" shape="circle"></tec-color-swatch>
    </div>`)
    const [md, xs, xl] = [...root.querySelectorAll<TecColorSwatch>("tec-color-swatch")]
    expect(await axNode(q(md!, ".swatch"))).toMatchObject({ role: "image", name: "Sandstone" })
    expect(await axNode(q(xs!, ".swatch"))).toMatchObject({ name: "#38bdf8" })
    expect([md!, xs!, xl!].map((s) => q(s, ".swatch").getBoundingClientRect().width)).toEqual([24, 12, 48])
    expect(getComputedStyle(q(md!, ".swatch")).backgroundColor).toBe("rgb(245, 158, 11)")
    expect(getComputedStyle(q(xl!, ".swatch")).borderTopLeftRadius).toBe("9999px")
    await expectAccessible(root)
  })

  it("shows label and value text, the swatch then being decorative", async () => {
    const el = await fixture<TecColorSwatch>(html`<tec-color-swatch color="#64748b" label="Shale" value="#64748b"></tec-color-swatch>`)
    expect(q(el, ".label").textContent).toBe("Shale")
    expect(getComputedStyle(q(el, ".value")).fontFamily).toContain("Plex Mono")
    expect(q(el, ".swatch").getAttribute("aria-hidden")).toBe("true")
    await expectAccessible(el)
  })

  it("resolves tokens and other CSS colours to hex", async () => {
    const el = await fixture<TecColorSwatch>(html`<tec-color-swatch color="var(--tecton-color-accent-lime-fill)"></tec-color-swatch>`)
    expect(el.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(resolveColorToHex("rebeccapurple", el.shadowRoot!)).toBe("#663399")
    expect(resolveColorToHex("oklch(0.628 0.2577 29.23)", el.shadowRoot!)).toMatch(/^#f[0-9a-f]0/)
    expect(resolveColorToHex("var(--missing)", el.shadowRoot!)).toBeNull()
    expect(resolveColorToHex("nope", el.shadowRoot!)).toBeNull()
    expect(parseHex("ABC")).toBe("#aabbcc")
    expect(parseHex("#12345")).toBeNull()
  })

  it("opens a picker from the editable swatch and picks a preset", async () => {
    const el = await fixture<TecColorSwatch>(html`<tec-color-swatch editable color="#cb8553" label="Series colour" value="#cb8553"></tec-color-swatch>`)
    const trigger = q<HTMLButtonElement>(el, ".trigger")
    expect(await axNode(trigger)).toMatchObject({ role: "button", name: "Edit colour", hasPopup: "dialog", expanded: "false" })
    const changes = recordEvents(el, "change")
    await userEvent.click(trigger)
    const picker = q(el, ".picker")
    await waitUntil(() => picker.matches(":popover-open"))
    await animationsFinished(picker)
    expect(el.open).toBe(true)
    expect(await axNode(picker)).toMatchObject({ role: "dialog", name: "Edit colour" })
    const presets = qa(el, ".preset")
    expect(presets).toHaveLength(6)
    expect((await axTree(q(el, ".presets"))).slice(0, 3)).toEqual(["listbox: Presets", "option: Saffron [focused]", "option: Lime"])
    expect(deepActiveElement()).toBe(presets[0])
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(presets[1])
    await userEvent.keyboard("{Enter}")
    expect(el.color).toBe(presets[1]!.dataset.hex)
    expect(changes.events).toHaveLength(1)
    await el.updateComplete
    expect(presets[1]!.getAttribute("aria-selected")).toBe("true")
    expect(q<HTMLInputElement>(el, ".hex").value).toBe(el.color)
    await expectAccessible(el)
    await userEvent.keyboard("{Escape}")
    await waitUntil(() => !picker.matches(":popover-open"))
    expect(el.open).toBe(false)
    expect(deepActiveElement()).toBe(trigger)
  })

  it("commits a typed hex on Enter and reverts an invalid one", async () => {
    const el = await fixture<TecColorSwatch>(html`<tec-color-swatch editable color="#cb8553" aria-label="Edit series colour"></tec-color-swatch>`)
    expect(await axNode(q(el, ".trigger"))).toMatchObject({ name: "Edit series colour" })
    el.show()
    await el.updateComplete
    const hex = q<HTMLInputElement>(el, ".hex")
    await waitUntil(() => q(el, ".picker").matches(":popover-open"))
    await userEvent.click(hex)
    await userEvent.clear(hex)
    await userEvent.type(hex, "12ab34{Enter}")
    expect(el.color).toBe("#12ab34")
    await userEvent.keyboard("{ArrowUp}")
    expect(el.color).toBe("#12ab35")
    await userEvent.clear(hex)
    await userEvent.type(hex, "zz{Enter}")
    expect(el.color).toBe("#12ab35")
    expect(hex.value).toBe("#12ab35")
    expect(await axNode(q(el, ".native input"))).toMatchObject({ name: "Pick a custom colour" })
  })

  it("can veto opening and leaves out presets that are not colours", async () => {
    const el = await fixture<TecColorSwatch>(html`<tec-color-swatch editable color="red"></tec-color-swatch>`)
    el.presets = ["#000", "var(--nope)", { color: "#fff", label: "White" }]
    el.addEventListener("tec-open-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(q(el, ".trigger"))
    expect(el.open).toBe(false)
    await userEvent.click(q(el, ".trigger"))
    await el.updateComplete
    const presets = qa(el, ".preset")
    expect(presets.map((p) => p.getAttribute("aria-label"))).toEqual(["#000", "White"])
  })
})
