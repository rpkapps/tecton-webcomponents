/**
 * @module typeahead
 * Type-to-select for collections (menus, listboxes, trees, radio/toggle groups), matching React
 * Aria's `useTypeSelect`: printable keys accumulate into a search string that resets after a pause;
 * the first item whose text starts with it (locale-aware, case/accent-insensitive) matches. Typing
 * the same letter repeatedly cycles through the items starting with that letter.
 *
 * `RovingFocusController` and `ListNavigationController` accept `typeahead: true`; use `Typeahead`
 * directly for custom key handling:
 *
 * ```ts
 * #typeahead = new Typeahead()
 * onKeyDown(e: KeyboardEvent) {
 *   const match = this.#typeahead.match(e, this.items, this.active, (item) => item.textContent ?? "")
 *   if (match) { e.preventDefault(); this.setActive(match) }
 * }
 * ```
 */

/** Options of {@link Typeahead}. */
export interface TypeaheadOptions {
  /** Pause (ms) after which the search string resets. Default 1000 (React Aria). */
  timeout?: number
  /** Locale for comparison. Default: the document's `lang` or the browser locale. */
  locale?: string
}

export class Typeahead {
  #search = ""
  #timer: ReturnType<typeof setTimeout> | undefined
  readonly #timeout: number
  readonly #collator: Intl.Collator

  constructor(options: TypeaheadOptions = {}) {
    this.#timeout = options.timeout ?? 1000
    const locale = options.locale ?? (document.documentElement.lang || undefined)
    this.#collator = new Intl.Collator(locale, { usage: "search", sensitivity: "base" })
  }

  /** The current search string. */
  get search(): string {
    return this.#search
  }

  /** Forgets the search string. */
  reset(): void {
    this.#search = ""
    clearTimeout(this.#timer)
  }

  /**
   * Whether `event` is a typeahead key: a single printable character without Ctrl/Meta/Alt; Space
   * only while a search is in progress (otherwise Space keeps its select/activate meaning).
   */
  isTypeaheadKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return false
    return event.key !== " " || this.#search.trim().length > 0
  }

  /**
   * Feeds `event` into the search and returns the matching item (skipping `isDisabled` ones), or
   * `null` when the key is not a typeahead key or nothing matches. The caller should
   * `preventDefault()` whenever {@link isTypeaheadKey} was true.
   */
  match<T>(
    event: KeyboardEvent,
    items: readonly T[],
    current: T | null | undefined,
    getText: (item: T) => string,
    isDisabled: (item: T) => boolean = () => false
  ): T | null {
    if (!this.isTypeaheadKey(event)) return null
    this.#search += event.key
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => (this.#search = ""), this.#timeout)

    const search = this.#search
    const repeated = [...search].every((c) => c === search[0])
    const needle = repeated ? search[0]! : search
    const start = current != null ? items.indexOf(current) : -1
    // A repeated letter moves on past the current item; a longer string may still match the current one.
    const from = repeated ? start + 1 : Math.max(start, 0)
    for (let i = 0; i < items.length; i++) {
      const index = (from + i) % items.length
      const item = items[index]!
      if (isDisabled(item)) continue
      const text = getText(item).trim()
      if (this.#collator.compare(text.slice(0, needle.length), needle) === 0) return item
    }
    return null
  }
}
