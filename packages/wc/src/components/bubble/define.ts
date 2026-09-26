import { defineElement } from "../../internal/define.js"
import { TecBubble, TecBubbleContent, TecBubbleGroup, TecBubbleReactions } from "./bubble.js"

defineElement("tec-bubble-group", TecBubbleGroup)
defineElement("tec-bubble", TecBubble)
defineElement("tec-bubble-content", TecBubbleContent)
defineElement("tec-bubble-reactions", TecBubbleReactions)

export { TecBubble, TecBubbleContent, TecBubbleGroup, TecBubbleReactions }
