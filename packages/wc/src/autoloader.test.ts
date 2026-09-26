import { describe, expect, it } from "vitest"
import { loaders } from "./autoloader-map.js"
import { discover } from "./autoloader.js"
import { waitUntil } from "./internal/test-utils.js"

describe("@tecton/wc/autoloader", () => {
  it("maps every registered tag to a family loader", () => {
    expect(Object.keys(loaders).length).toBeGreaterThan(300)
    expect(Object.keys(loaders).every((tag) => tag.startsWith("tec-"))).toBe(true)
  })

  it("registers the families of tags already in the page", async () => {
    document.body.insertAdjacentHTML("beforeend", `<tec-badge id="auto-1">New</tec-badge>`)
    await discover()
    expect(customElements.get("tec-badge")).toBeDefined()
    expect(document.getElementById("auto-1")!.matches(":defined")).toBe(true)
  })

  it("registers tags added later, including a family's parts and templates", async () => {
    const host = document.createElement("div")
    host.innerHTML = `<tec-tabs value="a"><tec-tabs-list><tec-tabs-trigger value="a">A</tec-tabs-trigger></tec-tabs-list></tec-tabs>
      <template><tec-kbd>K</tec-kbd></template>`
    document.body.append(host)
    await waitUntil(() => !!customElements.get("tec-tabs-trigger") && !!customElements.get("tec-kbd"), "loaded")
    expect(host.querySelector("tec-tabs")!.matches(":defined")).toBe(true)
  })

  it("ignores unknown tec- tags", async () => {
    document.body.insertAdjacentHTML("beforeend", `<tec-not-a-component></tec-not-a-component>`)
    await expect(discover()).resolves.toBeUndefined()
  })
})
