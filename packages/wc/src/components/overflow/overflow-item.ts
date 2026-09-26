import { arrow, computePosition, flip, offset, shift } from "@floating-ui/dom"
import { html, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { X } from "lucide"
import { icon } from "../../internal/icons.js"
import { popupStyles } from "../../internal/popup.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { iconOf, inspectControl, isDisabled, isOn, optionsOf, textOf, type OverflowMenuEntry, type OverflowMenuType } from "./overflow-forms.js"
import { overflowItemStyles, overflowLabelStyles } from "./overflow.styles.js"

export type { OverflowMenuEntry, OverflowMenuType } from "./overflow-forms.js"

/** `collapse`: the label can drop to icon-only; `keep`: it never does. */
export type OverflowLabelBehavior = "collapse" | "keep"

/** A custom overflow form: entries, or a function of the item returning them. */
export type OverflowMenuForm = OverflowMenuEntry[] | ((item: TecOverflowItem) => OverflowMenuEntry[])

/** The row an item reports to (`tec-overflow` and the elements built on it). @internal */
export interface OverflowRowLike extends HTMLElement {
  itemChanged(item: TecOverflowItem): void
  focusMenuTrigger(): void
}

function isRow(el: Element | null): el is OverflowRowLike {
  return !!el && typeof (el as Partial<OverflowRowLike>).itemChanged === "function"
}

/**
 * Wrap every control that may leave the row in a `tec-overflow-item`; controls that are not wrapped
 * (or items with `fixed`) never leave. Items must be direct children of the row (or of a
 * `tec-overflow-group` in it).
 *
 * The item's overflow form (what it becomes in the More menu) is derived from the control it wraps:
 * a button becomes a menu item that clicks the button, a toggle (`aria-pressed`, `tec-toggle`,
 * checkbox, switch) a checkbox item, a select a submenu of radio items that sets its value, tabs and
 * toggle groups a labelled section of radio (or checkbox) items that click the original, a dropdown
 * menu a submenu of its items, and a text field a menu item that opens a dialog holding the same
 * field. Force another form with `menu-type`, or replace it with the `menuForm` property.
 *
 * @summary An item of an overflow row: a control that can collapse to its icon and move into the More menu.
 *
 * @tag tec-overflow-item
 *
 * @slot - The control (a `tec-button`, toggle, select, input …). Put its label text in a `tec-overflow-label`.
 *
 * @csspart tooltip - The tooltip that shows the label while the item is icon-only.
 * @csspart dialog - The dialog that holds a text field while it is in the More menu.
 * @csspart dialog-title - The dialog title (the item's label).
 * @csspart dialog-close - The dialog's close button.
 *
 * @cssprop --tec-overflow-item-min - Minimum inline size of an `elastic` item (default 12rem).
 * @cssprop --tec-overflow-item-max - Maximum inline size of an `elastic` item (default 100%).
 *
 * @cssstate overflowing - The item is in the More menu (hidden in the row).
 * @cssstate compact - The item is icon-only (its `tec-overflow-label` is visually hidden).
 * @cssstate dialog-open - The item's field is shown in the overflow dialog.
 *
 * @fires tec-select - The item's action ran, from the row or from the More menu (`detail: { value }`). Fired for items whose form is a menu item (buttons).
 */
export class TecOverflowItem extends TectonElement {
  static styles = [hostStyles, srOnly, popupStyles, overflowItemStyles]

  /** Stable identifier of the item (reported by `tec-select` and `tec-overflow-change`). */
  @property({ reflect: true }) value = ""

  /** Higher stays in the row longer. Ties leave from the end of the row. Never changes the order. */
  @property({ type: Number, reflect: true }) priority = 0

  /** Text of the action: the menu entry, the tooltip while icon-only, and the dialog title. Defaults to the `tec-overflow-label` text. */
  @property() label = ""

  /** Shortcut hint shown in the menu entry (e.g. `⌘E`). */
  @property() shortcut = ""

  /** `destructive` styles the menu entry as destructive. Default: taken from the control's `variant`. */
  @property({ reflect: true }) variant?: "default" | "destructive"

  /**
   * `collapse` lets the label drop to icon-only, `keep` never does. Default: `collapse` when the item
   * has a label and its control has an icon (`svg`, `img`, `tec-icon`, `[data-icon]`), else `keep`.
   */
  @property({ attribute: "label-behavior" }) labelBehavior?: OverflowLabelBehavior

  /** Don't show the label as a tooltip while the item is icon-only. */
  @property({ type: Boolean, attribute: "no-tooltip" }) noTooltip = false

  /** Shrinks between `--tec-overflow-item-min` and `--tec-overflow-item-max` before anything collapses (search fields). */
  @property({ type: Boolean, reflect: true }) elastic = false

  /** Never leaves the row (like an unwrapped control). */
  @property({ type: Boolean, reflect: true }) fixed = false

  /** The overflow form: `auto` (derived from the control), `item`, `checkbox`, `radio`, `section`, `submenu` or `dialog`. */
  @property({ attribute: "menu-type" }) menuType: OverflowMenuType = "auto"

  /** Custom overflow form: menu entries (or a function returning them) used instead of the derived form. */
  @property({ attribute: false }) menuForm: OverflowMenuForm | null = null

  /** Accessible name of the overflow dialog's close button. */
  @property({ attribute: "close-label" }) closeLabel = "Close"

  @state() private dialogOpen = false
  @state() private tooltipShown = false

  @query(".tooltip") private tooltipEl?: HTMLElement
  @query(".arrow") private arrowEl?: HTMLElement
  @query("dialog") private dialogEl?: HTMLDialogElement

  #overflowing = false
  #compact = false
  #warned = false

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
    this.addEventListener("pointerenter", () => this.#showTooltip())
    this.addEventListener("pointerleave", () => this.#hideTooltip())
    this.addEventListener("pointerdown", () => this.#hideTooltip())
    this.addEventListener("focusin", (event) => {
      const target = event.composedPath()[0] as Element
      if (target?.matches?.(":focus-visible")) this.#showTooltip()
    })
    this.addEventListener("focusout", () => this.#hideTooltip())
    this.addEventListener("keydown", (event) => {
      // Hides the tooltip but lets Escape reach whatever else handles it.
      if (event.key === "Escape") this.#hideTooltip()
    })
  }

  /** Whether the item is currently in the More menu. */
  get overflowing(): boolean {
    return this.#overflowing
  }

  /** Whether the item is currently icon-only. */
  get compact(): boolean {
    return this.#compact
  }

  get #row(): OverflowRowLike | null {
    const parent = this.parentElement
    if (isRow(parent)) return parent
    const grand = parent?.localName === "tec-overflow-group" ? parent.parentElement : null
    return isRow(grand) ? grand : null
  }

  /** The label text: `label`, else the `tec-overflow-label` text, else the control's name. */
  get resolvedLabel(): string {
    if (this.label) return this.label
    const own = this.querySelector("tec-overflow-label")
    if (own) return textOf(own)
    const { control } = inspectControl(this)
    return control?.getAttribute("aria-label") || textOf(control) || this.value
  }

  /** The label behaviour in effect (see `label-behavior`). */
  get resolvedLabelBehavior(): OverflowLabelBehavior {
    const hasIcon = iconOf(this) !== null
    if (this.labelBehavior) {
      if (this.labelBehavior === "collapse" && !hasIcon && !this.#warned) {
        this.#warned = true
        console.warn(
          `[tecton] <tec-overflow-item value="${this.value}">: label-behavior="collapse" needs an icon in the control to collapse to; without one the item becomes an empty button.`
        )
      }
      return this.labelBehavior
    }
    const labelled = !!this.label || this.querySelector("tec-overflow-label") !== null
    return labelled && hasIcon ? "collapse" : "keep"
  }

  /**
   * Applies the row's decision (called by the row during its layout pass; synchronous so the row can
   * measure the result before paint). @internal
   */
  setLayoutState(overflowing: boolean, compact: boolean): void {
    if (overflowing !== this.#overflowing) {
      this.#overflowing = overflowing
      this.toggleState("overflowing", overflowing)
      if (overflowing) this.#hideTooltip()
    }
    if (compact !== this.#compact) {
      this.#compact = compact
      this.toggleState("compact", compact)
      for (const label of this.querySelectorAll<TecOverflowLabel>("tec-overflow-label")) label.syncCompact?.()
      if (!compact) this.#hideTooltip()
    }
  }

  /** The item's entries in the More menu. */
  menuEntries(): OverflowMenuEntry[] {
    if (this.menuForm) return typeof this.menuForm === "function" ? this.menuForm(this) : this.menuForm
    const info = inspectControl(this)
    const type = this.menuType === "auto" ? info.type : this.menuType
    const control = info.control
    const label = this.resolvedLabel
    const base = {
      label,
      icon: iconOf(this),
      shortcut: this.shortcut || undefined,
      disabled: control ? isDisabled(control) : false,
      destructive: (this.variant ?? control?.getAttribute("variant")) === "destructive",
    }
    const click = () => (control as HTMLElement | null)?.click()
    switch (type) {
      case "checkbox":
      case "radio":
        return [{ type, ...base, checked: control ? isOn(control) : false, onSelect: click }]
      case "section":
        return [{ type: "group", label, entries: optionsOf(info.options) }]
      case "submenu":
        return [{ type: "submenu", ...base, entries: optionsOf(info.options) }]
      case "dialog":
        return [{ type: "item", ...base, label: `${label}…`, onSelect: () => this.showDialog() }]
      default:
        return [{ type: "item", ...base, onSelect: click }]
    }
  }

  /** Shows the item's control in a modal dialog (the overflow form of text fields). */
  showDialog(): void {
    if (this.dialogOpen) return
    this.toggleState("dialog-open", true)
    this.dialogOpen = true
  }

  /** Closes the overflow dialog; focus returns to the row's More button. */
  hideDialog(): void {
    if (!this.dialogOpen) return
    const dialog = this.dialogEl
    if (dialog?.open) dialog.close()
    else this.#onDialogClose()
  }

  #onDialogClose = () => {
    if (!this.dialogOpen) return
    this.dialogOpen = false
    this.toggleState("dialog-open", false)
    void this.updateComplete.then(() => this.#row?.focusMenuTrigger())
  }

  #onDialogKeyDown = (event: KeyboardEvent) => {
    // Enter submits the field: the dialog closes with the value in place.
    const target = event.composedPath()[0] as Element
    if (event.key === "Enter" && !event.defaultPrevented && target?.localName !== "textarea" && !target?.closest?.("tec-button, button")) {
      event.preventDefault()
      this.hideDialog()
    }
  }

  #onClick = (event: MouseEvent) => {
    if (this.#row && !event.defaultPrevented && inspectControl(this).type === "item" && this.menuType !== "dialog" && !this.menuForm) {
      const { control } = inspectControl(this)
      if (control && event.composedPath().includes(control)) this.emit("tec-select", { detail: { value: this.value } })
    }
  }

  get #tooltipEnabled(): boolean {
    return this.#compact && !this.noTooltip && this.resolvedLabelBehavior !== "keep" && !!this.resolvedLabel
  }

  #showTooltip(): void {
    if (!this.#tooltipEnabled || this.#overflowing) return
    this.tooltipShown = true
    void this.updateComplete.then(() => {
      const tip = this.tooltipEl
      if (!tip || !this.tooltipShown || !this.isConnected) return
      if (!tip.matches(":popover-open")) tip.showPopover()
      void this.#positionTooltip(tip)
    })
  }

  #hideTooltip(): void {
    if (!this.tooltipShown) return
    this.tooltipShown = false
    const tip = this.tooltipEl
    if (tip?.matches(":popover-open")) tip.hidePopover()
  }

  async #positionTooltip(tip: HTMLElement): Promise<void> {
    const arrowEl = this.arrowEl
    const result = await computePosition(this, tip, {
      strategy: "fixed",
      placement: "top",
      middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 }), ...(arrowEl ? [arrow({ element: arrowEl })] : [])],
    })
    tip.style.left = `${result.x}px`
    tip.style.top = `${result.y}px`
    const side = result.placement.split("-")[0]!
    tip.dataset.side = side
    if (arrowEl && result.middlewareData.arrow) {
      const { x, y } = result.middlewareData.arrow
      arrowEl.style.left = x != null ? `${x}px` : ""
      arrowEl.style.top = y != null ? `${y}px` : ""
    }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#row?.itemChanged(this)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#hideTooltip()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("dialogOpen") && this.dialogOpen) {
      const dialog = this.dialogEl
      if (dialog && !dialog.open) dialog.showModal()
      const { control } = inspectControl(this)
      ;(control as HTMLElement | null)?.focus()
    }
    const layout = ["priority", "label", "labelBehavior", "elastic", "fixed", "menuType", "menuForm", "shortcut", "variant"] as const
    if (layout.some((key) => changed.has(key)) && changed.size && this.hasUpdated) this.#row?.itemChanged(this)
  }

  protected override render() {
    const tooltip = this.tooltipShown
      ? html`<div class="tooltip" part="tooltip" popover="manual" aria-hidden="true">${this.resolvedLabel}<span class="arrow"></span></div>`
      : nothing
    if (!this.dialogOpen) return html`<slot @slotchange=${() => this.#row?.itemChanged(this)}></slot>${tooltip}`
    return html`<dialog
      class="dialog"
      part="dialog"
      aria-labelledby="title"
      @close=${this.#onDialogClose}
      @keydown=${this.#onDialogKeyDown}
    >
      <h2 id="title" class="dialog-title" part="dialog-title">${this.resolvedLabel}</h2>
      <div class="dialog-body"><slot></slot></div>
      <tec-button class="dialog-close" part="dialog-close" variant="ghost" size="icon-sm" aria-label=${this.closeLabel} @click=${() => this.hideDialog()}>
        ${icon(X, { size: 16 })}
      </tec-button>
    </dialog>`
  }
}

/**
 * Visually hidden while its item is icon-only, so the control keeps its accessible name (the label
 * stays in the accessibility tree).
 *
 * @summary The label text of an overflow item's control.
 *
 * @tag tec-overflow-label
 *
 * @slot - The label text.
 *
 * @csspart base - The text wrapper (visually hidden while compact).
 *
 * @cssstate compact - The item is icon-only.
 */
export class TecOverflowLabel extends TectonElement {
  static styles = [hostStyles, srOnly, overflowLabelStyles]

  /** Mirrors the item's compact state. @internal */
  syncCompact(): void {
    const item = this.closest("tec-overflow-item") as TecOverflowItem | null
    this.toggleState("compact", !!item?.compact)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.syncCompact()
  }

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-overflow-item": TecOverflowItem
    "tec-overflow-label": TecOverflowLabel
  }
}
