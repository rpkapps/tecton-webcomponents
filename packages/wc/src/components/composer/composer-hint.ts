import { ContextConsumer } from "@lit/context"
import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { kbdStyles } from "../shortcuts/kbd.styles.js"
import { isMacPlatform } from "../shortcuts/registry.js"
import { composerContext } from "./composer-context.js"
import { composerHintStyles } from "./composer.styles.js"

/**
 * The textarea is described by it (`aria-describedby`), so a screen reader hears how to send. By
 * default it names the keys of the composer's `submit-mode` (with ⌘ instead of Ctrl on an Apple
 * keyboard), adds "/ for commands" with `tec-composer-commands` and "↑ for earlier messages" once
 * `history` has an entry. Put your own text (in the page's language) in the default slot instead.
 *
 * @summary How to send, tied to the textarea; visible, or for screen readers only.
 *
 * @tag tec-composer-hint
 *
 * @slot - Your own hint. Default: the keys, in English.
 *
 * @csspart base - The paragraph.
 * @csspart kbd - Each key cap of the default text.
 */
export class TecComposerHint extends TectonElement {
  static styles = [hostStyles, kbdStyles, composerHintStyles]

  /** Keeps the hint for screen readers only. */
  @property({ type: Boolean, reflect: true, attribute: "visually-hidden" }) visuallyHidden = false

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #unregister?: () => void
  #registeredWith?: object

  override connectedCallback(): void {
    super.connectedCallback()
    this.#register()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unregister?.()
    this.#unregister = undefined
    this.#registeredWith = undefined
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#register()
  }

  #register(): void {
    const composer = this.#composer.value?.composer
    if (!composer || composer === this.#registeredWith) return
    this.#unregister?.()
    this.#unregister = composer.registerHint(this)
    this.#registeredWith = composer
  }

  protected override render() {
    const context = this.#composer.value
    const kbd = (key: string) => html`<kbd class="kbd" part="kbd">${key}</kbd>`
    const send =
      context?.submitMode === "mod-enter"
        ? html`${kbd(isMacPlatform() ? "⌘" : "Ctrl")}+${kbd("Enter")} to send, ${kbd("Enter")} for a new line`
        : html`${kbd("Enter")} to send, ${kbd("Shift")}+${kbd("Enter")} for a new line`
    return html`<p class="base" part="base"
      ><slot
        >${send}${context?.hasCommands ? html`, ${kbd("/")} for commands` : nothing}${context?.hasHistory
          ? html`, ${kbd("↑")} for earlier messages`
          : nothing}</slot
      ></p
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-hint": TecComposerHint
  }
}
