import { ContextProvider } from "@lit/context"
import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { sidebarProviderContext, type SidebarOpenChangeReason } from "./sidebar-context.js"

/** `detail` of `tec-open-change` on `tec-sidebar-provider`. */
export interface SidebarOpenChangeDetail {
  open: boolean
  /** The change concerns the mobile sheet (below the breakpoint) rather than the desktop sidebar. */
  mobile: boolean
  reason: SidebarOpenChangeReason
}

export type SidebarPersist = "cookie" | "local-storage" | "none"

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

const styles = css`
  :host {
    display: flex;
    width: 100%;
    min-height: 100svh;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }
  :host(:state(inset)) .base {
    background-color: var(--tec-sidebar);
  }
`

/**
 * Holds the state of the sidebars inside it and lays them out next to the content
 * (`tec-sidebar` + `tec-sidebar-inset`, as a full-height row). Every `tec-sidebar-trigger`,
 * `tec-sidebar-rail` and `tec-sidebar-menu-button` inside talks to it.
 *
 * - **Desktop** (≥ `mobile-breakpoint`): the sidebar is expanded or collapsed (`collapsed`
 *   attribute, `open` property). The state is persisted (a 7-day `sidebar_state` cookie by default,
 *   or `localStorage`) and restored when the provider connects.
 * - **Mobile**: sidebars render as a modal sheet, opened with `openMobile` (never persisted).
 * - **Keyboard shortcut**: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>B</kbd> toggles the sidebar (a `window`
 *   listener; change the key with `shortcut`, or set `shortcut=""` to register none).
 *
 * Several providers on one page (micro-frontends) should use their own `persist-key` (or
 * `persist="none"`) and shortcut, so they do not share one cookie and one key.
 *
 * @summary A composable, themeable and customizable sidebar: the state and layout root.
 *
 * @tag tec-sidebar-provider
 *
 * @slot - A `tec-sidebar` and a `tec-sidebar-inset` (the main content), in reading order.
 *
 * @csspart base - The flex row holding the sidebar and the content.
 *
 * @cssprop --tec-sidebar-width - Width of the expanded sidebar (default 16rem). Set it on the provider or an ancestor.
 * @cssprop --tec-sidebar-width-icon - Width of the sidebar collapsed to icons (default 3rem).
 * @cssprop --tec-sidebar-width-mobile - Width of the mobile sheet (default 18rem).
 *
 * @cssstate collapsed - The desktop sidebar is collapsed.
 * @cssstate mobile - The viewport is below the mobile breakpoint.
 * @cssstate open-mobile - The mobile sheet is open.
 * @cssstate inset - A sidebar uses `variant="inset"` (the row gets the sidebar background).
 *
 * @fires tec-open-change - The user expanded/collapsed the sidebar or opened/closed the mobile sheet (trigger, rail, shortcut, Escape, outside press). Cancelable. `detail: { open, mobile, reason }`.
 */
export class TecSidebarProvider extends TectonElement {
  static styles = [hostStyles, styles]

  /** The desktop sidebar is collapsed. Reflects the state; a persisted state overrides it on connect. */
  @property({ type: Boolean, reflect: true }) collapsed = false

  /** The mobile sheet is open. */
  @property({ type: Boolean, reflect: true, attribute: "open-mobile" }) openMobile = false

  /** Where the desktop state is persisted: a `cookie` (read by servers too), `local-storage`, or `none`. */
  @property() persist: SidebarPersist = "cookie"

  /** Cookie / storage key of the persisted state. */
  @property({ attribute: "persist-key" }) persistKey = "sidebar_state"

  /** Key that toggles the sidebar together with Ctrl/⌘. Empty: no shortcut (no `window` listener). */
  @property() shortcut = "b"

  /** Viewport width (px) below which sidebars render as a sheet. */
  @property({ type: Number, attribute: "mobile-breakpoint" }) mobileBreakpoint = 768

  #mobile = false
  #media?: MediaQueryList
  #restored = false
  #provider = new ContextProvider(this, { context: sidebarProviderContext, initialValue: undefined })
  #observer = new MutationObserver(() => this.requestUpdate())

  /** Whether the desktop sidebar is expanded (the inverse of `collapsed`). */
  get open(): boolean {
    return !this.collapsed
  }
  set open(value: boolean) {
    this.collapsed = !value
  }

  /** Whether the viewport is below `mobile-breakpoint` (sidebars are sheets). */
  get mobile(): boolean {
    return this.#mobile
  }

  /** `"expanded"` or `"collapsed"` (desktop). */
  get state(): "expanded" | "collapsed" {
    return this.collapsed ? "collapsed" : "expanded"
  }

  /** Toggles the sidebar that applies: the mobile sheet on small screens, else the desktop sidebar. No event. */
  toggle(): void {
    if (this.#mobile) this.openMobile = !this.openMobile
    else this.collapsed = !this.collapsed
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#restore()
    window.addEventListener("keydown", this.#onKeyDown)
    this.#watchMedia()
    this.#observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ["variant"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("keydown", this.#onKeyDown)
    this.#media?.removeEventListener("change", this.#onMedia)
    this.#media = undefined
    this.#observer.disconnect()
  }

  #watchMedia(): void {
    this.#media?.removeEventListener("change", this.#onMedia)
    this.#media = window.matchMedia(`(max-width: ${this.mobileBreakpoint - 0.02}px)`)
    this.#media.addEventListener("change", this.#onMedia)
    this.#onMedia()
  }

  #onMedia = () => {
    const mobile = !!this.#media?.matches
    if (mobile === this.#mobile) return
    this.#mobile = mobile
    if (!mobile) this.openMobile = false
    this.requestUpdate()
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (!this.shortcut || event.defaultPrevented) return
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
    if (event.key.toLowerCase() !== this.shortcut.toLowerCase()) return
    event.preventDefault()
    this.#toggle("shortcut", event)
  }

  #toggle = (reason: SidebarOpenChangeReason, _event?: Event) => {
    if (this.#mobile) this.#requestMobile(!this.openMobile, reason)
    else if (this.#emit(!this.open, false, reason)) this.collapsed = !this.collapsed
  }

  #requestMobile = (open: boolean, reason: SidebarOpenChangeReason, _event?: Event) => {
    if (open === this.openMobile) return
    if (this.#emit(open, true, reason)) this.openMobile = open
  }

  #emit(open: boolean, mobile: boolean, reason: SidebarOpenChangeReason): boolean {
    return this.emit<SidebarOpenChangeDetail>("tec-open-change", { detail: { open, mobile, reason }, cancelable: true })
  }

  #restore(): void {
    if (this.#restored) return
    this.#restored = true
    const stored = this.#read()
    if (stored !== null) this.collapsed = !stored
  }

  #read(): boolean | null {
    try {
      let value: string | null | undefined = null
      if (this.persist === "cookie") {
        value = document.cookie
          .split("; ")
          .find((c) => c.startsWith(`${this.persistKey}=`))
          ?.slice(this.persistKey.length + 1)
      } else if (this.persist === "local-storage") value = localStorage.getItem(this.persistKey)
      return value === "true" ? true : value === "false" ? false : null
    } catch {
      return null
    }
  }

  #write(): void {
    try {
      if (this.persist === "cookie") {
        document.cookie = `${this.persistKey}=${this.open}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
      } else if (this.persist === "local-storage") localStorage.setItem(this.persistKey, String(this.open))
    } catch {
      /* storage unavailable (private mode, sandboxed iframe) */
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("mobileBreakpoint") && this.isConnected && changed.get("mobileBreakpoint") !== undefined) this.#watchMedia()
    const inset = [...this.querySelectorAll("tec-sidebar[variant=inset]")].some((s) => s.closest("tec-sidebar-provider") === this)
    this.toggleState("collapsed", this.collapsed)
    this.toggleState("mobile", this.#mobile)
    this.toggleState("open-mobile", this.openMobile)
    this.toggleState("inset", inset)
    this.#provider.setValue(
      {
        open: this.open,
        openMobile: this.openMobile,
        mobile: this.#mobile,
        inset,
        toggle: this.#toggle,
        requestMobile: this.#requestMobile,
      },
      true
    )
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // Persist changes of the desktop state (not the initial render).
    if (changed.has("collapsed") && changed.get("collapsed") !== undefined) this.#write()
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-sidebar-provider": TecSidebarProvider
  }
}
