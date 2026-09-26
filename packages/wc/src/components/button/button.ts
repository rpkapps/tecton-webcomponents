import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { buttonStyles } from "./button.styles.js"

export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
export type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

/**
 * Visual overrides are custom properties (utility classes on the host only affect layout: `w-full`,
 * `h-10`, `flex-1` work; `rounded-full`, `bg-*`, `text-*`, `shadow-*` don't reach the inner box):
 * `style="--tec-button-radius: 9999px; --tec-button-shadow: var(--tec-shadow-md)"`, or `::part(base)`.
 *
 * ARIA attributes set on the host (`aria-label`, `aria-expanded`, `aria-haspopup`, `aria-pressed`,
 * `aria-describedby` …) are delegated to the inner `<button>`/`<a>`; they stay on the host too, so
 * overlays can set them on a slotted `tec-button` trigger and styles can read them.
 *
 * @summary Displays a button or a component that looks like a button. With `href` it renders a link.
 *
 * @tag tec-button
 *
 * @slot - The label. Icons placed directly in the default slot (icon-only buttons) are sized too.
 * @slot start - A leading icon (tightens the leading padding).
 * @slot end - A trailing icon (tightens the trailing padding).
 *
 * @csspart base - The native `<button>` (or `<a>` with `href`) that fills the host.
 *
 * @cssprop --tec-button-radius - Corner radius (default `--tec-radius-md`; `xs`/`sm` sizes cap it at 8px/10px). `9999px` makes a pill / round icon button (`rounded-full`). Button groups set it.
 * @cssprop --tec-button-background - Resting background colour (overrides the variant's; hover, pressed and expanded keep the variant colours) — the equivalent of a `bg-*` class.
 * @cssprop --tec-button-foreground - Resting text/icon colour (overrides the variant's; hover, pressed and expanded keep the variant colours) — the equivalent of a `text-*` class.
 * @cssprop --tec-button-shadow - Box shadow of the button (e.g. `var(--tec-shadow-md)` for a floating action button); combined with the focus ring.
 * @cssprop --tec-button-padding-inline - Horizontal padding (default 0.5rem, 0.625rem for `lg`; `0` for an inline text-like button).
 * @cssprop --tec-button-border-color - Border colour of the filled variants (default transparent). Button groups set it for mixed groups.
 * @cssprop --tec-icon-size - Size of slotted icons (1rem; 0.75rem for `xs` and `icon-xs`).
 *
 * @cssstate focus-visible - The button has keyboard focus.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 */
export class TecButton extends TectonElement {
  static styles = [hostStyles, buttonStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }
  /** Form-associated so `type="submit"`/`"reset"` find their form and a disabled `<fieldset>` disables the button. */
  static formAssociated = true

  /** The visual style. */
  @property({ reflect: true }) variant: ButtonVariant = "default"

  /** The size. The `icon*` sizes make a square icon-only button (give it an `aria-label`). */
  @property({ reflect: true }) size: ButtonSize = "default"

  /** Disables the button: not focusable, not clickable, dimmed. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Form behaviour, like the native attribute. Defaults to `"button"` (no implicit submit). */
  @property({ reflect: true }) type: "button" | "submit" | "reset" = "button"

  /** Submitted as the form's submitter name (with `type="submit"`). */
  @property({ reflect: true }) name = ""

  /** Submitted as the submitter value (with `type="submit"` and a `name`). */
  @property({ reflect: true }) value = ""

  /** Renders an `<a href>` styled as a button. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: "_blank" | "_parent" | "_self" | "_top" | string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  /** Link `download` (with `href`). */
  @property() download?: string

  /** The inner `<button>` or `<a>`. */
  @query(".base") readonly control!: HTMLButtonElement | HTMLAnchorElement

  #formDisabled = false

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control })
    new FocusVisibleController(this)
    new HasSlotController(this, "start", "end", { states: true })
    this.addEventListener("click", this.#onClick, true)
  }

  /** Clicks the inner control (so `type="submit"` submits and links navigate). */
  override click(): void {
    this.control?.click()
  }

  get #isDisabled(): boolean {
    return this.disabled || this.#formDisabled
  }

  /** @internal */
  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled
    this.requestUpdate()
  }

  #onClick = (event: MouseEvent) => {
    if (this.#isDisabled) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    if (this.href || event.composedPath()[0] === this) return
    // Act once the event finished dispatching, so app listeners can preventDefault() the submit/reset
    // (like a native button's activation behaviour). A microtask would run between listeners.
    setTimeout(() => {
      if (event.defaultPrevented) return
      const form = this.internals.form
      if (!form) return
      if (this.type === "reset") form.reset()
      else if (this.type === "submit") this.#submit(form)
    }, 0)
  }

  /** Submits through a temporary native submit button so validation, `submitter`, name and value work. */
  #submit(form: HTMLFormElement): void {
    const proxy = document.createElement("button")
    proxy.type = "submit"
    proxy.hidden = true
    if (this.name) proxy.name = this.name
    if (this.value) proxy.value = this.value
    form.append(proxy)
    proxy.click()
    proxy.remove()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("disabled", this.#isDisabled)
  }

  protected override render() {
    const content = html`<slot name="start"></slot><slot></slot><slot name="end"></slot>`
    if (this.href !== undefined) {
      const disabled = this.#isDisabled
      return html`<a
        class="base"
        part="base"
        href=${ifDefined(disabled ? undefined : this.href)}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
        download=${ifDefined(this.download)}
        role=${disabled ? "link" : nothing}
        aria-disabled=${disabled ? "true" : nothing}
        >${content}</a
      >`
    }
    return html`<button class="base" part="base" type="button" ?disabled=${this.#isDisabled}>${content}</button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-button": TecButton
  }
}
