/**
 * @module listbox-core
 * The collection engine shared by `tec-select`, `tec-combobox` and `tec-command`: light-DOM items,
 * groups, labels, separators and an empty state, with filtering, selection and highlight state
 * kept on the items as custom states. The owners (select, combobox, command) decide the pattern:
 *
 * - `tec-select` — a button trigger and a `listbox` popup; the listbox (or the search field of a
 *   searchable select) keeps DOM focus and points `aria-activedescendant` at the highlighted option;
 * - `tec-combobox` — an editable `combobox` input with `aria-activedescendant` into a `listbox` popup;
 * - `tec-command` — a search field with `aria-activedescendant` into an always-visible `menu`.
 *
 * Items are never focused: navigation is virtual (`ListNavigationController`), so the item hosts
 * carry semantics through `ElementInternals` (`role="option"` / `"menuitem"`, `aria-selected`,
 * `aria-disabled`) and styles through custom states (`:state(selected)`, `:state(highlighted)`,
 * `:state(filtered)`).
 */
import { css, html, nothing, type CSSResultGroup, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { Check } from "lucide"
import { icon } from "./icons.js"
import { hostStyles, slottedIconStyles } from "./styles.js"
import { TectonElement } from "./tecton-element.js"

// ---------------------------------------------------------------------------------------- filter

/** Built-in filters: substring, prefix, in-order characters (fuzzy), or no filtering. */
export type FilterMode = "contains" | "starts-with" | "fuzzy" | "none"

/** A custom filter: return `true` to keep `item` for the typed `query`. */
export type FilterFunction = (text: string, query: string, item: HTMLElement) => boolean

/** A built-in filter name or a custom filter function. */
export type CollectionFilter = FilterMode | FilterFunction

/** Case-, accent- and width-insensitive form of `value` (Intl "base" sensitivity). */
export function foldText(value: string, locale?: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase(locale)
}

/**
 * Whether `text` matches `query` with `filter`. An empty query matches everything. The built-in
 * filters ignore case and accents; `fuzzy` matches the query's characters in order
 * (`"stg"` matches `"Settings"`).
 */
export function matchesFilter(text: string, query: string, filter: CollectionFilter = "contains", item?: HTMLElement, locale?: string): boolean {
  if (!query) return true
  if (typeof filter === "function") return filter(text, query, item as HTMLElement)
  if (filter === "none") return true
  const t = foldText(text, locale)
  const q = foldText(query, locale)
  if (filter === "starts-with") return t.startsWith(q)
  if (filter === "fuzzy") {
    let i = 0
    for (const char of q.replace(/\s+/g, "")) {
      i = t.indexOf(char, i)
      if (i < 0) return false
      i += 1
    }
    return true
  }
  return t.includes(q)
}

/** Converts the `filter` attribute: a mode name; anything else is kept (functions are set as properties). */
export const filterConverter = {
  fromAttribute: (value: string | null): CollectionFilter => (value === "starts-with" || value === "fuzzy" || value === "none" ? value : "contains"),
}

// ---------------------------------------------------------------------------------------- text

const SKIP_TEXT = "svg, [aria-hidden='true'], [data-text-ignore], tec-command-shortcut, style, script, template"

/** The visible text of an item's light DOM, without icons, shortcuts and `[data-text-ignore]` parts. */
export function itemText(root: Element): string {
  let out = ""
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? ""
      else if (child.nodeType === Node.ELEMENT_NODE && !(child as Element).matches(SKIP_TEXT)) {
        const el = child as Element
        const block = isBlockLike(el)
        if (block) out += " "
        walk(el)
        if (block) out += " "
      }
    }
  }
  walk(root)
  return out.replace(/\s+/g, " ").trim()
}

function isBlockLike(el: Element): boolean {
  // Block-level children (a title and a description) must not run their words together.
  return el.localName === "div" || el.localName === "p" || el.localName === "br"
}

/** Clones the light-DOM content of `item` (icons and text) for display elsewhere (a select trigger). */
export function cloneItemContent(item: Element): Node[] {
  const nodes: Node[] = []
  for (const child of item.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) continue
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).matches("tec-command-shortcut, [data-text-ignore]")) continue
    const clone = child.cloneNode(true)
    if (clone instanceof Element) {
      clone.removeAttribute("id")
      for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id")
    }
    nodes.push(clone)
  }
  return nodes
}

// ---------------------------------------------------------------------------------------- styles

const itemBaseStyles = css`
  :host {
    display: block;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    --tec-icon-size: 1rem;
  }
  :host(:state(filtered)) {
    display: none !important;
  }
  :host([disabled]) {
    pointer-events: none;
  }
  .base {
    position: relative;
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.5rem;
    border-radius: var(--tec-radius-sm);
    padding-block: 0.375rem;
    padding-inline: 0.5rem 2rem;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  :host([disabled]) .base {
    opacity: 0.5;
  }
  :host(:state(highlighted)) .base {
    background-color: var(--tec-accent);
    color: var(--tec-accent-foreground);
  }
  .indicator {
    position: absolute;
    inset-inline-end: 0.5rem;
    display: flex;
    width: 1rem;
    height: 1rem;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .indicator svg {
    width: 1rem;
    height: 1rem;
  }
  @media (forced-colors: active) {
    :host(:state(highlighted)) .base {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
    }
  }
`

// ---------------------------------------------------------------------------------------- item

/**
 * Base class of a collection item (`tec-select-item`, `tec-combobox-item`, `tec-command-item`).
 * Owners set `selected`, `highlighted` and `filtered`; the item reflects them as custom states and
 * ARIA (`aria-selected`), and draws the check indicator.
 */
export class ListItemBase extends TectonElement {
  static styles: CSSResultGroup = [hostStyles, slottedIconStyles, itemBaseStyles]

  /** The ARIA role of the item host. */
  protected itemRole: "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" = "option"

  /** The value (key) of the item. Defaults to its text. */
  @property({ reflect: true }) value = ""

  /** Disables the item: skipped by the keyboard, cannot be chosen. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /**
   * The item's text for filtering, typeahead and display in the trigger/input — needed when the
   * content is richer than plain text (it defaults to the text content).
   */
  @property() label = ""

  #selected = false
  #highlighted = false
  #filtered = false

  /** Whether the item is selected (set by the owning select/combobox). */
  get selected(): boolean {
    return this.#selected
  }
  set selected(value: boolean) {
    if (this.#selected === !!value) return
    this.#selected = !!value
    this.toggleState("selected", this.#selected)
    this.requestUpdate()
  }

  /** Whether the item is the active descendant (keyboard/pointer highlight). */
  get highlighted(): boolean {
    return this.#highlighted
  }
  set highlighted(value: boolean) {
    if (this.#highlighted === !!value) return
    this.#highlighted = !!value
    this.toggleState("highlighted", this.#highlighted)
  }

  /** Whether the current filter hides the item. */
  get filtered(): boolean {
    return this.#filtered
  }
  set filtered(value: boolean) {
    if (this.#filtered === !!value) return
    this.#filtered = !!value
    this.toggleState("filtered", this.#filtered)
  }

  /** The text used for typeahead, filtering and display (`label`, else the text content). */
  get textValue(): string {
    return this.label || itemText(this)
  }

  /** The text matched by the filter (the text value; command items add their keywords). */
  get searchText(): string {
    return this.textValue
  }

  /** The item's key: `value`, else its text. */
  get key(): string {
    return this.value || this.textValue
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = this.itemRole
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = this.itemRole
    this.internals.ariaDisabled = this.disabled ? "true" : null
    if (this.itemRole === "option") this.internals.ariaSelected = String(this.#selected)
    this.toggleState("disabled", this.disabled)
  }

  /** The check mark drawn next to selected items. */
  protected renderIndicator() {
    return html`<span class="indicator" part="indicator">${this.#selected ? icon(Check, { size: 16 }) : nothing}</span>`
  }

  protected override render() {
    return html`<div class="base" part="base"><slot name="start"></slot><slot></slot>${this.renderIndicator()}</div>`
  }
}

// ---------------------------------------------------------------------------------------- group

const groupStyles = css`
  :host {
    display: block;
  }
  :host(:state(filtered)) {
    display: none !important;
  }
  .label {
    padding: 0.375rem 0.5rem;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
    user-select: none;
    -webkit-user-select: none;
  }
`

/**
 * Base class of a group of items (`role="group"`), named by its `label` attribute or by a label
 * element child. Hidden while the filter hides all of its items.
 */
export class ListGroupBase extends TectonElement {
  static styles: CSSResultGroup = [hostStyles, groupStyles]

  /** The label element tag of this family (e.g. `tec-select-label`). */
  protected labelTag = ""

  /** The group heading. Alternatively put a label element as the first child. */
  @property() label = ""

  #filtered = false

  /** Whether the filter hides every item of the group. */
  get filtered(): boolean {
    return this.#filtered
  }
  set filtered(value: boolean) {
    if (this.#filtered === !!value) return
    this.#filtered = !!value
    this.toggleState("filtered", this.#filtered)
  }

  protected get headingText(): string {
    return this.label
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.internals.role = "group"
    const labelEl = this.labelTag ? [...this.children].find((c) => c.localName === this.labelTag) : undefined
    if (this.headingText) {
      this.internals.ariaLabelledByElements = null
      this.internals.ariaLabel = this.headingText
    } else {
      this.internals.ariaLabel = null
      this.internals.ariaLabelledByElements = labelEl ? [labelEl] : null
    }
  }

  protected override render() {
    return html`<div class="base" part="base">
      ${this.headingText ? html`<div class="label" part="label" aria-hidden="true">${this.headingText}</div>` : nothing}<slot
        @slotchange=${() => this.requestUpdate()}
      ></slot>
    </div>`
  }
}

/** Base class of a group label element (the heading of a group). */
export class ListLabelBase extends TectonElement {
  static styles: CSSResultGroup = [
    hostStyles,
    css`
      :host {
        display: block;
      }
      .base {
        padding: 0.375rem 0.5rem;
        font-size: var(--tec-text-xs);
        line-height: var(--tec-text-xs--line-height);
        color: var(--tec-muted-foreground);
        user-select: none;
        -webkit-user-select: none;
      }
    `,
  ]

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

// ---------------------------------------------------------------------------------------- separator

/** Base class of a separator between items or groups; hidden while a filter query is active. */
export class ListSeparatorBase extends TectonElement {
  static styles: CSSResultGroup = [
    hostStyles,
    css`
      :host {
        display: block;
      }
      :host(:state(filtered)) {
        display: none !important;
      }
      .base {
        height: 1px;
        margin: 0.25rem -0.25rem;
        background-color: var(--tec-border);
        pointer-events: none;
      }
      @media (forced-colors: active) {
        .base {
          background-color: CanvasText;
        }
      }
    `,
  ]

  #filtered = false

  /** Whether the separator is hidden by an active filter. */
  get filtered(): boolean {
    return this.#filtered
  }
  set filtered(value: boolean) {
    if (this.#filtered === !!value) return
    this.#filtered = !!value
    this.toggleState("filtered", this.#filtered)
  }

  /**
   * `separator` inside menus; decorative (`none`) inside listboxes, whose only allowed children are
   * options and groups.
   */
  protected separatorRole: "separator" | "none" = "none"

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = this.separatorRole
  }

  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

// ---------------------------------------------------------------------------------------- empty

/** Base class of the empty state, shown by its owner when no item is visible. */
export class ListEmptyBase extends TectonElement {
  static styles: CSSResultGroup = [
    hostStyles,
    css`
      :host {
        display: none;
      }
      :host(:state(shown)) {
        display: block;
      }
      .base {
        display: flex;
        width: 100%;
        justify-content: center;
        padding-block: 0.5rem;
        text-align: center;
        font-size: var(--tec-text-sm);
        line-height: var(--tec-text-sm--line-height);
        color: var(--tec-muted-foreground);
      }
    `,
  ]

  #shown = false

  /** Whether the empty state is displayed (set by the owner). */
  get shown(): boolean {
    return this.#shown
  }
  set shown(value: boolean) {
    if (this.#shown === !!value) return
    this.#shown = !!value
    this.toggleState("shown", this.#shown)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

// ---------------------------------------------------------------------------------------- collection

/** Tag names of one family's collection parts. */
export interface CollectionTags {
  item: string
  group: string
  separator: string
  empty: string
}

/** Result of {@link syncCollection}. */
export interface CollectionState<T extends ListItemBase = ListItemBase> {
  /** Every item, in document order. */
  items: T[]
  /** The items the filter keeps, in document order. */
  visible: T[]
}

/**
 * Applies `query` with `filter` to the items under `root`: filtered items, groups without a visible
 * item and (while a query is active) separators are hidden; empty-state elements are shown when
 * nothing is visible.
 */
export function syncCollection<T extends ListItemBase>(
  root: ParentNode,
  tags: CollectionTags,
  query: string,
  filter: CollectionFilter,
  locale?: string
): CollectionState<T> {
  const items = [...root.querySelectorAll<T>(tags.item)]
  const visible: T[] = []
  for (const item of items) {
    const keep = matchesFilter(item.searchText, query, filter, item, locale)
    item.filtered = !keep
    if (keep) visible.push(item)
  }
  for (const group of root.querySelectorAll<ListGroupBase>(tags.group)) {
    const own = [...group.querySelectorAll<T>(tags.item)]
    group.filtered = own.length > 0 && own.every((i) => i.filtered)
  }
  for (const separator of root.querySelectorAll<ListSeparatorBase>(tags.separator)) separator.filtered = query !== ""
  for (const empty of root.querySelectorAll<ListEmptyBase>(tags.empty)) empty.shown = visible.length === 0
  return { items, visible }
}

/** Observes `root`'s light DOM (items added/removed/renamed) and calls `onChange`. */
export function observeCollection(root: Element, onChange: () => void): MutationObserver {
  const observer = new MutationObserver(onChange)
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["value", "disabled", "label", "selected", "keywords", "heading"],
  })
  return observer
}
