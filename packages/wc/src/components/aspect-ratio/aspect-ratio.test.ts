import { html } from "lit"
import { describe, expect, it } from "vitest"
import { expectAccessible, fixture } from "../../internal/test-utils.js"
import { parseRatio, type TecAspectRatio } from "./aspect-ratio.js"
import "./define.js"

describe("tec-aspect-ratio", () => {
  it("parses numbers and fractions", () => {
    expect(parseRatio("16/9")).toBe("16 / 9")
    expect(parseRatio(" 16 : 9 ")).toBe("16 / 9")
    expect(parseRatio("1.5")).toBe("1.5")
    expect(parseRatio(0.5625)).toBe("0.5625")
    expect(parseRatio("0")).toBeNull()
    expect(parseRatio("wide")).toBeNull()
    expect(parseRatio(Number.NaN)).toBeNull()
  })

  it("keeps the ratio as the width changes and lets media fill it", async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <tec-aspect-ratio ratio="16/9" style="width: 320px"><img alt="Photo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="position: absolute; inset: 0; width: 100%; height: 100%" /></tec-aspect-ratio>
      <tec-aspect-ratio ratio="0.5625" style="width: 90px"></tec-aspect-ratio>
      <tec-aspect-ratio style="width: 50px"></tec-aspect-ratio>
      <tec-aspect-ratio ratio="nope" style="width: 40px"></tec-aspect-ratio>
    </div>`)
    const [wide, tall, square, invalid] = [...root.querySelectorAll<TecAspectRatio>("tec-aspect-ratio")]
    expect(wide!.getBoundingClientRect().height).toBe(180)
    expect(wide!.querySelector("img")!.getBoundingClientRect().height).toBe(180)
    expect(tall!.getBoundingClientRect().height).toBe(160)
    expect(square!.getBoundingClientRect().height).toBe(50)
    expect(invalid!.getBoundingClientRect().height).toBe(40)
    wide!.ratio = 2
    await wide!.updateComplete
    expect(wide!.getBoundingClientRect().height).toBe(160)
    await expectAccessible(root)
  })
})
