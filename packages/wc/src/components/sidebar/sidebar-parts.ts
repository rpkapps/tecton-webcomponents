import { ContextConsumer } from "@lit/context"
import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { PanelLeft } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { FormControlMixin } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecButton } from "../button/button.js"
import { sidebarContext, sidebarProviderContext } from "./sidebar-context.js"
import {
  sidebarActionStyles,
  sidebarContentStyles,
  sidebarGroupActionStyles,
  sidebarGroupContentStyles,
  sidebarGroupLabelStyles,
  sidebarGroupStyles,
  sidebarInputStyles,
  sidebarInsetStyles,
  sidebarRailStyles,
  sidebarSectionStyles,
  sidebarSeparatorStyles,
  sidebarTriggerStyles,
} from "./sidebar.styles.js"

/** Base of the parts that follow the enclosing `tec-sidebar` (`:state(icon)` when collapsed to icons). */
export class SidebarPart extends TectonElement {
  protected sidebar = new ContextConsumer(this, { context: sidebarContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("icon", !!this.sidebar.value?.iconCollapsed)
  }
}

/**
 * @summary The top of the sidebar (sticky): branding, a workspace switcher, a search input.
 * @tag tec-sidebar-header
 * @slot - The header content (often a `tec-sidebar-menu`).
 * @csspart base - The padded column.
 */
export class TecSidebarHeader extends TectonElement {
  static styles = [hostStyles, sidebarSectionStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary The bottom of the sidebar (sticky): the user menu, settings.
 * @tag tec-sidebar-footer
 * @slot - The footer content (often a `tec-sidebar-menu`).
 * @csspart base - The padded column.
 */
export class TecSidebarFooter extends TectonElement {
  static styles = [hostStyles, sidebarSectionStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Takes the height between the header and the footer and scrolls (without a visible scrollbar).
 *
 * @summary The scrollable region of the sidebar.
 * @tag tec-sidebar-content
 * @slot - `tec-sidebar-group`s.
 * @csspart base - The scroll container.
 * @cssstate icon - The sidebar is collapsed to icons (no scrolling).
 */
export class TecSidebarContent extends SidebarPart {
  static styles = [hostStyles, sidebarContentStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary A section of the sidebar: a label, an optional action and its content.
 * @tag tec-sidebar-group
 * @slot - A `tec-sidebar-group-label`, a `tec-sidebar-group-action` and a `tec-sidebar-group-content` (or a `tec-sidebar-menu`).
 * @csspart base - The padded column.
 */
export class TecSidebarGroup extends TectonElement {
  static styles = [hostStyles, sidebarGroupStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * It slides out of view when the sidebar is collapsed to icons. To make a group collapsible, put a
 * `tec-collapsible` trigger in it.
 *
 * @summary The heading of a sidebar group.
 * @tag tec-sidebar-group-label
 * @slot - The label text (and an optional icon or trigger).
 * @csspart base - The label row.
 * @cssstate icon - The sidebar is collapsed to icons (the label is hidden).
 */
export class TecSidebarGroupLabel extends SidebarPart {
  static styles = [hostStyles, sidebarGroupLabelStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary The content of a sidebar group.
 * @tag tec-sidebar-group-content
 * @slot - Usually a `tec-sidebar-menu`.
 */
export class TecSidebarGroupContent extends TectonElement {
  static styles = [hostStyles, sidebarGroupContentStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/** Shared by the group action and the menu action: a small icon `<button>`. */
export class SidebarActionBase extends SidebarPart {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Disables the action. */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".base") readonly control!: HTMLButtonElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control })
    new FocusVisibleController(this)
  }

  override click(): void {
    this.control?.click()
  }

  protected override render() {
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled}><slot></slot></button>`
  }
}

/**
 * An icon button in the corner of a group (e.g. "Add project"). Name it with `aria-label` or a
 * visually hidden text. Hidden when the sidebar is collapsed to icons.
 *
 * @summary An action for a sidebar group.
 * @tag tec-sidebar-group-action
 * @slot - An icon (and a visually hidden label).
 * @csspart base - The inner `<button>`.
 * @cssstate icon - The sidebar is collapsed to icons (the action is hidden).
 * @cssstate focus-visible - Keyboard focus.
 */
export class TecSidebarGroupAction extends SidebarActionBase {
  static styles = [hostStyles, sidebarActionStyles, sidebarGroupActionStyles]
}

/**
 * @summary A separator inside the sidebar.
 * @tag tec-sidebar-separator
 * @csspart base - The line.
 */
export class TecSidebarSeparator extends TectonElement {
  static styles = [hostStyles, sidebarSeparatorStyles]
  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "separator"
  }
  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

/**
 * A ghost icon button (`tec-button`) that toggles the sidebar: the mobile sheet on small screens,
 * else expanded/collapsed. It exposes `aria-expanded`. Place it anywhere in the provider (usually
 * the page header in `tec-sidebar-inset`). The icon mirrors in right-to-left layouts.
 *
 * @summary A button that toggles the sidebar.
 * @tag tec-sidebar-trigger
 * @slot - Replaces the panel icon.
 * @csspart base - The inner `<button>`.
 */
export class TecSidebarTrigger extends TecButton {
  static override styles = [...TecButton.styles, sidebarTriggerStyles]

  /** Accessible name. */
  @property() label = "Toggle Sidebar"

  #provider = new ContextConsumer(this, { context: sidebarProviderContext, subscribe: true })

  constructor() {
    super()
    this.variant = "ghost"
    this.size = "icon-sm"
    this.addEventListener("click", (event) => {
      if (event.defaultPrevented || this.disabled) return
      this.#provider.value?.toggle("trigger", event)
    })
  }

  protected override render() {
    const p = this.#provider.value
    const expanded = p ? (p.mobile ? p.openMobile : p.open) : false
    return html`<button
      class="base"
      part="base"
      type="button"
      ?disabled=${this.disabled}
      aria-label=${this.label}
      aria-expanded=${p ? String(expanded) : nothing}
    >
      <slot>${icon(PanelLeft, { size: 16, class: "icon" })}</slot>
    </button>`
  }
}

/**
 * A thin hit area on the sidebar's inner edge that toggles it on click (hover shows a line). It is
 * not in the tab order (the trigger and the keyboard shortcut are the keyboard paths). Hidden below
 * 640px.
 *
 * @summary An edge handle that toggles the sidebar.
 * @tag tec-sidebar-rail
 * @csspart base - The inner `<button>`.
 */
export class TecSidebarRail extends SidebarPart {
  static styles = [hostStyles, sidebarRailStyles]

  /** Accessible name (and tooltip). */
  @property() label = "Toggle Sidebar"

  #provider = new ContextConsumer(this, { context: sidebarProviderContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const s = this.sidebar.value
    this.toggleState("right", s?.side === "right")
    this.toggleState("collapsed", !!s?.collapsed)
    this.toggleState("offcanvas", !!s?.collapsed && s.collapsible === "offcanvas")
  }

  protected override render() {
    return html`<button
      class="base"
      part="base"
      type="button"
      tabindex="-1"
      aria-label=${this.label}
      title=${this.label}
      @click=${(e: Event) => this.#provider.value?.toggle("rail", e)}
    ></button>`
  }
}

/**
 * The main content next to the sidebar (a `<main>` landmark in its shadow root, so a slotted `<header>` is
 * not a page banner). With a `variant="inset"` sidebar it becomes
 * a rounded, raised card inset from the edges.
 *
 * @summary The main content area beside the sidebar.
 * @tag tec-sidebar-inset
 * @slot - The page: header, content.
 * @csspart base - The `<main>` content surface (background, radius, shadow).
 * @cssstate inset - The provider has a `variant="inset"` sidebar (desktop).
 * @cssstate collapsed - The sidebar is collapsed.
 */
export class TecSidebarInset extends TectonElement {
  static styles = [hostStyles, sidebarInsetStyles]

  #provider = new ContextConsumer(this, { context: sidebarProviderContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const p = this.#provider.value
    this.toggleState("inset", !!p?.inset && !p.mobile)
    this.toggleState("collapsed", p?.open === false)
  }

  protected override render() {
    return html`<main class="base" part="base"><slot></slot></main>`
  }
}

/**
 * A compact text input on the sidebar surface (search, filter). It is a form control: `name`,
 * `value`, `required`, `<label for>`, form reset and validation work as with `<input>`.
 *
 * @summary A text input for the sidebar.
 * @tag tec-sidebar-input
 * @csspart base - The native `<input>`.
 * @fires input - The value changed (as the user types).
 * @fires change - The user committed a value.
 */
export class TecSidebarInput extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, sidebarInputStyles]
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Input type. */
  @property() type: "text" | "search" | "email" | "url" | "tel" = "text"

  /** Placeholder text. */
  @property() placeholder = ""

  /** Autocomplete hint. */
  @property() autocomplete?: string

  @query("input") readonly input!: HTMLInputElement

  protected override get formControl(): HTMLInputElement | null {
    return this.input ?? null
  }

  protected override render() {
    return html`<input
      class="base"
      part="base"
      type=${this.type}
      .value=${live(this.value)}
      placeholder=${this.placeholder || nothing}
      autocomplete=${(this.autocomplete as never) ?? nothing}
      ?disabled=${this.isDisabled}
      ?required=${this.required}
      @input=${(e: Event) => (this.value = (e.target as HTMLInputElement).value)}
      @change=${this.redispatchChange}
    />`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-sidebar-header": TecSidebarHeader
    "tec-sidebar-footer": TecSidebarFooter
    "tec-sidebar-content": TecSidebarContent
    "tec-sidebar-group": TecSidebarGroup
    "tec-sidebar-group-label": TecSidebarGroupLabel
    "tec-sidebar-group-content": TecSidebarGroupContent
    "tec-sidebar-group-action": TecSidebarGroupAction
    "tec-sidebar-separator": TecSidebarSeparator
    "tec-sidebar-trigger": TecSidebarTrigger
    "tec-sidebar-rail": TecSidebarRail
    "tec-sidebar-inset": TecSidebarInset
    "tec-sidebar-input": TecSidebarInput
  }
}
