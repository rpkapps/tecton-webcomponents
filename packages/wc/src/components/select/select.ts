import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { ChevronDown, Search } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { resolveIdRefs } from "../../internal/aria.js"
import { FormControlMixin, requiredValidator, type FormValue, type Validator } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { ListNavigationController } from "../../internal/list-navigation.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupSide } from "../../internal/popup.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { Typeahead } from "../../internal/typeahead.js"
import { localeOf } from "../../internal/locale.js"
import { cloneItemContent, filterConverter, observeCollection, syncCollection, type CollectionFilter, type CollectionTags } from "../../internal/listbox-core.js"
import type { TecSelectItem } from "./select-item.js"
import { selectStyles } from "./select.styles.js"

export type { CollectionFilter, FilterFunction, FilterMode } from "../../internal/listbox-core.js"
export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** Trigger surface. */
export type SelectVariant = "outline" | "filled" | "text"
/** Trigger height: `sm` 28px, `default` 32px. */
export type SelectSize = "default" | "sm"
/** What the trigger shows for the chosen option. */
export type SelectValueDisplay = "content" | "text" | "value"

/** Why the popup opened or closed. */
export type SelectOpenChangeReason = "trigger" | "keyboard" | "select" | PopupCloseReason

/** Detail of `tec-open-change`. */
export interface SelectOpenChangeDetail {
  open: boolean
  reason: SelectOpenChangeReason
}

const TAGS: CollectionTags = {
  item: "tec-select-item",
  group: "tec-select-group",
  separator: "tec-select-separator",
  empty: "tec-select-empty",
}

type Highlight = "first" | "last" | "selected" | "none"

/**
 * A button that shows the chosen option and opens a listbox of `tec-select-item`s (optionally in
 * `tec-select-group`s with `tec-select-label`s, divided by `tec-select-separator`s).
 *
 * The trigger is a native `<button aria-haspopup="listbox">` named by the chosen value and the
 * field label (`<label for>`, `aria-labelledby` or `aria-label` on the element). While open, focus
 * is on the listbox (or on the search field of a `searchable` select) and the highlighted option is
 * its `aria-activedescendant`.
 *
 * Form-associated: submits `name=value` (or one entry per value with `multiple`); `required` blocks
 * submission while nothing is selected; form reset returns to the `value` attribute (or to the
 * items marked `selected`).
 *
 * @summary Displays a list of options for the user to pick from — triggered by a button.
 *
 * @tag tec-select
 *
 * @slot - The `tec-select-item`, `tec-select-group`, `tec-select-separator` and `tec-select-empty` elements.
 *
 * @csspart trigger - The trigger `<button>` (border, background, focus ring).
 * @csspart value - The chosen value (or the placeholder) inside the trigger.
 * @csspart chevron - The chevron icon.
 * @csspart content - The popup surface (top layer).
 * @csspart search - The search field of a `searchable` select.
 * @csspart search-input - The search `<input>`.
 * @csspart list - The `listbox` that scrolls the options.
 *
 * @cssprop --tec-select-radius - Corner radius of the trigger (default `--tec-radius-md`).
 * @cssprop --tec-select-content-width - Width of the popup (default: the trigger width; minimum 9rem).
 *
 * @cssstate open - The popup is open.
 * @cssstate placeholder - Nothing is selected.
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, or a failed constraint after interaction/submit).
 *
 * @fires input - The selection changed by user interaction.
 * @fires change - The selection changed by user interaction.
 * @fires tec-open-change - The user opened or closed the popup. Cancelable. `detail: { open, reason }`.
 */
export class TecSelect extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".content"), selectStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Text shown in the trigger while nothing is selected. */
  @property() placeholder = "Select an item"

  /** Trigger surface: `outline` (bordered), `filled` (muted background, bottom border) or `text` (bottom border only). */
  @property({ reflect: true }) variant: SelectVariant = "outline"

  /** Trigger height. */
  @property({ reflect: true }) size: SelectSize = "default"

  /** Allows several values (`values`); the popup stays open while choosing. */
  @property({ type: Boolean, reflect: true }) multiple = false

  /** Whether the popup is open. */
  @property({ type: Boolean, reflect: true }) open = false

  /**
   * What the trigger shows for the chosen option: `content` (a copy of the option's content, icons
   * included), `text` (its text or `label`), or `value` (its `value`, e.g. a currency symbol `$`
   * for an option reading "$ US Dollar"). With `multiple`, the texts or values are listed.
   */
  @property({ attribute: "value-display" }) valueDisplay: SelectValueDisplay = "content"

  /** Adds a search field at the top of the popup that filters the options. */
  @property({ type: Boolean, reflect: true }) searchable = false

  /** Accessible name of the search field. */
  @property({ attribute: "search-label" }) searchLabel = "Search"

  /** Placeholder of the search field. */
  @property({ attribute: "search-placeholder" }) searchPlaceholder = ""

  /**
   * How the search field filters: `contains` (default), `starts-with`, `fuzzy`, `none`, or (as a
   * property) a function `(text, query, item) => boolean`. Matching ignores case and accents.
   */
  @property({ converter: filterConverter }) filter: CollectionFilter = "contains"

  /** Side of the trigger to place the popup on (flips when there is no room). */
  @property() side: PopupSide = "bottom"

  /** Alignment of the popup against the trigger. */
  @property() align: PopupAlign = "start"

  /** Distance from the trigger in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  @state() private _query = ""

  @query(".trigger") private _button!: HTMLButtonElement
  @query(".value") private _valueEl!: HTMLElement
  @query(".content") private _content!: HTMLElement
  @query(".list") private _list!: HTMLElement
  @query(".search input") private _search?: HTMLInputElement
  @query(".aria-label") private _ariaLabelEl!: HTMLElement

  #values: string[] | undefined
  #typeahead = new Typeahead()
  #observer?: MutationObserver
  #pendingHighlight: Highlight | null = null

  #nav = new ListNavigationController<TecSelectItem>(this, {
    items: () => this.#visibleItems(),
    focusTarget: () => (this.searchable ? (this._search ?? null) : (this._list ?? null)),
    keyTarget: null,
    typeahead: (item) => item.textValue,
    loop: false,
  })

  #popup = new PopupController(this, {
    popup: () => this._content,
    trigger: () => this._button,
    haspopup: "listbox",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset }),
    focus: { initial: () => (this.searchable ? this._search : this._list), restore: true },
    dismiss: { escape: true, outsidePress: true, focusOut: true },
    onRequestClose: (reason) => this.#requestOpen(false, reason),
  })

  constructor() {
    super()
    this.addEventListener("click", this.#onHostClick)
  }

  /** Every `tec-select-item`, in document order. */
  get items(): TecSelectItem[] {
    return [...this.querySelectorAll<TecSelectItem>(TAGS.item)]
  }

  /** The selected values (one at most without `multiple`). Setting it replaces the selection. */
  @property({ attribute: false })
  get values(): string[] {
    if (!this.multiple) return this.value ? [this.value] : []
    return this.#values ?? this.items.filter((i) => i.defaultSelected).map((i) => i.key)
  }
  set values(values: string[]) {
    const list = [...(values ?? [])].map(String)
    if (this.multiple) this.#values = list
    else this.value = list[0] ?? ""
  }

  /** The selected items, in document order. */
  get selectedItems(): TecSelectItem[] {
    const values = this.values
    return this.items.filter((i) => values.includes(i.key))
  }

  /** Opens the popup (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the popup (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the popup (no event). */
  toggle(): void {
    this.open = !this.open
  }

  // ---------------------------------------------------------------- form
  /** The trigger: receives the host's delegated ARIA, `aria-invalid` and the validation anchor. */
  protected override get formControl(): HTMLElement | null {
    return this._button ?? null
  }

  /** The trigger is named "<value> <label>" by `#syncAria()`. */
  protected override get ariaDelegationExclude(): readonly string[] {
    return ["aria-label", "aria-labelledby"]
  }

  protected override get validators(): Validator<TecSelect>[] {
    return [requiredValidator<TecSelect>((el) => el.values.length === 0, "select")]
  }

  protected override formValue(): FormValue {
    if (!this.multiple) return this.value
    if (!this.name) return null
    const data = new FormData()
    for (const v of this.values) data.append(this.name, v)
    return data
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#values = undefined
    this.requestUpdate("values")
  }

  protected override formRestoreState(state: FormValue): void {
    if (state instanceof FormData) this.values = state.getAll(this.name).map(String)
    else if (typeof state === "string") this.value = state
  }

  // ---------------------------------------------------------------- lifecycle
  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer ??= observeCollection(this, () => this.requestUpdate())
    this.#observer.observe(this, { attributes: true, attributeFilter: ["aria-label", "aria-labelledby"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#observer = undefined
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("open") && !this.open) this._query = ""
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const values = new Set(this.values)
    for (const item of this.items) item.selected = values.has(item.key)
    syncCollection(this, TAGS, this.searchable ? this._query : "", this.filter)
    this.#nav.update()
    this.#syncAria()
    this.toggleState("open", this.open)
    this.toggleState("placeholder", values.size === 0)
    if (changed.has("open")) {
      void this.#popup.setOpen(this.open)
      if (!this.open) this.#nav.clear()
    } else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset"))) void this.#popup.reposition()
    if (this.open && this.#pendingHighlight) {
      this.#highlight(this.#pendingHighlight)
      this.#pendingHighlight = null
    }
  }

  #syncAria(): void {
    const button = this._button
    if (!button) return
    let labels: Element[]
    const labelledby = this.getAttribute("aria-labelledby")
    if (labelledby) labels = resolveIdRefs(this, labelledby)
    else if (this.hasAttribute("aria-label")) labels = [this._ariaLabelEl]
    else labels = [...this.internals.labels] as Element[]
    // Like React Aria: the trigger reads "<value> <label>".
    button.ariaLabelledByElements = [this._valueEl, ...labels]
    const list = this._list
    list.ariaLabelledByElements = labels.length ? labels : null
    list.ariaLabel = labels.length ? null : this.placeholder
    button.ariaControlsElements = [list]
    if (this._search) this._search.ariaControlsElements = [list]
  }

  #visibleItems(): TecSelectItem[] {
    return this.items.filter((i) => !i.filtered)
  }

  #highlight(mode: Highlight): void {
    const selected = this.selectedItems.find((i) => !i.disabled && !i.filtered)
    if (mode === "none") return
    if (mode === "selected" || selected) {
      if (selected) this.#nav.setActive(selected)
      else if (mode !== "selected") mode === "last" ? this.#nav.last() : this.#nav.first()
      return
    }
    if (mode === "last") this.#nav.last()
    else this.#nav.first()
  }

  #requestOpen(open: boolean, reason: SelectOpenChangeReason, highlight: Highlight = "none"): boolean {
    if (open === this.open) return true
    if (open && this.isDisabled) return false
    if (!this.emit<SelectOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return false
    this.open = open
    if (open) this.#pendingHighlight = highlight
    return true
  }

  #emitChange(): void {
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  #choose(item: TecSelectItem): void {
    if (item.disabled) return
    const key = item.key
    if (this.multiple) {
      const values = this.values
      this.values = values.includes(key) ? values.filter((v) => v !== key) : [...values, key]
      this.requestUpdate()
      this.#nav.setActive(item)
      this.#emitChange()
      return
    }
    const changed = key !== this.value
    this.value = key
    this.#requestOpen(false, "select")
    this._button?.focus({ preventScroll: true })
    if (changed) this.#emitChange()
  }

  // ---------------------------------------------------------------- events
  /** Clicks from `<label for>` land on the host: focus the trigger (like React Aria, without opening). */
  #onHostClick = (event: MouseEvent) => {
    if (event.composedPath()[0] !== this || this.isDisabled) return
    this._button?.focus()
  }

  #onTriggerClick(event: MouseEvent) {
    if (this.isDisabled) return
    // detail 0 = keyboard activation (Enter / Space): highlight like the arrow keys do.
    if (this.open) this.#requestOpen(false, "trigger")
    else this.#requestOpen(true, event.detail === 0 ? "keyboard" : "trigger", event.detail === 0 ? "first" : "selected")
  }

  #onTriggerKeyDown(event: KeyboardEvent) {
    if (this.isDisabled || event.defaultPrevented) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!this.open) this.#requestOpen(true, "keyboard", event.key === "ArrowDown" ? "first" : "last")
      return
    }
    if (!this.open && !this.multiple && this.#typeahead.isTypeaheadKey(event)) {
      event.preventDefault()
      const items = this.items.filter((i) => !i.disabled)
      const match = this.#typeahead.match(event, items, this.selectedItems[0] ?? null, (i) => i.textValue)
      if (match && match.key !== this.value) {
        this.value = match.key
        this.#emitChange()
      }
    }
  }

  #onListKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      const active = this.#nav.activeItem
      if (active) this.#choose(active)
      return
    }
    if (event.key === "Tab") return
    this.#nav.handleKeyDown(event)
  }

  #onSearchKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
      case "PageDown":
      case "PageUp":
        if ((event.key === "Home" || event.key === "End") && event.shiftKey) return
        this.#nav.handleKeyDown(event)
        event.preventDefault()
        return
      case "Enter": {
        event.preventDefault()
        const active = this.#nav.activeItem
        if (active) this.#choose(active)
        return
      }
      case "Escape":
        if (this._query) {
          event.preventDefault()
          event.stopPropagation()
          this._query = ""
          this.#nav.clear()
        }
        return
    }
  }

  async #onSearchInput(event: Event) {
    event.stopPropagation()
    this._query = (event.target as HTMLInputElement).value
    // Like React Aria's Autocomplete: typing filters; the arrow keys move into the results.
    await this.updateComplete
    this.#nav.update()
  }

  #onListClick(event: MouseEvent) {
    const item = event.composedPath().find((t): t is TecSelectItem => (t as Element).localName === TAGS.item)
    if (item && this.contains(item)) this.#choose(item)
  }

  #onListPointerDown(event: PointerEvent) {
    // Keep focus in the search field (virtual focus) when an option is pressed.
    if (this.searchable) event.preventDefault()
  }

  protected override render() {
    const selected = this.selectedItems
    let value: unknown
    const shown = (i: TecSelectItem) => (this.valueDisplay === "value" ? i.key : i.textValue)
    if (!selected.length) value = this.placeholder
    else if (!this.multiple) value = this.valueDisplay === "content" ? cloneItemContent(selected[0]!) : shown(selected[0]!)
    else value = new Intl.ListFormat(localeOf(this), { type: "conjunction" }).format(selected.map(shown))
    return html`<button
        class="trigger"
        part="trigger"
        type="button"
        ?disabled=${this.isDisabled}
        @click=${this.#onTriggerClick}
        @keydown=${this.#onTriggerKeyDown}
      >
        <span class="value" part="value" ?data-placeholder=${!selected.length}>${value}</span>
        ${icon(ChevronDown, { size: 16, class: "chevron", part: "chevron" })}
      </button>
      <span class="aria-label" hidden>${this.getAttribute("aria-label") ?? ""}</span>
      <div class="content" part="content" popover="manual">
        ${this.searchable
          ? html`<div class="search-wrapper">
              <div class="search" part="search">
                <input
                  part="search-input"
                  type="search"
                  aria-label=${this.searchLabel}
                  placeholder=${this.searchPlaceholder || nothing}
                  aria-autocomplete="list"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck="false"
                  enterkeyhint="go"
                  .value=${live(this._query)}
                  @input=${this.#onSearchInput}
                  @keydown=${this.#onSearchKeyDown}
                />
                ${icon(Search, { size: 16 })}
              </div>
            </div>`
          : nothing}
        <div
          class="list"
          part="list"
          role="listbox"
          tabindex="-1"
          aria-multiselectable=${this.multiple ? "true" : nothing}
          @keydown=${this.#onListKeyDown}
          @click=${this.#onListClick}
          @pointerdown=${this.#onListPointerDown}
        >
          <slot @slotchange=${() => this.requestUpdate()}></slot>
        </div>
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-select": TecSelect
  }
}
