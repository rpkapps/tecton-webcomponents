import { defineElement } from "../../internal/define.js"
import { TecCommand } from "./command.js"
import { TecCommandDialog } from "./command-dialog.js"
import { TecCommandInput } from "./command-input.js"
import { TecCommandEmpty, TecCommandGroup, TecCommandItem, TecCommandList, TecCommandSeparator, TecCommandShortcut } from "./command-parts.js"

// Parts first, so the palette reads upgraded items on its first render.
defineElement("tec-command-input", TecCommandInput)
defineElement("tec-command-list", TecCommandList)
defineElement("tec-command-group", TecCommandGroup)
defineElement("tec-command-item", TecCommandItem)
defineElement("tec-command-shortcut", TecCommandShortcut)
defineElement("tec-command-separator", TecCommandSeparator)
defineElement("tec-command-empty", TecCommandEmpty)
defineElement("tec-command", TecCommand)
defineElement("tec-command-dialog", TecCommandDialog)

export {
  TecCommand,
  TecCommandDialog,
  TecCommandEmpty,
  TecCommandGroup,
  TecCommandInput,
  TecCommandItem,
  TecCommandList,
  TecCommandSeparator,
  TecCommandShortcut,
}
