/**
 * @module tecton-element
 * The base class of every Tecton element.
 *
 * ```ts
 * export class TecBadge extends TectonElement {
 *   static styles = [hostStyles, styles]
 *   @property({ reflect: true }) variant: BadgeVariant = "default"
 *   render() { return html`<slot></slot>` }
 * }
 * ```
 *
 * - {@link TectonElement.emit} dispatches `bubbles` + `composed` events (the library's event contract)
 *   and returns `false` when a cancelable event was prevented.
 * - {@link TectonElement.internals} is the element's `ElementInternals`, attached on first use. Use it
 *   for default semantics (`internals.role = "tab"`, `internals.ariaSelected = "true"`) and custom
 *   states (`internals.states.add("checked")` → `:state(checked)`). Never call `attachInternals()`
 *   yourself — it may only be called once per element.
 */
import { LitElement, type CSSResultGroup } from "lit"
import { hostStyles } from "./styles.js"

/** Options of {@link TectonElement.emit}. */
export interface EmitOptions<D> {
  /** Payload, available as `event.detail`. */
  detail?: D
  /** Whether `preventDefault()` vetoes the action. Default `false`. */
  cancelable?: boolean
  /** Default `true`. */
  bubbles?: boolean
  /** Default `true` (events cross shadow boundaries). */
  composed?: boolean
}

export class TectonElement extends LitElement {
  /** Subclasses usually replace this with `[hostStyles, …own styles]`. */
  static styles: CSSResultGroup = hostStyles

  #internals?: ElementInternals

  /**
   * The element's `ElementInternals`, attached lazily on first access (so subclasses that never need
   * it pay nothing). Form-associated subclasses get the form APIs on the same object.
   * @internal
   */
  get internals(): ElementInternals {
    this.#internals ??= this.attachInternals()
    return this.#internals
  }

  /**
   * Dispatches a `CustomEvent` named `name` from the host (`bubbles` and `composed` by default) and
   * returns `true` unless the event was cancelable and a listener called `preventDefault()`.
   *
   * ```ts
   * if (this.emit("tec-open-change", { detail: { open: false }, cancelable: true })) this.open = false
   * ```
   */
  protected emit<D = undefined>(name: string, options: EmitOptions<D> = {}): boolean {
    const event = new CustomEvent<D>(name, {
      detail: options.detail as D,
      cancelable: options.cancelable ?? false,
      bubbles: options.bubbles ?? true,
      composed: options.composed ?? true,
    })
    return this.dispatchEvent(event)
  }

  /**
   * Adds or removes a custom state (`:state(name)` in CSS). No-op for falsy/unchanged values.
   * @internal
   */
  protected toggleState(name: string, force: boolean): void {
    const states = this.internals.states
    if (force) states.add(name)
    else states.delete(name)
  }
}
