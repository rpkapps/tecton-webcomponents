import { TecButton, type ButtonVariant } from "../button/button.js"
import { TecInput } from "../input/input.js"
import { TecTextarea } from "../textarea/textarea.js"
import {
  inputGroupButtonStyles,
  inputGroupControlStyles,
  inputGroupInputStyles,
  inputGroupTextareaStyles,
} from "./input-group.styles.js"

/**
 * A borderless `tec-input` for a `tec-input-group` (the group draws the border and the ring). Same
 * API as `tec-input`.
 *
 * @summary The input of an input group.
 *
 * @tag tec-input-group-input
 *
 * @csspart base - The native `<input>`.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (the group shows it).
 *
 * @fires input - The value changed by user input.
 * @fires change - The user committed a value.
 */
export class TecInputGroupInput extends TecInput {
  static styles = [...TecInput.styles, inputGroupControlStyles, inputGroupInputStyles]
}

/**
 * A borderless, non-resizable `tec-textarea` for a `tec-input-group`. Same API as `tec-textarea`.
 *
 * @summary The textarea of an input group.
 *
 * @tag tec-input-group-textarea
 *
 * @csspart base - The native `<textarea>`.
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (the group shows it).
 *
 * @fires input - The value changed by user input.
 * @fires change - The user committed a value.
 */
export class TecInputGroupTextarea extends TecTextarea {
  static styles = [...TecTextarea.styles, inputGroupControlStyles, inputGroupTextareaStyles]
}

export type InputGroupButtonSize = "xs" | "sm" | "icon-xs" | "icon-sm"

/**
 * A `tec-button` sized for an input group addon: `ghost` and `xs` by default. Same API as
 * `tec-button` (`type`, `href`, `start`/`end` slots …); give icon-only buttons an `aria-label`.
 *
 * @summary A button inside an input group addon.
 *
 * @tag tec-input-group-button
 *
 * @slot - The label. Icons placed directly in the default slot (icon-only buttons) are sized too.
 * @slot start - A leading icon.
 * @slot end - A trailing icon.
 *
 * @csspart base - The native `<button>` (or `<a>` with `href`).
 *
 * @cssstate focus-visible - The button has keyboard focus.
 */
export class TecInputGroupButton extends TecButton {
  static styles = [...TecButton.styles, inputGroupButtonStyles]

  constructor() {
    super()
    this.variant = "ghost" as ButtonVariant
    this.size = "xs"
  }

  /** The size: `xs` (1.5rem, default), `sm`, `icon-xs` (1.5rem square) or `icon-sm` (2rem square). */
  declare size: InputGroupButtonSize & TecButton["size"]
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-input-group-input": TecInputGroupInput
    "tec-input-group-textarea": TecInputGroupTextarea
    "tec-input-group-button": TecInputGroupButton
  }
}
