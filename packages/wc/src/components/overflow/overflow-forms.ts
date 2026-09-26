/**
 * The overflow form of an item: what a `tec-overflow-item` becomes in the More menu while it is
 * hidden. Most forms are derived from the control the item wraps (a button becomes a menu item, a
 * toggle a checkbox item, a select a submenu of radio items …); `menuForm` on the item replaces the
 * derived form with any entries.
 *
 * Every derived form acts through the row control itself (it clicks the button, the toggle, the tab
 * or the menu item, or sets the select's value and fires `input`/`change`), so the handlers an
 * application attached to the control run in both forms and there is never a second code path.
 */

/** Fields shared by the actionable entries. */
interface OverflowMenuEntryBase {
  /** Text of the entry. */
  label: string
  /** A leading icon (an element; it is cloned into the menu). */
  icon?: Element | null
  /** Shortcut hint shown at the end of the entry. */
  shortcut?: string
  /** Shown but not actionable. */
  disabled?: boolean
  /** Destructive styling. */
  destructive?: boolean
}

/** A menu entry of the More menu (see `TecOverflowItem.menuForm`). */
export type OverflowMenuEntry =
  | (OverflowMenuEntryBase & { type: "item"; onSelect?: () => void })
  | (OverflowMenuEntryBase & { type: "checkbox" | "radio"; checked: boolean; onSelect?: () => void })
  | (OverflowMenuEntryBase & { type: "submenu"; entries: OverflowMenuEntry[] })
  | { type: "group"; label?: string; entries: OverflowMenuEntry[] }
  | { type: "label"; label: string }
  | { type: "separator" }

/** The overflow forms an item can take (`menu-type`). */
export type OverflowMenuType = "auto" | "item" | "checkbox" | "radio" | "section" | "submenu" | "dialog"

type Option = {
  element: Element
  label: string
  icon: Element | null
  disabled: boolean
  checked: boolean
  role: "item" | "checkbox" | "radio" | "label"
  select: () => void
}

const ICON = "svg, tec-icon, img, [data-icon]"
const TEXT_FIELD =
  "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=hidden],[type=range],[type=color],[type=file]), textarea, tec-input, tec-textarea, tec-input-group, tec-combobox, tec-date-picker, tec-input-otp"
const SELECT = "select, tec-select, tec-native-select"
const CHOICE_GROUP = "tec-tabs, tec-toggle-group, tec-radio-group"
const DROPDOWN = "tec-dropdown-menu"
const TOGGLE = "tec-toggle, tec-switch, tec-checkbox, input[type=checkbox], [aria-pressed]"

/** Collapses whitespace in the visible text of `el`. */
export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim()
}

/** The first icon rendered inside `el`, if any. */
export function iconOf(el: Element | null | undefined): Element | null {
  return el?.querySelector(ICON) ?? null
}

/** Whether `el` shows an "on" state: checked, pressed or selected, as a property, ARIA or custom state. */
export function isOn(el: Element): boolean {
  const any = el as Element & { checked?: unknown; pressed?: unknown; selected?: unknown }
  if (any.checked === true || any.pressed === true || any.selected === true) return true
  for (const attr of ["aria-pressed", "aria-checked", "aria-selected"]) if (el.getAttribute(attr) === "true") return true
  for (const state of ["checked", "pressed", "selected", "on"]) {
    try {
      if (el.matches(`:state(${state})`)) return true
    } catch {
      break
    }
  }
  return false
}

/** Whether `el` is disabled (attribute, ARIA or `:disabled`). */
export function isDisabled(el: Element): boolean {
  return el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true" || el.matches(":disabled")
}

/** Fires `input` and `change` on a control whose value was set from the menu, like a user edit. */
function fireValueEvents(control: Element): void {
  control.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
  control.dispatchEvent(new Event("change", { bubbles: true }))
}

/** The options of a select-like control: value semantics, one checked radio. */
function selectOptions(control: Element): Option[] {
  const select = control as Element & { value?: string; options?: ArrayLike<HTMLOptionElement> }
  const options: Element[] =
    select.options && typeof select.options.length === "number"
      ? Array.from(select.options)
      : [...control.querySelectorAll("tec-select-item, tec-native-select-option, option")]
  return options.map((option) => {
    const value = (option as Element & { value?: string }).value ?? option.getAttribute("value") ?? textOf(option)
    return {
      element: option,
      label: (option as HTMLOptionElement).label || option.getAttribute("label") || textOf(option),
      icon: iconOf(option),
      disabled: isDisabled(option),
      checked: String(select.value ?? "") === String(value),
      role: "radio",
      select: () => {
        if (String(select.value ?? "") === String(value)) return
        ;(select as { value?: string }).value = value
        fireValueEvents(control)
      },
    }
  })
}

/** The options of a tab list, toggle group or radio group: each one is clicked when chosen. */
function choiceOptions(control: Element): Option[] {
  const multiple = control.localName === "tec-toggle-group" && (control.hasAttribute("multiple") || control.getAttribute("type") === "multiple")
  const selector =
    control.localName === "tec-tabs"
      ? "tec-tabs-trigger"
      : control.localName === "tec-toggle-group"
        ? "tec-toggle-group-item"
        : "tec-radio-group-item, tec-radio, input[type=radio]"
  return [...control.querySelectorAll(selector)].map((element) => ({
    element,
    label: element.getAttribute("aria-label") || textOf(element),
    icon: iconOf(element),
    disabled: isDisabled(element),
    checked: isOn(element),
    role: multiple ? "checkbox" : "radio",
    select: () => (element as HTMLElement).click(),
  }))
}

/** The items of a dropdown menu in the row: chosen by clicking the original item. */
function dropdownOptions(control: Element): Option[] {
  const selector = "tec-dropdown-menu-label, tec-dropdown-menu-item, tec-dropdown-menu-checkbox-item, tec-dropdown-menu-radio-item"
  return [...control.querySelectorAll(selector)]
    .filter((el) => !el.closest("tec-dropdown-menu-sub"))
    .map((element) => ({
      element,
      label: textOf(element),
      icon: iconOf(element),
      disabled: isDisabled(element),
      checked: isOn(element),
      role:
        element.localName === "tec-dropdown-menu-label"
          ? "label"
          : element.localName === "tec-dropdown-menu-checkbox-item"
            ? "checkbox"
            : element.localName === "tec-dropdown-menu-radio-item"
              ? "radio"
              : "item",
      select: () => (element as HTMLElement).click(),
    }))
}

function optionEntries(options: Option[]): OverflowMenuEntry[] {
  return options.map((option): OverflowMenuEntry => {
    if (option.role === "label") return { type: "label", label: option.label }
    const base = { label: option.label, icon: option.icon, disabled: option.disabled, onSelect: option.select }
    return option.role === "item" ? { type: "item", ...base } : { type: option.role, checked: option.checked, ...base }
  })
}

/** What the item wraps, as far as the menu form is concerned. */
export interface ControlInfo {
  /** The overflow form picked for `menu-type="auto"`. */
  type: Exclude<OverflowMenuType, "auto">
  /** The element the entry acts on (clicked, or whose value is set). */
  control: Element | null
  /** The element holding the options (select, tabs, toggle group, dropdown menu). */
  options: Element | null
}

/** Classifies the control an item wraps (`menu-type="auto"`). */
export function inspectControl(item: Element): ControlInfo {
  const content = [...item.children].filter((el) => !el.hasAttribute("slot"))
  const find = (selector: string) => {
    for (const el of content) {
      if (el.matches(selector)) return el
      const inner = el.querySelector(selector)
      if (inner) return inner
    }
    return null
  }
  const dropdown = find(DROPDOWN)
  if (dropdown) return { type: "submenu", control: dropdown, options: dropdown }
  const select = find(SELECT)
  if (select) return { type: "submenu", control: select, options: select }
  const choice = find(CHOICE_GROUP)
  if (choice) return { type: "section", control: choice, options: choice }
  const field = find(TEXT_FIELD)
  if (field) return { type: "dialog", control: field, options: null }
  const toggle = find(TOGGLE)
  if (toggle) return { type: "checkbox", control: toggle, options: null }
  const control = find("tec-button, button, a[href], tec-link, [role=button], [tabindex]") ?? content[0] ?? null
  return { type: "item", control, options: null }
}

/** The options of `container` as menu entries (select, choice group or dropdown). */
export function optionsOf(container: Element | null): OverflowMenuEntry[] {
  if (!container) return []
  if (container.matches(SELECT)) return optionEntries(selectOptions(container))
  if (container.matches(CHOICE_GROUP)) return optionEntries(choiceOptions(container))
  if (container.matches(DROPDOWN)) return optionEntries(dropdownOptions(container))
  return []
}
