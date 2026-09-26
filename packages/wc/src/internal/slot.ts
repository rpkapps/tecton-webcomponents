/**
 * @module slot
 * `HasSlotController` — knows whether named slots (or the default slot) have content, before and
 * after the first render, and re-renders the host when that changes. Use it to drop empty wrappers
 * and to switch styles (e.g. the tighter padding of a button with a start icon).
 *
 * ```ts
 * #slots = new HasSlotController(this, "start", "end", "[default]")
 * render() {
 *   return html`<span class=${classMap({ "has-start": this.#slots.test("start") })}>…</span>`
 * }
 * ```
 *
 * With `states: true` the host also gets custom states `has-<name>` (`has-default` for the default
 * slot), so styles can use `:host(:state(has-start))` without touching `render()`.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"

type Host = ReactiveControllerHost & HTMLElement & { internals?: ElementInternals }

export class HasSlotController implements ReactiveController {
  readonly #host: Host
  readonly #slots: string[]
  #states = false
  #last = new Map<string, boolean>()

  /** `slots`: slot names; `"[default]"` is the default slot. Pass `{ states: true }` last to set custom states. */
  constructor(host: Host, ...slots: (string | { states: boolean })[]) {
    this.#host = host
    this.#slots = slots.filter((s): s is string => typeof s === "string")
    this.#states = slots.some((s) => typeof s === "object" && s.states)
    host.addController(this)
  }

  /** Whether `name` (`"[default]"` for the default slot) currently has content. */
  test(name: string): boolean {
    const host = this.#host
    if (name === "[default]") {
      return [...host.childNodes].some((node) => {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").trim() !== ""
        if (node.nodeType !== Node.ELEMENT_NODE) return false
        const el = node as Element
        return !el.hasAttribute("slot") && el.localName !== "template"
      })
    }
    return [...host.children].some((el) => el.getAttribute("slot") === name)
  }

  hostConnected(): void {
    this.#host.shadowRoot?.addEventListener("slotchange", this.#onSlotChange)
    this.#observer.observe(this.#host, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["slot"] })
    this.#sync(false)
  }

  hostUpdated(): void {
    // The shadow root exists after the first update.
    this.#host.shadowRoot?.addEventListener("slotchange", this.#onSlotChange)
  }

  hostDisconnected(): void {
    this.#host.shadowRoot?.removeEventListener("slotchange", this.#onSlotChange)
    this.#observer.disconnect()
  }

  #observer = new MutationObserver(() => this.#sync(true))
  #onSlotChange = () => this.#sync(true)

  #sync(update: boolean): void {
    let changed = false
    for (const name of this.#slots) {
      const has = this.test(name)
      if (this.#last.get(name) !== has) {
        this.#last.set(name, has)
        changed = true
        if (this.#states && this.#host.internals) {
          const state = name === "[default]" ? "has-default" : `has-${name}`
          if (has) this.#host.internals.states.add(state)
          else this.#host.internals.states.delete(state)
        }
      }
    }
    if (changed && update) this.#host.requestUpdate()
  }
}
