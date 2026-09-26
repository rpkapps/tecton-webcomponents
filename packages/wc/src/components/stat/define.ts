import { defineElement } from "../../internal/define.js"
import { TecStat, TecStatGroup } from "./stat.js"
import { TecStatDelta, TecStatHelp, TecStatLabel, TecStatValue } from "./stat-parts.js"

defineElement("tec-stat-group", TecStatGroup)
defineElement("tec-stat", TecStat)
defineElement("tec-stat-label", TecStatLabel)
defineElement("tec-stat-value", TecStatValue)
defineElement("tec-stat-delta", TecStatDelta)
defineElement("tec-stat-help", TecStatHelp)

export { TecStat, TecStatDelta, TecStatGroup, TecStatHelp, TecStatLabel, TecStatValue }
