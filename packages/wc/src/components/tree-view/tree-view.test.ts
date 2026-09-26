import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecTreeView } from "./tree-view.js"
import type { TecTreeViewItem } from "./tree-view-item.js"
import type { TecTreeViewVisibilityToggle } from "./tree-view-action.js"
import "./define.js"

const row = (tree: ParentNode, value: string) => tree.querySelector<TecTreeViewItem>(`tec-tree-view-item[value="${value}"]`)!
const settle = async (tree: TecTreeView) => {
  await tree.updateComplete
  await Promise.all(tree.items.map((i) => i.updateComplete))
  await new Promise((r) => requestAnimationFrame(r))
  await tree.updateComplete
  await Promise.all(tree.items.map((i) => i.updateComplete))
}

const demo = (mode = "single") => html`<div>
  <button id="before">Before</button>
  <tec-tree-view label="Project" selection-mode=${mode} style="max-width: 24rem">
    <tec-tree-view-item value="wells" kind="folder" expanded>
      Wells
      <tec-tree-view-item value="a12">34/10-A-12</tec-tree-view-item>
      <tec-tree-view-item value="b3" disabled>34/10-B-3</tec-tree-view-item>
      <tec-tree-view-item value="c7">34/10-C-7</tec-tree-view-item>
    </tec-tree-view-item>
    <tec-tree-view-item value="horizons" kind="folder">
      Horizons
      <tec-tree-view-item value="balder">Top Balder</tec-tree-view-item>
      <tec-tree-view-item value="sele">Top Sele</tec-tree-view-item>
    </tec-tree-view-item>
    <tec-tree-view-item value="faults" kind="folder">
      Faults
      <tec-tree-view-item value="f1">F1</tec-tree-view-item>
    </tec-tree-view-item>
  </tec-tree-view>
  <button id="after">After</button>
</div>`

async function setup(mode = "single") {
  const root = await fixture<HTMLElement>(demo(mode))
  const tree = root.querySelector<TecTreeView>("tec-tree-view")!
  await settle(tree)
  return { root, tree }
}

describe("tec-tree-view", () => {
  it("exposes tree / treeitem semantics with level, position and expansion", async () => {
    const { root, tree } = await setup()
    expect(await axTree(tree)).toEqual([
      "tree: Project",
      "treeitem: Wells [expanded]",
      "group",
      "treeitem: 34/10-A-12",
      "treeitem: 34/10-B-3 [disabled]",
      "treeitem: 34/10-C-7",
      "treeitem: Horizons",
      "treeitem: Faults",
    ])
    expect(await axNode(row(tree, "a12"))).toMatchObject({ role: "treeitem", level: "2", selected: "false" })
    // Chrome's CDP tree does not report set size / position; check the default semantics directly.
    const internals = (row(tree, "a12") as unknown as { internals: ElementInternals }).internals
    expect([internals.ariaSetSize, internals.ariaPosInSet]).toEqual(["3", "1"])
    expect(await axNode(row(tree, "horizons"))).toMatchObject({ level: "1", expanded: "false" })
    expect(tree.items.map((i) => i.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1])
    await expectAccessible(root)
  })

  it("indents rows by level", async () => {
    const { tree } = await setup()
    const pad = (v: string) => getComputedStyle(row(tree, v).shadowRoot!.querySelector(".row")!).paddingInlineStart
    expect(pad("wells")).toBe("4px")
    expect(pad("a12")).toBe("24px")
    expect(row(tree, "a12").shadowRoot!.querySelector(".row")!.getBoundingClientRect().height).toBe(32)
  })

  it("arrow keys move through visible rows, skip disabled ones, expand and collapse", async () => {
    const { tree } = await setup()
    row(tree, "wells").focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(row(tree, "a12"))
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(row(tree, "c7"))
    await userEvent.keyboard("{ArrowDown}")
    expect(deepActiveElement()).toBe(row(tree, "horizons"))
    await userEvent.keyboard("{ArrowRight}")
    expect(row(tree, "horizons").expanded).toBe(true)
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(row(tree, "balder"))
    await userEvent.keyboard("{ArrowLeft}")
    expect(deepActiveElement()).toBe(row(tree, "horizons"))
    await userEvent.keyboard("{ArrowLeft}")
    expect(row(tree, "horizons").expanded).toBe(false)
    await userEvent.keyboard("{End}")
    expect(deepActiveElement()).toBe(row(tree, "faults"))
    await userEvent.keyboard("{Home}")
    expect(deepActiveElement()).toBe(row(tree, "wells"))
    await userEvent.keyboard("*")
    expect([row(tree, "horizons").expanded, row(tree, "faults").expanded]).toEqual([true, true])
    await userEvent.keyboard("t")
    expect(deepActiveElement()).toBe(row(tree, "balder"))
  })

  it("mirrors Left/Right in RTL", async () => {
    const root = await fixture<HTMLElement>(demo(), { dir: "rtl" })
    const tree = root.querySelector<TecTreeView>("tec-tree-view")!
    await settle(tree)
    row(tree, "horizons").focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(row(tree, "horizons").expanded).toBe(true)
    await userEvent.keyboard("{ArrowRight}")
    expect(row(tree, "horizons").expanded).toBe(false)
  })

  it("is a single Tab stop that remembers the last focused row", async () => {
    const { root, tree } = await setup()
    ;(root.querySelector("#before") as HTMLElement).focus()
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(row(tree, "wells"))
    await userEvent.keyboard("{ArrowDown}{Tab}")
    expect(deepActiveElement()).toBe(root.querySelector("#after"))
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(deepActiveElement()).toBe(row(tree, "a12"))
  })

  it("single selection: click / Enter / Space toggle, tec-value-change, tec-select", async () => {
    const { tree } = await setup()
    const changes = recordEvents<CustomEvent>(tree, "tec-value-change").events
    const selects = recordEvents<CustomEvent>(tree, "tec-select").events
    await userEvent.click(row(tree, "a12").shadowRoot!.querySelector(".label")!)
    expect(tree.value).toBe("a12")
    await settle(tree)
    expect(await axNode(row(tree, "a12"))).toMatchObject({ selected: "true" })
    expect(row(tree, "a12").matches(":state(selected)")).toBe(true)
    row(tree, "c7").focus()
    await userEvent.keyboard("{Enter}")
    expect(tree.values).toEqual(["c7"])
    await userEvent.keyboard(" ")
    expect(tree.values).toEqual([])
    expect(changes.map((e) => e.detail)).toEqual([
      { value: "a12", values: ["a12"] },
      { value: "c7", values: ["c7"] },
      { value: "", values: [] },
    ])
    expect(selects.map((e) => e.detail.value)).toEqual(["a12", "c7", "c7"])
    // Disabled rows cannot be selected.
    row(tree, "b3").click()
    expect(tree.values).toEqual([])
    // Veto.
    tree.addEventListener("tec-value-change", (e) => e.preventDefault(), { once: true })
    await userEvent.keyboard("{Enter}")
    expect(tree.values).toEqual([])
  })

  it("multiple selection: aria-multiselectable, toggle, Shift+Arrow, Ctrl+A", async () => {
    const { tree } = await setup("multiple")
    expect(await axNode(tree)).toMatchObject({ role: "tree", multiselectable: "true" })
    row(tree, "wells").focus()
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(tree.values).toEqual(["wells", "a12"])
    await userEvent.keyboard(" ")
    expect(tree.values).toEqual(["wells"])
    await userEvent.keyboard("{Control>}a{/Control}")
    expect(tree.values).toEqual(["wells", "a12", "c7", "horizons", "balder", "sele", "faults", "f1"])
  })

  it("without selection, pressing a parent row toggles it; the chevron toggles without selecting", async () => {
    const { tree } = await setup("none")
    const expands = recordEvents<CustomEvent>(tree, "tec-expanded-change").events
    await userEvent.click(row(tree, "horizons").shadowRoot!.querySelector(".label")!)
    expect(row(tree, "horizons").expanded).toBe(true)
    await userEvent.click(row(tree, "horizons").shadowRoot!.querySelector(".chevron")!)
    expect(row(tree, "horizons").expanded).toBe(false)
    expect(expands.map((e) => e.detail.expanded)).toEqual([true, false])
    expect(row(tree, "horizons").matches(":state(selected)")).toBe(false)
    // Canceling keeps the state.
    tree.addEventListener("tec-expanded-change", (e) => e.preventDefault(), { once: true })
    row(tree, "horizons").focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(row(tree, "horizons").expanded).toBe(false)
  })

  it("collapsing an ancestor of the focused row moves focus to it", async () => {
    const { tree } = await setup()
    row(tree, "a12").focus()
    await userEvent.click(row(tree, "wells").shadowRoot!.querySelector(".chevron")!)
    await settle(tree)
    expect(deepActiveElement()).toBe(row(tree, "wells"))
    expect(row(tree, "a12").tabIndex).toBe(-1)
  })

  it("adornments: slots, row name excludes them, controls follow the tab stop, visibility toggle", async () => {
    const root = await fixture<HTMLElement>(html`<tec-tree-view label="Horizons">
      <tec-tree-view-item value="horizons" kind="folder" expanded>
        Horizons
        <tec-tree-view-action slot="end" aria-label="More"></tec-tree-view-action>
        <tec-tree-view-item value="balder">
          <span slot="color-tag" style="background: var(--tec-chart-2)"></span>
          Top Balder
          <span slot="suffix">12 picks</span>
          <tec-tree-view-visibility-toggle slot="end"></tec-tree-view-visibility-toggle>
          <tec-tree-view-action slot="end" aria-label="Top Balder actions"></tec-tree-view-action>
        </tec-tree-view-item>
      </tec-tree-view-item>
    </tec-tree-view>`)
    const tree = root as unknown as TecTreeView
    await settle(tree)
    const balder = row(tree, "balder")
    const toggle = balder.querySelector<TecTreeViewVisibilityToggle>("tec-tree-view-visibility-toggle")!
    await toggle.updateComplete
    const button = toggle.shadowRoot!.querySelector("button")!
    expect(await axNode(balder)).toMatchObject({ role: "treeitem", name: "Top Balder" })
    expect(await axNode(button)).toMatchObject({ role: "button", name: "Hide Top Balder", pressed: "false" })
    expect(button.tabIndex).toBe(-1)
    balder.focus()
    await settle(tree)
    await toggle.updateComplete
    expect(button.tabIndex).toBe(0)
    await userEvent.keyboard("{Tab}")
    expect(deepActiveElement()).toBe(button)
    const changes = recordEvents<CustomEvent>(tree, "tec-visibility-change").events
    await userEvent.keyboard(" ")
    await toggle.updateComplete
    expect(changes.map((e) => e.detail)).toEqual([{ visible: false }])
    expect(balder.dimmed).toBe(true)
    expect(await axNode(button)).toMatchObject({ name: "Hide Top Balder", pressed: "true" })
    // The toggle press does not select or move the row.
    expect(tree.values).toEqual([])
    await expectAccessible(root)
  })
})
