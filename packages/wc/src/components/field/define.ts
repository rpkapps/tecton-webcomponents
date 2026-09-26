import { defineElement } from "../../internal/define.js"
import "../label/define.js"
import { TecField } from "./field.js"
import { TecFieldError } from "./field-error.js"
import { TecFieldLabel } from "./field-label.js"
import {
  TecFieldContent,
  TecFieldDescription,
  TecFieldGroup,
  TecFieldLegend,
  TecFieldSeparator,
  TecFieldSet,
  TecFieldTitle,
} from "./field-parts.js"

// The field provides context to its parts: define it first.
defineElement("tec-field", TecField)
defineElement("tec-field-set", TecFieldSet)
defineElement("tec-field-legend", TecFieldLegend)
defineElement("tec-field-group", TecFieldGroup)
defineElement("tec-field-content", TecFieldContent)
defineElement("tec-field-label", TecFieldLabel)
defineElement("tec-field-title", TecFieldTitle)
defineElement("tec-field-description", TecFieldDescription)
defineElement("tec-field-separator", TecFieldSeparator)
defineElement("tec-field-error", TecFieldError)

export {
  TecField,
  TecFieldContent,
  TecFieldDescription,
  TecFieldError,
  TecFieldGroup,
  TecFieldLabel,
  TecFieldLegend,
  TecFieldSeparator,
  TecFieldSet,
  TecFieldTitle,
}
