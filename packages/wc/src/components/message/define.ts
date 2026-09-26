import { defineElement } from "../../internal/define.js"
import { TecMessage, TecMessageAvatar, TecMessageContent, TecMessageFooter, TecMessageGroup, TecMessageHeader } from "./message.js"

// The context provider (tec-message) is defined before its parts.
defineElement("tec-message-group", TecMessageGroup)
defineElement("tec-message", TecMessage)
defineElement("tec-message-avatar", TecMessageAvatar)
defineElement("tec-message-content", TecMessageContent)
defineElement("tec-message-header", TecMessageHeader)
defineElement("tec-message-footer", TecMessageFooter)

export { TecMessage, TecMessageAvatar, TecMessageContent, TecMessageFooter, TecMessageGroup, TecMessageHeader }
