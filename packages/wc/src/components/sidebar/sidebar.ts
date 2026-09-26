import { ContextConsumer, ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { getTabbables } from "../../internal/focus.js"
import { lockScroll, unlockScroll } from "../../internal/scroll-lock.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  sidebarContext,
  sidebarProviderContext,
  type SidebarCollapsible,
  type SidebarSide,
  type SidebarVariant,
} from "./sidebar-context.js"
import { sidebarStyles } from "./sidebar.styles.js"

export type { SidebarCollapsible, SidebarOpenChangeReason, SidebarSide, SidebarVariant } from "./sidebar-context.js"

/**
 * Place it in a `tec-sidebar-provider`, before the `tec-sidebar-inset`. On desktop it keeps a gap in
 * the page flow and draws itself as a full-height fixed panel (the nearest ancestor with a
 * `transform` or `contain: layout` bounds it instead of the viewport — handy for previews). It
 * collapses off-canvas, to an icon rail, or not at all (`collapsible`). Below the provider's mobile
 * breakpoint it renders as a modal sheet (a native `<dialog>`: Escape and a press on the backdrop
 * close it, focus is trapped and restored).
 *
 * `side` is logical: `left` is the inline start (the right edge in right-to-left pages). Put a
 * `side="right"` sidebar after the `tec-sidebar-inset` (it is drawn at the end of the row either way).
 *
 * Style the content by state from your own CSS: `tec-sidebar:state(icon) .x { display: none }`.
 *
 * @summary The collapsible sidebar panel.
 *
 * @tag tec-sidebar
 *
 * @slot - `tec-sidebar-header`, `tec-sidebar-content`, `tec-sidebar-footer` and a `tec-sidebar-rail`.
 *
 * @csspart base - The sidebar surface (background, radius and ring of the floating variant).
 * @csspart gap - Desktop: the element that reserves the sidebar's width in the page flow.
 * @csspart container - Desktop: the fixed, full-height container (border, padding).
 * @csspart sheet - Mobile: the `<dialog>` sheet.
 *
 * @cssstate expanded - Desktop, expanded.
 * @cssstate collapsed - Desktop, collapsed.
 * @cssstate offcanvas - Collapsed off-canvas (hidden).
 * @cssstate icon - Collapsed to the icon rail.
 * @cssstate mobile - Rendered as the mobile sheet.
 */
export class TecSidebar extends TectonElement {
  static styles = [hostStyles, sidebarStyles]

  /** The edge the sidebar sits on (logical: `left` is the inline start). */
  @property({ reflect: true }) side: SidebarSide = "left"

  /** `sidebar`: flush with a border. `floating`: a rounded card with a ring. `inset`: the content becomes the card. */
  @property({ reflect: true }) variant: SidebarVariant = "sidebar"

  /** How it collapses on desktop: off-canvas, to icons, or never. */
  @property({ reflect: true }) collapsible: SidebarCollapsible = "offcanvas"

  /** Accessible name of the mobile sheet. */
  @property() label = "Sidebar"

  @query(".sheet") private sheet?: HTMLDialogElement

  #provider = new ContextConsumer(this, { context: sidebarProviderContext, subscribe: true })
  #context = new ContextProvider(this, { context: sidebarContext, initialValue: undefined })

  get #mobile(): boolean {
    return this.collapsible !== "none" && !!this.#provider.value?.mobile
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    unlockScroll(this)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const provider = this.#provider.value
    const mobile = this.#mobile
    const collapsed = !mobile && this.collapsible !== "none" && provider?.open === false
    this.toggleState("mobile", mobile)
    this.toggleState("expanded", !mobile && !collapsed)
    this.toggleState("collapsed", collapsed)
    this.toggleState("offcanvas", collapsed && this.collapsible === "offcanvas")
    this.toggleState("icon", collapsed && this.collapsible === "icon")
    this.#context.setValue(
      {
        side: this.side,
        variant: this.variant,
        collapsible: this.collapsible,
        collapsed,
        iconCollapsed: collapsed && this.collapsible === "icon",
        mobile,
      },
      true
    )
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#syncSheet()
  }

  #syncSheet(): void {
    const sheet = this.sheet
    if (!sheet) {
      unlockScroll(this)
      return
    }
    const open = !!this.#provider.value?.openMobile
    if (open && !sheet.open) {
      sheet.showModal()
      lockScroll(this)
      const inner = sheet.querySelector<HTMLElement>(".inner")
      const first = inner ? getTabbables(inner)[0] : undefined
      ;(first ?? sheet).focus({ preventScroll: true })
    } else if (!open && sheet.open) {
      sheet.close()
      unlockScroll(this)
    }
  }

  #onCancel = (event: Event) => {
    event.preventDefault()
    this.#provider.value?.requestMobile(false, "escape", event)
  }

  #onSheetClick = (event: MouseEvent) => {
    const sheet = this.sheet
    if (!sheet || event.target !== sheet) return
    const r = sheet.getBoundingClientRect()
    const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
    if (!inside) this.#provider.value?.requestMobile(false, "outside", event)
  }

  protected override render() {
    if (this.collapsible === "none") {
      return html`<div class="inner static" part="base"><slot></slot></div>`
    }
    if (this.#mobile) {
      return html`<dialog
        class="sheet"
        part="sheet"
        aria-label=${this.label}
        @cancel=${this.#onCancel}
        @click=${this.#onSheetClick}
        @close=${() => {
          // closed by the platform (e.g. a form with method=dialog): keep the provider in sync
          if (this.#provider.value?.openMobile) this.#provider.value.requestMobile(false, "escape")
        }}
        ><div class="inner" part="base"><slot></slot></div
      ></dialog>`
    }
    return html`<div class="gap" part="gap"></div>
      <div class="container" part="container"><div class="inner" part="base"><slot></slot></div></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-sidebar": TecSidebar
  }
}
