import { defineElement } from "../../internal/define.js"
import { TecProgress, TecProgressLabel, TecProgressValue } from "./progress.js"

defineElement("tec-progress", TecProgress)
defineElement("tec-progress-label", TecProgressLabel)
defineElement("tec-progress-value", TecProgressValue)

export { TecProgress, TecProgressLabel, TecProgressValue }
