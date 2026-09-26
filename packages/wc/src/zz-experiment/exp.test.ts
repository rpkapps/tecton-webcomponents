import { test, expect } from "vitest"
import { userEvent } from "vitest/browser"
import { fixture } from "../internal/test-utils.js"

class XFace extends HTMLElement {
  static formAssociated = true
  internals = this.attachInternals()
  clicks = 0
  constructor() { super(); const r = this.attachShadow({ mode: "open", delegatesFocus: true }); r.innerHTML = `<input type="checkbox">`; this.addEventListener("click", () => this.clicks++) }
}
customElements.define("x-face", XFace)

test("probe", async () => {
  const i = document.createElement("input"); i.type = "checkbox"; i.required = true
  const s = document.createElement("select"); s.required = true
  const t = document.createElement("input"); t.required = true
  const el = await fixture(`<form><label for="f">Lbl</label><x-face id="f"></x-face><label>Wrap <x-face id="g"></x-face></label></form>`)
  const f = el.querySelector("#f") as XFace
  await userEvent.click(el.querySelector("label")!)
  const active = document.activeElement?.id + "/" + (document.activeElement?.shadowRoot?.activeElement?.localName)
  expect([i.validationMessage, s.validationMessage, t.validationMessage, f.internals.labels.length, (el.querySelector("#g") as XFace).internals.labels.length, f.clicks, active].join(" | ")).toBe("")
})
