import { html, LitElement } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { defineElement } from "./define.js"
import { FormControlMixin, nativeValueMissingMessage, requiredValidator, type Validator } from "./form-control.js"
import { TectonElement } from "./tecton-element.js"
import { aTimeout, axNode, fixture, recordEvents } from "./test-utils.js"

/** A minimal text field: inner native <input>, validity mirrored. */
class TestInput extends FormControlMixin(TectonElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }
  @property({ type: Number }) minlength?: number
  @query("input") input!: HTMLInputElement
  protected override get formControl() {
    return this.input ?? null
  }
  protected override render() {
    return html`<input
      .value=${live(this.value)}
      ?required=${this.required}
      ?disabled=${this.isDisabled}
      minlength=${this.minlength ?? -1}
      @input=${(e: Event) => (this.value = (e.target as HTMLInputElement).value)}
      @change=${this.redispatchChange}
    />`
  }
}
defineElement("test-input", TestInput)

/** A control without an inner native control: custom validators, host semantics. */
class TestPicker extends FormControlMixin(TectonElement) {
  protected override get validators(): Validator<TestPicker>[] {
    return [requiredValidator<TestPicker>((el) => !el.value, "select")]
  }
  pick(value: string) {
    this.value = value
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }
  protected override render() {
    return html`<slot></slot>`
  }
}
defineElement("test-picker", TestPicker)

/** Manages its inner control's name itself: `aria-label` is not delegated. */
class TestNamedInput extends TestInput {
  protected override get ariaDelegationExclude(): readonly string[] {
    return ["aria-label"]
  }
}
defineElement("test-named-input", TestNamedInput)

const inputOf = (el: TestInput) => el.shadowRoot!.querySelector("input")!

describe("FormControlMixin", () => {
  it("value attribute is the default, value property the current value; reset restores", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><test-input name="q" value="hello"></test-input></form>`)
    const el = form.querySelector<TestInput>("test-input")!
    expect(el.value).toBe("hello")
    expect(new FormData(form).get("q")).toBe("hello")
    await userEvent.fill(inputOf(el), "world")
    expect(el.value).toBe("world")
    expect(el.getAttribute("value")).toBe("hello")
    expect(new FormData(form).get("q")).toBe("world")
    el.setAttribute("value", "changed default")
    expect(el.value).toBe("world")
    form.reset()
    await el.updateComplete
    expect(el.value).toBe("changed default")
    expect(inputOf(el).value).toBe("changed default")
  })

  it("mirrors the inner control's validity (valueMissing, tooShort) with its native message", async () => {
    const el = await fixture<TestInput>(html`<test-input required></test-input>`)
    expect(el.validity.valueMissing).toBe(true)
    expect(el.validationMessage).toBe(nativeValueMissingMessage("text"))
    expect(el.willValidate).toBe(true)
    el.value = "ok"
    await el.updateComplete
    expect(el.checkValidity()).toBe(true)
  })

  it("displays invalidity only after a user change (like :user-invalid)", async () => {
    const el = await fixture<TestInput>(html`<test-input required value="x"></test-input>`)
    expect(el.showInvalid).toBe(false)
    await userEvent.clear(inputOf(el))
    await el.updateComplete
    expect(el.matches(":state(invalid)")).toBe(true)
    expect(el.matches(":state(user-invalid)")).toBe(false)
    inputOf(el).blur() // change fires on blur
    await el.updateComplete
    await el.updateComplete
    expect(el.matches(":state(user-invalid)")).toBe(true)
    expect(inputOf(el).getAttribute("aria-invalid")).toBe("true")
  })

  it("reportValidity() displays invalidity; checkValidity() does not", async () => {
    const el = await fixture<TestInput>(html`<test-input required></test-input>`)
    el.checkValidity()
    await el.updateComplete
    expect(el.matches(":state(user-invalid)")).toBe(false)
    el.reportValidity()
    await el.updateComplete
    expect(el.matches(":state(user-invalid)")).toBe(true)
  })

  it("form reset clears the displayed invalidity", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><test-input name="q" required></test-input></form>`)
    const el = form.querySelector<TestInput>("test-input")!
    el.reportValidity()
    await el.updateComplete
    form.reset()
    await el.updateComplete
    await el.updateComplete
    expect(el.matches(":state(user-invalid)")).toBe(false)
  })

  it("is labelled by <label for> and a wrapping label; ARIA delegated to the inner control", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <label for="city">City</label><test-input id="city" aria-describedby="hint"></test-input><p id="hint">Where you live</p>
      <label>Street <test-input id="street"></test-input></label>
      <test-input id="zip" aria-label="Zip code"></test-input>
    </div>`)
    expect(await axNode(inputOf(root.querySelector("#city")!))).toMatchObject({ role: "textbox", name: "City", description: "Where you live" })
    const street = await axNode(inputOf(root.querySelector("#street")!))
    expect(street.name.trim()).toBe("Street")
    expect(await axNode(inputOf(root.querySelector("#zip")!))).toMatchObject({ name: "Zip code" })
    await userEvent.click(root.querySelector("label")!)
    expect(root.querySelector("#city")!.shadowRoot!.activeElement).toBe(inputOf(root.querySelector("#city")!))
  })

  it("ariaDelegationExclude keeps attributes the component manages off the inner control", async () => {
    const el = await fixture<TestNamedInput>(html`<test-named-input aria-label="Host name" aria-describedby="d"></test-named-input>`)
    expect(inputOf(el).hasAttribute("aria-label")).toBe(false)
    el.setAttribute("aria-expanded", "true")
    await el.updateComplete
    await Promise.resolve()
    expect(inputOf(el).getAttribute("aria-expanded")).toBe("true")
  })

  it("fieldset disabled: isDisabled, :disabled, not submitted, inner control disabled", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset disabled><test-input name="q" value="x"></test-input></fieldset></form>`)
    const el = form.querySelector<TestInput>("test-input")!
    await el.updateComplete
    expect(el.isDisabled).toBe(true)
    expect(el.matches(":disabled")).toBe(true)
    expect(inputOf(el).disabled).toBe(true)
    expect(new FormData(form).has("q")).toBe(false)
    form.querySelector("fieldset")!.disabled = false
    await el.updateComplete
    expect(el.isDisabled).toBe(false)
    expect(new FormData(form).get("q")).toBe("x")
  })

  it("re-dispatches change as a composed event; input is composed natively", async () => {
    const el = await fixture<TestInput>(html`<test-input></test-input>`)
    const changes = recordEvents(el, "change")
    const inputs = recordEvents(el, "input")
    await userEvent.type(inputOf(el), "ab")
    inputOf(el).blur()
    expect(inputs.events.length).toBe(2)
    expect(changes.events.length).toBe(1)
    expect(changes.events[0]!.target).toBe(el)
  })

  it("custom validators for controls without an inner control; setCustomValidity wins", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><test-picker name="fruit" required></test-picker></form>`)
    const el = form.querySelector<TestPicker>("test-picker")!
    expect(el.validity.valueMissing).toBe(true)
    expect(el.validationMessage).toBe(nativeValueMissingMessage("select"))
    el.pick("apple")
    await el.updateComplete
    expect(el.checkValidity()).toBe(true)
    expect(new FormData(form).get("fruit")).toBe("apple")
    el.setCustomValidity("Apples are sold out")
    expect(el.validity.customError).toBe(true)
    expect(el.validationMessage).toBe("Apples are sold out")
  })

  it("blocks form submission while invalid and displays the error after the attempt", async () => {
    const form = await fixture<HTMLFormElement>(html`<form><test-picker name="fruit" required></test-picker></form>`)
    const el = form.querySelector<TestPicker>("test-picker")!
    let submitted = false
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      submitted = true
    })
    form.requestSubmit()
    await aTimeout()
    expect(submitted).toBe(false)
    expect(el.matches(":state(user-invalid)")).toBe(true)
  })

  it("restores state through formStateRestoreCallback", async () => {
    const el = await fixture<TestInput>(html`<test-input></test-input>`)
    el.formStateRestoreCallback("restored", "restore")
    await el.updateComplete
    expect(inputOf(el).value).toBe("restored")
  })

  it("invalid attribute forces the invalid display and blocks submission", async () => {
    const el = await fixture<TestInput>(html`<test-input invalid></test-input>`)
    expect(el.showInvalid).toBe(true)
    expect(el.checkValidity()).toBe(false)
    expect(inputOf(el).getAttribute("aria-invalid")).toBe("true")
    el.invalid = false
    await el.updateComplete
    expect(el.checkValidity()).toBe(true)
    expect(inputOf(el).hasAttribute("aria-invalid")).toBe(false)
  })
})
