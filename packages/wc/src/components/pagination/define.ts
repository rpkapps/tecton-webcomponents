import { defineElement } from "../../internal/define.js"
import {
  TecPagination,
  TecPaginationContent,
  TecPaginationEllipsis,
  TecPaginationItem,
  TecPaginationLink,
  TecPaginationNext,
  TecPaginationPrevious,
} from "./pagination.js"

defineElement("tec-pagination", TecPagination)
defineElement("tec-pagination-content", TecPaginationContent)
defineElement("tec-pagination-item", TecPaginationItem)
defineElement("tec-pagination-link", TecPaginationLink)
defineElement("tec-pagination-previous", TecPaginationPrevious)
defineElement("tec-pagination-next", TecPaginationNext)
defineElement("tec-pagination-ellipsis", TecPaginationEllipsis)

export {
  TecPagination,
  TecPaginationContent,
  TecPaginationEllipsis,
  TecPaginationItem,
  TecPaginationLink,
  TecPaginationNext,
  TecPaginationPrevious,
}
