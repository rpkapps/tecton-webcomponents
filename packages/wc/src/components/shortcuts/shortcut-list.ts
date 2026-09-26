import { ContextConsumer } from "@lit/context"
import { html, nothing, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { Shortcut, ShortcutRegistry } from "./registry.js"
import type { ShortcutPlatform } from "./shortcut-keys.js"
import { shortcutsContext } from "./shortcuts-context.js"
import { shortcutListStyles } from "./shortcuts.styles.js"

/**
 * Lists the shortcuts registered with the registry of the `tec-shortcuts` around it (or `registry`),
 * grouped under their `group` in the order the groups first appear, each with its label and key
 * caps. It updates as applications register and unregister shortcuts, so it is the body of a
 * shell's "Keyboard shortcuts" dialog. Shortcuts registered `hidden` (`unlisted`) are left out.
 *
 * @summary A live list of the registered keyboard shortcuts, grouped.
 *
 * @tag tec-shortcut-list
 *
 * @csspart base - The column of groups.
 * @csspart group - One group.
 * @csspart group-label - The group's heading text.
 * @csspart list - The `<ul>` of a group.
 * @csspart item - One shortcut row.
 * @csspart label - The shortcut's label.
 * @csspart keys - The shortcut's `tec-shortcut-keys` (its parts are exported as `kbd`, `separator`, `then`).
 *
 * @cssstate empty - No shortcut is listed.
 */
export class TecShortcutList extends TectonElement {
  static styles = [hostStyles, shortcutListStyles]

  /** The registry to list. Default: the one of the `tec-shortcuts` around the element. */
  @property({ attribute: false }) registry?: ShortcutRegistry

  /** The keyboard the caps are drawn for (see `tec-shortcut-keys`). */
  @property() platform: ShortcutPlatform = "auto"

  /** The heading of shortcuts registered without a `group`. */
  @property({ attribute: "default-group" }) defaultGroup = "General"

  @state() private shortcuts: Shortcut[] = []

  #context = new ContextConsumer(this, { context: shortcutsContext, subscribe: true })
  #subscribed?: { registry: ShortcutRegistry; unsubscribe: () => void }
  #idPrefix = uniqueId("tec-shortcut-list")

  /** The registry listed. */
  get activeRegistry(): ShortcutRegistry | undefined {
    return this.registry ?? this.#context.value
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.hasUpdated) this.#subscribe()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#subscribed?.unsubscribe()
    this.#subscribed = undefined
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.#subscribe()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("empty", !this.#visible().length)
  }

  #subscribe(): void {
    const registry = this.activeRegistry
    if (this.#subscribed?.registry === registry) return
    this.#subscribed?.unsubscribe()
    this.#subscribed = undefined
    if (!registry) {
      this.shortcuts = []
      return
    }
    const sync = () => (this.shortcuts = registry.getAll())
    this.#subscribed = { registry, unsubscribe: registry.subscribe(sync) }
    sync()
  }

  #visible(): Shortcut[] {
    return this.shortcuts.filter((shortcut) => !shortcut.hidden)
  }

  protected override render() {
    const groups = new Map<string, Shortcut[]>()
    for (const shortcut of this.#visible()) {
      const name = shortcut.group || this.defaultGroup
      const list = groups.get(name)
      if (list) list.push(shortcut)
      else groups.set(name, [shortcut])
    }
    if (!groups.size) return nothing
    return html`<div class="base" part="base">
      ${[...groups].map(([name, shortcuts], index) => {
        const labelId = `${this.#idPrefix}-${index}`
        return html`<div class="group" part="group">
          <div class="group-label" part="group-label" id=${labelId}>${name}</div>
          <ul class="list" part="list" aria-labelledby=${labelId}>
            ${shortcuts.map(
              (shortcut) => html`<li class="item" part="item">
                <span class="label" part="label">${shortcut.label}</span>
                <tec-shortcut-keys part="keys" exportparts="kbd, separator, then" keys=${shortcut.keys} platform=${this.platform}></tec-shortcut-keys>
              </li>`
            )}
          </ul>
        </div>`
      })}
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-shortcut-list": TecShortcutList
  }
}
