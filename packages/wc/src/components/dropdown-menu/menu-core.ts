/**
 * The menu core shared by `tec-dropdown-menu` and `tec-context-menu` (WAI-ARIA APG menu pattern, with
 * the behaviour of React Aria's `Menu`, `MenuTrigger` and `SubmenuTrigger`).
 *
 * Every family defines thin subclasses of these bases under its own tag names; nothing here
 * registers an element.
 *
 * - **Surfaces** ({@link MenuSurfaceElement}) own a `role="menu"` element in their shadow root with a
 *   default slot: the root menu ({@link MenuRootElement}) and each submenu content
 *   ({@link MenuSubContentElement}). An item belongs to the closest surface above it.
 * - **Items** ({@link MenuItemElement}) are the focusable hosts (`menuitem`, `menuitemcheckbox`,
 *   `menuitemradio` through ElementInternals). A group ({@link MenuGroupElement}) with
 *   `selection-mode` turns its items into checkboxes or radios.
 * - **Submenus**: {@link MenuSubElement} pairs a {@link MenuSubTriggerElement} with a
 *   {@link MenuSubContentElement} positioned by `PopupController`, opened by hover (200 ms), click,
 *   Enter/Space or the inline-end arrow, with React Aria's "safe triangle" so the pointer can travel
 *   diagonally to the submenu.
 */
import { html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit"
import { property } from "lit/decorators.js"
import { Check, ChevronRight } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { setAriaElements } from "../../internal/aria.js"
import { horizontalStep } from "../../internal/direction.js"
import { deepActiveElement } from "../../internal/focus.js"
import { icon } from "../../internal/icons.js"
import { PopupController, popupStyles, type PopupAlign, type PopupCloseReason, type PopupOptions, type PopupSide } from "../../internal/popup.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { Typeahead } from "../../internal/typeahead.js"
import {
  menuGroupStyles,
  menuItemStyles,
  menuLabelStyles,
  menuRootStyles,
  menuSeparatorStyles,
  menuShortcutStyles,
  menuSubContentStyles,
  menuSubStyles,
} from "./menu.styles.js"

export type { PopupAlign, PopupSide } from "../../internal/popup.js"

/** How the items of a group can be checked. */
export type MenuSelectionMode = "none" | "single" | "multiple"

/** Visual style of an item. */
export type MenuItemVariant = "default" | "destructive"

/** Why a menu opened or closed. */
export type MenuOpenChangeReason = "trigger" | "context-menu" | "select" | "tab" | PopupCloseReason

/** Detail of `tec-open-change`. */
export interface MenuOpenChangeDetail {
  open: boolean
  reason: MenuOpenChangeReason
}

/** Detail of `tec-select` (fired by an item when it is activated). */
export interface MenuSelectDetail {
  /** The item's `value` (empty when it has none). */
  value: string
  /** For checkbox / radio items: whether the item is checked after the activation. */
  checked?: boolean
}

/** Detail of `tec-value-change` (fired by a group with `selection-mode`). */
export interface MenuValueChangeDetail {
  /** `single`: the checked item's value (empty when none). `multiple`: the first checked value. */
  value: string
  /** The values of every checked item, in document order. */
  values: string[]
}

/** Where focus goes when a menu (or submenu) opens. */
export type MenuFocusStrategy = "first" | "last" | "menu" | "none"

/** How an item was activated (decides whether the menu closes, as in React Aria). */
export type MenuActivationSource = "pointer" | "enter" | "space"

/** The surface an element belongs to: the closest root menu or submenu content above it. */
export function ownerSurface(el: Element): MenuSurfaceElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof MenuSurfaceElement) return p
  return null
}

function textOf(nodes: Iterable<Node>): string {
  let text = ""
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? ""
    else if (node instanceof Element && !(node instanceof MenuShortcutElement) && node.getAttribute("slot") !== "start" && node.localName !== "svg")
      text += node.textContent ?? ""
  }
  return text.replace(/\s+/g, " ").trim()
}

// ================================================================================================ surface

/**
 * A menu surface: renders the `role="menu"` element and implements the keyboard model for the items
 * it owns (arrows with wrapping, Home/End, PageUp/PageDown, typeahead, Enter/Space, the arrows that
 * open and close submenus, Tab).
 */
export abstract class MenuSurfaceElement extends TectonElement {
  readonly #typeahead = new Typeahead()

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown)
    this.addEventListener("focusin", this.#onFocusIn)
  }

  /** The `role="menu"` element (in the shadow root). @internal */
  get menuElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(".content") ?? null
  }

  /** The root menu of this menu tree. @internal */
  abstract get rootMenu(): MenuRootElement | null

  /** Whether this is a submenu surface. @internal */
  get isSubmenu(): boolean {
    return false
  }

  /** The items this surface owns, in document order (disabled ones included). @internal */
  menuItems(): MenuItemElement[] {
    return [...this.querySelectorAll("*")].filter((el): el is MenuItemElement => el instanceof MenuItemElement && ownerSurface(el) === this)
  }

  /** The submenus opened from this surface. @internal */
  ownSubmenus(): MenuSubElement[] {
    return [...this.querySelectorAll("*")].filter((el): el is MenuSubElement => el instanceof MenuSubElement && ownerSurface(el) === this)
  }

  /** Moves focus to the first / last enabled item, or to the menu itself. @internal */
  focusStrategy(strategy: MenuFocusStrategy): void {
    if (strategy === "none") return
    const enabled = this.menuItems().filter((i) => !i.disabled)
    const target = strategy === "first" ? enabled[0] : strategy === "last" ? enabled[enabled.length - 1] : undefined
    ;(target ?? this.menuElement)?.focus()
  }

  #onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0]
    if (!(target instanceof MenuItemElement) || ownerSurface(target) !== this) return
    // Focus moved to another item of this surface (hover or arrows): close the other open submenus.
    for (const sub of this.ownSubmenus()) if (sub.open && sub.trigger !== target) sub.closeNow()
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return
    const origin = event.composedPath()[0]
    const onMenu = origin === this.menuElement
    const current = origin instanceof MenuItemElement && ownerSurface(origin) === this ? origin : null
    if (!onMenu && !current) return

    if (event.key === "Tab") {
      this.rootMenu?.closeForTab()
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return

    const items = this.menuItems()
    const enabled = items.filter((i) => !i.disabled)
    const step = horizontalStep(event.key, this)

    const focus = (item: MenuItemElement | undefined) => {
      event.preventDefault()
      item?.focus()
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!enabled.length) return focus(undefined)
        const dir = event.key === "ArrowDown" ? 1 : -1
        const index = current ? enabled.indexOf(current) : -1
        const next = index < 0 ? (dir > 0 ? 0 : enabled.length - 1) : (index + dir + enabled.length) % enabled.length
        return focus(enabled[next])
      }
      case "Home":
      case "PageUp":
        return focus(enabled[0])
      case "End":
      case "PageDown":
        return focus(enabled[enabled.length - 1])
      case "Enter":
      case " ":
        if (event.key === " " && this.#typeahead.isTypeaheadKey(event)) break
        if (!current) return
        event.preventDefault()
        current.activate(event.key === "Enter" ? "enter" : "space", event)
        return
    }

    if (step === 1 && current instanceof MenuSubTriggerElement) {
      event.preventDefault()
      current.activate("enter", event)
      return
    }
    if (step === -1 && this instanceof MenuSubContentElement) {
      event.preventDefault()
      this.sub?.closeNow()
      this.sub?.trigger?.focus()
      return
    }

    if (this.#typeahead.isTypeaheadKey(event)) {
      event.preventDefault()
      const match = this.#typeahead.match(event, enabled, current, (item) => item.label)
      if (match && match !== current) match.focus()
    }
  }
}

// ================================================================================================ root

/**
 * The root of a menu tree: `open` state, the floating surface (`PopupController`) and the
 * `tec-open-change` event. Subclasses decide what opens it (a trigger button, a context menu).
 */
export abstract class MenuRootElement extends MenuSurfaceElement {
  static styles: CSSResultGroup = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), menuRootStyles]

  /** Whether the menu is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Side of the anchor to place the menu on (flips when there is no room). */
  @property() side: PopupSide = "bottom"

  /** Alignment against the anchor. (Not reflected: an `align` attribute is a legacy presentational hint.) */
  @property() align: PopupAlign = "start"

  /** Distance from the anchor in px. */
  @property({ type: Number, attribute: "side-offset" }) sideOffset = 4

  /** Shift along the anchor edge in px. */
  @property({ type: Number, attribute: "align-offset" }) alignOffset = 0

  /** Accessible name of the menu. Default: the trigger's name. */
  @property() label = ""

  protected popup: PopupController
  #focusStrategy: MenuFocusStrategy = "menu"

  constructor() {
    super()
    this.popup = new PopupController(this, {
      popup: () => this.menuElement,
      placement: () => ({ side: this.side, align: this.align, sideOffset: this.sideOffset, alignOffset: this.alignOffset }),
      focus: { initial: "none", trap: false, restore: true },
      dismiss: { escape: true, outsidePress: true, focusOut: false },
      onRequestClose: (reason) => this.requestOpen(false, reason),
      ...this.popupOptions(),
    })
  }

  /** Trigger / anchor / ARIA options of the popup (subclasses). @internal */
  protected abstract popupOptions(): Partial<PopupOptions>

  /** @internal */
  override get rootMenu(): MenuRootElement {
    return this
  }

  /** Opens the menu (no event); focus goes to the menu. */
  show(): void {
    this.open = true
  }

  /** Closes the menu (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the menu (no event). */
  toggle(): void {
    this.open = !this.open
  }

  /** Recomputes the menu position. */
  reposition(): Promise<void> {
    return this.popup.reposition()
  }

  /**
   * Opens or closes after a cancelable `tec-open-change`. Returns whether the state changed.
   * @internal
   */
  requestOpen(open: boolean, reason: MenuOpenChangeReason, focus: MenuFocusStrategy = "menu"): boolean {
    if (open === this.open) {
      if (open) this.#applyFocus(focus)
      return false
    }
    if (!this.emit<MenuOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) return false
    this.#focusStrategy = focus
    if (!open) this.#closeSubmenus()
    this.open = open
    return true
  }

  /** Tab / Shift+Tab: close everything and hand focus back to where it came from, so Tab moves on from there. @internal */
  closeForTab(): void {
    this.#closeSubmenus()
    this.focusReturnTarget()?.focus({ preventScroll: true })
    this.requestOpen(false, "tab")
  }

  /** The element focus returns to on close (the trigger). @internal */
  protected focusReturnTarget(): HTMLElement | null {
    return null
  }

  #closeSubmenus(): void {
    const subs = [...this.querySelectorAll("*")].filter((el): el is MenuSubElement => el instanceof MenuSubElement && el.open)
    for (const sub of subs.reverse()) sub.closeNow()
  }

  #applyFocus(strategy: MenuFocusStrategy): void {
    this.focusStrategy(strategy)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("open") && !this.open) this.#closeSubmenus()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const menu = this.menuElement
    if (menu) {
      const trigger = this.labelElement()
      setAriaElements(menu, "ariaLabelledByElements", !this.label && trigger ? [trigger] : null)
    }
    if (changed.has("open")) void this.#sync()
    else if (this.open && (changed.has("side") || changed.has("align") || changed.has("sideOffset") || changed.has("alignOffset"))) void this.popup.reposition()
  }

  /** The element that names the menu when there is no `label`. @internal */
  protected labelElement(): HTMLElement | null {
    return null
  }

  /** Called right before the popup is shown (e.g. to measure the target). @internal */
  protected beforeShow(): void {}

  async #sync(): Promise<void> {
    if (this.open) {
      this.beforeShow()
      const strategy = this.#focusStrategy
      this.#focusStrategy = "menu"
      await this.popup.setOpen(true)
      if (this.open && this.popup.isOpen) this.#applyFocus(strategy)
    } else {
      await this.popup.setOpen(false)
    }
  }

  protected renderContent(): TemplateResult {
    return html`<div class="content" part="content" popover="manual" role="menu" tabindex="-1" aria-label=${this.label || nothing}><slot></slot></div>`
  }
}

// ================================================================================================ item

/**
 * A menu item. Its role follows the enclosing group: `menuitem`, or `menuitemcheckbox` /
 * `menuitemradio` with `aria-checked` inside a group with `selection-mode`.
 */
export class MenuItemElement extends TectonElement {
  static styles: CSSResultGroup = [hostStyles, menuItemStyles]

  /** `destructive` colours the label, icon and focus background with the destructive colour. */
  @property({ reflect: true }) variant: MenuItemVariant = "default"

  /** Indents the item to line up with items that have an icon or a check mark. */
  @property({ type: Boolean, reflect: true }) inset = false

  /** Disables the item (skipped by the arrow keys, cannot be activated). */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Identifies the item in `tec-select` and in its group's values. */
  @property({ reflect: true }) value = ""

  /** Whether a checkbox / radio item is checked. The attribute sets the initial state. */
  @property({ type: Boolean }) checked = false

  /** Plain-text label for typeahead, when the text content is not the right one. */
  @property({ attribute: "text-value" }) textValue = ""

  /** Makes the item a link: activating it navigates to this URL. */
  @property() href = ""

  /** Browsing context of the link (`_blank` …). */
  @property() target = ""

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      if (this.disabled) return
      this.activate("pointer", event)
    })
    this.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" || this.disabled) return
      if (deepActiveElement() !== this) this.focus({ preventScroll: true })
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1
  }

  /** The text used for typeahead. @internal */
  get label(): string {
    return this.textValue || textOf(this.childNodes)
  }

  /** The group this item belongs to. @internal */
  get group(): MenuGroupElement | null {
    for (let p = this.parentElement; p && !(p instanceof MenuSurfaceElement); p = p.parentElement) if (p instanceof MenuGroupElement) return p
    return null
  }

  /** The selection mode of the item's group. @internal */
  get selectionMode(): MenuSelectionMode {
    return this.group?.selectionMode ?? "none"
  }

  /**
   * Activates the item: checks it (in a selection group), fires `tec-select`, follows `href`, and
   * closes the menu like React Aria (Enter always, Space only for plain items, pointer unless the
   * group allows multiple selection) unless `tec-select` was canceled.
   * @internal
   */
  activate(source: MenuActivationSource, _event?: Event): void {
    if (this.disabled) return
    const mode = this.selectionMode
    if (mode !== "none") this.group?.userToggle(this)
    const detail: MenuSelectDetail = { value: this.value }
    if (mode !== "none") detail.checked = this.checked
    const proceed = this.emit<MenuSelectDetail>("tec-select", { detail, cancelable: true })
    if (!proceed) return
    if (this.href) {
      const a = document.createElement("a")
      a.href = this.href
      if (this.target) a.target = this.target
      a.click()
    }
    const close = source === "enter" || (source === "space" ? mode === "none" : mode !== "multiple")
    if (close) ownerSurface(this)?.rootMenu?.requestOpen(false, "select")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const mode = this.selectionMode
    this.internals.role = mode === "single" ? "menuitemradio" : mode === "multiple" ? "menuitemcheckbox" : "menuitem"
    this.internals.ariaChecked = mode === "none" ? null : String(this.checked)
    this.internals.ariaDisabled = this.disabled ? "true" : null
    this.toggleState("checkable", mode !== "none")
    this.toggleState("checked", mode !== "none" && this.checked)
  }

  protected renderIndicator(): TemplateResult | typeof nothing {
    if (this.selectionMode === "none") return nothing
    return html`<span class="indicator" part="indicator">${this.checked ? icon(Check, { size: 16 }) : nothing}</span>`
  }

  protected override render() {
    return html`<div class="base" part="base"><slot name="start"></slot><slot></slot><slot name="end"></slot>${this.renderIndicator()}</div>`
  }
}

/** The item that opens a submenu (`aria-haspopup="menu"`, `aria-expanded`). */
export class MenuSubTriggerElement extends MenuItemElement {
  #hoverTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    super()
    this.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || this.disabled || this.sub?.open) return
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = setTimeout(() => this.sub?.openSub("none"), 200)
    })
    this.addEventListener("pointerleave", () => clearTimeout(this.#hoverTimer))
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    clearTimeout(this.#hoverTimer)
  }

  /** The submenu this trigger opens. @internal */
  get sub(): MenuSubElement | null {
    return this.parentElement instanceof MenuSubElement ? this.parentElement : null
  }

  /** @internal */
  override get selectionMode(): MenuSelectionMode {
    return "none"
  }

  /** @internal */
  override activate(source: MenuActivationSource, _event?: Event): void {
    if (this.disabled) return
    clearTimeout(this.#hoverTimer)
    this.sub?.openSub(source === "pointer" ? "none" : "first")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("open", !!this.sub?.open)
  }

  protected override render() {
    return html`<div class="base" part="base">
      <slot name="start"></slot><slot></slot>${icon(ChevronRight, { size: 16, class: "chevron", part: "chevron" })}
    </div>`
  }
}

// ================================================================================================ group, label, separator, shortcut

/** A group of items, optionally a set of checkboxes (`multiple`) or radios (`single`). */
export class MenuGroupElement extends TectonElement {
  static styles = [hostStyles, menuGroupStyles]

  /** `single`: the items are radios; `multiple`: checkboxes; `none`: plain items. */
  @property({ attribute: "selection-mode", reflect: true }) selectionMode: MenuSelectionMode = "none"

  /** The items of this group, in order. */
  get items(): MenuItemElement[] {
    return [...this.querySelectorAll("*")].filter((el): el is MenuItemElement => el instanceof MenuItemElement && el.group === this)
  }

  /** The value of the (first) checked item, or `""`. Setting it checks the item with that value only. */
  get value(): string {
    return this.values[0] ?? ""
  }

  set value(value: string) {
    this.values = value ? [value] : []
  }

  /** The values of the checked items. Setting it checks exactly those items. */
  get values(): string[] {
    return this.items.filter((i) => i.checked && i.value).map((i) => i.value)
  }

  set values(values: string[]) {
    const set = new Set(values)
    for (const item of this.items) item.checked = set.has(item.value)
  }

  /** User toggled `item`: emit the cancelable `tec-value-change`, then apply. @internal */
  userToggle(item: MenuItemElement): void {
    const items = this.items
    let next: MenuItemElement[]
    if (this.selectionMode === "single") {
      if (item.checked) return
      next = [item]
    } else {
      next = items.filter((i) => (i === item ? !i.checked : i.checked))
    }
    const values = next.map((i) => i.value).filter(Boolean)
    if (!this.emit<MenuValueChangeDetail>("tec-value-change", { detail: { value: values[0] ?? "", values }, cancelable: true })) return
    for (const i of items) i.checked = next.includes(i)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "group"
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const label = [...this.children].find((c) => c instanceof MenuLabelElement)
    this.internals.ariaLabelledByElements = label ? [label] : null
    if (changed.has("selectionMode")) for (const item of this.items) item.requestUpdate()
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.requestUpdate()}></slot>`
  }
}

/** A non-interactive heading for a group of items. */
export class MenuLabelElement extends TectonElement {
  static styles = [hostStyles, menuLabelStyles]

  /** Indents the label to line up with inset items. */
  @property({ type: Boolean, reflect: true }) inset = false

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/** A horizontal rule between items or groups (`role="separator"`). */
export class MenuSeparatorElement extends TectonElement {
  static styles = [hostStyles, menuSeparatorStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "separator"
  }

  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

/** A keyboard shortcut hint at the end of an item. */
export class MenuShortcutElement extends TectonElement {
  static styles = [hostStyles, menuShortcutStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

// ================================================================================================ submenu

const SAFE_THROTTLE = 50
const SAFE_TIMEOUT = 1000
const SAFE_ANGLE_PADDING = Math.PI / 12
const SAFE_ALLOWED_INVALID = 2

/** Pairs a submenu trigger with its content; holds the submenu's `open` state. */
export class MenuSubElement extends TectonElement {
  static styles = [hostStyles, menuSubStyles]

  /** Whether the submenu is shown. */
  @property({ type: Boolean, reflect: true }) open = false

  #pendingFocus: MenuFocusStrategy = "none"
  // safe triangle
  #prev: { x: number; y: number } | undefined
  #side: "left" | "right" | undefined
  #count = SAFE_ALLOWED_INVALID
  #lastTime = 0
  #timeout: ReturnType<typeof setTimeout> | undefined
  #blocked: HTMLElement | null = null

  /** The trigger item. @internal */
  get trigger(): MenuSubTriggerElement | null {
    return ([...this.children].find((c) => c instanceof MenuSubTriggerElement) as MenuSubTriggerElement | undefined) ?? null
  }

  /** The submenu content. @internal */
  get content(): MenuSubContentElement | null {
    return ([...this.children].find((c) => c instanceof MenuSubContentElement) as MenuSubContentElement | undefined) ?? null
  }

  /** Opens the submenu and moves focus as asked. @internal */
  openSub(focus: MenuFocusStrategy): void {
    if (this.trigger?.disabled) return
    if (this.open) {
      this.content?.focusStrategy(focus)
      return
    }
    this.#pendingFocus = focus
    this.open = true
  }

  /** Closes the submenu (and its nested submenus) synchronously. @internal */
  closeNow(): void {
    const content = this.content
    if (content) {
      const nested = [...content.querySelectorAll("*")].filter((el): el is MenuSubElement => el instanceof MenuSubElement && el.open)
      for (const sub of nested.reverse()) sub.closeNow()
    }
    if (!this.open) return
    this.open = false
    void content?.setPopupOpen(false)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#stopSafeTriangle()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (!changed.has("open")) return
    this.trigger?.requestUpdate()
    const content = this.content
    if (this.open) {
      const focus = this.#pendingFocus
      this.#pendingFocus = "none"
      void content?.setPopupOpen(true).then(() => {
        if (this.open) content.focusStrategy(focus)
      })
      window.addEventListener("pointermove", this.#onPointerMove)
    } else {
      this.closeNow()
      void content?.setPopupOpen(false)
      this.#stopSafeTriangle()
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }

  #stopSafeTriangle(): void {
    window.removeEventListener("pointermove", this.#onPointerMove)
    clearTimeout(this.#timeout)
    this.#reset()
  }

  #reset(): void {
    this.#setBlocked(null)
    this.#count = SAFE_ALLOWED_INVALID
    this.#prev = undefined
    this.#side = undefined
  }

  #setBlocked(el: HTMLElement | null): void {
    if (this.#blocked && this.#blocked !== el) this.#blocked.style.pointerEvents = ""
    this.#blocked = el
    if (el) el.style.pointerEvents = "none"
  }

  // React Aria's useSafelyMouseToSubmenu: while the pointer moves towards the submenu, the parent
  // menu ignores the pointer so crossing other items does not close the submenu.
  #onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return
    const now = Date.now()
    if (now - this.#lastTime < SAFE_THROTTLE) return
    clearTimeout(this.#timeout)
    const menu = ownerSurface(this)?.menuElement
    const submenu = this.content?.menuElement
    if (!menu || !submenu || !submenu.matches(":popover-open")) return
    const { clientX: x, clientY: y } = event
    if (!this.#prev) {
      this.#prev = { x, y }
      return
    }
    const sub = submenu.getBoundingClientRect()
    const box = menu.getBoundingClientRect()
    this.#side ??= x > sub.right ? "left" : "right"
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
      this.#reset()
      return
    }
    const prev = this.#prev
    const toSubX = this.#side === "right" ? sub.left - prev.x : prev.x - sub.right
    const angleTop = Math.atan2(prev.y - sub.top, toSubX) + SAFE_ANGLE_PADDING
    const angleBottom = Math.atan2(prev.y - sub.bottom, toSubX) - SAFE_ANGLE_PADDING
    const anglePointer = Math.atan2(prev.y - y, this.#side === "left" ? -(x - prev.x) : x - prev.x)
    const towards = anglePointer < angleTop && anglePointer > angleBottom
    this.#count = towards ? Math.min(this.#count + 1, SAFE_ALLOWED_INVALID) : Math.max(this.#count - 1, 0)
    this.#setBlocked(this.#count >= SAFE_ALLOWED_INVALID ? menu : null)
    this.#lastTime = now
    this.#prev = { x, y }
    if (towards) this.#timeout = setTimeout(() => this.#reset(), SAFE_TIMEOUT)
  }
}

/** The floating surface of a submenu, placed at the inline end of its trigger. */
export class MenuSubContentElement extends MenuSurfaceElement {
  static styles: CSSResultGroup = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), menuRootStyles, menuSubContentStyles]

  #popup = new PopupController(this, {
    popup: () => this.menuElement,
    trigger: () => this.sub?.trigger,
    haspopup: "menu",
    placement: () => ({ side: "inline-end", align: "start", sideOffset: 0, alignOffset: -3 }),
    focus: { initial: "none", trap: false, restore: true },
    dismiss: { escape: true, outsidePress: true, focusOut: false },
    onRequestClose: () => this.sub?.closeNow(),
  })

  /** The submenu element this content belongs to. @internal */
  get sub(): MenuSubElement | null {
    return this.parentElement instanceof MenuSubElement ? this.parentElement : null
  }

  /** @internal */
  override get isSubmenu(): boolean {
    return true
  }

  /** @internal */
  override get rootMenu(): MenuRootElement | null {
    for (let p = this.parentElement; p; p = p.parentElement) if (p instanceof MenuRootElement) return p
    return null
  }

  /** Shows / hides the floating surface. @internal */
  async setPopupOpen(open: boolean): Promise<void> {
    // Hiding starts synchronously, so a parent closing right after sees focus already restored.
    if (!open) return this.#popup.hide()
    await this.updateComplete
    if (this.sub?.open) await this.#popup.show()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const menu = this.menuElement
    const trigger = this.sub?.trigger
    if (menu) setAriaElements(menu, "ariaLabelledByElements", trigger ? [trigger] : null)
  }

  protected override render() {
    return html`<div class="content" part="content" popover="manual" role="menu" tabindex="-1"><slot></slot></div>`
  }
}
