import { defineElement } from "../../internal/define.js"
import { TecThemeRoot } from "./theme-root.js"

defineElement("tec-theme-root", TecThemeRoot)

export { TecThemeRoot }
export {
  DEFAULT_THEME_STORAGE_KEY,
  getTheme,
  isThemePreference,
  onSystemThemeChange,
  readStoredTheme,
  resolveTheme,
  setTheme,
  systemPrefersDark,
  writeStoredTheme,
} from "./theme.js"
export type { ResolvedTheme, ThemeOptions, ThemePreference } from "./theme.js"
