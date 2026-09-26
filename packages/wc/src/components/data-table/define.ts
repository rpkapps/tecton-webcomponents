import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import "../checkbox/define.js"
import "../table/define.js"
import { TecDataTable } from "./data-table.js"

defineElement("tec-data-table", TecDataTable)

export { TecDataTable }
