import { defineElement } from "../../internal/define.js"
import {
  TecItem,
  TecItemActions,
  TecItemContent,
  TecItemDescription,
  TecItemFooter,
  TecItemGroup,
  TecItemHeader,
  TecItemMedia,
  TecItemSeparator,
  TecItemTitle,
} from "./item.js"

defineElement("tec-item-group", TecItemGroup)
defineElement("tec-item", TecItem)
defineElement("tec-item-separator", TecItemSeparator)
defineElement("tec-item-media", TecItemMedia)
defineElement("tec-item-content", TecItemContent)
defineElement("tec-item-title", TecItemTitle)
defineElement("tec-item-description", TecItemDescription)
defineElement("tec-item-actions", TecItemActions)
defineElement("tec-item-header", TecItemHeader)
defineElement("tec-item-footer", TecItemFooter)

export {
  TecItem,
  TecItemActions,
  TecItemContent,
  TecItemDescription,
  TecItemFooter,
  TecItemGroup,
  TecItemHeader,
  TecItemMedia,
  TecItemSeparator,
  TecItemTitle,
}
