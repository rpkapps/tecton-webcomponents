import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { ListNavigationController } from "../../internal/list-navigation.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { filterConverter, observeCollection, syncCollection, type CollectionFilter, type CollectionTags } from "../../internal/listbox-core.js"
import type { TecCommandInput } from "./command-input.js"
import type { TecCommandItem, TecCommandList } from "./command-parts.js"

export type { CollectionFilter, FilterFunction, FilterMode } from "../../internal/listbox-core.js"

/** Detail of `tec-select`. */
export interface CommandSelectDetail {
  value: string
  /** The item's checked state after activation (lists with a `selection-mode`). */
  checked?: boolean
}

const TAGS: CollectionTags = {
  item: "tec-command-item",
  group: "tec-command-group",
  separator: "tec-command-separator",
  empty: "tec-command-empty",
}

/**
 * A search-as-you-type command palette: a `tec-command-input` filters the `tec-command-item`s of a
 * `tec-command-list` (groups without a match and separators hide while searching;
 * `tec-command-empty` shows when nothing matches). Focus stays in the input; ArrowUp/ArrowDown,
 * Home/End and PageUp/PageDown move a virtual highlight (`aria-activedescendant`) and Enter
 * activates it, firing `tec-select` on the item.
 *
 * Put it in a `tec-command-dialog` for a ⌘K-style palette.
 *
 * @summary Command menu for search and quick actions.
 *
 * @tag tec-command
 *
 * @slot - A `tec-command-input` and a `tec-command-list`.
 *
 * @csspart base - The palette surface (background, radius, padding).
 *
 * @cssprop --tec-command-radius - Corner radius (default `--tec-radius-xl`).
 *
 * @cssstate empty - No item matches the search.
 *
 * @fires tec-select - Fired on the activated `tec-command-item` (bubbles, cancelable). `detail: { value, checked? }`.
 */
export class TecCommand extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-width: 0;
        border-radius: var(--tec-command-radius, var(--tec-radius-xl));
        overflow: hidden;
        font-family: var(--tec-font-sans);
        font-size: var(--tec-text-sm);
        line-height: var(--tec-text-sm--line-height);
        color: var(--tec-popover-foreground);
      }
      .base {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--tec-command-radius, var(--tec-radius-xl));
        background-color: var(--tec-popover);
        padding: 0.25rem;
      }
    `,
  ]

  /**
   * How the search filters: `contains` (default), `starts-with`, `fuzzy` (characters in order), `none`,
   * or (as a property) a function `(text, query, item) => boolean`. Matching ignores case and accents
   * and covers each item's text and `keywords`.
   */
  @property({ converter: filterConverter }) filter: CollectionFilter = "contains"

  /** The search text (mirrors the `tec-command-input`). */
  @property({ attribute: false }) search = ""

  #observer?: MutationObserver
  #visible: TecCommandItem[] = []

  #nav = new ListNavigationController<TecCommandItem>(this, {
    items: () => this.#visible,
    focusTarget: () => this.inputElement?.input ?? null,
    keyTarget: null,
    homeEnd: true,
    loop: false,
  })

  constructor() {
    super()
    this.addEventListener("input", this.#onInput)
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("click", this.#onClick)
    this.addEventListener("pointerdown", this.#onPointerDown)
  }

  /** The `tec-command-input` of this palette. */
  get inputElement(): TecCommandInput | null {
    return this.querySelector("tec-command-input")
  }

  /** The `tec-command-list` of this palette. */
  get listElement(): TecCommandList | null {
    return this.querySelector("tec-command-list")
  }

  /** Every `tec-command-item`, in document order. */
  get items(): TecCommandItem[] {
    return [...this.querySelectorAll<TecCommandItem>(TAGS.item)]
  }

  /** The highlighted item. */
  get activeItem(): TecCommandItem | null {
    return this.#nav.activeItem
  }

  /** Clears the search and the highlight. */
  reset(): void {
    this.search = ""
    this.#nav.clear()
  }

  /** Focuses the search field. */
  override focus(options?: FocusOptions): void {
    this.inputElement?.focus(options)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer ??= observeCollection(this, () => this.requestUpdate())
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#observer = undefined
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const { visible } = syncCollection<TecCommandItem>(this, TAGS, this.search, this.filter)
    this.#visible = visible
    this.#nav.update()
    this.toggleState("empty", visible.length === 0)
    const input = this.inputElement
    if (input) {
      if (input.value !== this.search) input.value = this.search
      void input.updateComplete.then(() => {
        const list = this.listElement
        if (input.input) input.input.ariaControlsElements = list ? [list] : null
      })
    }
  }

  /** Activates `item` as Enter or a click does: checks it (list `selection-mode`) and fires `tec-select`. */
  activate(item: TecCommandItem): void {
    if (item.disabled || !this.contains(item)) return
    const list = item.closest("tec-command-list")
    const mode = list?.selectionMode ?? "none"
    if (mode === "single") {
      for (const other of list!.querySelectorAll<TecCommandItem>(TAGS.item)) if (other !== item) other.checked = false
      item.checked = true
    } else if (mode === "multiple") item.checked = !item.checked
    item.dispatchEvent(
      new CustomEvent<CommandSelectDetail>("tec-select", { detail: mode === "none" ? { value: item.key } : { value: item.key, checked: item.checked }, bubbles: true, composed: true, cancelable: true })
    )
  }

  #fromInput(event: Event): boolean {
    const input = this.inputElement
    return !!input && event.composedPath().includes(input)
  }

  #onInput = async (event: Event) => {
    const input = this.inputElement
    if (!input || !this.#fromInput(event)) return
    this.search = input.input?.value ?? input.value
    // Like React Aria's Autocomplete around a menu: typing highlights the first match, so Enter runs it;
    // clearing the search clears the highlight.
    await this.updateComplete
    if (this.search) this.#nav.first()
    else this.#nav.clear()
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || !this.#fromInput(event)) return
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
      case "PageDown":
      case "PageUp":
        if ((event.key === "Home" || event.key === "End") && event.shiftKey) return
        if (!this.#nav.activeItem && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault()
          if (event.key === "ArrowDown") this.#nav.first()
          else this.#nav.last()
          return
        }
        this.#nav.handleKeyDown(event)
        return
      case "Enter": {
        const active = this.#nav.activeItem
        if (!active) return
        event.preventDefault()
        this.activate(active)
        return
      }
      case "Escape":
        // Like a search field: Escape clears the text first; with no text it closes the dialog.
        if (this.search) {
          event.preventDefault()
          event.stopPropagation()
          this.reset()
        }
        return
    }
  }

  #itemFrom(event: Event): TecCommandItem | undefined {
    return event.composedPath().find((t): t is TecCommandItem => (t as Element).localName === TAGS.item)
  }

  #onPointerDown = (event: PointerEvent) => {
    // Keep focus in the search field when an item is pressed.
    if (this.#itemFrom(event)) event.preventDefault()
  }

  #onClick = (event: MouseEvent) => {
    const item = this.#itemFrom(event)
    if (item) this.activate(item)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-command": TecCommand
  }
}
