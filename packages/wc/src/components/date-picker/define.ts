import "../calendar/define.js"
import { defineElement } from "../../internal/define.js"
import { TecDatePicker } from "./date-picker.js"
import { TecDateRangePicker } from "./date-range-picker.js"

defineElement("tec-date-picker", TecDatePicker)
defineElement("tec-date-range-picker", TecDateRangePicker)

export { TecDatePicker, TecDateRangePicker }
