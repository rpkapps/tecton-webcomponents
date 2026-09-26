import { ContextConsumer } from "@lit/context"
import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { setAriaElements } from "../../internal/aria.js"
import { uniqueId } from "../../internal/id.js"
import { ListNavigationController } from "../../internal/list-navigation.js"
import { PopupController, popupStyles } from "../../internal/popup.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ComposerKeyHandler } from "./composer.js"
import { composerContext } from "./composer-context.js"
import { composerCommandStyles, composerCommandsStyles } from "./composer.styles.js"

/** `detail` of a command's `tec-select`. */
export interface ComposerCommandSelectDetail {
  /** The command, as typed after the slash (`"new"`). */
  value: string
}

/** The typed `/word` at the start of the box, or undefined when there is none. */
function commandQuery(value: string): string | undefined {
  const match = /^\/(\S*)$/.exec(value)
  return match === null ? undefined : match[1]!.toLowerCase()
}

/**
 * The commands that match `query`, best first: the command starts with it, then a word of the label
 * does, then the command contains it. Ties keep the document order.
 */
function matchCommands(items: readonly TecComposerCommand[], query: string): TecComposerCommand[] {
  const rank = (item: TecComposerCommand): number => {
    const command = item.command.toLowerCase()
    if (command.startsWith(query)) return 0
    if (
      item.labelText
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .some((word) => word.startsWith(query))
    )
      return 1
    if (command.includes(query)) return 2
    return -1
  }
  return items
    .filter((item) => !item.disabled && item.command !== "")
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
}

/** The matches grouped: each group where its best match ranks, its commands in rank order. */
function groupCommands(matches: readonly TecComposerCommand[]): { name: string | undefined; items: TecComposerCommand[] }[] {
  const groups = new Map<string | undefined, TecComposerCommand[]>()
  for (const item of matches) {
    const name = item.group || undefined
    const group = groups.get(name)
    if (group === undefined) groups.set(name, [item])
    else group.push(item)
  }
  return [...groups].map(([name, items]) => ({ name, items }))
}

function defaultCountMessage(count: number): string {
  return `${count} ${count === 1 ? "command" : "commands"}, arrow keys to choose.`
}

/**
 * Lists its `tec-composer-command`s when the box starts with a `/`, above the field (in the top
 * layer, so no overflow clips it). Typing narrows the list, by the start of the command, then a word
 * of its label; the commands stay in their groups, each group where its best match ranks. The
 * textarea keeps focus and points at the active command with `aria-activedescendant`, as a
 * combobox does: ArrowUp and ArrowDown move, Enter or Tab picks, Escape closes the list until the text
 * changes. With no match the list stays closed and Enter sends as usual. Picking empties the box and
 * fires `tec-select` on the command; fill the box (`composer.setValue()`), send, or act. A polite status
 * says how many commands match.
 *
 * @summary Slash commands for the composer.
 *
 * @tag tec-composer-commands
 *
 * @slot - `tec-composer-command` elements.
 *
 * @csspart base - The list surface.
 * @csspart group - A group of commands.
 * @csspart group-label - A group's heading.
 *
 * @cssprop --tec-composer-commands-max-height - The list's maximum height (default 16rem).
 *
 * @cssstate open - The list is shown.
 */
export class TecComposerCommands extends TectonElement implements ComposerKeyHandler {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), composerCommandsStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: "manual" }

  /** The list's accessible name (an `aria-label` on the element wins). */
  @property() label = "Commands"

  /** What the polite status says while the list is open, for `count` matches (translate it here). */
  @property({ attribute: false }) countMessage: (count: number) => string = defaultCountMessage

  @state() private dismissed?: string

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #unregister?: () => void
  #registeredWith?: object
  #groups: { name: string | undefined; items: TecComposerCommand[] }[] = []
  #matches: TecComposerCommand[] = []
  #query: string | undefined
  #open = false
  #idPrefix = uniqueId("tec-composer-commands")
  #observer = new MutationObserver(() => this.requestUpdate())

  #nav = new ListNavigationController<TecComposerCommand>(this, {
    items: () => this.#matches,
    focusTarget: () => this.#composer.value?.composer.textarea,
    keyTarget: null,
    loop: true,
    homeEnd: false,
    pageSize: 0,
    scroll: false,
    onActiveChange: (item, previous) => {
      if (previous) previous.highlighted = false
      if (item) {
        item.highlighted = true
        this.#scrollIntoList(item)
      }
    },
  })

  #popup = new PopupController(this, {
    popup: () => this.renderRoot.querySelector<HTMLElement>(".content"),
    anchor: () => this.closest("tec-composer-field") ?? this.parentElement,
    haspopup: false,
    expanded: false,
    placement: () => ({ side: "top", align: "start", sideOffset: 8 }),
    matchWidth: true,
    dismiss: { escape: false, outsidePress: false, focusOut: false },
    focus: { initial: "none", restore: false },
    onRequestClose: () => {},
  })

  /** Whether the list is shown. */
  get open(): boolean {
    return this.#open
  }

  /** The commands, in document order. */
  get commands(): TecComposerCommand[] {
    return [...this.children].filter((el): el is TecComposerCommand => el.localName === "tec-composer-command")
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["command", "group", "description", "disabled", "slot"],
    })
    this.#register()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
    this.#unregister?.()
    this.#unregister = undefined
    this.#registeredWith = undefined
  }

  #register(): void {
    const composer = this.#composer.value?.composer
    if (!composer || composer === this.#registeredWith) return
    this.#unregister?.()
    this.#unregister = composer.registerCommands(this)
    this.#registeredWith = composer
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const context = this.#composer.value
    const value = context?.value ?? ""
    // Escape closes the list for the text it was pressed on; any other text opens it again.
    if (this.dismissed !== undefined && this.dismissed !== value) this.dismissed = undefined
    const query = commandQuery(value)
    this.#groups = groupCommands(query === undefined ? [] : matchCommands(this.commands, query))
    // In the order they are listed, which the arrow keys follow.
    this.#matches = this.#groups.flatMap((group) => group.items)
    const queryChanged = query !== this.#query
    this.#query = query
    this.#open =
      !!context &&
      !context.disabled &&
      query !== undefined &&
      this.#matches.length > 0 &&
      this.dismissed !== value &&
      // A prompt loaded from the history is browsed, not a command typed.
      context.historyEntry !== value
    this.internals.role = "listbox"
    this.internals.ariaLabel = this.label
    if (this.#open) this.toggleState("open", true)
    for (const item of this.commands) if (!this.#matches.includes(item)) item.highlighted = false
    if (!this.#open) this.#nav.clear()
    else if (queryChanged || !this.#nav.activeItem || !this.#matches.includes(this.#nav.activeItem)) this.#pendingFirst = true
  }

  #pendingFirst = false

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#register()
    // Manual slot assignment: each group's slot gets its matching commands, in rank order; the
    // commands that do not match are assigned nowhere, so they are not rendered.
    const slots = [...this.renderRoot.querySelectorAll<HTMLSlotElement>("slot")]
    this.#groups.forEach((group, index) => slots[index]?.assign(...group.items))
    for (const slot of slots.slice(this.#groups.length)) slot.assign()
    const composer = this.#composer.value?.composer
    composer?.setCommandsMessage(this.#open ? this.countMessage(this.#matches.length) : "")
    const textarea = composer?.textarea
    if (textarea) setAriaElements(textarea, "ariaControlsElements", this.#open ? [this] : null)
    if (this.#open) {
      if (this.#pendingFirst) {
        this.#pendingFirst = false
        this.#nav.first()
      } else if (this.#nav.activeItem) {
        // Re-point the textarea (it may have been re-rendered).
        this.#nav.setActive(this.#nav.activeItem, { scroll: false })
      }
      void this.#popup.show()
    } else if (this.#popup.isOpen || this.matches(":state(open)")) {
      void this.#popup.hide().then(() => {
        if (!this.#open) this.toggleState("open", false)
      })
    }
  }

  /** The active option is scrolled into the list's view, and only the list's. */
  #scrollIntoList(option: HTMLElement): void {
    const list = this.renderRoot.querySelector<HTMLElement>(".content")
    if (!list) return
    const top = option.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop + list.scrollTop
    const bottom = top + option.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }

  #pick(item: TecComposerCommand | null | undefined): void {
    const composer = this.#composer.value?.composer
    if (!item || !composer) return
    composer.setValue("")
    item.dispatchEvent(
      new CustomEvent<ComposerCommandSelectDetail>("tec-select", { detail: { value: item.command }, bubbles: true, composed: true })
    )
    composer.focus()
  }

  /** @internal The textarea's keys while the list is open. */
  handleComposerKey(event: KeyboardEvent): boolean {
    if (!this.#open) return false
    const mod = event.metaKey || event.ctrlKey || event.altKey
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        if (mod || event.shiftKey) return false
        event.preventDefault()
        if (event.key === "ArrowDown") this.#nav.next()
        else this.#nav.previous()
        return true
      case "Enter":
      case "Tab":
        if (mod || event.shiftKey) return false
        event.preventDefault()
        this.#pick(this.#nav.activeItem ?? this.#matches[0])
        return true
      case "Escape":
        // Handled here, so a sheet around the chat stays open.
        event.preventDefault()
        event.stopPropagation()
        this.dismissed = this.#composer.value?.value ?? ""
        return true
      default:
        return false
    }
  }

  #onClick = (event: MouseEvent) => {
    const item = event.composedPath().find((t): t is TecComposerCommand => t instanceof TecComposerCommand)
    if (item && this.#matches.includes(item)) this.#pick(item)
  }

  protected override render() {
    return html`<div
      class="content"
      part="base"
      role="none"
      popover="manual"
      @mousedown=${(event: MouseEvent) => event.preventDefault()}
      @click=${this.#onClick}
    >
      ${this.#groups.map((group, index) =>
        group.name === undefined
          ? html`<slot></slot>`
          : html`<div class="group" part="group" role="group" aria-labelledby=${`${this.#idPrefix}-${index}`}>
              <div class="group-label" part="group-label" id=${`${this.#idPrefix}-${index}`}>${group.name}</div>
              <slot></slot>
            </div>`
      )}
    </div>`
  }
}

/**
 * The label is its text; `command` is what is typed after the slash. An icon goes in `slot="start"`.
 * Picking it (Enter, Tab or a press) empties the box and fires `tec-select`.
 *
 * @summary One slash command.
 *
 * @tag tec-composer-command
 *
 * @slot - The label: what the command does, in words (its words are matched too).
 * @slot start - An icon.
 *
 * @csspart base - The row.
 * @csspart command - The `/command` text.
 * @csspart label - The label.
 * @csspart description - The description.
 *
 * @fires tec-select - The command was picked (the box is already empty). `detail: { value }` (the command).
 */
export class TecComposerCommand extends TectonElement {
  static styles = [hostStyles, composerCommandStyles]

  /** What is typed after the slash, such as `new`: one word, no spaces. */
  @property() command = ""

  /** Commands with the same group are listed together under it. */
  @property() group = ""

  /** Shown at the end of the row, muted. */
  @property() description = ""

  /** Leaves the command out of the list. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The active command (the textarea's active descendant). Set by `tec-composer-commands`. */
  @property({ type: Boolean, reflect: true }) highlighted = false

  /** The label text (the element's text outside the `start` slot). */
  get labelText(): string {
    return [...this.childNodes]
      .filter((node) => !(node instanceof Element && node.hasAttribute("slot")))
      .map((node) => node.textContent ?? "")
      .join("")
      .trim()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "option"
    this.internals.ariaSelected = this.highlighted ? "true" : "false"
  }

  protected override render() {
    return html`<div class="base" part="base">
      <slot name="start"></slot>
      <span class="command" part="command">/${this.command}</span>
      <span class="label" part="label"><slot></slot></span>
      ${this.description ? html`<span class="description" part="description">${this.description}</span>` : nothing}
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-commands": TecComposerCommands
    "tec-composer-command": TecComposerCommand
  }
}
