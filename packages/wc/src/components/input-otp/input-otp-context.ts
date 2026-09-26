import { createContext } from "@lit/context"

/** What `tec-input-otp` tells its groups and slots. */
export interface InputOtpContextValue {
  value: string
  maxLength: number
  /** Selected slot range `[start, end)` while the input has focus (`start === end`: caret before `start`). */
  selection: readonly [number, number] | null
  invalid: boolean
  disabled: boolean
  /** The slot elements in document order (the implicit `index` of a slot). */
  slots: readonly Element[]
}

export const inputOtpContext = createContext<InputOtpContextValue | undefined>(Symbol("tec-input-otp"))
