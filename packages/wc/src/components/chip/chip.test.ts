import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecChip } from "./chip.js"
import type { TecChipGroup } from "./chip-group.js"
import "./define.js"

const chipsOf = (group: TecChipGroup) => [...group.querySelectorAll<TecChip>("tec-chip")]
const base = (chip: TecChip) => chip.shadowRoot!.querySelector(".base") as HTMLElement
const removeButton = (chip: TecChip) => chip.shadowRoot!.querySelector(".remove") as HTMLButtonElement | null

describe("tec-chip-group", () => {
  it("is a grid of rows with one tab stop", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="Horizons">
      <tec-chip>Top Balder</tec-chip><tec-chip>Top Sele</tec-chip><tec-chip disabled>Brent</tec-chip>
    </tec-chip-group>`)
    const [a, b, c] = chipsOf(group)
    expect(a!.variant).toBe("secondary")
    expect(await axNode(group)).toMatchObject({ role: "grid", name: "Horizons" })
    expect(await axNode(a!)).toMatchObject({ role: "row", name: "Top Balder" })
    expect(await axNode(c!)).toMatchObject({ role: "row", disabled: "true" })
    expect([a!.tabIndex, b!.tabIndex, c!.tabIndex]).toEqual([0, -1, -1])
    expect(removeButton(a!)).toBeNull()
    await expectAccessible(group)
  })

  it("moves focus with the arrow keys (wrapping, skipping disabled) and Home/End", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="Horizons">
      <tec-chip>A</tec-chip><tec-chip disabled>B</tec-chip><tec-chip>C</tec-chip><tec-chip>D</tec-chip>
    </tec-chip-group>`)
    const [a, , c, d] = chipsOf(group)
    a!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(c)
    await userEvent.keyboard("{End}")
    expect(document.activeElement).toBe(d)
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(a)
    await userEvent.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(d)
    await userEvent.keyboard("{Home}")
    expect(document.activeElement).toBe(a)
  })

  it("mirrors the arrow keys in RTL", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x"><tec-chip>A</tec-chip><tec-chip>B</tec-chip></tec-chip-group>`, { dir: "rtl" })
    const [a, b] = chipsOf(group)
    a!.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(b)
  })

  it("selects with click, Space and Enter in multiple mode", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="Facies" selection-mode="multiple">
      <tec-chip value="sand" selected>Sandstone</tec-chip><tec-chip value="shale">Shale</tec-chip><tec-chip value="coal">Coal</tec-chip>
    </tec-chip-group>`)
    const events = recordEvents<CustomEvent>(group, "tec-value-change")
    const [sand, shale, coal] = chipsOf(group)
    expect(group.values).toEqual(["sand"])
    expect(await axNode(group)).toMatchObject({ role: "grid", multiselectable: "true" })
    expect(await axNode(sand!)).toMatchObject({ selected: "true" })
    await userEvent.click(shale!)
    expect(group.values).toEqual(["sand", "shale"])
    expect(document.activeElement).toBe(shale)
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard(" ")
    expect(group.values).toEqual(["sand", "shale", "coal"])
    await userEvent.keyboard("{Enter}")
    expect(coal!.selected).toBe(false)
    expect(events.events.map((e) => e.detail.values)).toEqual([["sand", "shale"], ["sand", "shale", "coal"], ["sand", "shale"]])
    expect(coal!.matches(":state(selected)")).toBe(false)
    expect(sand!.matches(":state(selected)")).toBe(true)
    expect(getComputedStyle(base(sand!)).boxShadow).not.toBe("none")
    await expectAccessible(group)
  })

  it("keeps one selection in single mode and can be vetoed", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x" selection-mode="single"><tec-chip>A</tec-chip><tec-chip>B</tec-chip></tec-chip-group>`)
    const [a, b] = chipsOf(group)
    await userEvent.click(a!)
    await userEvent.click(b!)
    expect(group.values).toEqual(["B"])
    expect(group.value).toBe("B")
    group.addEventListener("tec-value-change", (e) => e.preventDefault(), { once: true })
    await userEvent.click(a!)
    expect(group.values).toEqual(["B"])
    group.values = ["A"]
    expect([a!.selected, b!.selected]).toEqual([true, false])
  })

  it("does not select without a selection mode", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x"><tec-chip>A</tec-chip></tec-chip-group>`)
    await userEvent.click(chipsOf(group)[0]!)
    expect(group.values).toEqual([])
    expect((await axNode(chipsOf(group)[0]!)).selected).toBeUndefined()
  })

  it("removes chips with the remove button and Delete, moving focus", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="Horizons" removable>
      <tec-chip value="a">Top Balder</tec-chip><tec-chip value="b">Top Sele</tec-chip><tec-chip value="c">Brent</tec-chip>
    </tec-chip-group>`)
    const events = recordEvents<CustomEvent>(group, "tec-remove")
    const [a, b, c] = chipsOf(group)
    const button = removeButton(a!)!
    expect(button.tabIndex).toBe(-1)
    expect(await axNode(button)).toMatchObject({ role: "button", name: "Remove Top Balder" })
    expect(await axNode(a!)).toMatchObject({ description: "Press Delete to remove tag." })
    await expectAccessible(group)

    b!.focus()
    await userEvent.keyboard("{Delete}")
    expect(b!.isConnected).toBe(false)
    expect(document.activeElement).toBe(c)
    await userEvent.keyboard("{Backspace}")
    expect(document.activeElement).toBe(a)
    await userEvent.click(removeButton(a!)!)
    expect(chipsOf(group)).toEqual([])
    expect(events.events.map((e) => e.detail.value)).toEqual(["b", "c", "a"])
    expect(document.activeElement).toBe(group)
    expect((await axNode(group)).role).toBe("group")
  })

  it("keeps a chip whose tec-remove was prevented", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x" removable><tec-chip>A</tec-chip></tec-chip-group>`)
    group.addEventListener("tec-remove", (e) => e.preventDefault())
    const [a] = chipsOf(group)
    a!.focus()
    await userEvent.keyboard("{Delete}")
    expect(a!.isConnected).toBe(true)
  })

  it("removes every selected chip when the focused one is selected", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x" removable selection-mode="multiple">
      <tec-chip selected>A</tec-chip><tec-chip>B</tec-chip><tec-chip selected>C</tec-chip>
    </tec-chip-group>`)
    const [a] = chipsOf(group)
    a!.focus()
    await userEvent.keyboard("{Backspace}")
    expect(chipsOf(group).map((c) => c.textValue)).toEqual(["B"])
    expect(deepActiveElement()).toBe(chipsOf(group)[0])
  })

  it("shows the empty slot when there are no chips", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x"><span slot="empty">No horizons.</span></tec-chip-group>`)
    const empty = group.querySelector("span")!
    expect(empty.getBoundingClientRect().height).toBeGreaterThan(0)
    group.append(document.createElement("tec-chip"))
    await new Promise((r) => setTimeout(r))
    expect(empty.getBoundingClientRect().height).toBe(0)
  })

  it("uses the badge sizes and colours", async () => {
    const group = await fixture<TecChipGroup>(html`<tec-chip-group aria-label="x">
      <tec-chip>a</tec-chip><tec-chip size="md">b</tec-chip><tec-chip size="lg">c</tec-chip>
      <tec-chip variant="info" appearance="outline">d</tec-chip>
    </tec-chip-group>`)
    const chips = chipsOf(group)
    expect(chips.slice(0, 3).map((c) => c.getBoundingClientRect().height)).toEqual([20, 24, 28])
    const probe = document.createElement("span")
    probe.style.color = "var(--tec-info)"
    group.append(probe)
    const style = getComputedStyle(base(chips[3]!))
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(style.borderTopColor).toBe(getComputedStyle(probe).color)
    expect(await axTree(group)).toEqual(["grid: x", "row: a", "gridcell: a", "row: b", "gridcell: b", "row: c", "gridcell: c", "row: d", "gridcell: d"])
  })
})
