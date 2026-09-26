import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { Check, ChevronDown, Search, SearchX } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { icon } from "../../internal/icons.js"
import { ListNavigationController } from "../../internal/list-navigation.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupSide } from "../../internal/popup.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  appFinderGroupStyles,
  appFinderIconStyles,
  appFinderItemStyles,
  appFinderStyles,
  appFinderTriggerStyles,
  type APP_FINDER_TONES,
} from "./app-finder.styles.js"

/** Colour of an application tile (a Tecton palette family, or `neutral`). */
export type AppFinderTone = (typeof APP_FINDER_TONES)[number]

/** Why the open state changed. */
export type AppFinderOpenChangeReason = "trigger" | "select" | PopupCloseReason

/** Detail of `tec-open-change`. */
export interface AppFinderOpenChangeDetail {
  open: boolean
  reason: AppFinderOpenChangeReason
}

/** Detail of `tec-select`. */
export interface AppFinderSelectDetail {
  /** The chosen item's `value`. */
  value: string
}

/** Lower-cases and strips diacritics, so the filter is case- and accent-insensitive. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase()
}

/** Wraps the first occurrence of `query` in `text` in a `<mark>` (case- and accent-insensitive). */
function highlight(text: string, query: string) {
  const needle = fold(query.trim())
  if (!needle) return text
  // Folding may change lengths (ß, ligatures); only highlight when positions map one to one.
  const haystack = fold(text)
  if (haystack.length !== text.length) return text
  const index = haystack.indexOf(needle)
  if (index < 0) return text
  return html`${text.slice(0, index)}<mark>${text.slice(index, index + needle.length)}</mark>${text.slice(index + needle.length)}`
}

/**
 * @summary The tinted code tile of an application (used by the trigger, the items, and on its own in a launcher grid).
 *
 * @tag tec-app-finder-icon
 *
 * @slot - The short code (`DWP`) or a glyph (`<svg>` / `tec-icon`, 16px).
 *
 * @csspart base - The tile.
 */
export class TecAppFinderIcon extends TectonElement {
  static styles = [hostStyles, appFinderIconStyles]

  /** Colour of the tile; use the app's category tone. */
  @property({ reflect: true }) tone: AppFinderTone = "neutral"

  /** `default` (28px, items) or `sm` (24px, the trigger). */
  @property({ reflect: true }) size: "default" | "sm" = "default"

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

/**
 * A ghost button showing the current application: its code tile, its name (from the `sm`
 * breakpoint up) and a chevron. Its accessible name is "Switch application, current: <name>" unless
 * `aria-label` is set. Put it in `slot="trigger"` of a `tec-app-finder`.
 *
 * @summary The application switcher's trigger in the shell header.
 *
 * @tag tec-app-finder-trigger
 *
 * @slot - The short code (or a glyph) of the current app, shown in the tile.
 *
 * @csspart base - The native `<button>`.
 * @csspart icon - The code tile (`tec-app-finder-icon`).
 * @csspart name - The app name.
 */
export class TecAppFinderTrigger extends TectonElement {
  static styles = [hostStyles, appFinderTriggerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Name of the current app; shown next to the tile on wider screens and used in the accessible name. */
  @property({ reflect: true }) name = ""

  /** Colour of the tile; use the app's category tone. */
  @property({ reflect: true }) tone: AppFinderTone = "neutral"

  /** Disables the trigger. */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".base") readonly control!: HTMLButtonElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: ["aria-label"] })
    new MutationObserver(() => this.requestUpdate()).observe(this, { attributes: true, attributeFilter: ["aria-label"] })
  }

  override click(): void {
    this.control?.click()
  }

  protected override render() {
    const label = this.getAttribute("aria-label") || (this.name ? `Switch application, current: ${this.name}` : null)
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled} aria-label=${label ?? nothing}>
      <tec-app-finder-icon part="icon" tone=${this.tone} size="sm"><slot></slot></tec-app-finder-icon>
      ${this.name ? html`<span class="name" part="name">${this.name}</span>` : nothing}
      ${icon(ChevronDown, { class: "chevron", size: 14 })}
    </button>`
  }
}

/**
 * A group (`role="group"`, named by its heading) of `tec-app-finder-item`s. A hairline separates it
 * from the group above. It is left out while no item of it matches the search, and — with
 * `hide-while-searching` — while any search is typed.
 *
 * @summary A category of applications in the app finder.
 *
 * @tag tec-app-finder-group
 *
 * @slot - `tec-app-finder-item` elements.
 *
 * @csspart base - The group box.
 * @csspart heading - The category label.
 *
 * @cssstate hidden - The group is left out of the results.
 * @cssstate first - The group is the first one shown.
 */
export class TecAppFinderGroup extends TectonElement {
  static styles = [hostStyles, appFinderGroupStyles]

  /** Category label. */
  @property() heading = ""

  /** Leave the group out while a search is typed ("Recent", "Favourites"), so apps don't show twice. */
  @property({ type: Boolean, attribute: "hide-while-searching" }) hideWhileSearching = false

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "group"
    this.internals.ariaLabel = this.heading || null
  }

  /** @internal */
  setResultState(hidden: boolean, first: boolean): void {
    this.toggleState("hidden", hidden)
    this.toggleState("first", first)
  }

  protected override render() {
    return html`<div class="base" part="base">
      ${this.heading ? html`<div class="heading" part="heading" aria-hidden="true">${this.heading}</div>` : nothing}
      <slot></slot>
    </div>`
  }
}

/**
 * A `menuitem` of the app finder. The search matches its `name` and `keywords` (case- and
 * accent-insensitive) and highlights the match in the name and the code. Choosing it (click, or
 * Enter while it is highlighted) fires `tec-select` with its `value` and closes the finder.
 *
 * @summary One application in the app finder.
 *
 * @tag tec-app-finder-item
 *
 * @slot icon - A glyph for the tile instead of the `icon` code.
 *
 * @csspart base - The row.
 * @csspart icon - The code tile.
 * @csspart name - The app name.
 * @csspart description - The secondary line.
 * @csspart current - The "Current" marker.
 *
 * @fires tec-select - The user chose the item. Bubbles. Cancelable: `preventDefault()` keeps the finder open. `detail: { value }`.
 */
export class TecAppFinderItem extends TectonElement {
  static styles = [hostStyles, appFinderItemStyles]

  /** Unique id of the app (across groups), reported by `tec-select`. */
  @property({ reflect: true }) value = ""

  /** Display name; also matched by the search. */
  @property() name = ""

  /** Secondary line (plain text). */
  @property() description = ""

  /** Short code shown in the tile (`DWP`); matched by the search only if also in `keywords`. */
  @property() icon = ""

  /** Colour of the tile; use the app's category tone. */
  @property({ reflect: true }) tone: AppFinderTone = "neutral"

  /** Extra words the search matches, space- or comma-separated (short code, category, aliases). */
  @property() keywords = ""

  /** Marks the app the shell is showing ("Current" and a check). */
  @property({ type: Boolean, reflect: true }) current = false

  /** Disables the item (skipped by the keyboard, not selectable). */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Whether the item is the keyboard-highlighted one (set by the finder). */
  @property({ type: Boolean, reflect: true }) highlighted = false

  /** The search text, for highlighting (set by the finder). @internal */
  @state() query = ""

  #hasIconSlot = false

  /** The text the search runs on. */
  get searchText(): string {
    return [this.name, ...this.keywords.split(/[\s,]+/)].filter(Boolean).join(" ")
  }

  /** Whether the item matches `query`. */
  matchesQuery(query: string): boolean {
    const q = fold(query.trim())
    return !q || fold(this.searchText).includes(q)
  }

  /** @internal */
  setFiltered(filtered: boolean): void {
    this.toggleState("filtered", filtered)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#hasIconSlot = !!this.querySelector(":scope > [slot='icon']")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "menuitem"
    this.internals.ariaDisabled = this.disabled ? "true" : null
  }

  protected override render() {
    const showTile = !!this.icon || this.#hasIconSlot
    return html`<div class="base" part="base">
      ${showTile
        ? html`<tec-app-finder-icon part="icon" tone=${this.tone}
            ><slot
              name="icon"
              @slotchange=${(e: Event) => {
                this.#hasIconSlot = (e.target as HTMLSlotElement).assignedNodes().length > 0
                this.requestUpdate()
              }}
              >${highlight(this.icon, this.query)}</slot
            ></tec-app-finder-icon
          >`
        : html`<slot name="icon" hidden @slotchange=${() => ((this.#hasIconSlot = true), this.requestUpdate())}></slot>`}
      <span class="text">
        <span class="name" part="name">${highlight(this.name, this.query)}</span>
        ${this.description ? html`<span class="description" part="description">${this.description}</span>` : nothing}
      </span>
      ${this.current ? html`<span class="current" part="current">Current${icon(Check, { class: "check", size: 16 })}</span>` : nothing}
    </div>`
  }
}

/**
 * The trigger (`slot="trigger"`, usually a `tec-app-finder-trigger`) opens a non-modal dialog
 * anchored below it, with a search field and a grouped list of applications. Focus stays in the
 * search field: typing filters every group at once and highlights the first match, the arrow keys
 * move through the results (`aria-activedescendant`), Enter chooses, and Escape clears the search
 * or closes the finder. The search is reset each time the finder opens.
 *
 * @summary The shell's application switcher: a searchable, category-grouped list of applications.
 *
 * @tag tec-app-finder
 *
 * @slot trigger - The button that opens the finder (`tec-app-finder-trigger`). It gets `aria-haspopup="dialog"` and `aria-expanded`.
 * @slot - `tec-app-finder-group` elements (or items directly).
 *
 * @csspart content - The floating panel (top layer).
 * @csspart input - The search field.
 * @csspart list - The scrolling list (`role="menu"`).
 * @csspart empty - The empty state.
 *
 * @cssprop --tec-app-finder-width - Width of the panel (default 26rem).
 * @cssprop --tec-app-finder-list-height - Maximum height of the list (default `min(24rem, 60vh)`).
 *
 * @fires tec-open-change - The user opened or closed the finder. Cancelable. `detail: { open, reason }` (`reason`: `trigger`, `select`, `escape`, `outside`).
 * @fires tec-select - An item was chosen (fired by the item, bubbles). `detail: { value }`.
 */
export class TecAppFinder extends TectonElement {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".content"), appFinderStyles]

  /** Whether the finder is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Accessible name of the dialog. */
  @property() label = "Applications"

  /** Placeholder (and accessible name) of the search field. */
  @property() placeholder = "Search applications…"

  /** Shown when the search matches nothing. */
  @property({ attribute: "empty-message" }) emptyMessage = "No applications match"

  /** Second line of the empty state (empty: none). */
  @property({ attribute: "empty-hint" }) emptyHint = "Try the app's short code or its category"

  /** Side of the trigger to place the panel on. */
  @property() side: PopupSide = "bottom"

  /** Alignment against the trigger. */
  @property() align: PopupAlign = "start"

  /** Distance from the trigger in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 6

  /** The current search text (reset on open). */
  @state() query = ""

  @state() private empty = false

  @query(".content") private panel!: HTMLElement
  @query(".input") private input!: HTMLInputElement
  @query(".list") private list!: HTMLElement

  #popup = new PopupController(this, {
    popup: () => this.panel,
    trigger: () => this.trigger,
    haspopup: "dialog",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset }),
    focus: { initial: () => this.input, trap: true, restore: true },
    onRequestClose: (reason) => this.#requestOpen(false, reason),
  })

  #nav = new ListNavigationController<TecAppFinderItem>(this, {
    items: () => this.#visibleItems(),
    focusTarget: () => this.input,
    keyTarget: () => this.input,
    homeEnd: false,
    loop: false,
  })

  constructor() {
    super()
    this.addEventListener("click", this.#onItemClick)
  }

  /** The element in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  /** Every item of the finder, in document order. */
  get items(): TecAppFinderItem[] {
    return [...this.querySelectorAll<TecAppFinderItem>("tec-app-finder-item")].filter((i) => i.closest("tec-app-finder") === this)
  }

  /** Opens the finder (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the finder (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the finder (no event). */
  toggle(): void {
    this.open = !this.open
  }

  #groups(): TecAppFinderGroup[] {
    return [...this.querySelectorAll<TecAppFinderGroup>("tec-app-finder-group")].filter((g) => g.closest("tec-app-finder") === this)
  }

  #visibleItems(): TecAppFinderItem[] {
    const searching = !!this.query.trim()
    return this.items.filter((item) => {
      const group = item.closest("tec-app-finder-group")
      if (searching && group?.hideWhileSearching) return false
      return item.matchesQuery(this.query)
    })
  }

  #requestOpen(open: boolean, reason: AppFinderOpenChangeReason): void {
    if (open === this.open) return
    if (this.emit<AppFinderOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) this.open = open
  }

  #onTriggerClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    const trigger = this.trigger as (HTMLElement & { disabled?: boolean }) | null
    if (!trigger || trigger.disabled) return
    this.#requestOpen(!this.open, "trigger")
  }

  /** Applies the search: filters items and groups, highlights the first match. */
  #filter(): void {
    const searching = !!this.query.trim()
    const visible = new Set(this.#visibleItems())
    for (const item of this.items) {
      item.query = this.query
      item.setFiltered(!visible.has(item))
    }
    let first = true
    for (const group of this.#groups()) {
      const shown = !(searching && group.hideWhileSearching) && group.querySelector("tec-app-finder-item") !== null && [...visible].some((i) => group.contains(i))
      group.setResultState(!shown, shown && first)
      if (shown) first = false
    }
    this.empty = visible.size === 0
    if (searching) this.#nav.first()
    else this.#nav.clear()
  }

  #onInput = (event: Event) => {
    this.query = (event.target as HTMLInputElement).value
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return
    if (event.key === "Enter") {
      const item = this.#nav.activeItem
      if (item) {
        event.preventDefault()
        this.#choose(item)
      }
    } else if (event.key === "Escape" && this.query) {
      // Escape clears the search first (like a search field); the next one closes.
      event.preventDefault()
      this.query = ""
    }
  }

  #onItemClick = (event: MouseEvent) => {
    const item = event.composedPath().find((t): t is TecAppFinderItem => t instanceof TecAppFinderItem)
    if (!item || item.closest("tec-app-finder") !== this || item.disabled) return
    this.#choose(item)
  }

  #choose(item: TecAppFinderItem): void {
    const allowed = item.dispatchEvent(
      new CustomEvent<AppFinderSelectDetail>("tec-select", { detail: { value: item.value }, bubbles: true, composed: true, cancelable: true }),
    )
    if (allowed) this.#requestOpen(false, "select")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("open") && this.open) this.query = ""
    if (changed.has("query") || changed.has("open")) this.#filter()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("open")) {
      if (!this.open) this.#nav.clear()
      void this.#popup.setOpen(this.open)
    } else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset"))) void this.#popup.reposition()
  }

  protected override render() {
    return html`<slot name="trigger" @click=${this.#onTriggerClick} @slotchange=${() => this.requestUpdate()}></slot>
      <div class="content" part="content" popover="manual" role="dialog" tabindex="-1" aria-label=${this.label}>
        <div class="search">
          <div class="field">
            ${icon(Search, { class: "search-icon", size: 16 })}
            <input
              class="input"
              part="input"
              type="search"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              aria-autocomplete="list"
              aria-controls="list"
              aria-label=${this.placeholder}
              placeholder=${this.placeholder}
              .value=${live(this.query)}
              @input=${this.#onInput}
              @keydown=${this.#onKeyDown}
            />
          </div>
        </div>
        <div class="list" id="list" part="list" role="menu" aria-label="Suggestions" ?hidden=${this.empty}>
          <slot @slotchange=${() => this.#filter()}></slot>
        </div>
        ${this.empty
          ? html`<div class="empty" part="empty" role="status">
              ${icon(SearchX, { class: "empty-icon", size: 20 })}
              <span class="empty-message">${this.emptyMessage}</span>
              ${this.emptyHint ? html`<span class="empty-hint">${this.emptyHint}</span>` : nothing}
            </div>`
          : nothing}
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-app-finder": TecAppFinder
    "tec-app-finder-trigger": TecAppFinderTrigger
    "tec-app-finder-group": TecAppFinderGroup
    "tec-app-finder-item": TecAppFinderItem
    "tec-app-finder-icon": TecAppFinderIcon
  }
}
