import { ContextEvent, createContext } from "@lit/context"
import type { ShortcutRegistry } from "./registry.js"

/** The registry of the nearest `tec-shortcuts`, for its descendants (`tec-shortcut`, `tec-shortcut-list`). */
export const shortcutsContext = createContext<ShortcutRegistry | undefined>(Symbol("tec-shortcuts"))

/**
 * The registry of the `tec-shortcuts` element around `element` (through shadow roots), or `undefined`
 * outside one. Code that is not a Tecton element — an application mounted into the shell, a plain
 * script — registers its shortcuts with it:
 *
 * ```ts
 * const unregister = getShortcutRegistry(container)?.register({ id: "wells.new", keys: "n", label: "Create well", onAction })
 * ```
 */
export function getShortcutRegistry(element: Element): ShortcutRegistry | undefined {
  let found: ShortcutRegistry | undefined
  element.dispatchEvent(
    new ContextEvent(shortcutsContext, element, (value) => {
      found = value
    })
  )
  return found
}
