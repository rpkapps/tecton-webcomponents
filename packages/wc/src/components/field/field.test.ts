import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, waitUntil } from "../../internal/test-utils.js"
import "../checkbox/define.js"
import "../input/define.js"
import "../textarea/define.js"
import type { TecField } from "./field.js"
import type { TecFieldError } from "./field-error.js"
import "./define.js"

const inner = (el: Element) => el.shadowRoot!.querySelector("input, textarea")!
const settled = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

describe("tec-field", () => {
  it("wires label and description to the control without ids", async () => {
    const field = await fixture<TecField>(html`<tec-field>
      <tec-field-label>Well name</tec-field-label>
      <tec-input></tec-input>
      <tec-field-description>Licence block, platform and slot.</tec-field-description>
    </tec-field>`)
    await settled()
    const input = field.querySelector("tec-input")!
    expect(field.control).toBe(input)
    expect(await axNode(inner(input))).toMatchObject({ role: "textbox", name: "Well name", description: "Licence block, platform and slot." })
    expect(await axNode(field)).toMatchObject({ role: "group" })
    await userEvent.click(field.querySelector("tec-field-label")!)
    expect(input.shadowRoot!.activeElement).toBe(inner(input))
    await expectAccessible(field)
  })

  it("works with native controls and for=", async () => {
    const field = await fixture<TecField>(html`<tec-field>
      <tec-field-label for="native-1">Comment</tec-field-label>
      <textarea id="native-1"></textarea>
      <tec-field-description>Optional.</tec-field-description>
    </tec-field>`)
    await settled()
    expect(await axNode(field.querySelector("textarea")!)).toMatchObject({ name: "Comment", description: "Optional." })
  })

  it("shows the error and destructive style only while the control is invalid", async () => {
    const form = await fixture<HTMLFormElement>(html`<form novalidate><tec-field>
      <tec-field-label>Email</tec-field-label>
      <tec-input type="email" required></tec-input>
      <tec-field-error></tec-field-error>
    </tec-field></form>`)
    const field = form.querySelector("tec-field")!
    const error = form.querySelector<TecFieldError>("tec-field-error")!
    const input = form.querySelector("tec-input")!
    await settled()
    expect(error.displayed).toBe(false)
    expect(getComputedStyle(error).display).toBe("none")
    expect(field.matches(":state(invalid)")).toBe(false)

    input.reportValidity()
    await waitUntil(() => error.displayed)
    await error.updateComplete
    expect(field.matches(":state(invalid)")).toBe(true)
    expect(error.shadowRoot!.textContent).toContain(input.validationMessage)
    expect(await axNode(error)).toMatchObject({ role: "alert" })
    expect(input.getAttribute("aria-describedby")).toContain(error.id)
    const label = field.querySelector("tec-field-label")!
    expect(getComputedStyle(label).color).toBe(getComputedStyle(error).color)

    await userEvent.click(inner(input))
    await userEvent.keyboard("a@b.co")
    await waitUntil(() => !error.displayed)
    expect(input.getAttribute("aria-describedby") ?? "").not.toContain(error.id)
  })

  it("invalid on the field marks the control invalid without failing validation", async () => {
    const field = await fixture<TecField>(html`<tec-field invalid>
      <tec-field-label>Username</tec-field-label>
      <tec-input value="taken"></tec-input>
      <tec-field-error>Choose another username.</tec-field-error>
    </tec-field>`)
    const input = field.querySelector("tec-input")!
    await waitUntil(() => inner(input).getAttribute("aria-invalid") === "true")
    expect(input.checkValidity()).toBe(true)
    expect(await axNode(inner(input))).toMatchObject({ invalid: "true", description: "Choose another username." })
    field.invalid = false
    await waitUntil(() => !inner(input).hasAttribute("aria-invalid"))
  })

  it("renders errors from the errors property, deduplicated", async () => {
    const error = await fixture<TecFieldError>(html`<tec-field-error></tec-field-error>`)
    expect(error.displayed).toBe(false)
    error.errors = [{ message: "Too short" }, { message: "Too short" }, "No digits"]
    await error.updateComplete
    expect([...error.shadowRoot!.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Too short", "No digits"])
    error.errors = [{ message: "Only one" }]
    await error.updateComplete
    expect(error.shadowRoot!.querySelector("li")).toBeNull()
    expect(error.shadowRoot!.textContent).toContain("Only one")
    expect(error.displayed).toBe(true)
  })

  it("horizontal: checkbox beside its label, which toggles it", async () => {
    const field = await fixture<TecField>(html`<tec-field orientation="horizontal">
      <tec-checkbox></tec-checkbox>
      <tec-field-label>Notify the team</tec-field-label>
    </tec-field>`)
    await settled()
    const box = field.querySelector("tec-checkbox")!
    const label = field.querySelector("tec-field-label")!
    expect(getComputedStyle(field).flexDirection).toBe("row")
    expect(box.getBoundingClientRect().right).toBeLessThanOrEqual(label.getBoundingClientRect().left)
    expect(await axNode(box.shadowRoot!.querySelector("input")!)).toMatchObject({ name: "Notify the team" })
    await userEvent.click(label)
    expect(box.checked).toBe(true)
  })

  it("follows a disabled control", async () => {
    const field = await fixture<TecField>(html`<tec-field><tec-field-label>Email</tec-field-label><tec-input disabled></tec-input></tec-field>`)
    await settled()
    expect(field.matches(":state(disabled)")).toBe(true)
    const label = field.querySelector("tec-field-label")!
    await label.updateComplete
    expect(getComputedStyle(label).opacity).toBe("0.5")
  })

  it("responsive fields turn horizontal in a wide field group", async () => {
    const group = await fixture<HTMLElement>(html`<tec-field-group style="width: 500px">
      <tec-field orientation="responsive"><tec-field-label>Name</tec-field-label><tec-input></tec-input></tec-field>
    </tec-field-group>`)
    const field = group.querySelector("tec-field")!
    expect(getComputedStyle(field).flexDirection).toBe("row")
    group.style.width = "300px"
    await settled()
    expect(getComputedStyle(field).flexDirection).toBe("column")
  })

  it("field-set is a group named by its legend", async () => {
    const set = await fixture<HTMLElement>(html`<tec-field-set>
      <tec-field-legend>Address</tec-field-legend>
      <tec-field-description>Where we deliver.</tec-field-description>
      <tec-field-group><tec-field><tec-field-label>Street</tec-field-label><tec-input></tec-input></tec-field></tec-field-group>
    </tec-field-set>`)
    await settled()
    const fieldset = set.shadowRoot!.querySelector("fieldset")!
    expect(await axNode(fieldset)).toMatchObject({ role: "group", name: "Address" })
    const legend = set.querySelector("tec-field-legend")!
    const description = set.querySelector("tec-field-description")!
    expect(legend.getBoundingClientRect().top).toBeLessThan(description.getBoundingClientRect().top)
    await expectAccessible(set)
  })

  it("choice card: label wrapping a field", async () => {
    const label = await fixture<HTMLElement>(html`<tec-field-label>
      <tec-field orientation="horizontal">
        <tec-field-content>
          <tec-field-title>Kubernetes</tec-field-title>
          <tec-field-description>Run GPU workloads.</tec-field-description>
        </tec-field-content>
        <tec-checkbox></tec-checkbox>
      </tec-field>
    </tec-field-label>`)
    await settled()
    expect(label.matches(":state(card)")).toBe(true)
    const base = label.shadowRoot!.querySelector(".base")!
    expect(getComputedStyle(base).borderTopWidth).toBe("1px")
    await userEvent.click(label.querySelector("tec-field-title")!)
    await waitUntil(() => label.matches(":state(checked)"))
    expect(label.querySelector("tec-checkbox")!.checked).toBe(true)
  })

  it("separator with and without text", async () => {
    const root = await fixture<HTMLElement>(html`<div><tec-field-separator></tec-field-separator><tec-field-separator>Or</tec-field-separator></div>`)
    const [plain, text] = [...root.querySelectorAll("tec-field-separator")]
    expect(await axNode(plain!.shadowRoot!.querySelector(".line")!)).toMatchObject({ role: "separator" })
    expect(getComputedStyle(text!.shadowRoot!.querySelector(".content")!).display).toBe("block")
    expect(getComputedStyle(plain!.shadowRoot!.querySelector(".content")!).display).toBe("none")
  })
})
