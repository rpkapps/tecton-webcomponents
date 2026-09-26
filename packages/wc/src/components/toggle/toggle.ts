import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { toggleStyles } from "./toggle.styles.js"

export type ToggleVariant = "default" | "outline"
export type ToggleSize = "default" | "sm" | "lg"

/**
 * Renders a native `<button aria-pressed>` in its shadow root: pointer, <kbd>Enter</kbd> and
 * <kbd>Space</kbd> flip `pressed` and fire `tec-pressed-change`. `pressed` is reflected, so a
 * pressed toggle matches `tec-toggle[pressed]` (fill an icon with `[pressed] svg { fill: currentColor }`).
 * Host `aria-*` attributes (`aria-label`, `aria-describedby` …) are forwarded to the button.
 *
 * @summary A two-state button that can be either on or off.
 *
 * @tag tec-toggle
 *
 * @slot - The label. Icons placed directly in the default slot (icon-only toggles) are sized to 1rem.
 * @slot start - A leading icon (tightens the leading padding).
 * @slot end - A trailing icon (tightens the trailing padding).
 *
 * @csspart base - The native `<button>` that fills the host.
 *
 * @cssprop --tec-toggle-radius - Corner radius (default `--tec-radius-md`).
 * @cssprop --tec-icon-size - Size of slotted icons (default 1rem).
 *
 * @cssstate pressed - The toggle is on.
 * @cssstate focus-visible - The toggle has keyboard focus.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 *
 * @fires tec-pressed-change - The user toggled the button. Cancelable (`preventDefault()` keeps the current state). `detail: { pressed }`.
 */
export class TecToggle extends TectonElement {
  static styles = [hostStyles, toggleStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Whether the toggle is on (`aria-pressed="true"`). Reflected. */
  @property({ type: Boolean, reflect: true }) pressed = false

  /** The visual style: `default` (transparent) or `outline` (with a subtle border). */
  @property({ reflect: true }) variant: ToggleVariant = "default"

  /** The height: `sm` (28px), `default` (32px) or `lg` (36px). */
  @property({ reflect: true }) size: ToggleSize = "default"

  /** Disables the toggle: not focusable, not clickable, dimmed. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The inner `<button>`. */
  @query(".base") readonly control!: HTMLButtonElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: ["aria-pressed"] })
    new FocusVisibleController(this)
    new HasSlotController(this, "start", "end", { states: true })
  }

  /** Clicks the inner button (toggles, like a user press). */
  override click(): void {
    this.control?.click()
  }

  /** Flips `pressed` as a user press would (fires `tec-pressed-change`). */
  toggle(): void {
    this.click()
  }

  #onClick = () => {
    if (this.disabled) return
    const pressed = !this.pressed
    if (this.emit<{ pressed: boolean }>("tec-pressed-change", { detail: { pressed }, cancelable: true })) this.pressed = pressed
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("disabled", this.disabled)
    this.toggleState("pressed", this.pressed)
    this.toggleState("outline", this.variant === "outline")
    this.toggleState("sm", this.size === "sm")
    this.toggleState("lg", this.size === "lg")
  }

  protected override render() {
    return html`<button class="base" part="base" type="button" aria-pressed=${this.pressed ? "true" : "false"} ?disabled=${this.disabled} @click=${this.#onClick}>
      <slot name="start"></slot><slot></slot><slot name="end"></slot>
    </button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-toggle": TecToggle
  }
}
