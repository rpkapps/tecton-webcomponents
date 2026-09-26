import { ContextConsumer, ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { createShortcutRegistry, type ShortcutRegistry } from "./registry.js"
import { shortcutsContext } from "./shortcuts-context.js"
import { shortcutsStyles } from "./shortcuts.styles.js"

/**
 * The host shell wraps its page in one `tec-shortcuts`; applications register their shortcuts against
 * its registry, declaratively with `tec-shortcut` elements, or from any script with
 * `getShortcutRegistry(element).register(…)` (or the `registry` object the host hands them). It
 * listens for `keydown` once, on `document` by default.
 *
 * A nested `tec-shortcuts` without a `registry` of its own reuses its parent's, so a component can
 * wrap itself in one and still share the host's shortcuts. A nested one that is `scoped` (or given a
 * `target`) gets a registry of its own, listening there only: one registry listening in two places
 * would see every key twice. Its shortcuts are then listed inside it, not with the host's.
 *
 * @summary Keyboard shortcut provider: listens for keys once and shares a shortcut registry with everything inside it.
 *
 * @tag tec-shortcuts
 *
 * @slot - The page, region or application the shortcuts belong to.
 */
export class TecShortcuts extends TectonElement {
  static styles = [hostStyles, shortcutsStyles]

  /**
   * The registry to share, created with `createShortcutRegistry()` so the host can hand it to
   * applications outside this element. Omitted: the parent's registry, or one of its own.
   */
  @property({ attribute: false }) registry?: ShortcutRegistry

  /**
   * Listen for keys on this element only (so the shortcuts fire only while focus is inside it), with
   * a registry of its own unless `registry` is set.
   */
  @property({ type: Boolean, reflect: true }) scoped = false

  /**
   * The element (or document) whose `keydown` events are dispatched. Default: `document`, or this
   * element when `scoped`. Setting it on a nested `tec-shortcuts` gives it a registry of its own.
   */
  @property({ attribute: false }) target?: HTMLElement | Document | null

  #parent = new ContextConsumer(this, { context: shortcutsContext, subscribe: true })
  #provider = new ContextProvider(this, { context: shortcutsContext, initialValue: undefined })
  #fallback?: ShortcutRegistry
  #listening?: { node: EventTarget; registry: ShortcutRegistry }

  /** The registry in use: `registry`, the parent's, or one created for this element. */
  get activeRegistry(): ShortcutRegistry {
    if (this.registry) return this.registry
    const parent = this.#parent.value
    if (parent && !this.scoped && this.target === undefined) return parent
    this.#fallback ??= createShortcutRegistry()
    return this.#fallback
  }

  override connectedCallback(): void {
    super.connectedCallback()
    // Listening starts after the first update (the parent's registry is known by then).
    if (this.hasUpdated) this.#listen()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#stop()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const registry = this.activeRegistry
    if (this.#provider.value !== registry) this.#provider.setValue(registry)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#listen()
  }

  #listen(): void {
    const registry = this.activeRegistry
    // The parent already listens for its registry.
    const node = registry === this.#parent.value ? null : this.target === undefined ? (this.scoped ? this : document) : this.target
    if (this.#listening?.node === node && this.#listening?.registry === registry) return
    this.#stop()
    if (!node) return
    node.addEventListener("keydown", this.#onKeyDown)
    this.#listening = { node, registry }
  }

  #stop(): void {
    this.#listening?.node.removeEventListener("keydown", this.#onKeyDown)
    this.#listening = undefined
  }

  #onKeyDown = (event: Event) => {
    this.#listening?.registry.handleKeyDown(event as KeyboardEvent)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-shortcuts": TecShortcuts
  }
}
