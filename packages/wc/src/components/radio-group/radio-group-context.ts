import { createContext } from "@lit/context"
import type { TecRadioGroupItem } from "./radio-group-item.js"

/** What `tec-radio-group` shares with its items. A new object on every group update. */
export interface RadioGroupContextValue {
  /** The checked value (`""` = none). */
  value: string
  disabled: boolean
  readonly: boolean
  required: boolean
  /** Invalidity is displayed (the group's `:state(user-invalid)`). */
  invalid: boolean
  /** User selection of an item (fires `input` and `change` on the group). */
  select(item: TecRadioGroupItem): void
}

export const radioGroupContext = createContext<RadioGroupContextValue | undefined>(Symbol("tec-radio-group"))
