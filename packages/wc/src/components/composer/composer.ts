import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext, type ComposerContextValue, type ComposerStatus, type ComposerSubmitMode } from "./composer-context.js"
import { composerStyles } from "./composer.styles.js"

export type { ComposerStatus, ComposerSubmitMode } from "./composer-context.js"

/** `detail` of `tec-submit`. */
export interface ComposerSubmitDetail {
  /** The message, trimmed. */
  text: string
}

/** Where ArrowUp and ArrowDown have taken the box in `history`, and what it held before. */
interface HistoryPosition {
  /** The index of the entry in the box, among the entries the arrows reach. */
  index: number
  /** The box's text while browsing, as loaded or as typed since: any other text means it was changed from outside. */
  text: string
  /** What the box held when browsing began, restored past the newest entry. */
  draft: string
}

/** A part that registers with the composer (the textarea, the command list, hints). @internal */
export interface ComposerKeyHandler {
  handleComposerKey(event: KeyboardEvent): boolean
}

/**
 * The composer holds the text and the chat's `status` for its parts: `tec-composer-field` (the box)
 * with `tec-composer-input` (the textarea that grows with its text), `tec-composer-toolbar` and
 * `tec-composer-submit`; `tec-composer-hint`, `tec-composer-status-message`,
 * `tec-composer-attachments`, `tec-composer-suggestions` and `tec-composer-commands`.
 *
 * Keyboard: Enter sends, Shift+Enter is a new line, ⌘/Ctrl+Enter always sends (and is the only way to
 * send with `submit-mode="mod-enter"`); nothing sends while an IME is composing; Escape stops a reply
 * that is arriving. With `history`, ArrowUp on the first line of the box steps back through the prompts
 * sent before and ArrowDown on the last line forward, back to the draft the box held when browsing
 * began. The textarea stays enabled while a reply streams, and focus stays in it after sending.
 *
 * Listen to `tec-submit` to send the message (the box is cleared after the event unless it is
 * cancelled), set `status` as the reply arrives, and listen to `tec-stop` to stop it.
 *
 * @summary The message box of a chat: send and stop, keyboard first, with suggestions, commands and removable context.
 *
 * @tag tec-composer
 *
 * @slot - `tec-composer-suggestions`, `tec-composer-field`, `tec-composer-hint`, `tec-composer-status-message`.
 *
 * @fires tec-submit - The user sent a message (Enter, the send button, a suggestion with `submit`, or `submit()`). `detail: { text }`, trimmed. Cancelable: `preventDefault()` keeps the text in the box.
 * @fires tec-stop - The user stopped the reply that is arriving (Escape in the textarea or the stop button).
 * @fires input - The text changed: typed, recalled from `history`, filled by a suggestion or a command, or cleared by a send. Read `value`.
 *
 * @cssstate busy - `status` is `submitted` or `streaming`.
 * @cssstate can-submit - The box holds text that can be sent.
 */
export class TecComposer extends TectonElement {
  static styles = [hostStyles, srOnly, composerStyles]

  /** The text in the box. The attribute sets the initial text. */
  @property() value = ""

  /** The chat's state: nothing sends while `submitted` or `streaming`, and the send button turns into Stop. */
  @property({ reflect: true }) status: ComposerStatus = "ready"

  /** `enter`: Enter sends, Shift+Enter is a new line. `mod-enter`: ⌘/Ctrl+Enter sends, Enter is a new line (long-form input). */
  @property({ attribute: "submit-mode", reflect: true }) submitMode: ComposerSubmitMode = "enter"

  /** Disables the whole composer. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The reply cannot be stopped: no Stop button while busy, and Escape does nothing. */
  @property({ type: Boolean, reflect: true }) unstoppable = false

  /**
   * The prompts the user has sent, oldest first: ArrowUp on the first line of the box steps back
   * through them, ArrowDown on the last line forward. Never changed by the composer.
   */
  @property({ attribute: false }) history: readonly string[] = []

  /** How many of the newest entries of `history` ArrowUp reaches. Unset: all of them. */
  @property({ type: Number, attribute: "history-limit" }) historyLimit?: number

  @state() private stopCount = 0
  @state() private historyEntry?: string
  @state() private commandsMessage = ""
  @state() private hints: readonly HTMLElement[] = []
  @state() private commands: ComposerKeyHandler | null = null

  #provider = new ContextProvider(this, { context: composerContext, initialValue: undefined })
  #position: HistoryPosition | null = null
  #ownChange = false
  #input: HTMLElement | null = null

  /** `status` is `submitted` or `streaming`. */
  get busy(): boolean {
    return this.status === "submitted" || this.status === "streaming"
  }

  /** Whether `submit()` would send: not disabled, not busy, and the box holds text. */
  get canSubmit(): boolean {
    return !this.disabled && !this.busy && this.value.trim() !== ""
  }

  /** The part of `history` the arrows reach: its newest `historyLimit` entries. */
  get #recent(): readonly string[] {
    const entries = this.history ?? []
    if (this.historyLimit === undefined || this.historyLimit === null || Number.isNaN(this.historyLimit)) return entries
    // Floored first: `slice(-0)` would be the whole history.
    const limit = Math.floor(this.historyLimit)
    return limit > 0 ? entries.slice(-limit) : []
  }

  /** Sends the text in the box (as Enter does): fires `tec-submit`, then empties the box and keeps focus in it. */
  submit(): void {
    if (!this.canSubmit) return
    const text = this.value.trim()
    if (!this.emit<ComposerSubmitDetail>("tec-submit", { detail: { text }, cancelable: true })) return
    this.#setPosition(null)
    this.#commit("", true)
    this.focus()
  }

  /** Sends `text` as it is, leaving the box alone (a suggestion that sends). */
  send(text: string): void {
    if (this.disabled || this.busy || text.trim() === "") return
    this.#setPosition(null)
    this.emit<ComposerSubmitDetail>("tec-submit", { detail: { text: text.trim() }, cancelable: true })
    this.focus()
  }

  /** Stops the reply that is arriving (as Escape does): fires `tec-stop` and announces it. */
  stop(): void {
    if (!this.busy || this.unstoppable) return
    this.emit("tec-stop")
    this.stopCount += 1
  }

  /** Focuses the textarea. */
  override focus(options?: FocusOptions): void {
    this.#input?.focus(options)
  }

  /**
   * Replaces the text as the user would (a command filling the box): ends browsing `history` and
   * fires `input`. Setting `value` does the same without the event.
   */
  setValue(text: string): void {
    this.#setPosition(null)
    this.#commit(text, true)
  }

  // ------------------------------------------------------------------ parts (internal)

  /** @internal The textarea's host registers itself (focus target). */
  registerInput(input: HTMLElement): () => void {
    this.#input = input
    return () => {
      if (this.#input === input) this.#input = null
    }
  }

  /** @internal A hint registers itself; the textarea is described by every registered hint. */
  registerHint(hint: HTMLElement): () => void {
    this.hints = [...this.hints, hint]
    return () => {
      this.hints = this.hints.filter((h) => h !== hint)
    }
  }

  /** @internal The command list registers itself; it gets the textarea's keys first. */
  registerCommands(commands: ComposerKeyHandler): () => void {
    this.commands = commands
    return () => {
      if (this.commands === commands) this.commands = null
      this.commandsMessage = ""
    }
  }

  /** @internal What the polite status says about the command list. */
  setCommandsMessage(message: string): void {
    this.commandsMessage = message
  }

  /** @internal The native textarea of the composer's `tec-composer-input`. */
  get textarea(): HTMLTextAreaElement | null {
    return (this.#input as (HTMLElement & { textarea?: HTMLTextAreaElement }) | null)?.textarea ?? null
  }

  /** @internal The textarea's registered hints, in order. */
  get describedBy(): readonly HTMLElement[] {
    return this.hints
  }

  /** @internal The open command list's keys, asked before the textarea's own; true when it took the key. */
  handleCommandKey(event: KeyboardEvent): boolean {
    return this.commands?.handleComposerKey(event) ?? false
  }

  /** @internal The textarea's own change: typing in a loaded prompt keeps browsing, and the draft. */
  typeValue(text: string): void {
    if (this.#position !== null) this.#position = { ...this.#position, text }
    this.#commit(text, false)
  }

  /** @internal Whether ArrowUp has taken the box into `history`, so ArrowDown can step forward. */
  get browsingHistory(): boolean {
    return this.#position !== null
  }

  /** @internal Whether `history` has an entry to load. */
  get hasHistory(): boolean {
    return this.#recent.some((entry) => entry.trim() !== "")
  }

  /**
   * @internal Loads the next older or newer entry of `history` into the box, with `current` the box's
   * text; returns the text loaded, or undefined when there is none that way.
   */
  stepHistory(direction: "older" | "newer", current: string): string | undefined {
    const entries = this.#recent
    let position = this.#position
    // The box was changed from outside, or the history shrank: start over.
    if (position !== null && (current !== position.text || position.index >= entries.length)) {
      position = null
      this.#setPosition(null)
    }
    const shown = position === null ? undefined : entries[position.index]
    // Blank entries, and a run of the same prompt, are stepped over.
    const skip = (entry: string) => entry === shown || entry.trim() === ""

    if (direction === "older") {
      let index = (position?.index ?? entries.length) - 1
      while (index >= 0 && skip(entries[index]!)) index -= 1
      if (index < 0) return undefined
      const entry = entries[index]!
      this.#setPosition({ index, text: entry, draft: position?.draft ?? current })
      this.#commit(entry, true)
      return entry
    }

    if (position === null) return undefined
    let index = position.index + 1
    while (index < entries.length && skip(entries[index]!)) index += 1
    if (index >= entries.length) {
      this.#setPosition(null)
      this.#commit(position.draft, true)
      return position.draft
    }
    const entry = entries[index]!
    this.#setPosition({ ...position, index, text: entry })
    this.#commit(entry, true)
    return entry
  }

  #setPosition(position: HistoryPosition | null): void {
    this.#position = position
    this.historyEntry = position === null ? undefined : this.#recent[position.index]
  }

  /** Changes the value from inside the composer; `announce` fires `input` (typing fires its own). */
  #commit(text: string, announce: boolean): void {
    if (text === this.value) return
    this.#ownChange = true
    this.value = text
    if (announce) this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    // A change from outside (the app setting `value`) ends browsing: the new text is the draft.
    if (changed.has("value") && !this.#ownChange && this.#position !== null) this.#setPosition(null)
    this.#ownChange = false
    if (changed.has("history") && this.#position !== null && this.#position.index >= this.#recent.length) this.#setPosition(null)
    this.value ??= ""
    const busy = this.busy
    const value: ComposerContextValue = {
      composer: this,
      value: this.value,
      status: this.status,
      busy,
      disabled: this.disabled,
      canSubmit: this.canSubmit,
      canStop: busy && !this.unstoppable,
      submitMode: this.submitMode,
      hasHistory: this.hasHistory,
      historyEntry: this.historyEntry,
      stopCount: this.stopCount,
      hasCommands: this.commands !== null,
    }
    this.#provider.setValue(value, true)
    this.toggleState("busy", busy)
    this.toggleState("can-submit", this.canSubmit)
  }

  protected override render() {
    return html`<slot></slot><span class="sr-only" role="status">${this.commandsMessage}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer": TecComposer
  }
}
