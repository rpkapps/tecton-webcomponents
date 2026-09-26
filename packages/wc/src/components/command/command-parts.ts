import { css, html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { Check } from "lucide"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { ListEmptyBase, ListGroupBase, ListItemBase, ListSeparatorBase } from "../select/listbox-core.js"

/** How `tec-command-item`s of a list are checked: not at all, one at a time, or independently. */
export type CommandSelectionMode = "none" | "single" | "multiple"

/**
 * The list is a `menu` (named "Suggestions" by default) whose items the `tec-command-input` points
 * at with `aria-activedescendant`. With `selection-mode="single" | "multiple"` its items become
 * `menuitemradio` / `menuitemcheckbox` and choosing one toggles its `checked` state.
 *
 * @summary The scrollable list of a `tec-command`.
 *
 * @tag tec-command-list
 *
 * @slot - `tec-command-group`, `tec-command-item`, `tec-command-separator` and `tec-command-empty` elements.
 *
 * @csspart base - The scroll container (max height 18rem).
 *
 * @cssprop --tec-command-list-max-height - Maximum height before the list scrolls (default 18rem).
 */
export class TecCommandList extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .base {
        max-height: var(--tec-command-list-max-height, 18rem);
        overflow-x: hidden;
        overflow-y: auto;
        scroll-padding-block: 0.25rem;
        scrollbar-width: none;
        outline: none;
      }
      .base::-webkit-scrollbar {
        display: none;
      }
    `,
  ]

  /** Accessible name of the menu. */
  @property() label = "Suggestions"

  /** Whether choosing an item checks it (`single`: one item, `multiple`: any number). */
  @property({ attribute: "selection-mode" }) selectionMode: CommandSelectionMode = "none"

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "menu"
    this.internals.ariaLabel = this.label || null
    if (changed.has("selectionMode")) for (const item of this.querySelectorAll<TecCommandItem>("tec-command-item")) item.requestUpdate()
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Activation (Enter on the highlighted item, or a click) fires `tec-select`; inside a
 * `tec-command-dialog` it also closes the dialog unless the event is cancelled. Give items whose
 * content is not plain text a `label`, and add `keywords` for extra search terms.
 *
 * @summary A command in a `tec-command` palette.
 *
 * @tag tec-command-item
 *
 * @slot - The content: an optional leading icon, the text (in a `<span>`) and an optional `tec-command-shortcut`.
 * @slot start - A leading icon (an icon placed first in the default slot works too).
 *
 * @csspart base - The row (padding, highlight background).
 * @csspart indicator - The check mark shown when `checked` (hidden when the item has a shortcut).
 *
 * @cssprop --tec-icon-size - Size of slotted icons (1rem).
 *
 * @cssstate highlighted - The item is the active descendant (keyboard or pointer).
 * @cssstate checked - The item is checked.
 * @cssstate filtered - The search hides the item.
 * @cssstate disabled - The item is disabled.
 *
 * @fires tec-select - The user activated the item. Cancelable (inside a dialog, cancelling keeps it open). `detail: { value }`.
 */
export class TecCommandItem extends ListItemBase {
  static override styles = [
    ...(ListItemBase.styles as []),
    css`
      .base {
        padding-inline: 0.5rem;
      }
      :host(:state(in-dialog)) .base {
        border-radius: var(--tec-radius-lg);
      }
      :host(:state(highlighted)),
      :host(:state(checked)) {
        --tec-command-shortcut-color: var(--tec-foreground);
      }
      :host(:state(highlighted)) .base {
        background-color: var(--tec-muted);
        color: var(--tec-foreground);
      }
      .check {
        margin-inline-start: auto;
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
        opacity: 0;
      }
      :host(:state(checked)) .check {
        opacity: 1;
      }
      :host(:state(has-shortcut)) .check {
        display: none;
      }
    `,
  ]

  /** Extra search terms, comma-separated (`keywords="profile, account"`). */
  @property() keywords = ""

  /** Checked state (with a list `selection-mode`); toggled when the item is chosen. */
  @property({ type: Boolean, reflect: true }) checked = false

  protected override itemRole: "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" = "menuitem"

  override get searchText(): string {
    return `${this.textValue} ${this.keywords.replace(/,/g, " ")}`.trim()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.toggleState("in-dialog", !!this.closest("tec-command-dialog"))
  }

  protected override willUpdate(changed: PropertyValues): void {
    const mode = this.closest("tec-command-list")?.selectionMode ?? "none"
    this.itemRole = mode === "single" ? "menuitemradio" : mode === "multiple" ? "menuitemcheckbox" : "menuitem"
    super.willUpdate(changed)
    this.internals.ariaChecked = mode === "none" ? null : String(this.checked)
    this.toggleState("checked", this.checked)
    this.toggleState("has-shortcut", !!this.querySelector(":scope > tec-command-shortcut"))
  }

  protected override render() {
    return html`<div class="base" part="base">
      <slot name="start"></slot><slot @slotchange=${() => this.requestUpdate()}></slot>${icon(Check, { size: 16, class: "check", part: "indicator" })}
    </div>`
  }
}

/**
 * @summary A group of `tec-command-item`s under a heading; hidden when the search leaves it empty.
 *
 * @tag tec-command-group
 *
 * @slot - The group's items.
 *
 * @csspart base - The group box (padding).
 * @csspart label - The heading.
 *
 * @cssstate filtered - The search hides every item of the group.
 */
export class TecCommandGroup extends ListGroupBase {
  static override styles = [
    ...(ListGroupBase.styles as []),
    css`
      .base {
        overflow: hidden;
        padding: 0.25rem;
        color: var(--tec-foreground);
      }
      .label {
        font-weight: var(--tec-font-weight-medium);
      }
    `,
  ]

  /** The group heading (`label` is accepted too). */
  @property() heading = ""

  protected override get headingText(): string {
    return this.heading || this.label
  }
}

/**
 * @summary A horizontal rule between groups of a `tec-command`; hidden while searching.
 *
 * @tag tec-command-separator
 *
 * @csspart base - The 1px line.
 *
 * @cssstate filtered - Hidden while a search query is active.
 */
export class TecCommandSeparator extends ListSeparatorBase {
  static override styles = [
    ...(ListSeparatorBase.styles as []),
    css`
      .base {
        margin: 0 -0.25rem;
      }
    `,
  ]
  protected override separatorRole: "separator" | "none" = "separator"
}

/**
 * @summary The message a `tec-command` shows when no item matches the search.
 *
 * @tag tec-command-empty
 *
 * @slot - The message ("No results found.").
 *
 * @csspart base - The message box.
 *
 * @cssstate shown - No item is visible, the message is displayed.
 */
export class TecCommandEmpty extends ListEmptyBase {
  static override styles = [
    ...(ListEmptyBase.styles as []),
    css`
      .base {
        padding-block: 1.5rem;
        color: inherit;
      }
    `,
  ]
}

/**
 * @summary A keyboard shortcut hint at the end of a `tec-command-item`.
 *
 * @tag tec-command-shortcut
 *
 * @slot - The shortcut text (`⌘P`).
 *
 * @csspart base - The text.
 *
 * @cssprop --tec-command-shortcut-color - Text colour (muted; the foreground on the highlighted item).
 */
export class TecCommandShortcut extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: contents;
      }
      .base {
        margin-inline-start: auto;
        font-size: var(--tec-text-xs);
        line-height: var(--tec-text-xs--line-height);
        letter-spacing: 0.1em;
        color: var(--tec-command-shortcut-color, var(--tec-muted-foreground));
      }
    `,
  ]

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>${nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-command-list": TecCommandList
    "tec-command-item": TecCommandItem
    "tec-command-group": TecCommandGroup
    "tec-command-separator": TecCommandSeparator
    "tec-command-empty": TecCommandEmpty
    "tec-command-shortcut": TecCommandShortcut
  }
}
