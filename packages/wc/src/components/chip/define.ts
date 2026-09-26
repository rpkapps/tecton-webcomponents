import { defineElement } from "../../internal/define.js"
import { TecChip } from "./chip.js"
import { TecChipGroup } from "./chip-group.js"

// Chips first: the group reads their `key`/`selected` as soon as it connects.
defineElement("tec-chip", TecChip)
defineElement("tec-chip-group", TecChipGroup)

export { TecChip, TecChipGroup }
