import { defineElement } from "../../internal/define.js"
import {
  TecBreadcrumb,
  TecBreadcrumbEllipsis,
  TecBreadcrumbItem,
  TecBreadcrumbLink,
  TecBreadcrumbList,
  TecBreadcrumbPage,
  TecBreadcrumbSeparator,
} from "./breadcrumb.js"

defineElement("tec-breadcrumb", TecBreadcrumb)
defineElement("tec-breadcrumb-list", TecBreadcrumbList)
defineElement("tec-breadcrumb-item", TecBreadcrumbItem)
defineElement("tec-breadcrumb-separator", TecBreadcrumbSeparator)
defineElement("tec-breadcrumb-link", TecBreadcrumbLink)
defineElement("tec-breadcrumb-page", TecBreadcrumbPage)
defineElement("tec-breadcrumb-ellipsis", TecBreadcrumbEllipsis)

export {
  TecBreadcrumb,
  TecBreadcrumbEllipsis,
  TecBreadcrumbItem,
  TecBreadcrumbLink,
  TecBreadcrumbList,
  TecBreadcrumbPage,
  TecBreadcrumbSeparator,
}
