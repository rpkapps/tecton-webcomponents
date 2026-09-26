import { defineElement } from "../../internal/define.js"
import {
  TecCard,
  TecCardAction,
  TecCardContent,
  TecCardDescription,
  TecCardFooter,
  TecCardHeader,
  TecCardTitle,
} from "./card.js"

defineElement("tec-card", TecCard)
defineElement("tec-card-header", TecCardHeader)
defineElement("tec-card-title", TecCardTitle)
defineElement("tec-card-description", TecCardDescription)
defineElement("tec-card-action", TecCardAction)
defineElement("tec-card-content", TecCardContent)
defineElement("tec-card-footer", TecCardFooter)

export { TecCard, TecCardAction, TecCardContent, TecCardDescription, TecCardFooter, TecCardHeader, TecCardTitle }
