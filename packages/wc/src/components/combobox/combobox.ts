import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { ChevronDown, X } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { resolveIdRefs } from "../../internal/aria.js"
import { horizontalStep } from "../../internal/direction.js"
import { containsFlat } from "../../internal/focus.js"
import { FormControlMixin, requiredValidator, type FormValue, type Validator } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { ListNavigationController } from "../../internal/list-navigation.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupSide } from "../../internal/popup.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { filterConverter, observeCollection, syncCollection, type CollectionFilter, type CollectionTags } from "../select/listbox-core.js"
import type { TecComboboxItem } from "./combobox-item.js"
import { comboboxStyles } from "./combobox.styles.js"

export type { CollectionFilter, FilterFunction, FilterMode } from "../select/listbox-core.js"
export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** When the popup opens: while typing (default), on focus, or only from the arrow keys / button. */
export type ComboboxMenuTrigger = "input" | "focus" | "manual"

/** Why the popup opened or closed. */
export type ComboboxOpenChangeReason = "input" | "focus" | "trigger" | "keyboard" | "select" | "clear" | PopupCloseReason

/** Detail of `tec-open-change`. */
export interface ComboboxOpenChangeDetail {
  open: boolean
  reason: ComboboxOpenChangeReason
}

/** Detail of `tec-input-change`. */
export interface ComboboxInputChangeDetail {
  inputValue: string
}

const TAGS: CollectionTags = {
  item: "tec-combobox-item",
  group: "tec-combobox-group",
  separator: "tec-combobox-separator",
  empty: "tec-combobox-empty",
}

type Highlight = "first" | "last" | "none"

/**
 * An editable input (`role="combobox"`) that filters a popup `listbox` of `tec-combobox-item`s as
 * the user types. DOM focus stays in the input; the highlighted option is its
 * `aria-activedescendant`. Choosing an option puts its text in the input; with `multiple`, chosen
 * options become removable chips in front of the input.
 *
 * Name it with `<label for>`, `aria-labelledby` or `aria-label` on the element.
 *
 * Form-associated: submits `name=value` (the chosen item's `value`, or the typed text with
 * `allow-custom-value`), or one entry per value with `multiple`; `required` blocks submission while
 * nothing is chosen; form reset returns to the `value` attribute.
 *
 * @summary Autocomplete input with a filterable list of suggestions.
 *
 * @tag tec-combobox
 *
 * @slot - The `tec-combobox-item`, `tec-combobox-group`, `tec-combobox-separator` and `tec-combobox-empty` elements.
 * @slot start - An addon before the input (an icon).
 * @slot end - An addon after the input and its buttons.
 *
 * @csspart base - The input group box (border, focus ring); holds the chips with `multiple`.
 * @csspart input - The `<input role="combobox">`.
 * @csspart trigger - The chevron button that toggles the list.
 * @csspart clear - The clear button (`show-clear`).
 * @csspart chip - A chip of a chosen value (`multiple`).
 * @csspart chip-remove - The remove button of a chip.
 * @csspart content - The popup surface (top layer).
 * @csspart list - The `listbox` that scrolls the options.
 *
 * @cssprop --tec-combobox-radius - Corner radius of the field (default `--tec-radius-md`).
 * @cssprop --tec-combobox-content-width - Width of the popup (default: the field width; minimum 9rem).
 *
 * @cssstate open - The popup is open.
 * @cssstate empty - No option matches the typed text.
 * @cssstate has-chips - At least one chip is shown (`multiple`).
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, or a failed constraint after interaction/submit).
 *
 * @fires input - The value changed by user interaction.
 * @fires change - The value changed by user interaction.
 * @fires tec-input-change - The user edited the text. `detail: { inputValue }`.
 * @fires tec-open-change - The user opened or closed the popup. Cancelable. `detail: { open, reason }`.
 */
export class TecCombobox extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".content"), comboboxStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Placeholder of the input. */
  @property() placeholder = ""

  /** Allows several values (`values`), shown as removable chips. */
  @property({ type: Boolean, reflect: true }) multiple = false

  /** Whether the popup is open. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Keeps typed text that matches no option as the value (instead of reverting to the chosen option). */
  @property({ type: Boolean, attribute: "allow-custom-value" }) allowCustomValue = false

  /** Shows a clear button while the input has text (it replaces the chevron). */
  @property({ type: Boolean, attribute: "show-clear" }) showClear = false

  /** Hides the chevron button. */
  @property({ type: Boolean, attribute: "hide-trigger" }) hideTrigger = false

  /** When the popup opens: `input` (while typing), `focus` (also when the input is focused) or `manual` (arrow keys and button only). */
  @property({ attribute: "menu-trigger" }) menuTrigger: ComboboxMenuTrigger = "input"

  /**
   * How typing filters the options: `contains` (default), `starts-with`, `fuzzy`, `none`, or (as a
   * property) a function `(text, query, item) => boolean`. Matching ignores case and accents.
   */
  @property({ converter: filterConverter }) filter: CollectionFilter = "contains"

  /** Side of the field to place the popup on (flips when there is no room). */
  @property() side: PopupSide = "bottom"

  /** Alignment of the popup against the field. */
  @property() align: PopupAlign = "start"

  /** Distance from the field in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 6

  /** Shift along the field edge in px. */
  @property({ type: Number, attribute: "align-offset" }) alignOffset = 0

  /** Accessible name of the chevron button. */
  @property({ attribute: "trigger-label" }) triggerLabel = "Show suggestions"

  /** Accessible name of the clear button. */
  @property({ attribute: "clear-label" }) clearLabel = "Clear"

  /** Accessible name prefix of a chip's remove button ("Remove Apple"). */
  @property({ attribute: "remove-label" }) removeLabel = "Remove"

  /** Accessible name of the listbox when the combobox has no label. */
  @property({ attribute: "list-label" }) listLabel = "Suggestions"

  /** The text in the input. */
  @property({ attribute: false }) inputValue = ""

  @state() private _showAll = false

  @query("input") private _input!: HTMLInputElement
  @query(".field") private _field!: HTMLElement
  @query(".content") private _content!: HTMLElement
  @query(".list") private _list!: HTMLElement

  #values: string[] | undefined
  #syncedFor: string | undefined
  #observer?: MutationObserver
  #pendingHighlight: Highlight | null = null
  #visible: TecComboboxItem[] = []

  #nav = new ListNavigationController<TecComboboxItem>(this, {
    items: () => this.#visible.filter((i) => this.contains(i)),
    focusTarget: () => this._input ?? null,
    keyTarget: null,
    homeEnd: false,
    loop: false,
  })

  #popup = new PopupController(this, {
    popup: () => this._content,
    trigger: () => this._input,
    anchor: () => this._field,
    haspopup: "listbox",
    placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset, alignOffset: this.alignOffset }),
    focus: { initial: "none", restore: false },
    dismiss: { escape: true, outsidePress: true, focusOut: false },
    onRequestClose: (reason) => this.#close(reason),
  })

  #slots = new HasSlotController(this, "start", "end", { states: true })

  constructor() {
    super()
    this.addEventListener("click", this.#onHostClick)
    this.addEventListener("focusout", this.#onFocusOut)
  }

  /** Every `tec-combobox-item`, in document order. */
  get items(): TecComboboxItem[] {
    return [...this.querySelectorAll<TecComboboxItem>(TAGS.item)]
  }

  /** The chosen values (one at most without `multiple`). Setting it replaces the selection. */
  @property({ attribute: false })
  get values(): string[] {
    if (!this.multiple) return this.value ? [this.value] : []
    return this.#values ?? (this.defaultValue ? [this.defaultValue] : [])
  }
  set values(values: string[]) {
    const list = [...(values ?? [])].map(String)
    if (this.multiple) this.#values = list
    else this.value = list[0] ?? ""
  }

  /** The chosen items, in the order of `values`. */
  get selectedItems(): TecComboboxItem[] {
    const items = this.items
    return this.values.map((v) => items.find((i) => i.key === v)).filter((i): i is TecComboboxItem => !!i)
  }

  /** Opens the popup (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the popup (no event). */
  hide(): void {
    this.open = false
  }

  /** Selects the input text. */
  select(): void {
    this._input?.select()
  }

  // ---------------------------------------------------------------- form
  protected override get formControl(): HTMLElement | null {
    return this._input ?? null
  }

  protected override get validators(): Validator<TecCombobox>[] {
    return [requiredValidator<TecCombobox>((el) => el.values.length === 0, "select")]
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
    this.#syncedFor = undefined
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
    // Show the chosen option's text in the input whenever the value changes by other means than typing.
    if (!this.multiple && this.value !== this.#syncedFor) {
      const item = this.items.find((i) => i.key === this.value)
      if (!this.value) {
        this.inputValue = ""
        this.#syncedFor = ""
      } else if (item && typeof item.textValue === "string") {
        this.inputValue = item.textValue
        this.#syncedFor = this.value
      } else if (this.allowCustomValue) {
        this.inputValue = this.value
        this.#syncedFor = this.value
      }
    }
    if (changed.has("open") && !this.open) this._showAll = false
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const values = new Set(this.values)
    for (const item of this.items) item.selected = values.has(item.key)
    const { visible } = syncCollection<TecComboboxItem>(this, TAGS, this._showAll ? "" : this.inputValue, this.filter)
    this.#visible = visible
    this.#nav.update()
    this.#syncAria()
    this.toggleState("open", this.open)
    this.toggleState("empty", visible.length === 0)
    this.toggleState("has-chips", this.multiple && this.selectedItems.length > 0)
    this.toggleState("has-end-addon", this.#hasEndButtons())
    if (changed.has("open")) {
      void this.#popup.setOpen(this.open)
      if (!this.open) this.#nav.clear()
    } else if (this.open && ["side", "align", "sideOffset", "alignOffset", "values", "value"].some((p) => changed.has(p))) void this.#popup.reposition()
    // Nothing to show and no empty message: close.
    if (this.open && visible.length === 0 && !this.querySelector(TAGS.empty)) this.#requestOpen(false, "input")
    if (this.open && this.#pendingHighlight) {
      const highlight = this.#pendingHighlight
      this.#pendingHighlight = null
      this.#highlight(highlight)
    }
  }

  #syncAria(): void {
    const input = this._input
    const list = this._list
    if (!input || !list) return
    input.ariaControlsElements = [list]
    if (this.required) input.setAttribute("aria-required", "true")
    else input.removeAttribute("aria-required")
    let labels: Element[] = []
    const labelledby = this.getAttribute("aria-labelledby")
    if (labelledby) labels = resolveIdRefs(this, labelledby)
    else if (!this.hasAttribute("aria-label")) labels = [...this.internals.labels] as Element[]
    list.ariaLabelledByElements = labels.length ? labels : null
    list.ariaLabel = labels.length ? null : (this.getAttribute("aria-label") ?? this.listLabel)
  }

  #hasEndButtons(): boolean {
    if (this.multiple) return this.#clearVisible()
    return this.#clearVisible() || !this.hideTrigger
  }

  #clearVisible(): boolean {
    return this.showClear && (this.inputValue !== "" || (this.multiple && this.values.length > 0))
  }

  #highlight(mode: Highlight): void {
    if (mode === "none") return
    const selected = this.selectedItems.find((i) => !i.disabled && !i.filtered && this.#visible.includes(i))
    if (selected) this.#nav.setActive(selected)
    else if (mode === "last") this.#nav.last()
    else this.#nav.first()
  }

  #requestOpen(open: boolean, reason: ComboboxOpenChangeReason, highlight: Highlight = "none", showAll = false): boolean {
    if (open === this.open) {
      if (open && highlight !== "none") this.#highlight(highlight)
      return true
    }
    if (open && (this.isDisabled || !this.isConnected)) return false
    if (!this.emit<ComboboxOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return false
    this.open = open
    if (open) {
      this._showAll = showAll
      this.#pendingHighlight = highlight
    }
    return true
  }

  #emitChange(): void {
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  #setInputValue(text: string, emit: boolean): void {
    if (text === this.inputValue) return
    this.inputValue = text
    if (emit) this.emit<ComboboxInputChangeDetail>("tec-input-change", { detail: { inputValue: text } })
  }

  /** Resolves the typed text when the popup closes or focus leaves (React Aria's commit). */
  #commit(): void {
    if (this.multiple) {
      this.#setInputValue("", true)
      return
    }
    const text = this.inputValue
    const selected = this.items.find((i) => i.key === this.value)
    if (text === "") {
      if (this.value) {
        this.value = ""
        this.#syncedFor = ""
        this.#emitChange()
      }
      return
    }
    if (selected && text === selected.textValue) return
    if (this.allowCustomValue) {
      if (text !== this.value) {
        this.value = text
        this.#syncedFor = text
        this.#emitChange()
      }
      return
    }
    this.#setInputValue(selected ? selected.textValue : "", true)
  }

  #close(reason: ComboboxOpenChangeReason): void {
    this.#commit()
    this.#requestOpen(false, reason)
  }

  #choose(item: TecComboboxItem): void {
    if (item.disabled) return
    const key = item.key
    if (this.multiple) {
      const values = this.values
      this.values = values.includes(key) ? values.filter((v) => v !== key) : [...values, key]
      this.#setInputValue("", true)
      this._showAll = false
      this.#emitChange()
      void this.updateComplete.then(() => {
        if (this.#visible.includes(item)) this.#nav.setActive(item, { scroll: false })
      })
      return
    }
    const changed = key !== this.value
    this.value = key
    this.#syncedFor = key
    this.#setInputValue(item.textValue, true)
    this.#requestOpen(false, "select")
    if (changed) this.#emitChange()
  }

  #remove(key: string, focusAfter?: "next" | "input"): void {
    const values = this.values
    const index = values.indexOf(key)
    if (index < 0 || this.isDisabled) return
    this.values = values.filter((v) => v !== key)
    this.#emitChange()
    void this.updateComplete.then(() => {
      if (!focusAfter) return
      const buttons = this.#chipButtons()
      const next = focusAfter === "next" ? (buttons[index] ?? buttons[index - 1]) : undefined
      ;(next ?? this._input)?.focus()
    })
  }

  #clear(): void {
    const had = this.values.length > 0 || (!this.multiple && !!this.value)
    if (this.multiple) this.values = []
    else {
      this.value = ""
      this.#syncedFor = ""
    }
    this.#setInputValue("", true)
    this._input?.focus()
    if (had) this.#emitChange()
  }

  #chipButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>(".chip-remove")]
  }

  // ---------------------------------------------------------------- events
  #onHostClick = (event: MouseEvent) => {
    // Clicks from <label for> (or host.click()) land on the host: focus the input.
    if (event.composedPath()[0] !== this || this.isDisabled) return
    this._input?.focus()
  }

  #onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next && (next === this || containsFlat(this, next) || this.renderRoot.contains(next))) return
    // Focus left the combobox: commit the typed text and close.
    queueMicrotask(() => {
      if (this.matches(":focus-within")) return
      if (this.open) this.#close("focus-out")
      else this.#commit()
    })
  }

  #onFieldPointerDown(event: PointerEvent) {
    // Presses on the field padding, chips or addons keep focus in the input.
    const target = event.composedPath()[0] as Element
    if (target === this._input || this.isDisabled) return
    event.preventDefault()
    if (!target.closest?.(".icon-button")) this._input?.focus()
  }

  #onInput(event: Event) {
    event.stopPropagation()
    const text = (event.target as HTMLInputElement).value
    this.#setInputValue(text, true)
    this._showAll = false
    if (!this.multiple && text === "" && this.value) {
      this.value = ""
      this.#syncedFor = ""
      this.#emitChange()
    }
    if (!this.open && this.menuTrigger !== "manual") this.#requestOpen(true, "input")
  }

  #onInputFocus() {
    if (this.menuTrigger === "focus" && !this.open) this.#requestOpen(true, "focus", "none", true)
  }

  #onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || this.isDisabled) return
    const input = this._input
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault()
        const down = event.key === "ArrowDown"
        if (event.altKey) {
          if (down && !this.open) this.#requestOpen(true, "keyboard", "none", true)
          else if (!down && this.open) this.#close("keyboard")
          return
        }
        if (!this.open) this.#requestOpen(true, "keyboard", down ? "first" : "last", true)
        else if (!this.#nav.activeItem) down ? this.#nav.first() : this.#nav.last()
        else this.#nav.handleKeyDown(event)
        return
      }
      case "PageDown":
      case "PageUp":
        if (this.open) {
          this.#nav.handleKeyDown(event)
          event.preventDefault()
        }
        return
      case "Enter": {
        if (!this.open) return
        event.preventDefault()
        const active = this.#nav.activeItem
        if (active) this.#choose(active)
        else this.#close("keyboard")
        return
      }
      case "Escape": {
        if (this.open) {
          event.preventDefault()
          event.stopPropagation()
          this.#close("escape")
          return
        }
        if (this.inputValue || this.values.length) {
          event.preventDefault()
          event.stopPropagation()
          this.#clear()
        }
        return
      }
      case "Backspace":
        if (this.multiple && input.value === "" && this.values.length) {
          event.preventDefault()
          this.#remove(this.values[this.values.length - 1]!)
        }
        return
      case "ArrowLeft":
      case "ArrowRight": {
        const backward = horizontalStep(event.key, this) === -1
        if (this.multiple && backward && input.selectionStart === 0 && input.selectionEnd === 0) {
          const buttons = this.#chipButtons()
          const last = buttons[buttons.length - 1]
          if (last) {
            event.preventDefault()
            last.focus()
          }
        }
        return
      }
    }
  }

  #onChipKeyDown(event: KeyboardEvent, key: string) {
    const buttons = this.#chipButtons()
    const index = buttons.indexOf(event.currentTarget as HTMLButtonElement)
    const step = horizontalStep(event.key, this)
    if (step) {
      event.preventDefault()
      const next = buttons[index + step]
      if (next) next.focus()
      else if (step > 0) this._input?.focus()
      return
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault()
      this.#remove(key, "next")
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault()
      this._input?.focus()
      if (event.key === "Tab") event.preventDefault()
    }
  }

  #onTriggerClick() {
    if (this.isDisabled) return
    this._input?.focus()
    if (this.open) this.#close("trigger")
    else this.#requestOpen(true, "trigger", "none", true)
  }

  #onListClick(event: MouseEvent) {
    const item = event.composedPath().find((t): t is TecComboboxItem => (t as Element).localName === TAGS.item)
    if (item && this.contains(item)) this.#choose(item)
  }

  protected override render() {
    const disabled = this.isDisabled
    const clear = this.#clearVisible()
    const chips = this.multiple ? this.selectedItems : []
    return html`<div class="field" part="base" @pointerdown=${this.#onFieldPointerDown}>
        <span class="start" ?hidden=${!this.#slots.test("start")}><slot name="start"></slot></span>
        ${this.multiple
          ? html`<span class="chips" role="list" ?hidden=${!chips.length}>
              ${chips.map(
                (item) =>
                  html`<span class="chip" part="chip" role="listitem"
                    >${item.textValue}<button
                      class="icon-button chip-remove"
                      part="chip-remove"
                      type="button"
                      tabindex="-1"
                      aria-label="${this.removeLabel} ${item.textValue}"
                      ?disabled=${disabled}
                      @click=${() => this.#remove(item.key, "input")}
                      @keydown=${(e: KeyboardEvent) => this.#onChipKeyDown(e, item.key)}
                    >
                      ${icon(X, { size: 16 })}
                    </button></span
                  >`
              )}
            </span>`
          : nothing}
        <input
          part="input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          placeholder=${this.placeholder || nothing}
          ?disabled=${disabled}
          .value=${live(this.inputValue)}
          @input=${this.#onInput}
          @focus=${this.#onInputFocus}
          @keydown=${this.#onKeyDown}
          @change=${(e: Event) => e.stopPropagation()}
        />
        ${this.#hasEndButtons()
          ? html`<span class="end">
              ${clear
                ? html`<button
                    class="icon-button clear"
                    part="clear"
                    type="button"
                    tabindex="-1"
                    aria-label=${this.clearLabel}
                    ?disabled=${disabled}
                    @click=${this.#clear}
                  >
                    ${icon(X, { size: 16 })}
                  </button>`
                : !this.hideTrigger && !this.multiple
                  ? html`<button
                      class="icon-button trigger"
                      part="trigger"
                      type="button"
                      tabindex="-1"
                      aria-label=${this.triggerLabel}
                      aria-hidden="true"
                      aria-expanded=${String(this.open)}
                      ?disabled=${disabled}
                      @click=${this.#onTriggerClick}
                    >
                      ${icon(ChevronDown, { size: 16 })}
                    </button>`
                  : nothing}
            </span>`
          : nothing}
        <slot name="end"></slot>
      </div>
      <div class="content" part="content" popover="manual" @pointerdown=${(e: PointerEvent) => e.preventDefault()}>
        <div class="list" part="list" role="listbox" aria-multiselectable=${this.multiple ? "true" : nothing} @click=${this.#onListClick}>
          <slot @slotchange=${() => this.requestUpdate()}></slot>
        </div>
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-combobox": TecCombobox
  }
}
