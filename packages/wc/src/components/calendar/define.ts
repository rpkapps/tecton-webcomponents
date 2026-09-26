import "../button/define.js"
import { defineElement } from "../../internal/define.js"
import { TecCalendar } from "./calendar.js"
import { TecRangeCalendar } from "./range-calendar.js"

defineElement("tec-calendar", TecCalendar)
defineElement("tec-range-calendar", TecRangeCalendar)

export { TecCalendar, TecRangeCalendar }
