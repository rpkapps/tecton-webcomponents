import { ContextConsumer } from "@lit/context"
import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { live } from "lit/directives/live.js"
import { AriaDelegateController, resolveIdRefs, setAriaElements } from "../../internal/aria.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerInputStyles } from "./composer.styles.js"

function isComposing(event: KeyboardEvent): boolean {
  // Safari ends the composition before the Enter that confirms it arrives, so `isComposing` alone
  // lets that Enter send; 229 is the IME's key code.
  return event.isComposing || event.keyCode === 229
}

/** The styles that decide where the textarea's text wraps, copied to the copy that measures it. */
const WRAP_STYLES = [
  "direction",
  "font-family",
  "font-feature-settings",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "overflow-wrap",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "tab-size",
  "text-indent",
  "text-transform",
  "white-space",
  "word-break",
  "word-spacing",
]

/**
 * Whether the caret is on the first (or last) line the textarea shows: no newline between it and that
 * edge, and no wrap either. Where it wraps is measured in a hidden copy laid out as the textarea is,
 * with a mark at the start, one around the character after the caret (a caret at a wrap is drawn on
 * the line below) and one at the end.
 */
function caretOnEdgeLine(node: HTMLTextAreaElement, edge: "first" | "last"): boolean {
  const { selectionStart, selectionEnd, value } = node
  if (selectionStart !== selectionEnd) return false
  const between = edge === "first" ? value.slice(0, selectionStart) : value.slice(selectionEnd)
  if (between.includes("\n")) return false
  if (between === "") return true

  const style = getComputedStyle(node)
  const copy = document.createElement("div")
  for (const property of WRAP_STYLES) copy.style.setProperty(property, style.getPropertyValue(property))
  Object.assign(copy.style, {
    position: "absolute",
    top: "0",
    left: "-9999px",
    visibility: "hidden",
    boxSizing: "border-box",
    width: `${node.clientWidth}px`,
    border: "0",
    margin: "0",
  })
  const mark = (text = "") => {
    const span = copy.appendChild(document.createElement("span"))
    span.textContent = text
    return span
  }
  const next = selectionStart + ((value.codePointAt(selectionStart) ?? 0) > 0xffff ? 2 : 1)
  const start = mark()
  copy.append(value.slice(0, selectionStart))
  const caret = mark(value.slice(selectionStart, next))
  copy.append(value.slice(next))
  const end = mark()
  document.body.appendChild(copy)
  // Same line within half a line: a glyph from a fallback font can sit a pixel or two off.
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16
  const onEdge = Math.abs(caret.offsetTop - (edge === "first" ? start : end).offsetTop) < lineHeight / 2
  copy.remove()
  return onEdge
}

function supportsFieldSizing(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content")
}

/**
 * The textarea grows with its text (`field-sizing: content`, or its scroll height where a browser has
 * none, measured again when the box changes width) up to 12rem, then scrolls. It is named "Message"
 * (`label`, or `aria-label` / `aria-labelledby` on the element) and described by every
 * `tec-composer-hint` of the composer (and its own `aria-describedby`). With `tec-composer-commands`
 * it points at the active command with `aria-activedescendant` and at the list with `aria-controls`.
 *
 * @summary The composer's textarea.
 *
 * @tag tec-composer-input
 *
 * @csspart base - The native `<textarea>`.
 */
export class TecComposerInput extends TectonElement {
  static styles = [hostStyles, composerInputStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Placeholder text. */
  @property() placeholder = ""

  /** The accessible name when the element has no `aria-label` / `aria-labelledby`. */
  @property() label = "Message"

  /** Name of the textarea (for autofill and form tooling; the composer does not submit a form). */
  @property() name = ""

  /** The `aria-label` attribute of the element, which names the textarea. */
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null

  /** The native `<textarea>`. */
  @query("textarea") readonly textarea!: HTMLTextAreaElement

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #unregister?: () => void
  #registeredWith?: object
  /** A history entry goes in with the caret at its end, once it is in the textarea. */
  #caretAtEnd: string | null = null
  #resizeObserver?: ResizeObserver
  #width = 0

  constructor() {
    super()
    new AriaDelegateController(this, {
      target: () => this.textarea,
      exclude: ["aria-label", "aria-describedby", "aria-activedescendant", "aria-controls", "aria-autocomplete"],
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#register()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unregister?.()
    this.#unregister = undefined
    this.#registeredWith = undefined
    this.#resizeObserver?.disconnect()
  }

  #register(): void {
    const composer = this.#composer.value?.composer
    if (!composer || composer === this.#registeredWith) return
    this.#unregister?.()
    this.#unregister = composer.registerInput(this)
    this.#registeredWith = composer
  }

  protected override firstUpdated(): void {
    // The text wraps again when the box gets narrower or wider (a resized panel, a sidebar that opens).
    if (supportsFieldSizing() || typeof ResizeObserver === "undefined") return
    this.#width = this.textarea.clientWidth
    this.#resizeObserver = new ResizeObserver(() => {
      // Only a new width: the height is ours, and setting it resizes too.
      if (this.textarea.clientWidth === this.#width) return
      this.#width = this.textarea.clientWidth
      this.#fitHeight()
    })
    this.#resizeObserver.observe(this.textarea)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#register()
    const textarea = this.textarea
    const composer = this.#composer.value?.composer
    const own = resolveIdRefs(this, this.getAttribute("aria-describedby"))
    setAriaElements(textarea, "ariaDescribedByElements", [...(composer?.describedBy ?? []), ...own])
    if (this.#caretAtEnd !== null && textarea.value === this.#caretAtEnd) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      this.#caretAtEnd = null
    }
    this.#fitHeight()
  }

  /** Without `field-sizing` (Firefox) the height follows the text's scroll height. */
  #fitHeight(): void {
    const node = this.textarea
    if (!node || supportsFieldSizing()) return
    node.style.height = "auto"
    // `scrollHeight` counts the padding but not the border.
    const style = getComputedStyle(node)
    const px = (value: string) => parseFloat(value) || 0
    const extra =
      style.boxSizing === "border-box"
        ? px(style.borderTopWidth) + px(style.borderBottomWidth)
        : -(px(style.paddingTop) + px(style.paddingBottom))
    node.style.height = `${node.scrollHeight + extra}px`
  }

  /** Selects the text. */
  select(): void {
    this.textarea?.select()
  }

  #onInput = (event: Event) => {
    const composer = this.#composer.value?.composer
    composer?.typeValue((event.target as HTMLTextAreaElement).value)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const context = this.#composer.value
    if (!context || event.defaultPrevented || isComposing(event)) return
    const { composer } = context
    if (composer.handleCommandKey(event)) return

    const mod = event.metaKey || event.ctrlKey
    if (event.key === "Enter") {
      if (event.shiftKey && !mod) return
      if (mod || context.submitMode === "enter") {
        event.preventDefault()
        composer.submit()
      }
      return
    }

    if (event.key === "Escape" && context.canStop) {
      // Handled here, so a sheet or dialog around the chat stays open.
      event.preventDefault()
      event.stopPropagation()
      composer.stop()
      return
    }

    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !mod && !event.shiftKey && !event.altKey) {
      // Only from the first line up, or the last line down, so the arrows still move the caret
      // inside a message of several lines, split by newlines or wrapped. A prompt just loaded, as it
      // was, keeps stepping up from wherever the caret is, as a terminal's history does.
      const node = this.textarea
      const older = event.key === "ArrowUp"
      // Nothing to step to: leave the key to the caret without measuring where it is.
      if (older ? !composer.hasHistory : !composer.browsingHistory) return
      const unedited = node.selectionStart === node.selectionEnd && context.historyEntry === node.value
      const onEdge = (older && unedited) || caretOnEdgeLine(node, older ? "first" : "last")
      if (!onEdge) return
      const loaded = composer.stepHistory(older ? "older" : "newer", node.value)
      if (loaded === undefined) return
      event.preventDefault()
      if (node.value === loaded) node.setSelectionRange(loaded.length, loaded.length)
      else this.#caretAtEnd = loaded
    }
  }

  protected override render() {
    const context = this.#composer.value
    const labelledBy = this.hasAttribute("aria-labelledby")
    return html`<textarea
      class="base"
      part="base"
      rows="1"
      name=${ifDefined(this.name || undefined)}
      placeholder=${ifDefined(this.placeholder || undefined)}
      aria-label=${labelledBy ? nothing : (this.accessibleLabel ?? this.label)}
      aria-autocomplete=${context?.hasCommands ? "list" : nothing}
      ?disabled=${context?.disabled ?? false}
      .value=${live(context?.value ?? "")}
      @input=${this.#onInput}
      @keydown=${this.#onKeyDown}
    ></textarea>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-input": TecComposerInput
  }
}
