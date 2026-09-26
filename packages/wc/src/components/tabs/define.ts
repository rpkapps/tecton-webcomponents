import { defineElement } from "../../internal/define.js"
import { TecTabs } from "./tabs.js"
import { TecTabsContent } from "./tabs-content.js"
import { TecTabsList } from "./tabs-list.js"
import { TecTabsTrigger } from "./tabs-trigger.js"

// Context providers (tabs, list) are defined before their consumers.
defineElement("tec-tabs", TecTabs)
defineElement("tec-tabs-list", TecTabsList)
defineElement("tec-tabs-trigger", TecTabsTrigger)
defineElement("tec-tabs-content", TecTabsContent)

export { TecTabs, TecTabsContent, TecTabsList, TecTabsTrigger }
