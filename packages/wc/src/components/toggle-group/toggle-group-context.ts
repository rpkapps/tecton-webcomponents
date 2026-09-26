import { createContext } from "@lit/context"
import type { ToggleSize, ToggleVariant } from "../toggle/toggle.js"
import type { TecToggleGroupItem } from "./toggle-group-item.js"

export type ToggleGroupOrientation = "horizontal" | "vertical"

/** What `tec-toggle-group` shares with its items. A new object on every group update. */
export interface ToggleGroupContextValue {
  /** The group's variant/size, which win over the item's own (undefined = the item decides). */
  variant: ToggleVariant | undefined
  size: ToggleSize | undefined
  spacing: number
  orientation: ToggleGroupOrientation
  multiple: boolean
  disabled: boolean
  /** The selected item values. */
  values: readonly string[]
  /** User toggle of an item (fires the cancelable `tec-value-change`). */
  toggle(item: TecToggleGroupItem, event?: Event): void
  /** The enabled/disabled items of the group in DOM order. */
  items(): TecToggleGroupItem[]
}

export const toggleGroupContext = createContext<ToggleGroupContextValue | undefined>(Symbol("tec-toggle-group"))
