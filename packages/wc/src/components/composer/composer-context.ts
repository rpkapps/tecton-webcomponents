import { createContext } from "@lit/context"
import type { TecComposer } from "./composer.js"

/** The chat's state, in the shape the AI SDK and TanStack AI use. */
export type ComposerStatus = "ready" | "submitted" | "streaming" | "error"

/** Which key sends: `enter` (Shift+Enter is a new line) or `mod-enter` (⌘/Ctrl+Enter; Enter is a new line). */
export type ComposerSubmitMode = "enter" | "mod-enter"

/** What `tec-composer` shares with its parts. A new object on every change. */
export interface ComposerContextValue {
  composer: TecComposer
  value: string
  status: ComposerStatus
  /** `submitted` or `streaming`: nothing sends. */
  busy: boolean
  disabled: boolean
  /** Not disabled, not busy, and the box holds more than whitespace. */
  canSubmit: boolean
  /** Busy and the reply can be stopped (the composer is not `unstoppable`). */
  canStop: boolean
  submitMode: ComposerSubmitMode
  /** `history` has an entry the arrows can load (for the hint). */
  hasHistory: boolean
  /** The entry of `history` last loaded while the user browses it. */
  historyEntry: string | undefined
  /** Counts the replies the user stopped, so the status says so each time. */
  stopCount: number
  /** A `tec-composer-commands` is rendered (for the hint and `aria-autocomplete`). */
  hasCommands: boolean
}

export const composerContext = createContext<ComposerContextValue | undefined>(Symbol("tec-composer"))
