/**
 * @module form-control
 * `FormControlMixin` turns a `TectonElement` into a **form-associated custom element** that behaves
 * like a native control: it submits `name=value` with its `<form>`, takes part in constraint
 * validation, resets and restores, is disabled by a disabled `<fieldset>`, and is labelled by
 * `<label for>` / wrapping `<label>` elements.
 *
 * ```ts
 * export class TecInput extends FormControlMixin(TectonElement) {
 *   static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }
 *   @query("input") input!: HTMLInputElement
 *   protected get formControl() { return this.input }        // validity mirrored, labels + ARIA delegated
 *   render() {
 *     return html`<input .value=${live(this.value)} ?disabled=${this.isDisabled} ?required=${this.required}
 *       @input=${(e) => (this.value = e.target.value)} @change=${this.redispatchChange} />`
 *   }
 * }
 * ```
 *
 * What the mixin provides:
 *
 * | Member | |
 * | --- | --- |
 * | `name`, `disabled`, `required`, `invalid` | reflected attributes |
 * | `value` / `defaultValue` | native `<input>` model: the `value` **attribute** is the default (`defaultValue`), the `value` **property** is the current value; until the property is set it follows the attribute; form reset returns to the attribute |
 * | `isDisabled` | `disabled` or disabled by a `<fieldset>` — use it in `render()`; style with `:host(:disabled)` |
 * | `showInvalid` | whether to *display* invalidity (`invalid` attribute, or constraint failure after user interaction or a submit attempt — the `:user-invalid` model). Validity is computed after each render, so style it with `:state(user-invalid)` (always current) rather than reading `showInvalid` in `render()`; `aria-invalid` is set on the `formControl` for you |
 * | `checkValidity()`, `reportValidity()`, `setCustomValidity()`, `validity`, `validationMessage`, `willValidate`, `form`, `labels` | native API |
 * | `redispatchChange(e)` | re-fires the inner control's (non-composed) `change` event from the host |
 *
 * Hooks a component overrides (all optional):
 *
 * | Hook | Default |
 * | --- | --- |
 * | `formControl` | `null` — the inner native control whose `validity` is mirrored and that receives delegated ARIA and `<label for>` labelling |
 * | `ariaDelegationExclude` | `[]` — host `aria-*` attributes not delegated to `formControl` (the component manages them itself) |
 * | `formValue()` | `this.value` — the submitted value (`null` = nothing, `FormData` for several entries) |
 * | `formState()` | `formValue()` — what the browser stores for restore |
 * | `formResetValue()` | forgets the dirty `value` (back to the `value` attribute) |
 * | `formRestoreState(state)` | `this.value = state` when it is a string |
 * | `validators` | `[]` — custom validators for controls without a native inner control (see {@link requiredValidator}) |
 * | `formLabels()` | the `<label>`s associated with the host (`internals.labels`) |
 *
 * Value and validity are re-synced after every Lit update; call `syncFormState()` after changing
 * something Lit does not track.
 *
 * Events: fire the native-named `input` (composed natively) and `change` (use `redispatchChange`,
 * native `change` is not composed) on user interaction only.
 *
 * **Control observers** (the field protocol). A container that presents a control — `<tec-field>`
 * (label, description, error message) or `<tec-input-group>` (one ring around the input and its
 * addons) — follows the control's displayed state with {@link observeControl}: the control calls the
 * observer's `controlChanged(control)` after every value/validity sync (so `:state(user-invalid)`,
 * `validationMessage` and `:disabled` can be read there), and displays invalidity while an observer
 * reports `invalid: true` (a `<tec-field invalid>`), without failing validation.
 */
import { property, state } from "lit/decorators.js"
import type { PropertyValues } from "lit"
import { AriaDelegateController } from "./aria.js"
import type { TectonElement } from "./tecton-element.js"

/** A value `ElementInternals.setFormValue()` accepts. */
export type FormValue = File | string | FormData | null

/** A failed validation: the `ValidityState` flags that are true, and the message to show. */
export interface ValidationResult {
  flags: ValidityStateFlags
  message: string
}

/** A custom validator: returns a {@link ValidationResult} when the control is invalid, else `null`. */
export type Validator<E extends FormControl = FormControl> = (element: E) => ValidationResult | null | undefined

const VALIDITY_FLAGS = [
  "valueMissing",
  "typeMismatch",
  "patternMismatch",
  "tooLong",
  "tooShort",
  "rangeUnderflow",
  "rangeOverflow",
  "stepMismatch",
  "badInput",
  "customError",
] as const satisfies readonly (keyof ValidityStateFlags)[]

const messageCache = new Map<string, string>()

/**
 * The browser's own localized `valueMissing` message for a kind of control, e.g.
 * `"Please check this box if you want to proceed."` for `"checkbox"`.
 */
export function nativeValueMissingMessage(kind: "text" | "checkbox" | "radio" | "select" | "file" = "text"): string {
  let message = messageCache.get(kind)
  if (message === undefined) {
    let probe: HTMLInputElement | HTMLSelectElement
    if (kind === "select") probe = document.createElement("select")
    else {
      probe = document.createElement("input")
      probe.type = kind === "text" ? "text" : kind
    }
    probe.required = true
    message = probe.validationMessage || "Please fill out this field."
    messageCache.set(kind, message)
  }
  return message
}

/**
 * Validator for `required` controls without a native inner control (select, combobox, radio group…):
 * `valueMissing` with the browser's localized message when `required` and `isEmpty(element)`.
 *
 * ```ts
 * protected get validators() { return [requiredValidator((el) => el.values.length === 0, "select")] }
 * ```
 */
export function requiredValidator<E extends FormControl>(
  isEmpty: (element: E) => boolean = (el) => !el.value,
  kind: Parameters<typeof nativeValueMissingMessage>[0] = "text"
): Validator<E> {
  return (el) =>
    el.required && isEmpty(el) ? { flags: { valueMissing: true }, message: nativeValueMissingMessage(kind) } : null
}

/**
 * An element that follows a form control's displayed state (see "Control observers" in the module
 * docs). Registered with {@link observeControl}.
 */
export interface ControlObserver {
  /**
   * While `true`, the control displays invalidity (`aria-invalid` on its inner control,
   * `:state(user-invalid)`) without failing constraint validation. Call `requestUpdate()` on the
   * control after changing it.
   */
  readonly invalid?: boolean
  /** Called by the control after each sync of its value and validity. */
  controlChanged(control: HTMLElement): void
}

// Shared through the global symbol registry, so two copies of the library still see each other.
const observerKey = Symbol.for("tecton.control-observers")
const globalScope = globalThis as unknown as Record<symbol, WeakMap<Element, Set<ControlObserver>> | undefined>
const controlObservers: WeakMap<Element, Set<ControlObserver>> = (globalScope[observerKey] ??= new WeakMap())

/**
 * Registers `observer` on `control` (any element; only `FormControlMixin` controls call it back) and
 * asks the control to re-sync, so the observer gets the current state. No-op when already registered.
 */
export function observeControl(control: Element, observer: ControlObserver): void {
  let set = controlObservers.get(control)
  if (!set) controlObservers.set(control, (set = new Set()))
  if (set.has(observer)) return
  set.add(observer)
  ;(control as Partial<{ requestUpdate(): void }>).requestUpdate?.()
}

/** Removes an observer registered with {@link observeControl}. */
export function unobserveControl(control: Element, observer: ControlObserver): void {
  const set = controlObservers.get(control)
  if (!set?.delete(observer)) return
  ;(control as Partial<{ requestUpdate(): void }>).requestUpdate?.()
}

type Constructor<T = object> = new (...args: any[]) => T // eslint-disable-line @typescript-eslint/no-explicit-any

/** The public and protected members `FormControlMixin` adds (for typing subclasses). */
export declare class FormControl {
  static formAssociated: boolean
  /** The name submitted with the form. */
  name: string
  /** Disables the control (it is not submitted and cannot be focused). */
  disabled: boolean
  /** The control must have a value for the form to submit. */
  required: boolean
  /** Marks the control invalid (displayed immediately; the form refuses to submit with "Invalid value."). */
  invalid: boolean
  /**
   * Current value. Declared as an accessor so subclasses can override it with their own
   * getter/setter (e.g. a slider mapping `value` to `values`).
   */
  get value(): string
  set value(value: string)
  /** Default value (the `value` attribute); form reset returns to it. */
  defaultValue: string
  /** `disabled`, or disabled by an ancestor `<fieldset disabled>`. */
  get isDisabled(): boolean
  /** Whether invalidity is currently displayed (see module docs). */
  get showInvalid(): boolean
  get validity(): ValidityState
  get validationMessage(): string
  get willValidate(): boolean
  get form(): HTMLFormElement | null
  get labels(): NodeList
  checkValidity(): boolean
  reportValidity(): boolean
  setCustomValidity(message: string): void
  /** Re-syncs the submitted value and validity now. */
  syncFormState(): void
  protected formDisabled: boolean
  protected get formControl(): HTMLElement | null
  protected get ariaDelegationExclude(): readonly string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get validators(): Validator<any>[]
  protected formValue(): FormValue
  protected formState(): FormValue
  protected formResetValue(): void
  protected formRestoreState(state: FormValue, reason: "restore" | "autocomplete"): void
  protected formLabels(): Element[]
  /** Marks the control as interacted with, so constraint failures are displayed. */
  protected markInteracted(): void
  /** Re-dispatches an inner control's `change` event from the host (bubbling, composed). */
  protected redispatchChange(event?: Event): void
  formResetCallback(): void
  formDisabledCallback(disabled: boolean): void
  formStateRestoreCallback(state: FormValue, reason: "restore" | "autocomplete"): void
}

/** See the module documentation. */
export function FormControlMixin<T extends Constructor<TectonElement>>(Base: T) {
  class FormControlElement extends Base {
    static formAssociated = true

    /** The name submitted with the form. */
    @property({ reflect: true }) name = ""

    /** Disables the control (not submitted, not focusable). A disabled `<fieldset>` also disables it. */
    @property({ type: Boolean, reflect: true }) disabled = false

    /** The control must have a value for the form to submit. */
    @property({ type: Boolean, reflect: true }) required = false

    /**
     * Marks the control invalid: displayed immediately (`aria-invalid`, destructive styling) and the
     * form refuses to submit ("Invalid value.") — like React Aria's `isInvalid`.
     */
    @property({ type: Boolean, reflect: true }) invalid = false

    /** The default value (the `value` attribute). Form reset returns to it. */
    @property({ attribute: "value" }) defaultValue = ""

    #value: string | undefined

    /** The current value. Until set, it follows the `value` attribute. */
    @property({ attribute: false })
    get value(): string {
      return this.#value ?? this.defaultValue
    }
    set value(value: string) {
      this.#value = value == null ? "" : String(value)
    }

    /** Disabled by an ancestor `<fieldset disabled>`. */
    @state() protected formDisabled = false

    @state() private _interacted = false
    #customMessage = ""
    #silentCheck = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args)
      new AriaDelegateController(this, {
        target: () => this.formControl,
        labels: () => this.formLabels(),
        exclude: () => ["aria-invalid", ...this.ariaDelegationExclude],
      })
      // A submit attempt (or reportValidity / form.checkValidity) fires "invalid": show the errors.
      this.addEventListener("invalid", () => {
        if (!this.#silentCheck) this.markInteracted()
      })
      this.addEventListener("change", () => this.markInteracted())
    }

    // ---------------------------------------------------------------- hooks
    protected get formControl(): HTMLElement | null {
      return null
    }
    /**
     * Host `aria-*` attributes NOT mirrored onto `formControl`, because the component manages them
     * itself (e.g. a select that names its trigger "<value> <label>" excludes `aria-label` and
     * `aria-labelledby`). `aria-invalid` is always excluded (the mixin sets it from `showInvalid`).
     */
    protected get ariaDelegationExclude(): readonly string[] {
      return []
    }
    /** Custom validators, run when the `formControl` (if any) is valid. Typed loosely so subclasses can return `Validator<TheirClass>[]`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected get validators(): Validator<any>[] {
      return []
    }
    protected formValue(): FormValue {
      return this.value
    }
    protected formState(): FormValue {
      return this.formValue()
    }
    protected formResetValue(): void {
      this.#value = undefined
      this.requestUpdate("value")
    }
    protected formRestoreState(state: FormValue, _reason: "restore" | "autocomplete"): void {
      if (typeof state === "string") this.value = state
    }
    protected formLabels(): Element[] {
      return [...this.internals.labels] as Element[]
    }

    // ---------------------------------------------------------------- state
    get isDisabled(): boolean {
      return this.disabled || this.formDisabled
    }
    get showInvalid(): boolean {
      if (this.invalid || (this._interacted && !this.isDisabled && !this.internals.validity.valid)) return true
      for (const observer of controlObservers.get(this) ?? []) if (observer.invalid) return true
      return false
    }
    protected markInteracted(): void {
      if (!this._interacted) this._interacted = true
    }
    protected redispatchChange(_event?: Event): void {
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
    }

    // ---------------------------------------------------------------- native API
    get validity(): ValidityState {
      return this.internals.validity
    }
    get validationMessage(): string {
      return this.internals.validationMessage
    }
    get willValidate(): boolean {
      return this.internals.willValidate
    }
    get form(): HTMLFormElement | null {
      return this.internals.form
    }
    get labels(): NodeList {
      return this.internals.labels
    }
    checkValidity(): boolean {
      this.syncFormState()
      // Like :user-invalid, a programmatic check does not display the error.
      this.#silentCheck = true
      try {
        return this.internals.checkValidity()
      } finally {
        this.#silentCheck = false
      }
    }
    reportValidity(): boolean {
      this.syncFormState()
      this.markInteracted()
      return this.internals.reportValidity()
    }
    setCustomValidity(message: string): void {
      this.#customMessage = message ?? ""
      this.syncFormState()
    }

    // ---------------------------------------------------------------- form callbacks
    /** @internal */
    formResetCallback(): void {
      this.formResetValue()
      this._interacted = false
    }
    /** @internal */
    formDisabledCallback(disabled: boolean): void {
      this.formDisabled = disabled
    }
    /** @internal */
    formStateRestoreCallback(state: FormValue, reason: "restore" | "autocomplete"): void {
      this.formRestoreState(state, reason)
    }

    // ---------------------------------------------------------------- sync
    protected updated(changed: PropertyValues): void {
      super.updated(changed)
      this.syncFormState()
    }

    /** Re-syncs the submitted value and validity now (runs after every update). */
    syncFormState(): void {
      this.internals.setFormValue(this.formValue(), this.formState())
      const control = this.formControl as (HTMLElement & Partial<Pick<HTMLInputElement, "validity" | "validationMessage" | "willValidate">>) | null
      let flags: ValidityStateFlags = {}
      let message = ""
      if (this.#customMessage) {
        flags = { customError: true }
        message = this.#customMessage
      } else if (this.invalid) {
        flags = { customError: true }
        message = "Invalid value."
      } else {
        if (control?.validity && control.willValidate && !control.validity.valid) {
          for (const flag of VALIDITY_FLAGS) if (control.validity[flag] && flag !== "customError") flags[flag] = true
          message = control.validationMessage ?? ""
        }
        if (!Object.keys(flags).length) {
          for (const validator of this.validators) {
            const result = validator(this as unknown as FormControl)
            if (result) {
              flags = result.flags
              message = result.message
              break
            }
          }
        }
      }
      if (Object.keys(flags).length) this.internals.setValidity(flags, message || "Invalid value.", control ?? undefined)
      else this.internals.setValidity({})

      const invalidNow = !this.internals.validity.valid
      const show = this.showInvalid
      this.toggleState("invalid", invalidNow)
      this.toggleState("user-invalid", show)
      if (control) {
        if (show) control.setAttribute("aria-invalid", "true")
        else control.removeAttribute("aria-invalid")
      }
      for (const observer of controlObservers.get(this) ?? []) observer.controlChanged(this)
    }
  }
  return FormControlElement as unknown as Constructor<FormControl> & T
}
