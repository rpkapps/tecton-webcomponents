import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { FormControlMixin, type FormValue } from "../../internal/form-control.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { switchStyles } from "./switch.styles.js"

export type SwitchSize = "default" | "sm"

/**
 * A native `<input type="checkbox" role="switch">` in the shadow root carries the semantics, so the
 * switch is announced as "switch, on/off" and toggles with <kbd>Space</kbd>.
 *
 * Form-associated: submits `name=value` (value defaults to `"on"`) while on; `required` blocks
 * submission while off; reset restores the `checked` attribute; a disabled `<fieldset>` disables it.
 *
 * @summary A control that allows the user to toggle between on and off.
 *
 * @tag tec-switch
 *
 * @slot - Optional label text, rendered next to the track (clicking it toggles). Alternatively label
 *   the switch with `<label for="id">` or `aria-label`.
 *
 * @csspart base - The `<label>` wrapping the track and the label text.
 * @csspart track - The pill-shaped track.
 * @csspart thumb - The round thumb.
 * @csspart input - The native checkbox (transparent, covers the track).
 * @csspart label - The label text container.
 *
 * @cssstate checked - The switch is on.
 * @cssstate focus-visible - The switch has keyboard focus.
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, or a failed constraint after interaction/submit).
 *
 * @fires input - The switch was toggled by the user.
 * @fires change - The switch was toggled by the user.
 */
export class TecSwitch extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, switchStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The size: `default` (34×16px) or `sm` (26×12px). */
  @property({ reflect: true }) size: SwitchSize = "default"

  /** The initial state (the `checked` attribute); form reset returns to it. */
  @property({ type: Boolean, attribute: "checked" }) defaultChecked = false

  #checked: boolean | undefined

  /** The current state. Until set (or toggled by the user) it follows the `checked` attribute. */
  @property({ type: Boolean, attribute: false })
  get checked(): boolean {
    return this.#checked ?? this.defaultChecked
  }
  set checked(value: boolean) {
    this.#checked = !!value
  }

  /** The user cannot toggle the switch (it is still focusable and submitted). */
  @property({ type: Boolean, reflect: true }) readonly = false

  /** The native checkbox inside the shadow root. */
  @query(".input") readonly input!: HTMLInputElement
  @query(".label") private labelPart!: HTMLElement

  #slots = new HasSlotController(this, "[default]")

  constructor() {
    super()
    this.defaultValue = "on"
    new FocusVisibleController(this)
    this.addEventListener("click", this.#onHostClick)
  }

  protected override get formControl(): HTMLElement | null {
    return this.input ?? null
  }

  protected override formValue(): FormValue {
    return this.checked ? this.value : null
  }

  protected override formState(): FormValue {
    return String(this.checked)
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#checked = undefined
    this.requestUpdate("checked")
  }

  protected override formRestoreState(state: FormValue): void {
    this.checked = state === "true"
  }

  protected override formLabels(): Element[] {
    const labels = super.formLabels()
    const ownText = this.#slots.test("[default]") && this.labelPart
    const wrapped = labels.some((l) => l.contains(this))
    return labels.length && ownText && !wrapped ? [...labels, this.labelPart] : labels
  }

  /** Toggles the switch as if clicked (fires `input` and `change`). */
  toggle(): void {
    this.input?.click()
  }

  /** Clicks from `<label for>` or `host.click()` land on the host; forward them to the native input. */
  #onHostClick = (event: MouseEvent) => {
    if (event.composedPath()[0] !== this || this.isDisabled) return
    this.input?.click()
  }

  #onInputClick(event: MouseEvent) {
    if (this.readonly) event.preventDefault()
  }

  #onInput() {
    this.checked = this.input.checked
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("checked", this.checked)
  }

  protected override render() {
    const hasLabel = this.#slots.test("[default]")
    return html`<label class="base" part="base">
      <span class="track" part="track">
        <input
          class="input"
          part="input"
          type="checkbox"
          role="switch"
          .checked=${live(this.checked)}
          ?disabled=${this.isDisabled}
          ?required=${this.required}
          @click=${this.#onInputClick}
          @input=${this.#onInput}
          @change=${this.redispatchChange}
        />
        <span class="thumb" part="thumb"></span>
      </span>
      <span class="label" part="label" ?hidden=${!hasLabel}><slot></slot></span>
    </label>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-switch": TecSwitch
  }
}
