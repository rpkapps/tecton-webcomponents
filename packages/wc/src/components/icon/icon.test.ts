import { html } from "lit"
import { ChevronDown, Search } from "lucide"
import { describe, expect, it } from "vitest"
import { axNode, expectAccessible, fixture } from "../../internal/test-utils.js"
import { tectonIcons } from "../../icons/index.js"
import type { TecIcon } from "./icon.js"
import { getIcon, iconNames, normalizeIconName, registerIcon, registerIcons } from "./registry.js"
import "./define.js"

const svg = (el: TecIcon) => el.shadowRoot!.querySelector("svg")

describe("tec-icon", () => {
  it("ships the 18 Tecton domain icons", () => {
    expect(tectonIcons).toHaveLength(18)
    for (const icon of tectonIcons) expect(getIcon(icon.name)).toBe(icon)
    expect(iconNames()).toEqual(expect.arrayContaining(["well", "seismic", "drill-bit", "strata"]))
  })

  it("renders outlined and filled variants on the cropped viewBox", async () => {
    const el = await fixture<TecIcon>(html`<tec-icon name="well"></tec-icon>`)
    expect(svg(el)!.getAttribute("viewBox")).toBe("1 1 14 14")
    const outlined = svg(el)!.innerHTML
    el.variant = "filled"
    await el.updateComplete
    expect(svg(el)!.innerHTML).not.toBe(outlined)
    expect(el.getBoundingClientRect().width).toBe(24)
  })

  it("is decorative without a label and an image with one", async () => {
    const el = await fixture<HTMLElement>(html`<div><tec-icon name="seismic"></tec-icon><tec-icon name="valve" label="Valve"></tec-icon></div>`)
    const [decorative, labelled] = [...el.querySelectorAll("tec-icon")]
    expect((await axNode(decorative!)).ignored).toBe("true")
    expect(await axNode(labelled!)).toMatchObject({ role: "image", name: "Valve" })
    await expectAccessible(el)
  })

  it("renders registered Lucide icons, and re-renders when an icon is registered later", async () => {
    registerIcons({ ChevronDown })
    const el = await fixture<TecIcon>(html`<tec-icon name="chevron-down"></tec-icon>`)
    expect(svg(el)!.getAttribute("stroke")).toBe("currentColor")
    expect(svg(el)!.querySelector("path")!.getAttribute("d")).toBe("m6 9 6 6 6-6")

    const later = await fixture<TecIcon>(html`<tec-icon name="search-later"></tec-icon>`)
    expect(svg(later)).toBeNull()
    registerIcon("SearchLater", Search)
    await later.updateComplete
    expect(svg(later)).not.toBeNull()
  })

  it("renders custom SVG definitions and follows --tec-icon-size", async () => {
    registerIcon("dot", { viewBox: "0 0 10 10", svg: '<circle cx="5" cy="5" r="4"></circle>' })
    const el = await fixture<TecIcon>(html`<tec-icon name="dot" style="--tec-icon-size: 1rem"></tec-icon>`)
    expect(svg(el)!.getAttribute("fill")).toBe("currentColor")
    expect(el.getBoundingClientRect().height).toBe(16)
  })

  it("normalizes names", () => {
    expect(normalizeIconName("ChevronDown")).toBe("chevron-down")
    expect(normalizeIconName("oil_rig offshore")).toBe("oil-rig-offshore")
    expect(normalizeIconName("ArrowUpDown")).toBe("arrow-up-down")
  })
})
