/**
 * @module roving-focus
 * `RovingFocusController` — the roving-tabindex pattern for composite widgets whose items take real
 * DOM focus (tabs, toolbar, radio group, toggle group, menu, menubar, tree, listbox without a text
 * input). Exactly one enabled item has `tabindex="0"` (the active one, remembered across visits);
 * the others have `-1`. Arrow keys move focus (RTL-aware), Home/End jump, disabled items are
 * skipped, and focus can optionally activate the item.
 *
 * ```ts
 * export class TecTabsList extends TectonElement {
 *   #roving = new RovingFocusController(this, {
 *     items: () => [...this.querySelectorAll(":scope > tec-tabs-trigger")],
 *     orientation: () => this.orientation,          // "horizontal" | "vertical" | "both"
 *     activateOnFocus: () => this.activation === "automatic",
 *     onActivate: (tab) => this.tabs.select(tab.value),
 *   })
 *   // after items change (slotchange) or the selected item changes:
 *   this.#roving.setActive(selectedTab)             // or this.#roving.update()
 * }
 * ```
 *
 * The controller listens to `keydown` and `focusin` on the host (item events bubble to it) and only
 * handles events whose composed path contains one of the items.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"
import { horizontalStep } from "./direction.js"
import { Typeahead } from "./typeahead.js"

export type RovingOrientation = "horizontal" | "vertical" | "both"

/** Options of {@link RovingFocusController}. */
export interface RovingFocusOptions<T extends HTMLElement> {
  /** All items in DOM order, disabled ones included. */
  items: () => T[]
  /** Arrow keys that move: Left/Right, Up/Down or all four. Default `"horizontal"`. */
  orientation?: RovingOrientation | (() => RovingOrientation)
  /** Wrap from the last item to the first and back. Default `true`. */
  loop?: boolean
  /** Home/End move to the first/last item. Default `true`. */
  homeEnd?: boolean
  /** Default: `disabled` attribute, `aria-disabled="true"` or `:disabled`. */
  isDisabled?: (item: T) => boolean
  /** Disabled items stay focusable (skipped by nothing) — APG menus allow it. Default `false`. */
  focusDisabled?: boolean
  /** Call `onActivate` when an item receives focus from arrow/Home/End keys (automatic tab activation). */
  activateOnFocus?: boolean | (() => boolean)
  /** Called for focus-activation (see `activateOnFocus`). */
  onActivate?: (item: T, event: Event) => void
  /** Type-to-focus. `true` uses the item's text; a function returns the text to match. */
  typeahead?: boolean | ((item: T) => string)
}

export function defaultIsDisabled(item: Element): boolean {
  return item.hasAttribute("disabled") || item.getAttribute("aria-disabled") === "true" || item.matches(":disabled")
}

export class RovingFocusController<T extends HTMLElement = HTMLElement> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement
  readonly #options: RovingFocusOptions<T>
  readonly #typeahead?: Typeahead
  #active: T | null = null

  constructor(host: ReactiveControllerHost & HTMLElement, options: RovingFocusOptions<T>) {
    this.#host = host
    this.#options = options
    if (options.typeahead) this.#typeahead = new Typeahead()
    host.addController(this)
  }

  /** The item that owns `tabindex="0"`. */
  get activeItem(): T | null {
    return this.#active
  }

  hostConnected(): void {
    this.#host.addEventListener("keydown", this.#onKeyDown)
    this.#host.addEventListener("focusin", this.#onFocusIn)
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("keydown", this.#onKeyDown)
    this.#host.removeEventListener("focusin", this.#onFocusIn)
  }

  hostUpdated(): void {
    this.update()
  }

  #isDisabled(item: T): boolean {
    return (this.#options.isDisabled ?? defaultIsDisabled)(item)
  }

  #canFocus(item: T): boolean {
    return this.#options.focusDisabled || !this.#isDisabled(item)
  }

  /** Makes `item` the tab stop (and focuses it with `{ focus: true }`). */
  setActive(item: T | null, options: { focus?: boolean } = {}): void {
    this.#active = item
    this.update()
    if (item && options.focus) item.focus()
  }

  /**
   * Re-applies tabindex: the active item (or, if it is gone or disabled, the first focusable item)
   * gets 0, every other item -1. Called after every host update; call it after items change.
   */
  update(): void {
    const items = this.#options.items()
    if (!this.#active || !items.includes(this.#active) || !this.#canFocus(this.#active)) {
      this.#active = items.find((i) => this.#canFocus(i)) ?? null
    }
    for (const item of items) {
      const tabIndex = item === this.#active ? 0 : -1
      if (item.tabIndex !== tabIndex || !item.hasAttribute("tabindex")) item.tabIndex = tabIndex
    }
  }

  /** Focuses the active item. */
  focus(options?: FocusOptions): void {
    this.update()
    this.#active?.focus(options)
  }

  #itemFromEvent(event: Event): T | undefined {
    const items = this.#options.items()
    return event.composedPath().find((t): t is T => items.includes(t as T))
  }

  #onFocusIn = (event: FocusEvent) => {
    const item = this.#itemFromEvent(event)
    if (item && item !== this.#active && this.#canFocus(item)) this.setActive(item)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const current = this.#itemFromEvent(event)
    if (!current) return
    const items = this.#options.items()
    const enabled = items.filter((i) => this.#canFocus(i))
    if (!enabled.length) return

    const orientation = typeof this.#options.orientation === "function" ? this.#options.orientation() : (this.#options.orientation ?? "horizontal")
    const horizontal = orientation !== "vertical"
    const vertical = orientation !== "horizontal"
    let target: T | undefined

    let step = 0
    if (horizontal) step = horizontalStep(event.key, this.#host)
    if (vertical && event.key === "ArrowDown") step = 1
    if (vertical && event.key === "ArrowUp") step = -1

    if (step) {
      const index = enabled.indexOf(current)
      let next = (index < 0 ? (step > 0 ? -1 : enabled.length) : index) + step
      if (this.#options.loop ?? true) next = (next + enabled.length) % enabled.length
      target = enabled[next]
    } else if (this.#options.homeEnd !== false && event.key === "Home") {
      target = enabled[0]
    } else if (this.#options.homeEnd !== false && event.key === "End") {
      target = enabled[enabled.length - 1]
    } else if (this.#typeahead) {
      const getText = typeof this.#options.typeahead === "function" ? this.#options.typeahead : (i: T) => i.textContent ?? ""
      const handled = this.#typeahead.isTypeaheadKey(event)
      const match = this.#typeahead.match(event, items, current, getText, (i) => !this.#canFocus(i))
      if (handled) event.preventDefault()
      if (match && match !== current) this.#move(match, event, false)
      return
    } else {
      return
    }
    event.preventDefault()
    if (target && target !== current) this.#move(target, event, true)
  }

  #move(target: T, event: Event, fromArrow: boolean): void {
    this.setActive(target, { focus: true })
    const activate = typeof this.#options.activateOnFocus === "function" ? this.#options.activateOnFocus() : this.#options.activateOnFocus
    if (activate && fromArrow && !this.#isDisabled(target)) this.#options.onActivate?.(target, event)
  }
}
