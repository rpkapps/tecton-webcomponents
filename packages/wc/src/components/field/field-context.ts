import { createContext } from "@lit/context"

export type FieldOrientation = "vertical" | "horizontal" | "responsive"

/** What a `tec-field` tells its parts (label, title, description, error). */
export interface FieldContextValue {
  /** The field displays an error: its `invalid` attribute, or its control displays invalidity. */
  invalid: boolean
  /** The field's `disabled` attribute, or its control is disabled. */
  disabled: boolean
  orientation: FieldOrientation
  /** The control's `validationMessage` while it displays invalidity (shown by an empty `tec-field-error`). */
  validationMessage: string
}

export const fieldContext = createContext<FieldContextValue | undefined>(Symbol("tec-field"))
