import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import {
  TecAttachment,
  TecAttachmentAction,
  TecAttachmentActions,
  TecAttachmentContent,
  TecAttachmentDescription,
  TecAttachmentGroup,
  TecAttachmentMedia,
  TecAttachmentTitle,
  TecAttachmentTrigger,
} from "./attachment.js"

// The context provider (tec-attachment) is defined before its parts.
defineElement("tec-attachment", TecAttachment)
defineElement("tec-attachment-group", TecAttachmentGroup)
defineElement("tec-attachment-media", TecAttachmentMedia)
defineElement("tec-attachment-content", TecAttachmentContent)
defineElement("tec-attachment-title", TecAttachmentTitle)
defineElement("tec-attachment-description", TecAttachmentDescription)
defineElement("tec-attachment-actions", TecAttachmentActions)
defineElement("tec-attachment-action", TecAttachmentAction)
defineElement("tec-attachment-trigger", TecAttachmentTrigger)

export {
  TecAttachment,
  TecAttachmentAction,
  TecAttachmentActions,
  TecAttachmentContent,
  TecAttachmentDescription,
  TecAttachmentGroup,
  TecAttachmentMedia,
  TecAttachmentTitle,
  TecAttachmentTrigger,
}
