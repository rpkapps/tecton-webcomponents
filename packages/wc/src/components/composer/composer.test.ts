import { html } from "lit"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { animationsFinished, axNode, axTree, deepActiveElement, expectAccessible, fixture, recordEvents, waitUntil } from "../../internal/test-utils.js"
import type { TecComposer } from "./composer.js"
import type { TecComposerAttachment } from "./composer-attachments.js"
import type { TecComposerCommand, TecComposerCommands } from "./composer-commands.js"
import type { TecComposerInput } from "./composer-input.js"
import type { TecComposerStatusMessage } from "./composer-status-message.js"
import type { TecComposerSubmit } from "./composer-submit.js"
import type { TecComposerSuggestion } from "./composer-suggestions.js"
import "./define.js"

const basic = (o: { mode?: string; status?: string; history?: string[]; value?: string } = {}) => html`<tec-composer
  submit-mode=${o.mode ?? "enter"}
  status=${o.status ?? "ready"}
  value=${o.value ?? ""}
  .history=${o.history ?? []}
>
  <tec-composer-field>
    <tec-composer-input placeholder="Ask…"></tec-composer-input>
    <tec-composer-toolbar>
      <tec-button variant="ghost" size="icon-sm" aria-label="Attach">+</tec-button>
      <tec-composer-submit></tec-composer-submit>
    </tec-composer-toolbar>
  </tec-composer-field>
  <tec-composer-hint></tec-composer-hint>
  <tec-composer-status-message></tec-composer-status-message>
</tec-composer>`

const parts = (el: TecComposer) => {
  const input = el.querySelector<TecComposerInput>("tec-composer-input")!
  const submit = el.querySelector<TecComposerSubmit>("tec-composer-submit")!
  return {
    input,
    textarea: () => input.shadowRoot!.querySelector("textarea")!,
    submit,
    button: () => submit.shadowRoot!.querySelector("button")!,
    status: () => el.querySelector<TecComposerStatusMessage>("tec-composer-status-message")!.shadowRoot!.querySelector("[role=status]")!.textContent!.trim(),
  }
}

const settle = async (el: TecComposer) => {
  await el.updateComplete
  for (const part of el.querySelectorAll("*")) await (part as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete
  await el.updateComplete
}

describe("tec-composer", () => {
  it("names and describes the textarea, and Send is aria-disabled while empty", async () => {
    const el = await fixture<TecComposer>(basic())
    await settle(el)
    const { textarea, button } = parts(el)
    expect(await axNode(textarea())).toMatchObject({
      role: "textbox",
      name: "Message",
      description: "Enter to send, Shift + Enter for a new line",
      multiline: "true",
    })
    expect(await axNode(button())).toMatchObject({ role: "button", name: "Send message", disabled: "true" })
    expect(await axNode(el.querySelector("tec-composer-toolbar")!)).toMatchObject({ role: "toolbar", name: "Message actions" })
    await expectAccessible(el)
  })

  it("Enter sends the trimmed text, clears the box and keeps focus; Shift+Enter is a new line", async () => {
    const el = await fixture<TecComposer>(basic())
    await settle(el)
    const { textarea, input } = parts(el)
    const submits = recordEvents<CustomEvent>(el, "tec-submit")
    const inputs = recordEvents(el, "input")
    input.focus()
    await userEvent.keyboard("  Hello{Shift>}{Enter}{/Shift}there ")
    expect(el.value).toBe("  Hello\nthere ")
    expect(el.matches(":state(can-submit)")).toBe(true)
    await userEvent.keyboard("{Enter}")
    expect(submits.events.map((e) => e.detail.text)).toEqual(["Hello\nthere"])
    await settle(el)
    expect(el.value).toBe("")
    expect(textarea().value).toBe("")
    expect(deepActiveElement()).toBe(textarea())
    expect(inputs.events.length).toBeGreaterThan(5) // typed characters, then the clear
    // Nothing to send: Enter does nothing.
    await userEvent.keyboard("{Enter}")
    expect(submits.events).toHaveLength(1)
  })

  it("a cancelled tec-submit keeps the text", async () => {
    const el = await fixture<TecComposer>(basic({ value: "Draft" }))
    el.addEventListener("tec-submit", (e) => e.preventDefault())
    el.submit()
    await settle(el)
    expect(el.value).toBe("Draft")
  })

  it("mod-enter mode: Enter is a new line, Ctrl+Enter sends; the hint says so", async () => {
    const el = await fixture<TecComposer>(basic({ mode: "mod-enter" }))
    await settle(el)
    const { input, textarea } = parts(el)
    const submits = recordEvents<CustomEvent>(el, "tec-submit")
    input.focus()
    await userEvent.keyboard("a{Enter}b")
    expect(el.value).toBe("a\nb")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    expect(submits.events.map((e) => e.detail.text)).toEqual(["a\nb"])
    expect((await axNode(textarea())).description).toMatch(/^(Ctrl|⌘) \+ Enter to send, Enter for a new line$/)
  })

  it("ignores Enter while an IME composes", async () => {
    const el = await fixture<TecComposer>(basic({ value: "にほ" }))
    await settle(el)
    const submits = recordEvents(el, "tec-submit")
    const event = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, composed: true, cancelable: true })
    parts(el).textarea().dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(submits.events).toHaveLength(0)
  })

  it("swaps Send for Stop while busy, moves focus with it, and Escape stops with an announcement", async () => {
    const el = await fixture<TecComposer>(basic({ value: "Go" }))
    await settle(el)
    const { button, input } = parts(el)
    const stops = recordEvents(el, "tec-stop")
    button().focus()
    el.status = "submitted"
    await settle(el)
    expect(button().dataset.action).toBe("stop")
    expect(deepActiveElement()).toBe(button())
    expect(await axNode(button())).toMatchObject({ role: "button", name: "Stop generating" })
    expect(button().querySelector(".spinner")).not.toBeNull()
    expect(parts(el).status()).toBe("Message sent.")
    el.status = "streaming"
    await settle(el)
    expect(button().querySelector(".square")).not.toBeNull()
    // The textarea stays enabled; Enter does not send while busy.
    input.focus()
    const submits = recordEvents(el, "tec-submit")
    await userEvent.keyboard("{Enter}")
    expect(submits.events).toHaveLength(0)
    await userEvent.keyboard("{Escape}")
    expect(stops.events).toHaveLength(1)
    await settle(el)
    expect(parts(el).status()).toBe("Stopped.")
    // Stop pressed with the pointer; the app sets the status back, focus returns to the textarea.
    button().focus()
    await userEvent.click(button())
    expect(stops.events).toHaveLength(2)
    el.status = "ready"
    await settle(el)
    expect(button().dataset.action).toBe("send")
    expect(deepActiveElement()).toBe(parts(el).textarea())
    el.status = "error"
    await settle(el)
    expect(parts(el).status()).toBe("The reply failed.")
  })

  it("unstoppable: no Stop button while busy", async () => {
    const el = await fixture<TecComposer>(basic({ status: "streaming" }))
    el.unstoppable = true
    await settle(el)
    expect(parts(el).button().dataset.action).toBe("send")
    expect(parts(el).button().getAttribute("aria-disabled")).toBe("true")
  })

  it("steps through history with ArrowUp/ArrowDown and restores the draft", async () => {
    const el = await fixture<TecComposer>(basic({ history: ["first", "second", "second", ""] }))
    await settle(el)
    const { input, textarea } = parts(el)
    input.focus()
    await userEvent.keyboard("draft")
    await userEvent.keyboard("{ArrowUp}")
    expect(el.value).toBe("second")
    await settle(el)
    expect(textarea().selectionStart).toBe("second".length)
    await userEvent.keyboard("{ArrowUp}")
    expect(el.value).toBe("first")
    await userEvent.keyboard("{ArrowUp}")
    expect(el.value).toBe("first")
    await userEvent.keyboard("{ArrowDown}")
    expect(el.value).toBe("second")
    await userEvent.keyboard("{ArrowDown}")
    expect(el.value).toBe("draft")
    await settle(el)
    expect((await axNode(textarea())).description).toBe("Enter to send, Shift + Enter for a new line, ↑ for earlier messages")
  })

  it("ArrowUp moves the caret inside a multi-line message", async () => {
    const el = await fixture<TecComposer>(basic({ history: ["old"] }))
    await settle(el)
    parts(el).input.focus()
    await userEvent.keyboard("one{Shift>}{Enter}{/Shift}two{ArrowUp}")
    expect(el.value).toBe("one\ntwo")
  })
})

describe("tec-composer-suggestions", () => {
  it("fill the box, send at once, or hand the press to the app", async () => {
    const el = await fixture<TecComposer>(html`<tec-composer>
      <tec-composer-suggestions>
        <tec-composer-suggestion value="Explain this"></tec-composer-suggestion>
        <tec-composer-suggestion value="Draft the note" submit>Draft</tec-composer-suggestion>
        <tec-composer-suggestion value="Custom"></tec-composer-suggestion>
      </tec-composer-suggestions>
      <tec-composer-field><tec-composer-input></tec-composer-input></tec-composer-field>
    </tec-composer>`)
    await settle(el)
    const [fill, send, custom] = [...el.querySelectorAll<TecComposerSuggestion>("tec-composer-suggestion")]
    const submits = recordEvents<CustomEvent>(el, "tec-submit")
    expect(await axTree(el.querySelector("tec-composer-suggestions")!)).toEqual([
      "toolbar: Suggestions",
      "button: Explain this",
      "button: Draft",
      "button: Custom",
    ])
    expect([fill, send, custom].map((s) => s!.tabIndex)).toEqual([0, -1, -1])
    await userEvent.click(fill!)
    expect(el.value).toBe("Explain this")
    expect(deepActiveElement()).toBe(el.querySelector("tec-composer-input")!.shadowRoot!.querySelector("textarea"))
    await userEvent.click(send!)
    expect(submits.events.map((e) => e.detail.text)).toEqual(["Draft the note"])
    expect(el.value).toBe("Explain this")
    custom!.addEventListener("tec-select", (e) => e.preventDefault())
    await userEvent.click(custom!)
    expect(el.value).toBe("Explain this")
    // Arrow keys move between them.
    fill!.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()?.getRootNode()).toBe(send!.shadowRoot!.querySelector("tec-button")!.shadowRoot)
    el.status = "streaming"
    await settle(el)
    expect(send!.isDisabled).toBe(true)
    await expectAccessible(el)
  })
})

describe("tec-composer-attachments", () => {
  it("removes chips with Delete/Backspace or the button, moving focus on, then to the textarea", async () => {
    const el = await fixture<TecComposer>(html`<tec-composer>
      <tec-composer-field>
        <tec-composer-attachments>
          <tec-composer-attachment id="a" description="“Flaring at A-7”">Selected text</tec-composer-attachment>
          <tec-composer-attachment id="b">Report.pdf</tec-composer-attachment>
          <tec-composer-attachment id="c">Well 34/10</tec-composer-attachment>
        </tec-composer-attachments>
        <tec-composer-input></tec-composer-input>
      </tec-composer-field>
    </tec-composer>`)
    await settle(el)
    const list = el.querySelector("tec-composer-attachments")!
    expect(await axTree(list)).toEqual([
      "grid: Attachments",
      "row: Selected text “Flaring at A-7”",
      "gridcell: Selected text “Flaring at A-7” Remove Selected text",
      "button: Remove Selected text",
      "row: Report.pdf",
      "gridcell: Report.pdf Remove Report.pdf",
      "button: Remove Report.pdf",
      "row: Well 34/10",
      "gridcell: Well 34/10 Remove Well 34/10",
      "button: Remove Well 34/10",
    ])
    await expectAccessible(el)
    const removed = recordEvents(list, "tec-remove")
    const a = el.querySelector<TecComposerAttachment>("#a")!
    a.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(deepActiveElement()).toBe(el.querySelector("#b"))
    await userEvent.keyboard("{Delete}")
    expect(el.querySelector("#b")).toBeNull()
    expect(deepActiveElement()).toBe(el.querySelector("#c"))
    await userEvent.keyboard("{Backspace}")
    expect(deepActiveElement()).toBe(a)
    await userEvent.click(a.shadowRoot!.querySelector("button")!)
    expect(removed.events).toHaveLength(3)
    expect(deepActiveElement()).toBe(el.querySelector("tec-composer-input")!.shadowRoot!.querySelector("textarea"))
    await list.updateComplete
    expect(list.matches(":state(empty)")).toBe(true)
  })
})

describe("tec-composer-commands", () => {
  const commandsFixture = () => html`<tec-composer>
    <tec-composer-field>
      <tec-composer-commands>
        <tec-composer-command command="new" group="Chat">Start a new conversation</tec-composer-command>
        <tec-composer-command command="acknowledge" group="On this page">Acknowledge alert A-7</tec-composer-command>
        <tec-composer-command command="note" group="On this page" description="34/10-A-12">Add a note to well</tec-composer-command>
      </tec-composer-commands>
      <tec-composer-input></tec-composer-input>
    </tec-composer-field>
    <tec-composer-hint></tec-composer-hint>
  </tec-composer>`

  it("opens on a leading slash, filters and groups, and the textarea points at the active option", async () => {
    const el = await fixture<TecComposer>(commandsFixture())
    await settle(el)
    const list = el.querySelector<TecComposerCommands>("tec-composer-commands")!
    const textarea = el.querySelector("tec-composer-input")!.shadowRoot!.querySelector("textarea")!
    const commands = [...el.querySelectorAll<TecComposerCommand>("tec-composer-command")]
    expect(list.open).toBe(false)
    expect(await axNode(textarea)).toMatchObject({ autocomplete: "list", description: "Enter to send, Shift + Enter for a new line, / for commands" })
    textarea.focus()
    await userEvent.keyboard("/")
    await settle(el)
    await waitUntil(() => list.shadowRoot!.querySelector(".content")!.matches(":popover-open"))
    await animationsFinished(list.shadowRoot!.querySelector(".content")!)
    expect(list.open).toBe(true)
    expect(await axTree(list)).toEqual([
      "listbox: Commands",
      "group: Chat",
      "option: /new Start a new conversation [selected]",
      "group: On this page",
      "option: /acknowledge Acknowledge alert A-7",
      "option: /note Add a note to well 34/10-A-12",
    ])
    expect(textarea.ariaActiveDescendantElement).toBe(commands[0])
    expect(textarea.ariaControlsElements).toEqual([list])
    expect(el.shadowRoot!.querySelector("[role=status]")!.textContent).toBe("3 commands, arrow keys to choose.")
    await expectAccessible(el)

    await userEvent.keyboard("{ArrowDown}")
    expect(textarea.ariaActiveDescendantElement).toBe(commands[1])
    await userEvent.keyboard("{ArrowUp}{ArrowUp}")
    expect(textarea.ariaActiveDescendantElement).toBe(commands[2])

    // "n": /new and /note start with it, /acknowledge contains it; groups keep their best match's rank.
    await userEvent.keyboard("n")
    await settle(el)
    const shown = () => [...list.shadowRoot!.querySelectorAll("slot")].flatMap((s) => s.assignedElements().map((e) => (e as TecComposerCommand).command))
    expect(shown()).toEqual(["new", "note", "acknowledge"])
    await userEvent.keyboard("ot")
    await settle(el)
    expect(shown()).toEqual(["note"])
    expect(textarea.ariaActiveDescendantElement).toBe(commands[2])
    await userEvent.keyboard("x")
    await settle(el)
    expect(list.open).toBe(false)
    expect(textarea.ariaActiveDescendantElement).toBeNull()
    expect(el.shadowRoot!.querySelector("[role=status]")!.textContent).toBe("")
  })

  it("Enter or Tab picks (the box is emptied), Escape closes until the text changes", async () => {
    const el = await fixture<TecComposer>(commandsFixture())
    await settle(el)
    const list = el.querySelector<TecComposerCommands>("tec-composer-commands")!
    const textarea = el.querySelector("tec-composer-input")!.shadowRoot!.querySelector("textarea")!
    const picks = recordEvents<CustomEvent>(el, "tec-select")
    const submits = recordEvents(el, "tec-submit")
    textarea.focus()
    await userEvent.keyboard("/ack")
    await settle(el)
    await userEvent.keyboard("{Enter}")
    expect(picks.events.map((e) => [e.detail.value, (e.target as TecComposerCommand).command])).toEqual([["acknowledge", "acknowledge"]])
    expect(submits.events).toHaveLength(0)
    await settle(el)
    expect(el.value).toBe("")
    expect(list.open).toBe(false)
    await userEvent.keyboard("/")
    await settle(el)
    await userEvent.keyboard("{Tab}")
    expect(picks.events.map((e) => e.detail.value)).toEqual(["acknowledge", "new"])
    expect(deepActiveElement()).toBe(textarea)
    await userEvent.keyboard("/n")
    await settle(el)
    expect(list.open).toBe(true)
    await userEvent.keyboard("{Escape}")
    await settle(el)
    expect(list.open).toBe(false)
    await userEvent.keyboard("{Enter}")
    expect(submits.events).toHaveLength(1)
  })

  it("a press on an option picks it and keeps focus in the textarea", async () => {
    const el = await fixture<TecComposer>(commandsFixture())
    await settle(el)
    const textarea = el.querySelector("tec-composer-input")!.shadowRoot!.querySelector("textarea")!
    const picks = recordEvents<CustomEvent>(el, "tec-select")
    el.addEventListener("tec-select", (e) => el.setValue(`${(e.target as TecComposerCommand).labelText}: `))
    textarea.focus()
    await userEvent.keyboard("/")
    const list = el.querySelector<TecComposerCommands>("tec-composer-commands")!
    await settle(el)
    await animationsFinished(list.shadowRoot!.querySelector(".content")!)
    await userEvent.click(el.querySelectorAll("tec-composer-command")[2]!)
    expect(picks.events.map((e) => e.detail.value)).toEqual(["note"])
    expect(el.value).toBe("Add a note to well: ")
    expect(deepActiveElement()).toBe(textarea)
  })
})
