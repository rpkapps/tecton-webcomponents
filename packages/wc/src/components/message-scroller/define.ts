import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import { TecMessageScroller } from "./message-scroller.js"
import { TecMessageScrollerButton, TecMessageScrollerContent, TecMessageScrollerItem, TecMessageScrollerViewport } from "./message-scroller-parts.js"

// The scroller is defined first so it is upgraded before its parts.
defineElement("tec-message-scroller", TecMessageScroller)
defineElement("tec-message-scroller-viewport", TecMessageScrollerViewport)
defineElement("tec-message-scroller-content", TecMessageScrollerContent)
defineElement("tec-message-scroller-item", TecMessageScrollerItem)
defineElement("tec-message-scroller-button", TecMessageScrollerButton)

export { TecMessageScroller, TecMessageScrollerButton, TecMessageScrollerContent, TecMessageScrollerItem, TecMessageScrollerViewport }
