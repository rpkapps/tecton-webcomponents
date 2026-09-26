import { defineElement } from "../../internal/define.js"
import { TecAccordion } from "./accordion.js"
import { TecAccordionContent } from "./accordion-content.js"
import { TecAccordionItem } from "./accordion-item.js"
import { TecAccordionTrigger } from "./accordion-trigger.js"

// Parts first: the accordion and items drive their children.
defineElement("tec-accordion-trigger", TecAccordionTrigger)
defineElement("tec-accordion-content", TecAccordionContent)
defineElement("tec-accordion-item", TecAccordionItem)
defineElement("tec-accordion", TecAccordion)

export { TecAccordion, TecAccordionContent, TecAccordionItem, TecAccordionTrigger }
