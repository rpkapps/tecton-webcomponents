import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  isThemePreference,
  onSystemThemeChange,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme.js"

/** `inherit` follows the ancestors; the others pin the subtree (see {@link ThemePreference}). */
export type ThemeRootTheme = "inherit" | ThemePreference

const styles = css`
  :host {
    display: block;
  }
  /* A pinned subtree re-resolves the text colour: the inherited value is the parent mode's colour. */
  :host([data-theme]) {
    color: var(--tec-foreground);
  }
`

/**
 * Everything below the element — light-DOM content, every component's shadow root, and the
 * overlays they open — renders in the chosen mode, because the element carries the `data-theme`
 * attribute the Tecton theme keys on and CSS custom properties inherit through shadow roots.
 *
 * Overlays need no portal container: dialogs, popovers, menus and tooltips are shown in the
 * browser's top layer but stay in the DOM where they are declared, so they inherit the root's mode,
 * variables and `dir` like any other descendant.
 *
 * With `storage-key` the preference is persisted in `localStorage`, restored when the element
 * connects, and synchronised across tabs. `theme="system"` follows `prefers-color-scheme` live.
 *
 * @summary Pins a subtree (or the whole application) to light, dark or the system mode.
 *
 * @tag tec-theme-root
 *
 * @slot - The themed content.
 *
 * @cssstate light - The subtree is pinned to light (directly or through `system`).
 * @cssstate dark - The subtree is pinned to dark (directly or through `system`).
 */
export class TecThemeRoot extends TectonElement {
  static styles = [hostStyles, styles]

  /**
   * The mode of the subtree: `inherit` (default, follow the ancestors), `light`, `dark`, or
   * `system` (follow the operating system preference).
   */
  @property({ reflect: true }) theme: ThemeRootTheme = "inherit"

  /**
   * Persist `theme` in `localStorage` under this key: the stored value wins over the attribute when
   * the element connects, and later changes are written back. Empty (default): not persisted.
   */
  @property({ attribute: "storage-key" }) storageKey = ""

  #unsubscribeSystem?: () => void
  #persist = false

  /** The mode the subtree currently shows; `null` with `theme="inherit"`. */
  get resolvedTheme(): ResolvedTheme | null {
    return isThemePreference(this.theme) ? resolveTheme(this.theme) : null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.storageKey) {
      const stored = readStoredTheme(this.storageKey)
      if (stored) this.theme = stored
    }
    window.addEventListener("storage", this.#onStorage)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("storage", this.#onStorage)
    this.#unsubscribeSystem?.()
    this.#unsubscribeSystem = undefined
  }

  #onStorage = (event: StorageEvent) => {
    if (!this.storageKey || event.key !== this.storageKey || !isThemePreference(event.newValue)) return
    this.#persist = false
    this.theme = event.newValue
  }

  #apply(): void {
    const mode = this.resolvedTheme
    if (mode) this.setAttribute("data-theme", mode)
    else this.removeAttribute("data-theme")
    this.toggleState("light", mode === "light")
    this.toggleState("dark", mode === "dark")
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (!changed.has("theme")) return
    this.#unsubscribeSystem?.()
    this.#unsubscribeSystem = this.theme === "system" && this.isConnected ? onSystemThemeChange(() => this.#apply()) : undefined
    this.#apply()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // The first update applies the attribute (or the restored value): nothing to store yet.
    if (changed.has("theme") && this.#persist && this.storageKey && isThemePreference(this.theme)) writeStoredTheme(this.theme, this.storageKey)
    this.#persist = true
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-theme-root": TecThemeRoot
  }
}
