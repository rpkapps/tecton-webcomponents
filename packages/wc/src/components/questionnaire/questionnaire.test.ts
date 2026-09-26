import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { aTimeout, axNode, deepActiveElement, expectAccessible, fixture, oneEvent, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecQuestionnaire } from "./questionnaire.js"
import type { TecQuestionnaireChoice } from "./questionnaire-choice.js"
import type { TecQuestionnaireItem } from "./questionnaire-item.js"
import "./define.js"

const demo = (opts: { shortcuts?: string } = {}) => html`<tec-questionnaire shortcuts=${opts.shortcuts ?? ""} style="width: 380px">
  <tec-questionnaire-progress></tec-questionnaire-progress>
  <tec-questionnaire-item name="direction" required>
    <tec-questionnaire-title>What should the agent build next?</tec-questionnaire-title>
    <tec-questionnaire-description>Choose a direction or describe another task.</tec-questionnaire-description>
    <tec-questionnaire-choices>
      <tec-questionnaire-choice value="tool-calls">Tool call timeline</tec-questionnaire-choice>
      <tec-questionnaire-choice value="approvals">Approval checkpoints</tec-questionnaire-choice>
      <tec-questionnaire-choice value="handoffs">Sub-agent handoffs</tec-questionnaire-choice>
      <tec-questionnaire-input aria-label="Another agent feature" placeholder="Describe another feature…"></tec-questionnaire-input>
    </tec-questionnaire-choices>
    <tec-questionnaire-error></tec-questionnaire-error>
  </tec-questionnaire-item>
  <tec-questionnaire-item name="signals" multiple>
    <tec-questionnaire-title>What should every progress update include?</tec-questionnaire-title>
    <tec-questionnaire-choices>
      <tec-questionnaire-choice value="progress">Progress</tec-questionnaire-choice>
      <tec-questionnaire-choice value="decisions">Decisions</tec-questionnaire-choice>
      <tec-questionnaire-choice value="risks">Risks</tec-questionnaire-choice>
    </tec-questionnaire-choices>
    <tec-questionnaire-error></tec-questionnaire-error>
  </tec-questionnaire-item>
  <tec-questionnaire-item name="timing" required>
    <tec-questionnaire-title>When should work begin?</tec-questionnaire-title>
    <tec-questionnaire-choices>
      <tec-questionnaire-choice value="now">Start now</tec-questionnaire-choice>
      <tec-questionnaire-choice value="later">Later</tec-questionnaire-choice>
    </tec-questionnaire-choices>
    <tec-questionnaire-error></tec-questionnaire-error>
  </tec-questionnaire-item>
  <tec-questionnaire-actions>
    <tec-questionnaire-previous></tec-questionnaire-previous>
    <tec-questionnaire-skip></tec-questionnaire-skip>
    <tec-questionnaire-next></tec-questionnaire-next>
    <tec-questionnaire-submit>Save plan</tec-questionnaire-submit>
  </tec-questionnaire-actions>
</tec-questionnaire>`

const q = (el: TecQuestionnaire, sel: string) => el.querySelector(sel) as HTMLElement & { updateComplete: Promise<unknown> }
const item = (el: TecQuestionnaire, name: string) => el.querySelector(`tec-questionnaire-item[name="${name}"]`) as TecQuestionnaireItem
const choice = (el: TecQuestionnaire, value: string) => el.querySelector(`tec-questionnaire-choice[value="${value}"]`) as TecQuestionnaireChoice
const isShown = (el: Element) => getComputedStyle(el).display !== "none"
const settle = async (el: TecQuestionnaire) => {
  await aTimeout(10)
  await el.updateComplete
  for (const e of el.querySelectorAll("*")) await (e as Partial<{ updateComplete: Promise<unknown> }>).updateComplete
}

describe("tec-questionnaire", () => {
  it("shows one question at a time with progress and the applicable actions", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    await settle(el)
    expect(isShown(item(el, "direction"))).toBe(true)
    expect(isShown(item(el, "signals"))).toBe(false)
    const progress = q(el, "tec-questionnaire-progress")
    expect(progress.shadowRoot!.textContent!.trim()).toBe("Question 1 of 3")
    expect(await axNode(progress)).toMatchObject({ role: "progressbar", name: "Questionnaire progress", valuetext: "Question 1 of 3" })
    expect(isShown(q(el, "tec-questionnaire-previous"))).toBe(false)
    expect(isShown(q(el, "tec-questionnaire-skip"))).toBe(false)
    expect(isShown(q(el, "tec-questionnaire-next"))).toBe(true)
    expect(isShown(q(el, "tec-questionnaire-submit"))).toBe(false)
    expect(await axNode(item(el, "direction"))).toMatchObject({
      role: "group",
      name: "What should the agent build next?",
      description: "Choose a direction or describe another task.",
    })
    const radio = choice(el, "approvals").input
    expect(await axNode(radio)).toMatchObject({ role: "radio", name: "Approval checkpoints", checked: "false" })
    await expectAccessible(el)
  })

  it("validates before moving on and shows the error as an alert describing the item", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    await settle(el)
    const events = recordEvents<CustomEvent>(el, "tec-item-change")
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    expect(events.events.length).toBe(0)
    const error = item(el, "direction").querySelector("tec-questionnaire-error")!
    expect(isShown(error)).toBe(true)
    expect(error.shadowRoot!.textContent).toContain("Choose an answer to continue.")
    expect(await axNode(error)).toMatchObject({ role: "alert" })
    expect(await axNode(item(el, "direction"))).toMatchObject({ invalid: "true" })
    expect((await axNode(item(el, "direction"))).description).toContain("Choose an answer to continue.")
    // Focus goes to the first answer.
    expect(deepActiveElement()).toBe(choice(el, "tool-calls").input)

    await userEvent.click(choice(el, "approvals"))
    await settle(el)
    expect(isShown(error)).toBe(false)
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    expect(events.events.map((e) => e.detail.item)).toEqual(["signals"])
    expect(el.item).toBe("signals")
    expect(deepActiveElement()).toBe(item(el, "signals"))
    expect(isShown(q(el, "tec-questionnaire-skip"))).toBe(true)
    expect(isShown(q(el, "tec-questionnaire-previous"))).toBe(true)
  })

  it("single choice: selecting one clears the others and typing replaces the choice", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    await settle(el)
    await userEvent.click(choice(el, "tool-calls"))
    await userEvent.click(choice(el, "handoffs"))
    await settle(el)
    expect(choice(el, "tool-calls").checked).toBe(false)
    expect(choice(el, "handoffs").checked).toBe(true)
    const input = el.querySelector("tec-questionnaire-input")!
    await userEvent.click(input)
    await userEvent.keyboard("Custom")
    await settle(el)
    expect(choice(el, "handoffs").checked).toBe(false)
    expect(el.formData.getAll("direction")).toEqual(["Custom"])
    await userEvent.click(choice(el, "approvals"))
    await settle(el)
    expect(el.formData.getAll("direction")).toEqual(["approvals"])
  })

  it("optional items need an answer or an explicit skip; skipping submits nothing for them", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    await settle(el)
    await userEvent.click(choice(el, "approvals"))
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    expect(el.item).toBe("signals")
    expect(item(el, "signals").querySelector("tec-questionnaire-error")!.shadowRoot!.textContent).toContain("Choose an answer or skip this question.")
    const statuses = recordEvents<CustomEvent>(item(el, "signals"), "tec-status-change")
    await userEvent.click(q(el, "tec-questionnaire-skip"))
    await settle(el)
    expect(statuses.events.map((e) => e.detail.status)).toEqual(["skipped"])
    expect(el.item).toBe("timing")
    expect(isShown(q(el, "tec-questionnaire-submit"))).toBe(true)
    expect(isShown(q(el, "tec-questionnaire-next"))).toBe(false)
    await userEvent.click(choice(el, "now"))
    const submit = oneEvent<CustomEvent<{ formData: FormData }>>(el, "tec-submit")
    await userEvent.click(q(el, "tec-questionnaire-submit"))
    const data = (await submit).detail.formData
    expect([...data.entries()]).toEqual([
      ["direction", "approvals"],
      ["timing", "now"],
    ])
  })

  it("multiple: checkboxes, all selected values submitted", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    el.item = "signals"
    await settle(el)
    await userEvent.click(choice(el, "progress"))
    await userEvent.click(choice(el, "risks"))
    await settle(el)
    expect(await axNode(choice(el, "risks").input)).toMatchObject({ role: "checkbox", checked: "true" })
    expect(el.formData.getAll("signals")).toEqual(["progress", "risks"])
  })

  it("keyboard: arrows move and select, shortcuts pick answers, Enter continues, Left goes back", async () => {
    const el = await fixture<TecQuestionnaire>(demo({ shortcuts: "letters" }))
    await settle(el)
    const b = choice(el, "approvals")
    expect(b.shadowRoot!.querySelector(".shortcut")!.textContent).toBe("B")
    expect(b.input.getAttribute("aria-keyshortcuts")).toBe("B")
    item(el, "direction").focus()
    await userEvent.keyboard("c")
    await settle(el)
    expect(choice(el, "handoffs").checked).toBe(true)
    expect(deepActiveElement()).toBe(choice(el, "handoffs").input)
    await userEvent.keyboard("{ArrowUp}")
    await settle(el)
    expect(choice(el, "approvals").checked).toBe(true)
    expect(choice(el, "handoffs").checked).toBe(false)
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    await settle(el)
    // Moves onto the freeform input (not typing into it): the letter keys type there now.
    const input = el.querySelector("tec-questionnaire-input")!
    expect(deepActiveElement()).toBe(input.input)
    await userEvent.keyboard("a")
    await settle(el)
    expect(input.value).toBe("a")
    expect(choice(el, "tool-calls").checked).toBe(false)
    await userEvent.keyboard("{Enter}")
    await settle(el)
    expect(el.item).toBe("signals")
    await userEvent.keyboard("{ArrowLeft}")
    await settle(el)
    expect(el.item).toBe("direction")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await settle(el)
    expect(el.item).toBe("signals")
  })

  it("submit validates every item and returns to the first invalid one", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    el.item = "timing"
    await settle(el)
    await userEvent.click(choice(el, "now"))
    const submits = recordEvents(el, "tec-submit")
    await userEvent.click(q(el, "tec-questionnaire-submit"))
    await settle(el)
    expect(submits.events.length).toBe(0)
    expect(el.item).toBe("direction")
    expect(item(el, "direction").matches(":state(invalid)")).toBe(true)
  })

  it("disabled items are left out (conditional questions)", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    item(el, "signals").disabled = true
    await settle(el)
    expect(q(el, "tec-questionnaire-progress").shadowRoot!.textContent!.trim()).toBe("Question 1 of 2")
    await userEvent.click(choice(el, "approvals"))
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    expect(el.item).toBe("timing")
  })

  it("tec-item-change can be vetoed", async () => {
    const el = await fixture<TecQuestionnaire>(demo())
    await settle(el)
    el.addEventListener("tec-item-change", (e) => e.preventDefault())
    await userEvent.click(choice(el, "approvals"))
    await userEvent.click(q(el, "tec-questionnaire-next"))
    await settle(el)
    expect(el.item).toBe("direction")
  })

  it("resets to the saved answers and the initial item, inside a form", async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <tec-questionnaire item="b">
        <tec-questionnaire-item name="a" required>
          <tec-questionnaire-title>A?</tec-questionnaire-title>
          <tec-questionnaire-choices>
            <tec-questionnaire-choice value="1" checked>One</tec-questionnaire-choice>
            <tec-questionnaire-choice value="2">Two</tec-questionnaire-choice>
          </tec-questionnaire-choices>
        </tec-questionnaire-item>
        <tec-questionnaire-item name="b">
          <tec-questionnaire-title>B?</tec-questionnaire-title>
          <tec-questionnaire-input aria-label="Note" value="Keep the API"></tec-questionnaire-input>
        </tec-questionnaire-item>
        <tec-questionnaire-actions>
          <tec-questionnaire-previous></tec-questionnaire-previous>
          <tec-questionnaire-submit></tec-questionnaire-submit>
        </tec-questionnaire-actions>
      </tec-questionnaire>
    </form>`)
    const el = form.querySelector("tec-questionnaire")!
    await settle(el)
    expect(el.item).toBe("b")
    expect([...new FormData(form).entries()]).toEqual([
      ["a", "1"],
      ["b", "Keep the API"],
    ])
    await userEvent.click(q(el, "tec-questionnaire-previous"))
    await userEvent.click(choice(el, "2"))
    await settle(el)
    expect(new FormData(form).get("a")).toBe("2")
    form.reset()
    await settle(el)
    expect(new FormData(form).get("a")).toBe("1")
    expect(el.item).toBe("b")
    let submitted = 0
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      submitted++
    })
    await userEvent.click(q(el, "tec-questionnaire-submit"))
    await settle(el)
    expect(submitted).toBe(1)
  })

  it("custom progress format and segments", async () => {
    const el = await fixture<TecQuestionnaire>(html`<tec-questionnaire>
      <tec-questionnaire-progress segments format="Checkpoint {current} of {total}"></tec-questionnaire-progress>
      <tec-questionnaire-item name="a"><tec-questionnaire-title>A</tec-questionnaire-title><tec-questionnaire-choices><tec-questionnaire-choice value="x">X</tec-questionnaire-choice></tec-questionnaire-choices></tec-questionnaire-item>
      <tec-questionnaire-item name="b"><tec-questionnaire-title>B</tec-questionnaire-title><tec-questionnaire-choices><tec-questionnaire-choice value="y">Y</tec-questionnaire-choice></tec-questionnaire-choices></tec-questionnaire-item>
    </tec-questionnaire>`)
    await settle(el)
    const progress = q(el, "tec-questionnaire-progress")
    await waitUntil(() => progress.shadowRoot!.querySelectorAll(".segment").length === 2)
    expect(progress.shadowRoot!.querySelectorAll(".segment.done").length).toBe(1)
    expect(progress.shadowRoot!.querySelector(".text")!.textContent).toBe("Checkpoint 1 of 2")
  })
})
