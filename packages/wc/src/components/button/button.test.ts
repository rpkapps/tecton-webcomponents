import { html } from "lit"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { axNode, expectAccessible, fixture, aTimeout } from "../../internal/test-utils.js"
import type { TecButton } from "./button.js"
import "./define.js"

const inner = (el: TecButton) => el.shadowRoot!.querySelector(".base") as HTMLElement

describe("tec-button", () => {
  it("renders a native button with defaults", async () => {
    const el = await fixture<TecButton>(html`<tec-button>Save</tec-button>`)
    expect(el.variant).toBe("default")
    expect(el.size).toBe("default")
    expect(el.getAttribute("variant")).toBe("default")
    expect(inner(el).localName).toBe("button")
    expect(inner(el).getAttribute("type")).toBe("button")
    expect(await axNode(inner(el))).toMatchObject({ role: "button", name: "Save" })
    await expectAccessible(el)
  })

  it("applies the Tecton size scale", async () => {
    const el = await fixture<HTMLElement>(html`<div>
      <tec-button size="xs">xs</tec-button><tec-button size="sm">sm</tec-button><tec-button>md</tec-button>
      <tec-button size="lg">lg</tec-button><tec-button size="icon" aria-label="i">+</tec-button>
      <tec-button size="icon-xs" aria-label="i">+</tec-button><tec-button size="icon-sm" aria-label="i">+</tec-button>
      <tec-button size="icon-lg" aria-label="i">+</tec-button>
    </div>`)
    const heights = [...el.querySelectorAll("tec-button")].map((b) => b.getBoundingClientRect().height)
    expect(heights).toEqual([24, 28, 32, 36, 32, 24, 28, 36])
    const iconWidths = [...el.querySelectorAll("tec-button[size^=icon]")].map((b) => b.getBoundingClientRect().width)
    expect(iconWidths).toEqual([32, 24, 28, 36])
  })

  it("uses the variant colours from the theme", async () => {
    const el = await fixture<HTMLElement>(html`<div>
      <tec-button>a</tec-button><tec-button variant="outline">b</tec-button><tec-button variant="ghost">c</tec-button>
    </div>`)
    const [primary, outline, ghost] = [...el.querySelectorAll("tec-button")].map((b) => getComputedStyle(inner(b)))
    const probe = document.createElement("div")
    probe.style.color = "var(--tec-primary)"
    el.append(probe)
    expect(primary!.backgroundColor).toBe(getComputedStyle(probe).color)
    expect(outline!.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(outline!.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(ghost!.backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("tightens padding next to start/end icons", async () => {
    const el = await fixture<TecButton>(html`<tec-button><svg slot="start" viewBox="0 0 24 24"></svg>New</tec-button>`)
    expect(el.matches(":state(has-start)")).toBe(true)
    expect(getComputedStyle(inner(el)).paddingInlineStart).toBe("6px")
    expect(getComputedStyle(inner(el)).paddingInlineEnd).toBe("8px")
    const svg = el.querySelector("svg")!
    expect(svg.getBoundingClientRect().width).toBe(16)
  })

  it("delegates host ARIA to the inner button and keeps it on the host", async () => {
    const el = await fixture<TecButton>(html`<tec-button size="icon" aria-label="Submit" aria-expanded="false">+</tec-button>`)
    expect(inner(el).getAttribute("aria-label")).toBe("Submit")
    el.setAttribute("aria-expanded", "true")
    await aTimeout()
    expect(await axNode(inner(el))).toMatchObject({ role: "button", name: "Submit", expanded: "true" })
    expect(el.getAttribute("aria-expanded")).toBe("true")
    el.removeAttribute("aria-label")
    await aTimeout()
    expect(inner(el).hasAttribute("aria-label")).toBe(false)
  })

  it("resolves aria-describedby ids from the host's tree as element references", async () => {
    const el = await fixture<HTMLElement>(html`<div><p id="hint">Deletes forever</p><tec-button aria-describedby="hint">Delete</tec-button></div>`)
    const button = el.querySelector("tec-button")!
    expect(await axNode(inner(button))).toMatchObject({ name: "Delete", description: "Deletes forever" })
  })

  it("is focusable, clickable and activates with Enter/Space", async () => {
    const onClick = vi.fn()
    const el = await fixture<TecButton>(html`<tec-button @click=${onClick}>Go</tec-button>`)
    await userEvent.click(el)
    expect(onClick).toHaveBeenCalledTimes(1)
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it("shows the focus ring only for keyboard focus", async () => {
    const el = await fixture<HTMLElement>(html`<div><input /><tec-button>Go</tec-button></div>`)
    const button = el.querySelector("tec-button")!
    await userEvent.click(button)
    expect(button.matches(":state(focus-visible)")).toBe(false)
    el.querySelector("input")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(button.matches(":state(focus-visible)")).toBe(true)
    expect(getComputedStyle(inner(button)).boxShadow).not.toBe("none")
  })

  it("disabled: not focusable, no clicks", async () => {
    const onClick = vi.fn()
    const el = await fixture<HTMLElement>(html`<div><input /><tec-button disabled @click=${onClick}>Go</tec-button><input id="after" /></div>`)
    const button = el.querySelector("tec-button")!
    expect((inner(button) as HTMLButtonElement).disabled).toBe(true)
    button.click()
    expect(onClick).not.toHaveBeenCalled()
    el.querySelector("input")!.focus()
    await userEvent.keyboard("{Tab}")
    expect(document.activeElement?.id).toBe("after")
    expect(getComputedStyle(button).opacity).toBe("0.5")
  })

  it("is disabled by a disabled fieldset", async () => {
    const el = await fixture<HTMLFieldSetElement>(html`<fieldset disabled><tec-button>Go</tec-button></fieldset>`)
    const button = el.querySelector("tec-button")!
    await button.updateComplete
    expect(button.matches(":disabled")).toBe(true)
    expect((inner(button) as HTMLButtonElement).disabled).toBe(true)
  })

  it("type=submit submits its form with name/value as submitter; type=reset resets", async () => {
    const onSubmit = vi.fn((e: SubmitEvent) => {
      e.preventDefault()
      return new FormData(e.target as HTMLFormElement, e.submitter).get("intent")
    })
    const form = await fixture<HTMLFormElement>(html`<form @submit=${onSubmit}>
      <input name="q" value="initial" />
      <tec-button type="submit" name="intent" value="save">Save</tec-button>
      <tec-button type="reset">Reset</tec-button>
      <tec-button>Plain</tec-button>
    </form>`)
    const [submit, reset, plain] = [...form.querySelectorAll("tec-button")]
    await userEvent.click(plain!)
    await aTimeout(10)
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(submit!)
    await aTimeout(10)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.results[0]!.value).toBe("save")
    const input = form.querySelector("input")!
    input.value = "changed"
    await userEvent.click(reset!)
    await aTimeout(10)
    expect(input.value).toBe("initial")
  })

  it("a submit click can be vetoed with preventDefault", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    const form = await fixture<HTMLFormElement>(html`<form @submit=${onSubmit}>
      <tec-button type="submit" @click=${(e: Event) => e.preventDefault()}>Save</tec-button>
    </form>`)
    await userEvent.click(form.querySelector("tec-button")!)
    await aTimeout(10)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("renders a link with href", async () => {
    const el = await fixture<TecButton>(html`<tec-button href="#top" variant="link">Top</tec-button>`)
    expect(inner(el).localName).toBe("a")
    expect(await axNode(inner(el))).toMatchObject({ role: "link", name: "Top" })
    el.target = "_blank"
    await el.updateComplete
    expect(inner(el).getAttribute("rel")).toBe("noreferrer noopener")
    el.disabled = true
    await el.updateComplete
    expect(inner(el).hasAttribute("href")).toBe(false)
    expect(await axNode(inner(el))).toMatchObject({ role: "link", disabled: "true" })
    await expectAccessible(el)
  })

  it("click() activates the inner control", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    const form = await fixture<HTMLFormElement>(html`<form @submit=${onSubmit}><tec-button type="submit">Save</tec-button></form>`)
    form.querySelector("tec-button")!.click()
    await aTimeout(10)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("variant/size attributes are accessible in every variant", async () => {
    const el = await fixture<HTMLElement>(html`<div>
      ${["default", "outline", "secondary", "ghost", "destructive", "link"].map((v) => html`<tec-button variant=${v}>${v}</tec-button>`)}
    </div>`)
    await expectAccessible(el)
  })
})

describe("tec-button under a document reset", () => {
  it("keeps its border and padding when the page resets * { border: 0; padding: 0 } (Tailwind preflight)", async () => {
    const el = await fixture<TecButton>(html`<tec-button variant="outline">Outline</tec-button>`)
    const base = getComputedStyle(inner(el))
    expect(base.borderTopWidth).toBe("1px")
    expect(base.paddingInlineStart).toBe("8px")
  })

  it("layout utilities on the host resize the button", async () => {
    const el = await fixture<TecButton>(html`<tec-button style="height: 40px; width: 200px">Wide</tec-button>`)
    expect(inner(el).getBoundingClientRect().height).toBe(40)
    expect(inner(el).getBoundingClientRect().width).toBe(200)
  })
})
