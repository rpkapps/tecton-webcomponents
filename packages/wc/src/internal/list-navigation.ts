/**
 * @module list-navigation
 * `ListNavigationController` — `aria-activedescendant` navigation for collections whose DOM focus must
 * stay on one element (combobox and command input, a listbox host, a menu opened from a text field).
 * It keeps a *virtual* active item among light-DOM options, points the focus holder's
 * `ariaActiveDescendantElement` at it (element reflection: a shadow-root `<input>` may reference
 * slotted/light-DOM options), highlights it, scrolls it into view and skips disabled items.
 *
 * ```ts
 * #nav = new ListNavigationController(this, {
 *   items: () => this.visibleOptions,               // light-DOM <tec-combobox-item>s, in order
 *   focusTarget: () => this.input,                  // the element that keeps DOM focus
 *   keyTarget: () => this.input,                    // where to listen for keys (default: host)
 *   homeEnd: false,                                 // Home/End stay with the text caret
 * })
 * // Enter: this.#nav.activeItem → select it
 * ```
 *
 * Highlighting: the item's `highlighted` property is set when it exists (declare
 * `@property({ type: Boolean, reflect: true }) highlighted` or map it to a custom state), otherwise
 * the `data-highlighted` attribute is toggled. Override with `onActiveChange`.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"
import { defaultIsDisabled } from "./roving-focus.js"
import { Typeahead } from "./typeahead.js"

/** Anything with an `ariaActiveDescendantElement` (an element or `ElementInternals`). */
export interface ActiveDescendantHolder {
  ariaActiveDescendantElement: Element | null
}

/** Options of {@link ListNavigationController}. */
export interface ListNavigationOptions<T extends HTMLElement> {
  /** The navigable items in order (hidden/filtered-out items excluded; disabled ones may be included). */
  items: () => T[]
  /** Receives `ariaActiveDescendantElement`. `null` → nothing is set. */
  focusTarget: () => ActiveDescendantHolder | null | undefined
  /** Element whose `keydown` is handled. Default: the host. Pass `null` to call `handleKeyDown` yourself. */
  keyTarget?: (() => EventTarget | null | undefined) | null
  /** `vertical` (ArrowUp/Down, default) or `horizontal` (ArrowLeft/Right, RTL-aware). */
  orientation?: "vertical" | "horizontal"
  /** Wrap around at the ends. Default `false` (React Aria listbox). */
  loop?: boolean
  /** Handle Home/End. Default `true`; `false` in text inputs. */
  homeEnd?: boolean
  /** Items moved by PageUp/PageDown. Default 10; 0 disables. */
  pageSize?: number
  isDisabled?: (item: T) => boolean
  /** Type-to-highlight (not for text inputs). `true` uses the item text. */
  typeahead?: boolean | ((item: T) => string)
  /** Highlight items under the pointer. Default `true`. */
  highlightOnHover?: boolean
  /** Scroll the active item into view (`block: "nearest"`). Default `true`. */
  scroll?: boolean
  /** Replaces the default highlight toggling. */
  onActiveChange?: (item: T | null, previous: T | null) => void
}

function setHighlighted(item: HTMLElement, on: boolean) {
  if ("highlighted" in item) (item as HTMLElement & { highlighted: boolean }).highlighted = on
  else item.toggleAttribute("data-highlighted", on)
}

export class ListNavigationController<T extends HTMLElement = HTMLElement> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement
  readonly #options: ListNavigationOptions<T>
  readonly #typeahead?: Typeahead
  #active: T | null = null
  #keyTarget: EventTarget | null = null

  constructor(host: ReactiveControllerHost & HTMLElement, options: ListNavigationOptions<T>) {
    this.#host = host
    this.#options = options
    if (options.typeahead) this.#typeahead = new Typeahead()
    host.addController(this)
  }

  /** The highlighted item (the active descendant). */
  get activeItem(): T | null {
    return this.#active
  }

  hostConnected(): void {
    this.#host.addEventListener("pointermove", this.#onPointerMove)
    this.#bindKeys()
  }

  hostUpdated(): void {
    this.#bindKeys()
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("pointermove", this.#onPointerMove)
    this.#keyTarget?.removeEventListener("keydown", this.#onKeyDown as EventListener)
    this.#keyTarget = null
  }

  #bindKeys(): void {
    if (this.#options.keyTarget === null) return
    const target = this.#options.keyTarget?.() ?? this.#host
    if (target === this.#keyTarget) return
    this.#keyTarget?.removeEventListener("keydown", this.#onKeyDown as EventListener)
    target.addEventListener("keydown", this.#onKeyDown as EventListener)
    this.#keyTarget = target
  }

  #isDisabled = (item: T) => (this.#options.isDisabled ?? defaultIsDisabled)(item)

  #enabled(): T[] {
    return this.#options.items().filter((i) => !this.#isDisabled(i))
  }

  /** Highlights `item` (or clears with `null`) and updates `aria-activedescendant`. */
  setActive(item: T | null, options: { scroll?: boolean } = {}): void {
    const previous = this.#active
    if (item && this.#isDisabled(item)) return
    this.#active = item
    const holder = this.#options.focusTarget()
    if (holder) holder.ariaActiveDescendantElement = item
    if (previous !== item) {
      if (this.#options.onActiveChange) this.#options.onActiveChange(item, previous)
      else {
        if (previous) setHighlighted(previous, false)
        if (item) setHighlighted(item, true)
      }
    }
    if (item && (options.scroll ?? this.#options.scroll ?? true)) item.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  /** Clears the highlight. */
  clear(): void {
    this.setActive(null)
  }

  first(): void {
    this.setActive(this.#enabled()[0] ?? null)
  }

  last(): void {
    const enabled = this.#enabled()
    this.setActive(enabled[enabled.length - 1] ?? null)
  }

  /** Moves by `delta` enabled items (clamped, or wrapped with `loop`). From nothing, +1 → first, -1 → last. */
  move(delta: number): void {
    const enabled = this.#enabled()
    if (!enabled.length) return
    const index = this.#active ? enabled.indexOf(this.#active) : -1
    let next: number
    if (index < 0) next = delta > 0 ? 0 : enabled.length - 1
    else if (this.#options.loop) next = (((index + delta) % enabled.length) + enabled.length) % enabled.length
    else next = Math.min(Math.max(index + delta, 0), enabled.length - 1)
    this.setActive(enabled[next]!)
  }

  next(): void {
    this.move(1)
  }

  previous(): void {
    this.move(-1)
  }

  /** Re-validates the active item after the items changed (clears it if it is gone or disabled). */
  update(): void {
    if (this.#active && (!this.#options.items().includes(this.#active) || this.#isDisabled(this.#active))) this.clear()
  }

  /**
   * Handles a navigation key; returns `true` (and prevents the default) when it did. Only needed when
   * `keyTarget: null` — otherwise the controller listens itself.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false
    const horizontal = this.#options.orientation === "horizontal"
    const rtl = getComputedStyle(this.#host).direction === "rtl"
    const nextKey = horizontal ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown"
    const prevKey = horizontal ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp"
    const page = this.#options.pageSize ?? 10
    const homeEnd = this.#options.homeEnd ?? true
    switch (event.key) {
      case nextKey:
        this.next()
        break
      case prevKey:
        this.previous()
        break
      case "Home":
        if (!homeEnd) return false
        this.first()
        break
      case "End":
        if (!homeEnd) return false
        this.last()
        break
      case "PageDown":
        if (!page) return false
        this.move(page)
        break
      case "PageUp":
        if (!page) return false
        this.move(-page)
        break
      default: {
        if (!this.#typeahead || !this.#typeahead.isTypeaheadKey(event)) return false
        const getText = typeof this.#options.typeahead === "function" ? this.#options.typeahead : (i: T) => i.textContent ?? ""
        const match = this.#typeahead.match(event, this.#options.items(), this.#active, getText, this.#isDisabled)
        if (match) this.setActive(match)
      }
    }
    event.preventDefault()
    return true
  }

  #onKeyDown = (event: KeyboardEvent) => {
    this.handleKeyDown(event)
  }

  #onPointerMove = (event: PointerEvent) => {
    if (this.#options.highlightOnHover === false) return
    const items = this.#options.items()
    const item = event.composedPath().find((t): t is T => items.includes(t as T))
    if (item && item !== this.#active && !this.#isDisabled(item)) this.setActive(item, { scroll: false })
  }
}
