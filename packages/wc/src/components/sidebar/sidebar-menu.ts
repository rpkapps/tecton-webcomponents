import { ContextConsumer, ContextProvider } from "@lit/context"
import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { PopupController, popupStyles } from "../../internal/popup.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { sidebarMenuItemContext, type SidebarMenuItemContextValue } from "./sidebar-context.js"
import { SidebarActionBase, SidebarPart } from "./sidebar-parts.js"
import {
  sidebarActionStyles,
  sidebarMenuActionStyles,
  sidebarMenuBadgeStyles,
  sidebarMenuButtonStyles,
  sidebarMenuItemStyles,
  sidebarMenuSkeletonStyles,
  sidebarMenuStyles,
  sidebarMenuSubButtonStyles,
  sidebarMenuSubItemStyles,
  sidebarMenuSubStyles,
} from "./sidebar.styles.js"

export type SidebarMenuButtonSize = "default" | "sm" | "lg"
export type SidebarMenuButtonVariant = "default" | "outline"

/**
 * @summary A list (`role="list"`) of sidebar menu items.
 * @tag tec-sidebar-menu
 * @slot - `tec-sidebar-menu-item`s.
 */
export class TecSidebarMenu extends TectonElement {
  static styles = [hostStyles, sidebarMenuStyles]
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
  }
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * One row of a sidebar menu (`role="listitem"`): a menu button, and optionally an action, a badge or
 * a sub menu. It tells its action and badge how to align with the button and reveals
 * `show-on-hover` actions while hovered or focused.
 *
 * @summary An item of a sidebar menu.
 * @tag tec-sidebar-menu-item
 * @slot - A `tec-sidebar-menu-button` (or a menu/collapsible wrapping one), a `tec-sidebar-menu-action`, a `tec-sidebar-menu-badge`, a `tec-sidebar-menu-sub`.
 */
export class TecSidebarMenuItem extends TectonElement {
  static styles = [hostStyles, sidebarMenuItemStyles]

  #engaged = false
  #provider = new ContextProvider(this, { context: sidebarMenuItemContext, initialValue: undefined })
  #observer = new MutationObserver(() => this.requestUpdate())

  constructor() {
    super()
    const engage = () => {
      const engaged = this.matches(":hover, :focus-within")
      if (engaged !== this.#engaged) {
        this.#engaged = engaged
        this.requestUpdate()
      }
    }
    this.addEventListener("pointerenter", engage)
    this.addEventListener("pointerleave", () => requestAnimationFrame(engage))
    this.addEventListener("focusin", engage)
    this.addEventListener("focusout", () => requestAnimationFrame(engage))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "listitem"
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["size", "active"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #own<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((el) => el.closest("tec-sidebar-menu-item") === this)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const button = this.#own<TecSidebarMenuButton>("tec-sidebar-menu-button")[0]
    const value: SidebarMenuItemContextValue = {
      hasAction: this.#own("tec-sidebar-menu-action").length > 0,
      buttonSize: (button?.getAttribute("size") as SidebarMenuItemContextValue["buttonSize"] | null) ?? "default",
      buttonActive: !!button?.hasAttribute("active"),
      engaged: this.#engaged,
    }
    this.#provider.setValue(value, true)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/** Shared by the menu button and the sub button: `<a href>` or `<button>`, `active`, ARIA delegation. */
class SidebarRowButton extends SidebarPart {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Renders a link (`<a href>`) instead of a button. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). */
  @property() rel?: string

  /** Marks the current destination: the accent background, and `aria-current="page"` on a link. */
  @property({ type: Boolean, reflect: true }) active = false

  /** Disables the row. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The inner `<a>` or `<button>`. */
  @query(".base") readonly control!: HTMLAnchorElement | HTMLButtonElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: ["aria-current"] })
    new FocusVisibleController(this)
    this.addEventListener(
      "click",
      (event) => {
        if (this.disabled) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      },
      true
    )
  }

  override click(): void {
    this.control?.click()
  }

  protected renderControl() {
    const content = html`<slot></slot>`
    const current = this.getAttribute("aria-current") ?? (this.active && this.href !== undefined ? "page" : undefined)
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${ifDefined(this.disabled ? undefined : this.href)}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        role=${this.disabled ? "link" : nothing}
        aria-disabled=${this.disabled ? "true" : nothing}
        aria-current=${ifDefined(current)}
        >${content}</a
      >`
    }
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled} aria-current=${ifDefined(current)}>
      ${content}
    </button>`
  }
}

/**
 * A row of the sidebar menu: an icon and a label (wrap the label in a `<span>` so it truncates).
 * With `href` it is a link, else a button — make it the `slot="trigger"` of a dropdown menu or a
 * collapsible to open one. `active` marks the current destination (and sets `aria-current="page"`
 * on links).
 *
 * When the sidebar is collapsed to icons the row shrinks to its icon and `tooltip` (if set) shows the
 * label on hover and focus, towards the content side.
 *
 * @summary A button or link in a sidebar menu.
 * @tag tec-sidebar-menu-button
 * @slot - A leading icon and the label (`<span>`); more content (a trailing chevron) may follow.
 * @csspart base - The inner `<a>` or `<button>`.
 * @csspart tooltip - The tooltip shown while collapsed to icons.
 * @cssstate icon - The sidebar is collapsed to icons.
 * @cssstate has-action - The item has a menu action (room is left for it).
 * @cssstate focus-visible - Keyboard focus.
 */
export class TecSidebarMenuButton extends SidebarRowButton {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".tooltip"), sidebarMenuButtonStyles]

  /** Row height: `default` (2rem), `sm` (1.75rem, small text) or `lg` (3rem, e.g. an avatar and two lines). */
  @property({ reflect: true }) size: SidebarMenuButtonSize = "default"

  /** `outline` adds a background and a ring. */
  @property({ reflect: true }) variant: SidebarMenuButtonVariant = "default"

  /** Label shown in a tooltip while the sidebar is collapsed to icons. */
  @property() tooltip?: string

  #item = new ContextConsumer(this, { context: sidebarMenuItemContext, subscribe: true })
  #tooltipOpen = false
  #popup = new PopupController(this, {
    popup: () => this.renderRoot.querySelector<HTMLElement>(".tooltip"),
    anchor: () => this,
    haspopup: false,
    expanded: false,
    placement: () => ({ side: this.sidebar.value?.side === "right" ? "inline-start" : "inline-end", align: "center", sideOffset: 4 }),
    arrow: () => this.renderRoot.querySelector<HTMLElement>(".arrow"),
    focus: { initial: "none", restore: false },
    dismiss: { escape: true, outsidePress: false },
    onRequestClose: () => this.#setTooltip(false),
  })

  constructor() {
    super()
    this.addEventListener("pointerenter", () => this.#setTooltip(true))
    this.addEventListener("pointerleave", () => this.#setTooltip(false))
    this.addEventListener("focusin", () => {
      if (this.matches(":state(focus-visible)") || this.control?.matches(":focus-visible")) this.#setTooltip(true)
    })
    this.addEventListener("focusout", () => this.#setTooltip(false))
    this.addEventListener("pointerdown", () => this.#setTooltip(false))
  }

  get #tooltipEnabled(): boolean {
    const s = this.sidebar.value
    return !!this.tooltip && !!s?.iconCollapsed && !s.mobile
  }

  #setTooltip(open: boolean): void {
    const next = open && this.#tooltipEnabled
    if (next === this.#tooltipOpen) return
    this.#tooltipOpen = next
    void this.#popup.setOpen(next)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#tooltipOpen = false
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("has-action", !!this.#item.value?.hasAction)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (!this.#tooltipEnabled) this.#setTooltip(false)
    const tip = this.renderRoot.querySelector(".tooltip")
    if (this.control && !this.hasAttribute("aria-describedby")) {
      this.control.ariaDescribedByElements = this.#tooltipEnabled && tip ? [tip] : null
    }
  }

  protected override render() {
    const tooltip = this.tooltip
      ? html`<div class="tooltip" part="tooltip" popover="manual" role="tooltip">${this.tooltip}<span class="arrow"></span></div>`
      : nothing
    return html`${this.renderControl()}${tooltip}`
  }
}

/**
 * An icon button at the end of a menu row (e.g. a "More" menu trigger). Name it with `aria-label` or
 * a visually hidden text. `show-on-hover` hides it (from 768px) until the row is hovered or focused
 * or its menu is open. Hidden when the sidebar is collapsed to icons.
 *
 * @summary An action for a sidebar menu item.
 * @tag tec-sidebar-menu-action
 * @slot - An icon (and a visually hidden label).
 * @csspart base - The inner `<button>`.
 * @cssstate icon - The sidebar is collapsed to icons (hidden).
 * @cssstate engaged - The row is hovered or has focus.
 * @cssstate focus-visible - Keyboard focus.
 */
export class TecSidebarMenuAction extends SidebarActionBase {
  static styles = [hostStyles, sidebarActionStyles, sidebarMenuActionStyles]

  /** Only show the action while the row is hovered or focused (on screens ≥ 768px). */
  @property({ type: Boolean, reflect: true, attribute: "show-on-hover" }) showOnHover = false

  #item = new ContextConsumer(this, { context: sidebarMenuItemContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const item = this.#item.value
    this.toggleState("engaged", !!item?.engaged)
    this.toggleState("size-sm", item?.buttonSize === "sm")
    this.toggleState("size-lg", item?.buttonSize === "lg")
    this.toggleState("button-active", !!item?.buttonActive && this.showOnHover)
  }
}

/**
 * A count at the end of a menu row. Decorative for pointer users (it ignores the pointer); it is
 * read after the row by screen readers. Hidden when the sidebar is collapsed to icons.
 *
 * @summary A badge for a sidebar menu item.
 * @tag tec-sidebar-menu-badge
 * @slot - The count.
 * @csspart base - The badge box.
 * @cssstate icon - The sidebar is collapsed to icons (hidden).
 */
export class TecSidebarMenuBadge extends SidebarPart {
  static styles = [hostStyles, sidebarMenuBadgeStyles]

  #item = new ContextConsumer(this, { context: sidebarMenuItemContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const item = this.#item.value
    this.toggleState("size-sm", item?.buttonSize === "sm")
    this.toggleState("size-lg", item?.buttonSize === "lg")
    this.toggleState("button-active", !!item?.buttonActive)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * A placeholder row while the menu loads (hidden from assistive technology: announce loading
 * elsewhere, e.g. `aria-busy` on the menu). The text bar gets a random width between 50% and 90%.
 *
 * @summary A loading placeholder for a sidebar menu row.
 * @tag tec-sidebar-menu-skeleton
 * @csspart base - The row.
 */
export class TecSidebarMenuSkeleton extends TectonElement {
  static styles = [hostStyles, sidebarMenuSkeletonStyles]

  /** Shows an icon placeholder before the text. */
  @property({ type: Boolean, reflect: true, attribute: "show-icon" }) showIcon = false

  #width = `${Math.floor(Math.random() * 40) + 50}%`

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
  }

  protected override render() {
    return html`<div class="base" part="base">
      ${this.showIcon ? html`<div class="icon"></div>` : nothing}
      <div class="text" style="--_skeleton-width: ${this.#width}"></div>
    </div>`
  }
}

/**
 * A nested list under a menu button, drawn with a guide line. Hidden when the sidebar is collapsed
 * to icons. Put it in a `tec-collapsible` to expand it from the row.
 *
 * @summary A sub menu of a sidebar menu item.
 * @tag tec-sidebar-menu-sub
 * @slot - `tec-sidebar-menu-sub-item`s.
 * @csspart base - The indented list with its guide line.
 * @cssstate icon - The sidebar is collapsed to icons (hidden).
 */
export class TecSidebarMenuSub extends SidebarPart {
  static styles = [hostStyles, sidebarMenuSubStyles]
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
  }
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary An item of a sidebar sub menu (`role="listitem"`).
 * @tag tec-sidebar-menu-sub-item
 * @slot - A `tec-sidebar-menu-sub-button`.
 */
export class TecSidebarMenuSubItem extends TectonElement {
  static styles = [hostStyles, sidebarMenuSubItemStyles]
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "listitem"
  }
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A link (with `href`) or button in a sub menu. `active` marks the current destination.
 *
 * @summary A button or link in a sidebar sub menu.
 * @tag tec-sidebar-menu-sub-button
 * @slot - The label (`<span>`), optionally after an icon.
 * @csspart base - The inner `<a>` or `<button>`.
 * @cssstate icon - The sidebar is collapsed to icons (hidden).
 * @cssstate focus-visible - Keyboard focus.
 */
export class TecSidebarMenuSubButton extends SidebarRowButton {
  static styles = [hostStyles, sidebarMenuSubButtonStyles]

  /** Text size: `md` (sm text) or `sm` (xs text). */
  @property({ reflect: true }) size: "sm" | "md" = "md"

  protected override render() {
    return this.renderControl()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-sidebar-menu": TecSidebarMenu
    "tec-sidebar-menu-item": TecSidebarMenuItem
    "tec-sidebar-menu-button": TecSidebarMenuButton
    "tec-sidebar-menu-action": TecSidebarMenuAction
    "tec-sidebar-menu-badge": TecSidebarMenuBadge
    "tec-sidebar-menu-skeleton": TecSidebarMenuSkeleton
    "tec-sidebar-menu-sub": TecSidebarMenuSub
    "tec-sidebar-menu-sub-item": TecSidebarMenuSubItem
    "tec-sidebar-menu-sub-button": TecSidebarMenuSubButton
  }
}
