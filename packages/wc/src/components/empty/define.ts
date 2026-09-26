import { defineElement } from "../../internal/define.js"
import { TecEmpty, TecEmptyContent, TecEmptyDescription, TecEmptyHeader, TecEmptyMedia, TecEmptyTitle } from "./empty.js"

defineElement("tec-empty", TecEmpty)
defineElement("tec-empty-header", TecEmptyHeader)
defineElement("tec-empty-media", TecEmptyMedia)
defineElement("tec-empty-title", TecEmptyTitle)
defineElement("tec-empty-description", TecEmptyDescription)
defineElement("tec-empty-content", TecEmptyContent)

export { TecEmpty, TecEmptyContent, TecEmptyDescription, TecEmptyHeader, TecEmptyMedia, TecEmptyTitle }
