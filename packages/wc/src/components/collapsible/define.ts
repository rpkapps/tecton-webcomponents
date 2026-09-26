import { defineElement } from "../../internal/define.js"
import { TecCollapsible } from "./collapsible.js"
import { TecCollapsibleContent } from "./collapsible-content.js"
import { TecCollapsibleTrigger } from "./collapsible-trigger.js"

// The parts are defined before the parent, which drives them.
defineElement("tec-collapsible-content", TecCollapsibleContent)
defineElement("tec-collapsible-trigger", TecCollapsibleTrigger)
defineElement("tec-collapsible", TecCollapsible)

export { TecCollapsible, TecCollapsibleContent, TecCollapsibleTrigger }
