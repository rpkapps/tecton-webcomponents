/**
 * Theme helpers: read, apply and persist the light / dark / system preference of the page (or of any
 * element), without a `<tec-theme-root>`.
 *
 * ```ts
 * import { getTheme, setTheme } from "@tecton/wc/theme-root/theme.js"
 *
 * setTheme(getTheme())            // on start-up: apply the stored preference to <html>
 * toggle.addEventListener("click", () => setTheme(resolveTheme(getTheme()) === "dark" ? "light" : "dark"))
 * ```
 *
 * The Tecton theme switches mode with `data-theme="dark" | "light"` (or the `.dark` / `.light` class)
 * on any element; every variable, the palette ramps and `color-scheme` follow below it. "system"
 * resolves to the operating system preference (`prefers-color-scheme`) and keeps following it.
 */

/** A theme preference: a fixed mode, or the operating system's. */
export type ThemePreference = "light" | "dark" | "system"

/** The mode a preference resolves to. */
export type ResolvedTheme = "light" | "dark"

/** The `localStorage` key used when none is given. */
export const DEFAULT_THEME_STORAGE_KEY = "tecton-theme"

const PREFERENCES: readonly string[] = ["light", "dark", "system"]

/** Whether `value` is a valid {@link ThemePreference}. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && PREFERENCES.includes(value)
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

/** Whether the operating system asks for dark mode. */
export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches
}

/** Resolves a preference to the mode it shows now (`"system"` follows `prefers-color-scheme`). */
export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light"
  return theme
}

/** Reads a stored preference; `null` when nothing (valid) is stored or storage is unavailable. */
export function readStoredTheme(storageKey = DEFAULT_THEME_STORAGE_KEY): ThemePreference | null {
  try {
    const value = localStorage.getItem(storageKey)
    return isThemePreference(value) ? value : null
  } catch {
    return null
  }
}

/** Stores a preference (ignored when storage is unavailable, e.g. in a sandboxed frame). */
export function writeStoredTheme(theme: ThemePreference, storageKey = DEFAULT_THEME_STORAGE_KEY): void {
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    /* storage blocked: the preference lasts for this page only */
  }
}

/** Subscribes to changes of the operating system preference; returns the unsubscribe function. */
export function onSystemThemeChange(callback: (theme: ResolvedTheme) => void): () => void {
  if (typeof matchMedia !== "function") return () => {}
  const query = matchMedia(DARK_QUERY)
  const listener = () => callback(query.matches ? "dark" : "light")
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

/** Options of {@link setTheme} and {@link getTheme}. */
export interface ThemeOptions {
  /** The element whose mode changes. Default: `document.documentElement` (the whole page). */
  root?: HTMLElement
  /** `localStorage` key of the preference. Default `"tecton-theme"`; `null` does not persist. */
  storageKey?: string | null
}

interface ThemeRootLike extends HTMLElement {
  theme: string
  storageKey: string
}

const isThemeRoot = (el: HTMLElement): el is ThemeRootLike => el.localName === "tec-theme-root" && "theme" in el

/** Preference currently applied to each plain element (and its system listener). */
const applied = new WeakMap<HTMLElement, { theme: ThemePreference; unsubscribe: () => void }>()

/**
 * Returns the theme preference: the `theme` of a `<tec-theme-root>` root, else the preference last
 * applied with {@link setTheme}, else the stored one, else `"system"`.
 */
export function getTheme(options: ThemeOptions = {}): ThemePreference {
  const root = options.root ?? document.documentElement
  if (isThemeRoot(root) && isThemePreference(root.theme)) return root.theme
  const current = applied.get(root)
  if (current) return current.theme
  if (options.storageKey !== null) {
    const stored = readStoredTheme(options.storageKey ?? DEFAULT_THEME_STORAGE_KEY)
    if (stored) return stored
  }
  return "system"
}

/**
 * Applies a theme preference to `root` (default: the page) by setting its `data-theme`, keeps
 * following the operating system for `"system"`, and stores the preference (unless `storageKey` is
 * `null`). On a `<tec-theme-root>` it sets the element's `theme` (the element persists it when it has
 * a `storage-key`).
 */
export function setTheme(theme: ThemePreference, options: ThemeOptions = {}): void {
  const root = options.root ?? document.documentElement
  if (isThemeRoot(root)) {
    root.theme = theme
    return
  }
  applied.get(root)?.unsubscribe()
  const apply = (mode: ResolvedTheme) => root.setAttribute("data-theme", mode)
  apply(resolveTheme(theme))
  const unsubscribe = theme === "system" ? onSystemThemeChange(apply) : () => {}
  applied.set(root, { theme, unsubscribe })
  if (options.storageKey !== null) writeStoredTheme(theme, options.storageKey ?? DEFAULT_THEME_STORAGE_KEY)
}
