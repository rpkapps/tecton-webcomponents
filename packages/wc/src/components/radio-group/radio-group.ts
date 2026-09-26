import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { FormControlMixin, requiredValidator, type FormValue, type Validator } from "../../internal/form-control.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { radioGroupContext, type RadioGroupContextValue } from "./radio-group-context.js"
import type { TecRadioGroupItem } from "./radio-group-item.js"
import { radioGroupStyles } from "./radio-group.styles.js"

export type RadioGroupOrientation = "horizontal" | "vertical"

/**
 * Implements the WAI-ARIA radio group pattern: the element is the `radiogroup`, its
 * `tec-radio-group-item`s are the `radio`s. Only the checked item (or the first enabled one) is in
 * the tab order; the arrow keys move focus **and** check the next/previous item (wrapping; Left/Right
 * mirrored in RTL); <kbd>Space</kbd> checks the focused item.
 *
 * Form-associated: submits `name=value` of the checked item; `required` blocks submission while
 * nothing is checked (the error shows on every item after a submit attempt); reset restores the
 * `value` attribute; a disabled `<fieldset>` disables it.
 *
 * Name the group with `aria-label`, `aria-labelledby` or a `<label for>`; items are named by their
 * content or by their own `<label for>`.
 *
 * @summary A set of checkable buttons — radio buttons — where no more than one can be checked at a time.
 *
 * @tag tec-radio-group
 *
 * The element itself is the layout box (a grid, or a wrapping flex row when horizontal), so layout
 * classes on it (`gap-6`, `grid-cols-2`, `flex`) apply to the options directly.
 *
 * @slot - `tec-radio-group-item` elements, directly or inside layout wrappers (fields, labels, divs).
 *
 * @cssprop --tec-radio-group-gap - Gap between the options (default 0.75rem; a `gap-*` class on the element also wins).
 *
 * @cssstate invalid - The value fails validation.
 * @cssstate user-invalid - Invalidity is displayed (`invalid`, or a failed `required` after interaction/submit).
 *
 * @fires input - The user checked another item.
 * @fires change - The user checked another item.
 */
export class TecRadioGroup extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, radioGroupStyles]

  /** Layout: `vertical` stacks the options, `horizontal` puts them in a wrapping row. */
  @property({ reflect: true }) orientation: RadioGroupOrientation = "vertical"

  /** The user cannot change the selection (items stay focusable). */
  @property({ type: Boolean, reflect: true }) readonly = false

  #provider = new ContextProvider(this, { context: radioGroupContext, initialValue: undefined })
  #providedInvalid = false
  #lastValue: string | undefined

  #roving = new RovingFocusController<TecRadioGroupItem>(this, {
    items: () => this.items,
    orientation: "both",
    loop: true,
    homeEnd: false,
    isDisabled: (item) => this.isDisabled || item.isDisabled,
    activateOnFocus: () => !this.readonly,
    onActivate: (item) => this.#select(item),
  })

  #observer = new MutationObserver((records) => {
    const relevant = (n: Node) => n instanceof Element && (n.localName === "tec-radio-group-item" || !!n.querySelector("tec-radio-group-item"))
    if (records.some((r) => (r.type === "attributes" ? relevant(r.target) : [...r.addedNodes, ...r.removedNodes].some(relevant)))) this.requestUpdate()
  })

  constructor() {
    super()
    // `<label for>` clicks land on the host: move focus into the group.
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] === this && !this.isDisabled) this.focus()
    })
  }

  /** The items of this group (not of nested groups), in DOM order. */
  get items(): TecRadioGroupItem[] {
    return [...this.querySelectorAll<TecRadioGroupItem>("tec-radio-group-item")].filter((i) => i.closest("tec-radio-group") === this)
  }

  protected override get validators(): Validator<TecRadioGroup>[] {
    return [requiredValidator<TecRadioGroup>((el) => !el.value, "radio")]
  }

  protected override formValue(): FormValue {
    return this.value ? this.value : null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "disabled"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** Focuses the checked item (or the first enabled one). */
  override focus(options?: FocusOptions): void {
    this.#roving.focus(options)
  }

  #select = (item: TecRadioGroupItem) => {
    if (this.isDisabled || this.readonly || item.isDisabled || item.value === this.value) return
    this.value = item.value
    this.markInteracted()
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "radiogroup"
    this.internals.ariaOrientation = this.orientation
    this.internals.ariaRequired = this.required ? "true" : null
    this.internals.ariaDisabled = this.isDisabled ? "true" : null
    this.internals.ariaReadOnly = this.readonly ? "true" : null
    this.#providedInvalid = this.showInvalid
    const value: RadioGroupContextValue = {
      value: this.value,
      disabled: this.isDisabled,
      readonly: this.readonly,
      required: this.required,
      invalid: this.#providedInvalid,
      select: this.#select,
    }
    this.#provider.setValue(value, true)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed) // syncs value and validity
    this.internals.ariaInvalid = this.showInvalid ? "true" : null
    // `<label for>` names the group unless it has its own aria-label(ledby).
    const labels = this.hasAttribute("aria-label") || this.hasAttribute("aria-labelledby") ? [] : this.formLabels()
    ;(this.internals as unknown as { ariaLabelledByElements: Element[] | null }).ariaLabelledByElements = labels.length ? labels : null
    // Validity is computed after rendering; re-provide when the displayed state changed.
    if (this.showInvalid !== this.#providedInvalid) this.requestUpdate()
    if (this.value !== this.#lastValue) {
      this.#lastValue = this.value
      const checked = this.items.find((i) => i.value === this.value && !i.disabled)
      if (checked) this.#roving.setActive(checked)
    }
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.#roving.update()}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-radio-group": TecRadioGroup
  }
}
