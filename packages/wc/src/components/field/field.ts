import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { observeControl, unobserveControl, type ControlObserver } from "../../internal/form-control.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { isFieldControl, updateIdRefs } from "../label/labelable.js"
import { fieldContext, type FieldContextValue, type FieldOrientation } from "./field-context.js"
import { fieldStyles } from "./field.styles.js"

/** Parts of a field that hold state the field reads (see `tec-field-error`). */
interface DescriptionPart extends HTMLElement {
  readonly displayed?: boolean
}

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector)
  } catch {
    return false
  }
}

/** Whether a control currently displays invalidity (Tecton `:state(user-invalid)`, native `:user-invalid` / `aria-invalid`). */
function showsInvalid(control: Element): boolean {
  return matches(control, ":state(user-invalid)") || matches(control, ":user-invalid") || control.getAttribute("aria-invalid") === "true"
}

/**
 * `tec-field` wires its parts to its control, so the markup needs no ids:
 *
 * - The **control** is the first form control inside the field (a Tecton control, `<input>`,
 *   `<select>`, `<textarea>` …; buttons are not controls). Fields nested inside are skipped.
 * - A `tec-field-label` without `for` labels that control (it adds its id to the control's
 *   `aria-labelledby`); clicking it focuses or toggles the control.
 * - Every `tec-field-description`, and every `tec-field-error` while it is displayed, **describes** the
 *   control (their ids are added to its `aria-describedby`, after the ids you set yourself).
 * - The field **follows the control**: it shows its invalid style (destructive text) and its
 *   `tec-field-error` while the control displays invalidity (`invalid`, or a failed constraint after
 *   the user edited it or tried to submit), and dims its label while the control is disabled.
 * - `invalid` on the field marks the control invalid for display and assistive technology
 *   (`aria-invalid`) without failing validation, e.g. for an error that comes from the server.
 *
 * @summary Combines a label, a control, help text and an error message into one accessible form field.
 *
 * @tag tec-field
 *
 * @slot - A `tec-field-label` (or `tec-field-content` with label and description), the control, `tec-field-description` and `tec-field-error`.
 *
 * @cssstate invalid - The field displays an error (its `invalid` attribute or its control's invalidity).
 * @cssstate disabled - The field is `disabled` or its control is disabled.
 * @cssstate has-content - A `tec-field-content` is a direct child (horizontal fields align to the top).
 */
export class TecField extends TectonElement {
  static styles = [hostStyles, fieldStyles]

  /**
   * Layout: `vertical` stacks label, control and messages; `horizontal` puts the control beside the
   * label (checkbox, switch, radio); `responsive` is vertical until the enclosing
   * `tec-field-group` is at least 28rem wide.
   */
  @property({ reflect: true }) orientation: FieldOrientation = "vertical"

  /**
   * Marks the field invalid: destructive label, the `tec-field-error` is displayed, and the control
   * shows invalidity (`aria-invalid`) — without failing constraint validation.
   */
  @property({ type: Boolean, reflect: true }) invalid = false

  /** Dims the label as disabled. Disable the control itself with its own `disabled` (the field follows it). */
  @property({ type: Boolean, reflect: true }) disabled = false

  #provider = new ContextProvider(this, {
    context: fieldContext,
    initialValue: { invalid: false, disabled: false, orientation: "vertical", validationMessage: "" },
  })
  #controls: HTMLElement[] = []
  #described = new Map<HTMLElement, string[]>()
  #pending = false
  #mutations = new MutationObserver(() => this.#schedule())
  #link: ControlObserver = {
    invalid: false,
    controlChanged: () => this.#schedule(),
  }

  constructor() {
    super()
    for (const type of ["input", "change", "focusout"]) this.addEventListener(type, () => this.#schedule())
    this.addEventListener("invalid", () => this.#schedule(), true)
  }

  /** The field's control (see the element description), or `null`. */
  get control(): HTMLElement | null {
    if (!this.#controls.length) this.#controls = this.#findControls()
    return this.#controls[0] ?? null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    this.#mutations.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["invalid", "disabled", "aria-invalid", "for", "errors"],
    })
    document.addEventListener("reset", this.#onReset, true)
    this.#schedule()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#mutations.disconnect()
    document.removeEventListener("reset", this.#onReset, true)
    for (const control of this.#controls) {
      unobserveControl(control, this.#link)
      updateIdRefs(control, "aria-describedby", this.#described.get(control) ?? [], [])
    }
    this.#controls = []
    this.#described.clear()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("invalid")) {
      ;(this.#link as { invalid: boolean }).invalid = this.invalid
      for (const control of this.#controls) (control as Partial<{ requestUpdate(): void }>).requestUpdate?.()
    }
    this.#schedule()
  }

  /**
   * Re-reads the field's control and parts. Called by the parts when their content changes; call it
   * if the field misses a change made by script.
   */
  refresh(): void {
    this.#schedule()
  }

  #onReset = (event: Event) => {
    if (event.target instanceof Node && event.target.contains(this)) setTimeout(() => this.#schedule())
  }

  /** Coalesces every trigger into one sync per microtask. */
  #schedule(): void {
    if (this.#pending) return
    this.#pending = true
    queueMicrotask(() => {
      this.#pending = false
      if (this.isConnected) this.#sync()
    })
  }

  #findControls(): HTMLElement[] {
    const found: HTMLElement[] = []
    const walker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const el = node as Element
        if (el.localName === "tec-field") return NodeFilter.FILTER_REJECT
        if (isFieldControl(el)) {
          found.push(el)
          return NodeFilter.FILTER_REJECT // controls inside a control (radio items) are its parts
        }
        if (el.localName.includes("-") && !customElements.get(el.localName)) {
          void customElements.whenDefined(el.localName).then(() => this.#schedule())
        }
        return NodeFilter.FILTER_SKIP
      },
    })
    while (walker.nextNode());
    return found
  }

  /** Parts (`tec-field-description`, `tec-field-error`) that belong to this field, in document order. */
  #parts(): DescriptionPart[] {
    return [...this.querySelectorAll<DescriptionPart>("tec-field-description, tec-field-error")].filter(
      (part) => part.closest("tec-field") === this
    )
  }

  #sync(): void {
    // Controls
    const controls = this.#findControls()
    const previousFirst = this.#controls[0]
    for (const control of this.#controls) {
      if (controls.includes(control)) continue
      unobserveControl(control, this.#link)
      updateIdRefs(control, "aria-describedby", this.#described.get(control) ?? [], [])
      this.#described.delete(control)
    }
    this.#controls = controls
    for (const control of controls) observeControl(control, this.#link)
    const control = controls[0] ?? null

    // State
    const invalidControl = controls.find(showsInvalid)
    const value: FieldContextValue = {
      invalid: this.invalid || !!invalidControl,
      disabled: this.disabled || (!!control && matches(control, ":disabled")),
      orientation: this.orientation,
      validationMessage: (invalidControl as HTMLInputElement | undefined)?.validationMessage ?? "",
    }
    const current = this.#provider.value
    if (
      !current ||
      current.invalid !== value.invalid ||
      current.disabled !== value.disabled ||
      current.orientation !== value.orientation ||
      current.validationMessage !== value.validationMessage
    ) {
      this.#provider.setValue(value, true)
    }
    this.toggleState("invalid", value.invalid)
    this.toggleState("disabled", value.disabled)
    this.toggleState("has-content", !!this.querySelector(":scope > tec-field-content"))

    // Descriptions: every description, and the errors that are displayed.
    const ids = this.#parts()
      .filter((part) => part.localName !== "tec-field-error" || part.displayed)
      .map((part) => part.id)
      .filter(Boolean)
    for (const c of controls) {
      updateIdRefs(c, "aria-describedby", this.#described.get(c) ?? [], ids)
      this.#described.set(c, ids)
    }

    // Labels without `for` follow the control.
    if (control !== previousFirst) {
      for (const label of this.querySelectorAll<HTMLElement & { refresh?(): void }>("tec-field-label, tec-label")) {
        if (label.closest("tec-field") === this) label.refresh?.()
      }
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-field": TecField
  }
}
