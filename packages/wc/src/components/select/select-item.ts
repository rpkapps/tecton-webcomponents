import { css, html } from "lit"
import { property } from "lit/decorators.js"
import { ListEmptyBase, ListGroupBase, ListItemBase, ListLabelBase, ListSeparatorBase } from "./listbox-core.js"

/**
 * Selection is owned by the parent `tec-select`: the item is an `option` whose `aria-selected`
 * follows the select's value, and a check mark is drawn at the inline end when it is selected.
 *
 * @summary An option of a `tec-select`.
 *
 * @tag tec-select-item
 *
 * @slot - The option content: text, optionally with a leading icon. It is also shown in the trigger when selected.
 * @slot start - A leading icon (an icon placed first in the default slot works too).
 *
 * @csspart base - The option row (padding, highlight background).
 * @csspart content - The wrapper of the slotted content.
 * @csspart indicator - The check mark container.
 *
 * @cssprop --tec-icon-size - Size of slotted icons (1rem).
 *
 * @cssstate selected - The option is selected.
 * @cssstate highlighted - The option is the active descendant (keyboard or pointer).
 * @cssstate filtered - A search hides the option.
 * @cssstate disabled - The option is disabled.
 */
export class TecSelectItem extends ListItemBase {
  static override styles = [
    ...(ListItemBase.styles as []),
    css`
      .content {
        display: flex;
        flex: 1 1 0%;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
      }
    `,
  ]

  /** Initially selected in a `multiple` select (like `<option selected>`); form reset returns to it. */
  @property({ type: Boolean, attribute: "selected" }) defaultSelected = false

  protected override render() {
    return html`<div class="base" part="base">
      <span class="content" part="content"><slot name="start"></slot><slot></slot></span>${this.renderIndicator()}
    </div>`
  }
}

/**
 * @summary A group of `tec-select-item`s with a heading.
 *
 * @tag tec-select-group
 *
 * @slot - A `tec-select-label` (optional) and the group's items.
 *
 * @csspart base - The group box (padding).
 * @csspart label - The heading drawn from the `label` attribute.
 *
 * @cssstate filtered - A search hides every item of the group.
 */
export class TecSelectGroup extends ListGroupBase {
  static override styles = [
    ...(ListGroupBase.styles as []),
    css`
      .base {
        padding: 0.25rem;
        scroll-margin-block: 0.25rem;
      }
    `,
  ]
  protected override labelTag = "tec-select-label"
}

/**
 * @summary The heading of a `tec-select-group` (names the group).
 *
 * @tag tec-select-label
 *
 * @slot - The heading text.
 */
export class TecSelectLabel extends ListLabelBase {}

/**
 * @summary A horizontal rule between groups of a `tec-select`.
 *
 * @tag tec-select-separator
 *
 * @csspart base - The 1px line.
 *
 * @cssstate filtered - Hidden while a search query is active.
 */
export class TecSelectSeparator extends ListSeparatorBase {}

/**
 * @summary The message a searchable `tec-select` shows when no option matches.
 *
 * @tag tec-select-empty
 *
 * @slot - The message ("No items found.").
 *
 * @csspart base - The message box.
 *
 * @cssstate shown - No option is visible, the message is displayed.
 */
export class TecSelectEmpty extends ListEmptyBase {}

declare global {
  interface HTMLElementTagNameMap {
    "tec-select-item": TecSelectItem
    "tec-select-group": TecSelectGroup
    "tec-select-label": TecSelectLabel
    "tec-select-separator": TecSelectSeparator
    "tec-select-empty": TecSelectEmpty
  }
}
