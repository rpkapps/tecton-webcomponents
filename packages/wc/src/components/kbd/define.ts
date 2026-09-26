import { defineElement } from "../../internal/define.js"
import { TecKbd, TecKbdGroup } from "./kbd.js"

defineElement("tec-kbd-group", TecKbdGroup)
defineElement("tec-kbd", TecKbd)

export { TecKbd, TecKbdGroup }
