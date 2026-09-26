import type { VirtualElement } from "@floating-ui/dom"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import type { PopupOptions } from "../../internal/popup.js"
import { deepActiveElement } from "../../internal/focus.js"
import {
  MenuGroupElement,
  MenuItemElement,
  MenuLabelElement,
  MenuRootElement,
  MenuSeparatorElement,
  MenuShortcutElement,
  MenuSubContentElement,
  MenuSubElement,
  MenuSubTriggerElement,
} from "../dropdown-menu/menu-core.js"
import { contextMenuRootStyles, contextMenuSubContentStyles } from "../dropdown-menu/menu.styles.js"

export type {
  MenuItemVariant,
  MenuOpenChangeDetail,
  MenuOpenChangeReason,
  MenuSelectDetail,
  MenuSelectionMode,
  MenuValueChangeDetail,
  PopupAlign,
  PopupSide,
} from "../dropdown-menu/menu-core.js"

const LONG_PRESS_MS = 500
const LONG_PRESS_TOLERANCE = 10
/** A native `contextmenu` that follows a keyboard / long-press open within this window is swallowed. */
const DEDUPE_MS = 400

/**
 * A menu opened on a target area: right click (at the pointer), <kbd>Shift</kbd>+<kbd>F10</kbd> or
 * the <kbd>ContextMenu</kbd> key (at the focused element, with focus on the first item), or a long
 * press on touch screens. The target goes in `slot="trigger"`; make it focusable (`tabindex="0"`) so
 * keyboard users can reach it. Like React Aria, the target gets no `aria-haspopup`: a context menu
 * is not opened by activating it.
 *
 * `side` / `align` place the menu against the pointer position. Everything else — items, groups,
 * submenus, keyboard, `tec-select`, `tec-value-change` — works as in `tec-dropdown-menu`.
 *
 * @summary Displays a menu of actions at the pointer, opened by right click or long press on an area.
 *
 * @tag tec-context-menu
 *
 * @slot trigger - The area that opens the menu (a focusable element).
 * @slot - The menu content: `tec-context-menu-item`, `-group`, `-label`, `-separator`, `-sub`.
 *
 * @csspart content - The floating `role="menu"` surface (top layer).
 *
 * @cssprop --tec-context-menu-width - Width of the menu. Default: the width of the target area.
 * @cssprop --tec-menu-min-width - Minimum width of the menu (default 9rem).
 *
 * @fires tec-open-change - The user opened or closed the menu (`reason`: `context-menu`, `select`, `escape`, `tab`, `outside`). Cancelable. `detail: { open, reason }`.
 * @fires tec-select - Bubbles from an item when it is activated. `detail: { value, checked? }`. Cancel it to keep the menu open.
 * @fires tec-value-change - Bubbles from a group with `selection-mode` when the user checks or unchecks an item. Cancelable. `detail: { value, values }`.
 */
export class TecContextMenu extends MenuRootElement {
  static override styles = [MenuRootElement.styles, contextMenuRootStyles]

  /** Disables the menu: the browser's own context menu shows instead. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #point = { x: 0, y: 0 }
  #anchorElement: Element | null = null
  #openedAt = -Infinity
  #returnFocus: HTMLElement | null = null
  #longPress: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | undefined

  #virtualAnchor: VirtualElement = {
    getBoundingClientRect: () => new DOMRect(this.#point.x, this.#point.y, 0, 0),
  }

  /** The target area in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  protected override popupOptions(): Partial<PopupOptions> {
    return {
      anchor: () => this.#anchorElement ?? this.#virtualAnchor,
      haspopup: false,
      expanded: false,
    }
  }

  protected override focusReturnTarget(): HTMLElement | null {
    return this.#returnFocus
  }

  protected override labelElement(): HTMLElement | null {
    return this.trigger
  }

  protected override beforeShow(): void {
    const width = this.trigger?.getBoundingClientRect().width
    this.menuElement?.style.setProperty("--tec-context-menu-target-width", width ? `${width}px` : "auto")
  }

  /**
   * Opens the menu at a viewport position (no event).
   * @param x - Client x coordinate.
   * @param y - Client y coordinate.
   */
  showAt(x: number, y: number): void {
    this.#point = { x, y }
    this.#anchorElement = null
    if (this.open) void this.reposition()
    this.open = true
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#cancelLongPress()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("open") && this.open && !this.#returnFocus) {
      const active = deepActiveElement()
      this.#returnFocus = active instanceof HTMLElement && !this.contains(active) ? active : null
    }
    if (changed.has("open") && !this.open) queueMicrotask(() => (this.#returnFocus = null))
  }

  #openAt(reason: "context-menu", focus: "first" | "menu"): void {
    if (this.open) {
      void this.reposition()
      this.focusStrategy(focus)
      return
    }
    const active = deepActiveElement()
    this.#returnFocus = active instanceof HTMLElement ? active : null
    if (!this.requestOpen(true, reason, focus)) this.#returnFocus = null
  }

  #onContextMenu = (event: MouseEvent) => {
    if (this.disabled) return
    event.preventDefault()
    if (performance.now() - this.#openedAt < DEDUPE_MS) return
    this.#point = { x: event.clientX, y: event.clientY }
    this.#anchorElement = null
    this.#openAt("context-menu", "menu")
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.disabled || event.defaultPrevented) return
    const isMenuKey = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)
    if (!isMenuKey) return
    event.preventDefault()
    this.#openedAt = performance.now()
    this.#anchorElement = (event.target as Element | null) ?? this.trigger
    this.#openAt("context-menu", "first")
  }

  #onPointerDown = (event: PointerEvent) => {
    if (this.disabled || event.pointerType !== "touch") return
    this.#cancelLongPress()
    const { clientX: x, clientY: y } = event
    this.#longPress = {
      x,
      y,
      timer: setTimeout(() => {
        this.#longPress = undefined
        this.#openedAt = performance.now()
        this.#point = { x, y }
        this.#anchorElement = null
        this.#openAt("context-menu", "menu")
      }, LONG_PRESS_MS),
    }
  }

  #onPointerMove = (event: PointerEvent) => {
    const lp = this.#longPress
    if (lp && Math.hypot(event.clientX - lp.x, event.clientY - lp.y) > LONG_PRESS_TOLERANCE) this.#cancelLongPress()
  }

  #cancelLongPress = () => {
    if (this.#longPress) clearTimeout(this.#longPress.timer)
    this.#longPress = undefined
  }

  protected override render() {
    return html`<slot
        name="trigger"
        @contextmenu=${this.#onContextMenu}
        @keydown=${this.#onKeyDown}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#cancelLongPress}
        @pointercancel=${this.#cancelLongPress}
        @slotchange=${() => this.requestUpdate()}
      ></slot>
      ${this.renderContent()}`
  }
}

/**
 * Inside a `tec-context-menu-group` with `selection-mode`, the item is a checkbox
 * (`menuitemcheckbox`) or a radio (`menuitemradio`) with `aria-checked` and a check mark.
 *
 * @summary An action in a context menu.
 *
 * @tag tec-context-menu-item
 *
 * @slot - The label (and a `tec-context-menu-shortcut`). A leading `<svg>` is sized to 1rem.
 * @slot start - A leading icon.
 * @slot end - Trailing content.
 *
 * @csspart base - The row (padding, radius, focus background).
 * @csspart indicator - The check mark of checkbox / radio items.
 *
 * @cssstate checkable - The item is in a group with `selection-mode`.
 * @cssstate checked - The checkbox / radio item is checked.
 *
 * @fires tec-select - The item was activated (click, Enter, Space). Bubbles. `detail: { value, checked? }`. Cancelable: `preventDefault()` keeps the menu open.
 */
export class TecContextMenuItem extends MenuItemElement {}

/**
 * @summary Groups items, optionally as checkboxes (`selection-mode="multiple"`) or radios (`"single"`).
 *
 * @tag tec-context-menu-group
 *
 * @slot - Items, and a `tec-context-menu-label` that names the group.
 *
 * @fires tec-value-change - The user checked or unchecked an item. Bubbles. `detail: { value, values }`. Cancelable: `preventDefault()` keeps the current selection.
 */
export class TecContextMenuGroup extends MenuGroupElement {}

/**
 * @summary A heading for a group of items; names its `tec-context-menu-group`.
 *
 * @tag tec-context-menu-label
 *
 * @slot - The label text.
 *
 * @csspart base - The label box.
 */
export class TecContextMenuLabel extends MenuLabelElement {}

/**
 * @summary A line between items or groups.
 *
 * @tag tec-context-menu-separator
 *
 * @csspart base - The line.
 */
export class TecContextMenuSeparator extends MenuSeparatorElement {}

/**
 * @summary A keyboard shortcut hint, placed at the end of an item.
 *
 * @tag tec-context-menu-shortcut
 *
 * @slot - The shortcut text (`⌘C`).
 */
export class TecContextMenuShortcut extends MenuShortcutElement {}

/**
 * Hovering the trigger for 200 ms, clicking it, or Enter, Space or ArrowRight (ArrowLeft in RTL)
 * opens the submenu; ArrowLeft (ArrowRight in RTL) and Escape close it and focus the trigger.
 *
 * @summary A submenu: a `tec-context-menu-sub-trigger` followed by a `tec-context-menu-sub-content`.
 *
 * @tag tec-context-menu-sub
 *
 * @slot - The sub trigger and the sub content.
 */
export class TecContextMenuSub extends MenuSubElement {}

/**
 * @summary The item that opens a submenu (with a chevron).
 *
 * @tag tec-context-menu-sub-trigger
 *
 * @slot - The label.
 * @slot start - A leading icon.
 *
 * @csspart base - The row.
 * @csspart chevron - The chevron (mirrored in RTL).
 *
 * @cssstate open - The submenu is open.
 */
export class TecContextMenuSubTrigger extends MenuSubTriggerElement {}

/**
 * @summary The floating surface of a submenu, placed at the inline end of its trigger.
 *
 * @tag tec-context-menu-sub-content
 *
 * @slot - The submenu's items, groups, labels and separators.
 *
 * @csspart content - The floating `role="menu"` surface.
 *
 * @cssprop --tec-menu-sub-width - Width of the submenu (default: its content).
 * @cssprop --tec-menu-sub-min-width - Minimum width of the submenu (default 8rem).
 */
export class TecContextMenuSubContent extends MenuSubContentElement {
  static override styles = [MenuSubContentElement.styles, contextMenuSubContentStyles]
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-context-menu": TecContextMenu
    "tec-context-menu-item": TecContextMenuItem
    "tec-context-menu-group": TecContextMenuGroup
    "tec-context-menu-label": TecContextMenuLabel
    "tec-context-menu-separator": TecContextMenuSeparator
    "tec-context-menu-shortcut": TecContextMenuShortcut
    "tec-context-menu-sub": TecContextMenuSub
    "tec-context-menu-sub-trigger": TecContextMenuSubTrigger
    "tec-context-menu-sub-content": TecContextMenuSubContent
  }
}
