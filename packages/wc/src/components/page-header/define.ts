import { defineElement } from "../../internal/define.js"
import "../overflow/define.js"
import {
  TecPageHeader,
  TecPageHeaderActions,
  TecPageHeaderContent,
  TecPageHeaderDescription,
  TecPageHeaderEyebrow,
  TecPageHeaderNav,
  TecPageHeaderTitle,
} from "./page-header.js"

defineElement("tec-page-header", TecPageHeader)
defineElement("tec-page-header-content", TecPageHeaderContent)
defineElement("tec-page-header-eyebrow", TecPageHeaderEyebrow)
defineElement("tec-page-header-title", TecPageHeaderTitle)
defineElement("tec-page-header-description", TecPageHeaderDescription)
defineElement("tec-page-header-nav", TecPageHeaderNav)
defineElement("tec-page-header-actions", TecPageHeaderActions)

export { TecPageHeader, TecPageHeaderActions, TecPageHeaderContent, TecPageHeaderDescription, TecPageHeaderEyebrow, TecPageHeaderNav, TecPageHeaderTitle }
