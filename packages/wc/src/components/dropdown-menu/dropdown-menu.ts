import { html } from "lit"
import type { PopupOptions } from "../../internal/popup.js"
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
} from "./menu-core.js"
import { dropdownMenuRootStyles } from "./menu.styles.js"

export type {
  MenuActivationSource,
  MenuItemVariant,
  MenuOpenChangeDetail,
  MenuOpenChangeReason,
  MenuSelectDetail,
  MenuSelectionMode,
  MenuValueChangeDetail,
  PopupAlign,
  PopupSide,
} from "./menu-core.js"

/**
 * A menu of actions opened by a button (WAI-ARIA menu button pattern). The trigger in
 * `slot="trigger"` gets `aria-haspopup="menu"` and `aria-expanded`; the menu is a `role="menu"`
 * surface in the top layer, named by the trigger (or `label`).
 *
 * A pointer press opens the menu with focus on the menu itself; Enter, Space and ArrowDown open it
 * with focus on the first item, ArrowUp on the last. Activating an item fires `tec-select` on it and
 * closes the menu; Escape, Tab and a press outside close it too, and focus returns to the trigger.
 *
 * @summary Displays a menu to the user — such as a set of actions or functions — triggered by a button.
 *
 * @tag tec-dropdown-menu
 *
 * @slot trigger - The button that opens the menu (usually a `tec-button`).
 * @slot - The menu content: `tec-dropdown-menu-item`, `-group`, `-label`, `-separator`, `-sub`.
 *
 * @csspart content - The floating `role="menu"` surface (top layer).
 *
 * @cssprop --tec-dropdown-menu-width - Width of the menu. Default: the trigger's width.
 * @cssprop --tec-menu-min-width - Minimum width of the menu (default 8rem).
 *
 * @fires tec-open-change - The user opened or closed the menu (trigger press, item selection, Escape, Tab, outside press). Cancelable. `detail: { open, reason }`.
 * @fires tec-select - Bubbles from an item when it is activated. `detail: { value, checked? }`. Cancel it to keep the menu open.
 * @fires tec-value-change - Bubbles from a group with `selection-mode` when the user checks or unchecks an item. Cancelable. `detail: { value, values }`.
 */
export class TecDropdownMenu extends MenuRootElement {
  static override styles = [MenuRootElement.styles, dropdownMenuRootStyles]

  /** The element in `slot="trigger"`. */
  get trigger(): HTMLElement | null {
    return this.querySelector(":scope > [slot='trigger']")
  }

  protected override popupOptions(): Partial<PopupOptions> {
    return { trigger: () => this.trigger, haspopup: "menu", expanded: true }
  }

  protected override focusReturnTarget(): HTMLElement | null {
    return this.trigger
  }

  protected override labelElement(): HTMLElement | null {
    return this.trigger
  }

  #isTriggerDisabled(): boolean {
    const trigger = this.trigger as (HTMLElement & { disabled?: boolean }) | null
    return !trigger || !!trigger.disabled || trigger.getAttribute("aria-disabled") === "true"
  }

  #onTriggerClick = (event: MouseEvent) => {
    if (event.defaultPrevented || this.#isTriggerDisabled()) return
    if (this.open) this.requestOpen(false, "trigger")
    // detail 0: Enter/Space on the button or a screen reader click → focus the first item.
    else this.requestOpen(true, "trigger", event.detail === 0 ? "first" : "menu")
  }

  #onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || this.#isTriggerDisabled()) return
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    this.requestOpen(true, "trigger", event.key === "ArrowDown" ? "first" : "last")
  }

  protected override render() {
    return html`<slot name="trigger" @click=${this.#onTriggerClick} @keydown=${this.#onTriggerKeyDown} @slotchange=${() => this.requestUpdate()}></slot>
      ${this.renderContent()}`
  }
}

/**
 * Inside a `tec-dropdown-menu-group` with `selection-mode`, the item is a checkbox
 * (`menuitemcheckbox`) or a radio (`menuitemradio`) with `aria-checked` and a check mark.
 *
 * @summary An action in a dropdown menu.
 *
 * @tag tec-dropdown-menu-item
 *
 * @slot - The label (and a `tec-dropdown-menu-shortcut`). A leading `<svg>` is sized to 1rem.
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
export class TecDropdownMenuItem extends MenuItemElement {}

/**
 * @summary Groups items, optionally as checkboxes (`selection-mode="multiple"`) or radios (`"single"`).
 *
 * @tag tec-dropdown-menu-group
 *
 * @slot - Items, and a `tec-dropdown-menu-label` that names the group.
 *
 * @fires tec-value-change - The user checked or unchecked an item. Bubbles. `detail: { value, values }`. Cancelable: `preventDefault()` keeps the current selection.
 */
export class TecDropdownMenuGroup extends MenuGroupElement {}

/**
 * @summary A heading for a group of items; names its `tec-dropdown-menu-group`.
 *
 * @tag tec-dropdown-menu-label
 *
 * @slot - The label text.
 *
 * @csspart base - The label box.
 */
export class TecDropdownMenuLabel extends MenuLabelElement {}

/**
 * @summary A line between items or groups.
 *
 * @tag tec-dropdown-menu-separator
 *
 * @csspart base - The line.
 */
export class TecDropdownMenuSeparator extends MenuSeparatorElement {}

/**
 * @summary A keyboard shortcut hint, placed at the end of an item.
 *
 * @tag tec-dropdown-menu-shortcut
 *
 * @slot - The shortcut text (`⌘S`).
 */
export class TecDropdownMenuShortcut extends MenuShortcutElement {}

/**
 * Hovering the trigger for 200 ms, clicking it, or Enter, Space or ArrowRight (ArrowLeft in RTL)
 * opens the submenu; ArrowLeft (ArrowRight in RTL) and Escape close it and focus the trigger.
 *
 * @summary A submenu: a `tec-dropdown-menu-sub-trigger` followed by a `tec-dropdown-menu-sub-content`.
 *
 * @tag tec-dropdown-menu-sub
 *
 * @slot - The sub trigger and the sub content.
 */
export class TecDropdownMenuSub extends MenuSubElement {}

/**
 * @summary The item that opens a submenu (with a chevron).
 *
 * @tag tec-dropdown-menu-sub-trigger
 *
 * @slot - The label.
 * @slot start - A leading icon.
 *
 * @csspart base - The row.
 * @csspart chevron - The chevron (mirrored in RTL).
 *
 * @cssstate open - The submenu is open.
 */
export class TecDropdownMenuSubTrigger extends MenuSubTriggerElement {}

/**
 * @summary The floating surface of a submenu, placed at the inline end of its trigger.
 *
 * @tag tec-dropdown-menu-sub-content
 *
 * @slot - The submenu's items, groups, labels and separators.
 *
 * @csspart content - The floating `role="menu"` surface.
 *
 * @cssprop --tec-menu-sub-width - Width of the submenu (default: its content).
 * @cssprop --tec-menu-sub-min-width - Minimum width of the submenu (default 96px).
 */
export class TecDropdownMenuSubContent extends MenuSubContentElement {}

declare global {
  interface HTMLElementTagNameMap {
    "tec-dropdown-menu": TecDropdownMenu
    "tec-dropdown-menu-item": TecDropdownMenuItem
    "tec-dropdown-menu-group": TecDropdownMenuGroup
    "tec-dropdown-menu-label": TecDropdownMenuLabel
    "tec-dropdown-menu-separator": TecDropdownMenuSeparator
    "tec-dropdown-menu-shortcut": TecDropdownMenuShortcut
    "tec-dropdown-menu-sub": TecDropdownMenuSub
    "tec-dropdown-menu-sub-trigger": TecDropdownMenuSubTrigger
    "tec-dropdown-menu-sub-content": TecDropdownMenuSubContent
  }
}
