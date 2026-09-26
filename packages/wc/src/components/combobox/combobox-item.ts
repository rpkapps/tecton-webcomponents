import { ListEmptyBase, ListGroupBase, ListItemBase, ListLabelBase, ListSeparatorBase } from "../select/listbox-core.js"

/**
 * Selection is owned by the parent `tec-combobox`: the item is an `option` whose `aria-selected`
 * follows the combobox value; a check mark is drawn at the inline end when it is selected. Set
 * `label` when the content is richer than plain text — it is what the input shows once the item is
 * chosen, and what the filter matches.
 *
 * @summary An option of a `tec-combobox`.
 *
 * @tag tec-combobox-item
 *
 * @slot - The option content (text, icons, or custom markup with a `label`).
 * @slot start - A leading icon.
 *
 * @csspart base - The option row (padding, highlight background).
 * @csspart indicator - The check mark container.
 *
 * @cssprop --tec-icon-size - Size of slotted icons (1rem).
 *
 * @cssstate selected - The option is selected.
 * @cssstate highlighted - The option is the active descendant (keyboard or pointer).
 * @cssstate filtered - The typed text hides the option.
 * @cssstate disabled - The option is disabled.
 */
export class TecComboboxItem extends ListItemBase {}

/**
 * @summary A group of `tec-combobox-item`s with a heading.
 *
 * @tag tec-combobox-group
 *
 * @slot - A `tec-combobox-label` (optional), the group's items and an optional trailing `tec-combobox-separator`.
 *
 * @csspart base - The group box.
 * @csspart label - The heading drawn from the `label` attribute.
 *
 * @cssstate filtered - The typed text hides every item of the group.
 */
export class TecComboboxGroup extends ListGroupBase {
  protected override labelTag = "tec-combobox-label"
}

/**
 * @summary The heading of a `tec-combobox-group` (names the group).
 *
 * @tag tec-combobox-label
 *
 * @slot - The heading text.
 *
 * @csspart base - The heading box (padding, muted text).
 */
export class TecComboboxLabel extends ListLabelBase {}

/**
 * @summary A horizontal rule between items or groups of a `tec-combobox`.
 *
 * @tag tec-combobox-separator
 *
 * @csspart base - The 1px line.
 *
 * @cssstate filtered - Hidden while the typed text filters the list.
 */
export class TecComboboxSeparator extends ListSeparatorBase {}

/**
 * With an empty element the popup stays open when nothing matches and shows the message; without
 * one it closes.
 *
 * @summary The message a `tec-combobox` shows when no option matches.
 *
 * @tag tec-combobox-empty
 *
 * @slot - The message ("No items found.").
 *
 * @csspart base - The message box.
 *
 * @cssstate shown - No option is visible, the message is displayed.
 */
export class TecComboboxEmpty extends ListEmptyBase {}

declare global {
  interface HTMLElementTagNameMap {
    "tec-combobox-item": TecComboboxItem
    "tec-combobox-group": TecComboboxGroup
    "tec-combobox-label": TecComboboxLabel
    "tec-combobox-separator": TecComboboxSeparator
    "tec-combobox-empty": TecComboboxEmpty
  }
}
