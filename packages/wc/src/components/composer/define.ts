import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import { TecComposer } from "./composer.js"
import { TecComposerAttachment, TecComposerAttachments } from "./composer-attachments.js"
import { TecComposerCommand, TecComposerCommands } from "./composer-commands.js"
import { TecComposerField } from "./composer-field.js"
import { TecComposerHint } from "./composer-hint.js"
import { TecComposerInput } from "./composer-input.js"
import { TecComposerStatusMessage } from "./composer-status-message.js"
import { TecComposerSubmit } from "./composer-submit.js"
import { TecComposerSuggestion, TecComposerSuggestions } from "./composer-suggestions.js"
import { TecComposerToolbar } from "./composer-toolbar.js"

// The provider before its parts.
defineElement("tec-composer", TecComposer)
defineElement("tec-composer-field", TecComposerField)
defineElement("tec-composer-input", TecComposerInput)
defineElement("tec-composer-toolbar", TecComposerToolbar)
defineElement("tec-composer-submit", TecComposerSubmit)
defineElement("tec-composer-hint", TecComposerHint)
defineElement("tec-composer-status-message", TecComposerStatusMessage)
defineElement("tec-composer-attachments", TecComposerAttachments)
defineElement("tec-composer-attachment", TecComposerAttachment)
defineElement("tec-composer-suggestions", TecComposerSuggestions)
defineElement("tec-composer-suggestion", TecComposerSuggestion)
defineElement("tec-composer-commands", TecComposerCommands)
defineElement("tec-composer-command", TecComposerCommand)

export {
  TecComposer,
  TecComposerAttachment,
  TecComposerAttachments,
  TecComposerCommand,
  TecComposerCommands,
  TecComposerField,
  TecComposerHint,
  TecComposerInput,
  TecComposerStatusMessage,
  TecComposerSubmit,
  TecComposerSuggestion,
  TecComposerSuggestions,
  TecComposerToolbar,
}
export type { ComposerStatus, ComposerSubmitDetail, ComposerSubmitMode } from "./composer.js"
export type { ComposerCommandSelectDetail } from "./composer-commands.js"
export type { ComposerSuggestionSelectDetail } from "./composer-suggestions.js"
