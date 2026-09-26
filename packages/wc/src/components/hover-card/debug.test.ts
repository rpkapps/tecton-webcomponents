import { html } from "lit"
import { it } from "vitest"
import { userEvent } from "vitest/browser"
import "../button/define.js"
import { aTimeout, fixture, waitUntil, deepActiveElement } from "../../internal/test-utils.js"
import "./define.js"
it("debug", async () => {
  const root = await fixture<HTMLElement>(html`<div style="padding: 40px 80px">
  <button id="before">Before</button>
  <tec-hover-card delay="10" close-delay="50">
    <tec-button slot="trigger" variant="link">Hover Here</tec-button>
    <div>@nextjs</div><a href="#profile">Profile</a>
  </tec-hover-card>
  <button id="after" style="display: block; margin-top: 300px">After</button></div>`)
  const el = root.querySelector("tec-hover-card")!
  document.addEventListener("pointermove", (e) => console.log("move", e.clientX, e.clientY, (e.target as Element).localName), true)
  el.addEventListener("tec-open-change", (e) => console.log("change", JSON.stringify((e as CustomEvent).detail)))
  await userEvent.hover(el.querySelector("tec-button")!)
  await waitUntil(() => el.open, "open")
  await aTimeout(200)
  console.log("card", JSON.stringify(el.shadowRoot!.querySelector(".content")!.getBoundingClientRect()), "trigger", JSON.stringify(el.querySelector("tec-button")!.getBoundingClientRect()))
  await userEvent.hover(el.querySelector("a")!)
  await aTimeout(120)
  console.log("after a, open", el.open)
  await userEvent.hover(root.querySelector("#after")!)
  await aTimeout(300)
  console.log("after #after", el.open, deepActiveElement()?.localName, JSON.stringify(root.querySelector("#after")!.getBoundingClientRect()))
})
