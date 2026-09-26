import { defineElement } from "../../internal/define.js"
import { TecCombobox } from "./combobox.js"
import { TecComboboxEmpty, TecComboboxGroup, TecComboboxItem, TecComboboxLabel, TecComboboxSeparator } from "./combobox-item.js"

// Parts first, so the combobox reads upgraded items on its first render.
defineElement("tec-combobox-item", TecComboboxItem)
defineElement("tec-combobox-group", TecComboboxGroup)
defineElement("tec-combobox-label", TecComboboxLabel)
defineElement("tec-combobox-separator", TecComboboxSeparator)
defineElement("tec-combobox-empty", TecComboboxEmpty)
defineElement("tec-combobox", TecCombobox)

export { TecCombobox, TecComboboxEmpty, TecComboboxGroup, TecComboboxItem, TecComboboxLabel, TecComboboxSeparator }
