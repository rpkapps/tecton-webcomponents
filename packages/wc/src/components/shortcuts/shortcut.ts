import { ContextConsumer } from "@lit/context"
import { nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ShortcutRegistry } from "./registry.js"
import { shortcutsContext } from "./shortcuts-context.js"
import { shortcutStyles } from "./shortcuts.styles.js"

/** `detail` of the `tec-shortcut` event. */
export interface ShortcutEventDetail {
  /** The shortcut's id in the registry. */
  id: string
  /** The keys it is bound to, as written (`"mod+s"`). */
  keys: string
  /** The key press that fired it (its default action is already prevented). */
  keyboardEvent: KeyboardEvent
}

/**
 * Registers one shortcut with the registry of the `tec-shortcuts` around it while it is connected,
 * and fires `tec-shortcut` when its keys are pressed. It renders nothing: list the registered
 * shortcuts with `tec-shortcut-list`, or show one binding with `tec-shortcut-keys`.
 *
 * Shortcuts without Ctrl, ⌘ or Alt do not fire while an input, textarea or editable element has focus
 * (inside a shadow root too); set `allow-in-input` to change that. A held key fires once unless
 * `allow-repeat` is set. Registering the same `name` again replaces the earlier shortcut, and when two
 * shortcuts share the same keys the most recently registered one wins.
 *
 * @summary Declares a keyboard shortcut.
 *
 * @tag tec-shortcut
 *
 * @fires tec-shortcut - The keys were pressed. `detail: { id, keys, keyboardEvent }`.
 */
export class TecShortcut extends TectonElement {
  static styles = [hostStyles, shortcutStyles]

  /** Key chord or sequence: `mod+k` (⌘ on macOS, Ctrl elsewhere), `shift+?`, `?`, `g w` (G then W). */
  @property() keys = ""

  /** What the shortcut does, shown in shortcut lists. */
  @property() label = ""

  /** Heading the shortcut is listed under (default "General"). */
  @property() group?: string

  /** Stable id in the registry. Default: a generated one. */
  @property() name = ""

  /** Fire while typing in a text field too. Default: only chords with Ctrl, ⌘ or Alt do. */
  @property({ type: Boolean, attribute: "allow-in-input" }) allowInInput = false

  /** Fire again while the key is held (zoom, nudge). */
  @property({ type: Boolean, attribute: "allow-repeat" }) allowRepeat = false

  /** Skips the shortcut and lets the key through (it stays listed). */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Keeps the shortcut out of lists (it still fires). */
  @property({ type: Boolean }) unlisted = false

  #registry = new ContextConsumer(this, { context: shortcutsContext, subscribe: true })
  #generatedId = uniqueId("tec-shortcut")
  #registered?: { registry: ShortcutRegistry; remove: () => void; signature: string }

  /** The id the shortcut is registered under. */
  get shortcutId(): string {
    return this.name || this.#generatedId
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unregister()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.hasUpdated) this.#register()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#register()
  }

  #register(): void {
    const registry = this.#registry.value
    const signature = JSON.stringify([this.shortcutId, this.keys, this.label, this.group, this.allowInInput, this.allowRepeat, this.unlisted])
    if (this.#registered && this.#registered.registry === registry && this.#registered.signature === signature) return
    this.#unregister()
    if (!registry || !this.keys.trim() || !this.isConnected) return
    const id = this.shortcutId
    const remove = registry.register({
      id,
      keys: this.keys,
      label: this.label,
      group: this.group || undefined,
      allowInInput: this.allowInInput ? true : undefined,
      allowRepeat: this.allowRepeat,
      hidden: this.unlisted,
      isEnabled: () => !this.disabled,
      onAction: (keyboardEvent) => this.emit<ShortcutEventDetail>("tec-shortcut", { detail: { id, keys: this.keys, keyboardEvent } }),
    })
    this.#registered = { registry, remove, signature }
  }

  #unregister(): void {
    this.#registered?.remove()
    this.#registered = undefined
  }

  protected override render() {
    return nothing
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-shortcut": TecShortcut
  }
}
