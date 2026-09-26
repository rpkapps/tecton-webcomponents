import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, deepActiveElement, expectAccessible, fixture, recordEvents } from "../../internal/test-utils.js"
import type { TecSlider } from "./slider.js"
import "./define.js"

const thumbs = (el: TecSlider) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".thumb")]
const center = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Presses (and optionally drags) with real pointer events at page coordinates. */
async function press(target: Element, from: { x: number; y: number }, to?: { x: number; y: number }) {
  const opts = { bubbles: true, composed: true, pointerId: 1, button: 0, buttons: 1, isPrimary: true, pointerType: "mouse" }
  target.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: from.x, clientY: from.y }))
  if (to) target.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: to.x, clientY: to.y }))
  const end = to ?? from
  target.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0, clientX: end.x, clientY: end.y }))
}

describe("tec-slider", () => {
  it("renders one slider thumb with value, bounds, valuetext and name", async () => {
    const el = await fixture<TecSlider>(html`<div style="width: 300px"><tec-slider aria-label="Volume" value="75" max="100"></tec-slider></div>`)
    const slider = el.querySelector("tec-slider")!
    const [thumb] = thumbs(slider)
    expect(thumb!.getAttribute("aria-valuenow")).toBe("75")
    expect(await axNode(thumb!)).toMatchObject({ role: "slider", name: "Volume", valuemin: "0", valuemax: "100", valuetext: "75", orientation: "horizontal" })
    const size = thumb!.getBoundingClientRect()
    expect([size.width, size.height]).toEqual([20, 20])
    // Thumb centre at 75% of the track.
    const track = slider.shadowRoot!.querySelector(".track")!.getBoundingClientRect()
    expect(Math.round(center(thumb!).x - track.left)).toBe(225)
    const range = slider.shadowRoot!.querySelector(".range")!.getBoundingClientRect()
    expect(Math.round(range.width)).toBe(225)
    await expectAccessible(el)
  })

  it("keyboard: arrows, shift+arrow, PageUp/PageDown, Home/End; input + change per key", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="x" value="50" step="1"></tec-slider>`)
    const inputs = recordEvents(slider, "input")
    const changes = recordEvents(slider, "change")
    thumbs(slider)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(slider.values).toEqual([51])
    await userEvent.keyboard("{ArrowUp}")
    expect(slider.values).toEqual([52])
    await userEvent.keyboard("{ArrowLeft}{ArrowDown}")
    expect(slider.values).toEqual([50])
    await userEvent.keyboard("{PageUp}")
    expect(slider.values).toEqual([60])
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    expect(slider.values).toEqual([50])
    await userEvent.keyboard("{PageDown}")
    expect(slider.values).toEqual([40])
    await userEvent.keyboard("{End}")
    expect(slider.values).toEqual([100])
    await userEvent.keyboard("{ArrowRight}") // at max: no change, no event
    await userEvent.keyboard("{Home}")
    expect(slider.values).toEqual([0])
    expect(inputs.events).toHaveLength(9)
    expect(changes.events).toHaveLength(9)
    expect(changes.events[0]!.composed).toBe(true)
    expect(slider.value).toBe("0")
  })

  it("mirrors Left/Right in RTL and places thumbs from the right", async () => {
    const root = await fixture<HTMLElement>(html`<div dir="rtl" style="width: 200px"><tec-slider aria-label="x" value="25"></tec-slider></div>`)
    const slider = root.querySelector("tec-slider")!
    const thumb = thumbs(slider)[0]!
    const track = slider.shadowRoot!.querySelector(".track")!.getBoundingClientRect()
    expect(Math.round(track.right - center(thumb).x)).toBe(50)
    thumb.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(slider.values).toEqual([26])
  })

  it("range: one thumb per value; thumbs are bounded by their neighbours", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="Price" value="25, 50" step="5" thumb-labels="Minimum, Maximum"></tec-slider>`)
    const [lo, hi] = thumbs(slider)
    expect(await axNode(lo!)).toMatchObject({ name: "Price Minimum", valuetext: "25", valuemin: "0", valuemax: "50" })
    expect(await axNode(hi!)).toMatchObject({ name: "Price Maximum", valuetext: "50", valuemin: "25", valuemax: "100" })
    lo!.focus()
    await userEvent.keyboard("{End}")
    expect(slider.values).toEqual([50, 50])
    await userEvent.keyboard("{ArrowRight}")
    expect(slider.values).toEqual([50, 50])
    hi!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(slider.values).toEqual([50, 55])
    await expectAccessible(slider)
  })

  it("snaps to step (decimal steps too) and formats aria-valuetext", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="Temperature" value="0.3 0.7" min="0" max="1" step="0.1"></tec-slider>`)
    slider.formatOptions = { style: "percent" }
    await slider.updateComplete
    thumbs(slider)[0]!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(slider.values).toEqual([0.4, 0.7])
    expect(slider.value).toBe("0.4,0.7")
    expect(thumbs(slider)[0]!.getAttribute("aria-valuetext")).toBe("40%")
  })

  it("pointer: pressing the track moves the closest thumb; dragging fires input, release fires change", async () => {
    const root = await fixture<HTMLElement>(html`<div style="width: 200px; padding: 20px"><tec-slider aria-label="x" value="10, 90"></tec-slider></div>`)
    const slider = root.querySelector("tec-slider")!
    const base = slider.shadowRoot!.querySelector(".base")!
    const rect = base.getBoundingClientRect()
    const at = (pct: number) => ({ x: rect.left + (rect.width * pct) / 100, y: rect.top + rect.height / 2 })
    const inputs = recordEvents(slider, "input")
    const changes = recordEvents(slider, "change")
    await press(base, at(70))
    expect(slider.values).toEqual([10, 70])
    expect(deepActiveElement()).toBe(thumbs(slider)[1])
    expect(changes.events).toHaveLength(1)
    await press(base, at(20), at(40))
    expect(slider.values).toEqual([40, 70])
    expect(inputs.events).toHaveLength(3)
    expect(changes.events).toHaveLength(2)
  })

  it("vertical: grows upwards, Up increases, orientation exposed", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="x" orientation="vertical" value="50" style="height: 160px"></tec-slider>`)
    expect(slider.getBoundingClientRect().height).toBe(160)
    const thumb = thumbs(slider)[0]!
    expect(await axNode(thumb)).toMatchObject({ orientation: "vertical" })
    const track = slider.shadowRoot!.querySelector(".track")!.getBoundingClientRect()
    expect(Math.round(track.bottom - center(thumb).y)).toBe(80)
    const base = slider.shadowRoot!.querySelector(".base")!
    const rect = base.getBoundingClientRect()
    await press(base, { x: rect.left + 10, y: rect.top + rect.height * 0.25 })
    expect(slider.values).toEqual([75])
  })

  it("submits one entry per thumb when named; reset restores the value attribute", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-slider name="depth" value="100 400" max="1000" aria-label="Depth"></tec-slider>
      <tec-slider name="gain" value="3" aria-label="Gain"></tec-slider>
      <tec-slider value="3" aria-label="Unnamed"></tec-slider>
    </form>`)
    const [depth, gain] = [...form.querySelectorAll("tec-slider")]
    let data = new FormData(form)
    expect(data.getAll("depth")).toEqual(["100", "400"])
    expect(data.get("gain")).toBe("3")
    expect([...data.keys()]).toEqual(["depth", "depth", "gain"])
    depth!.values = [200, 300]
    gain!.value = "7"
    await depth!.updateComplete
    await gain!.updateComplete
    data = new FormData(form)
    expect(data.getAll("depth")).toEqual(["200", "300"])
    expect(data.get("gain")).toBe("7")
    form.reset()
    await depth!.updateComplete
    expect(depth!.values).toEqual([100, 400])
    expect(gain!.values).toEqual([3])
  })

  it("is labelled by <label for>; a label click focuses the first thumb", async () => {
    const root = await fixture<HTMLElement>(html`<div><label for="sl-temp">Temperature</label><tec-slider id="sl-temp" value="20" aria-describedby="sl-d"></tec-slider><p id="sl-d">Celsius</p></div>`)
    const slider = root.querySelector("tec-slider")!
    await slider.updateComplete
    expect(await axNode(thumbs(slider)[0]!)).toMatchObject({ name: "Temperature", description: "Celsius" })
    await userEvent.click(root.querySelector("label")!)
    expect(deepActiveElement()).toBe(thumbs(slider)[0])
  })

  it("disabled: not focusable, no pointer or keyboard changes", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="x" value="50" disabled></tec-slider>`)
    expect(thumbs(slider)[0]!.hasAttribute("tabindex")).toBe(false)
    expect(await axNode(thumbs(slider)[0]!)).toMatchObject({ disabled: "true" })
    const base = slider.shadowRoot!.querySelector(".base")!
    const rect = base.getBoundingClientRect()
    await press(base, { x: rect.left + 2, y: rect.top + 5 })
    expect(slider.values).toEqual([50])
    await expectAccessible(slider)
  })

  it("does not fire events for programmatic changes and clamps/snaps set values", async () => {
    const slider = await fixture<TecSlider>(html`<tec-slider aria-label="x" step="10"></tec-slider>`)
    const events = recordEvents(slider, "input")
    expect(slider.values).toEqual([0])
    slider.values = [133]
    await slider.updateComplete
    expect(slider.values).toEqual([100])
    slider.value = "44"
    await slider.updateComplete
    expect(slider.values).toEqual([40])
    expect(events.events).toHaveLength(0)
  })
})
