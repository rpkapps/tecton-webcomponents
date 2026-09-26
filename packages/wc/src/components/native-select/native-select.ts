import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { ChevronDown } from "lucide"
import { FormControlMixin } from "../../internal/form-control.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { nativeSelectStyles } from "./native-select.styles.js"

/**
 * The browser's own `<select>`, styled as a Tecton field: the operating system's picker, native
 * keyboard behaviour and typeahead, and no JavaScript list. Write the options as plain `<option>` and
 * `<optgroup>` children (they are the `NativeSelectOption` / `NativeSelectOptGroup` parts); they are
 * mirrored into the shadow `<select>` and kept in sync when they change.
 *
 * Form-associated: submits `name=value`, `required` fails on an empty value (a placeholder
 * `<option value="">`), reset returns to the `value` attribute or the `selected` option.
 *
 * @summary A styled native HTML select element with consistent design system integration.
 *
 * @tag tec-native-select
 *
 * @slot - `<option>` and `<optgroup>` elements (not rendered in place; mirrored into the native select).
 *
 * @csspart base - The wrapper of the select and the chevron.
 * @csspart select - The native `<select>` (border, padding, focus ring).
 * @csspart icon - The chevron.
 * @cssprop --tec-native-select-radius - Corner radius of the select (default `--tec-radius-md`; set by `tec-button-group`).
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed.
 *
 * @fires input - The user picked an option (the native, composed event).
 * @fires change - The user picked an option.
 */
export class TecNativeSelect extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, nativeSelectStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The size. Both sizes are 2rem tall in the Tecton theme (`sm` is kept for API compatibility). */
  @property({ reflect: true }) size: "sm" | "default" = "default"

  /** Accessible name when no visible label is associated (applied like `aria-label`). */
  @property() label = ""

  /** Asks the browser to fill the value (`autocomplete="country"` …). */
  @property() autocomplete?: string

  /** The native `<select>` inside the shadow root. */
  @query(".select") readonly select!: HTMLSelectElement

  #dirtyOptions = true
  #observer = new MutationObserver(() => {
    this.#dirtyOptions = true
    this.requestUpdate()
  })

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] === this && !this.isDisabled) this.select?.focus()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true })
    this.#dirtyOptions = true
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  protected override get formControl(): HTMLElement | null {
    return this.select ?? null
  }

  /** The `<option>` children (light DOM). */
  get options(): HTMLOptionElement[] {
    return [...this.querySelectorAll("option")]
  }

  /** Index of the selected option (`-1` for none). Setting it selects that option (no event). */
  get selectedIndex(): number {
    return this.select?.selectedIndex ?? -1
  }
  set selectedIndex(index: number) {
    const option = this.options[index]
    this.value = option ? option.value : ""
  }

  /** Opens the browser's picker. */
  showPicker(): void {
    this.select?.showPicker()
  }

  protected override formResetValue(): void {
    super.formResetValue()
    this.#dirtyOptions = true
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (this.#dirtyOptions && !this.hasAttribute("value")) {
      // Like a native select, the default is the (last) `selected` option, else the first enabled one.
      const options = this.options
      const selected = options.filter((o) => o.hasAttribute("selected")).pop()
      const enabled = options.find((o) => !o.disabled && !o.closest("optgroup[disabled]"))
      this.defaultValue = (selected ?? enabled)?.value ?? ""
    }
  }

  protected override updated(changed: PropertyValues): void {
    const select = this.select
    if (select) {
      if (this.#dirtyOptions) {
        this.#dirtyOptions = false
        // Mirror the light-DOM options into the shadow select.
        select.replaceChildren(
          ...[...this.children].filter((c) => c.localName === "option" || c.localName === "optgroup").map((c) => c.cloneNode(true))
        )
      }
      if (select.value !== this.value) select.value = this.value
    }
    super.updated(changed)
  }

  #onChange(event: Event) {
    this.value = this.select.value
    this.redispatchChange(event)
  }

  protected override render() {
    return html`<div class="base" part="base">
      <select
        class="select"
        part="select"
        aria-label=${ifDefined(this.label || undefined)}
        autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
        ?disabled=${this.isDisabled}
        ?required=${this.required}
        @input=${() => (this.value = this.select.value)}
        @change=${this.#onChange}
      ></select>
      <span class="icon" part="icon" aria-hidden="true">${icon(ChevronDown, { size: 16 })}</span>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-native-select": TecNativeSelect
  }
}
