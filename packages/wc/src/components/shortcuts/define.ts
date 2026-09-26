import { defineElement } from "../../internal/define.js"
import { TecShortcut } from "./shortcut.js"
import { TecShortcutKeys } from "./shortcut-keys.js"
import { TecShortcutList } from "./shortcut-list.js"
import { TecShortcuts } from "./shortcuts.js"

// The provider before its consumers.
defineElement("tec-shortcuts", TecShortcuts)
defineElement("tec-shortcut", TecShortcut)
defineElement("tec-shortcut-keys", TecShortcutKeys)
defineElement("tec-shortcut-list", TecShortcutList)

export { TecShortcut, TecShortcutKeys, TecShortcutList, TecShortcuts }
export { createShortcutRegistry, describeShortcut, formatShortcut, isMacPlatform } from "./registry.js"
export type { Shortcut, ShortcutRegistry } from "./registry.js"
export { getShortcutRegistry } from "./shortcuts-context.js"
export type { ShortcutEventDetail } from "./shortcut.js"
export type { ShortcutPlatform } from "./shortcut-keys.js"
