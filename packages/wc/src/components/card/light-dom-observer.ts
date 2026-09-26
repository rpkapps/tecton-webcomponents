/**
 * @module light-dom-observer
 * `LightDomObserver` — runs a callback when the host connects and whenever its light DOM changes
 * (children added/removed, and optionally attributes of descendants). Layout parts use it to derive
 * custom states from their children, the way the Tecton spec uses `has-*` selectors
 * (`has-data-[slot=card-action]:grid-cols-[1fr_auto]`): `:host(:has(…))` is not reliable across
 * engines, so the state is computed in script and exposed as `:state(…)`.
 *
 * ```ts
 * #children = new LightDomObserver(this, () => this.toggleState("has-action", !!this.querySelector(":scope > tec-card-action")))
 * ```
 *
 * Used by the card, item and avatar families. (Candidate for `src/internal/`.)
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"

export class LightDomObserver implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement
  readonly #callback: () => void
  readonly #options: MutationObserverInit
  readonly #observer: MutationObserver

  /** `options` default to `{ childList: true }` (direct children only). */
  constructor(
    host: ReactiveControllerHost & HTMLElement,
    callback: () => void,
    options: MutationObserverInit = { childList: true }
  ) {
    this.#host = host
    this.#callback = callback
    this.#options = options
    this.#observer = new MutationObserver(() => this.#callback())
    host.addController(this)
  }

  hostConnected(): void {
    this.#observer.observe(this.#host, this.#options)
    this.#callback()
  }

  hostDisconnected(): void {
    this.#observer.disconnect()
  }

  /** Runs the callback now (e.g. after a child reported a change the observer cannot see). */
  sync(): void {
    this.#callback()
  }
}
