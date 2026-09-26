import { ContextConsumer } from "@lit/context"
import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { fieldContext } from "./field-context.js"
import { fieldErrorStyles } from "./field.styles.js"

/** An error entry: a message string, or an issue object with a `message` (Standard Schema, form libraries). */
export type FieldErrorEntry = string | { message?: string } | null | undefined

/**
 * The message comes from, in order: the slotted content, the `errors` property (duplicates removed;
 * several messages render as a list), or — inside a `tec-field` — the control's own
 * `validationMessage` (the browser's localized "Please fill out this field." …).
 *
 * Inside a `tec-field` the error is **displayed only while the field is invalid** (the field's
 * `invalid` attribute, or its control displays invalidity), and it then describes the control
 * (`aria-describedby`). Outside a field it is displayed whenever it has a message. It is a
 * `role="alert"` live region, so a message that appears is announced.
 *
 * @summary Displays a validation message for a form field.
 *
 * @tag tec-field-error
 *
 * @slot - A custom message (always used when present).
 *
 * @csspart base - The message container.
 * @csspart list - The `<ul>` of several `errors`.
 *
 * @cssstate displayed - The error is displayed.
 */
export class TecFieldError extends TectonElement {
  static styles = [hostStyles, fieldErrorStyles]

  /** Error entries to display (strings or `{ message }` objects), e.g. a validator's issue list. */
  @property({ attribute: false }) errors: FieldErrorEntry[] = []

  #field = new ContextConsumer(this, { context: fieldContext, subscribe: true })
  #slots = new HasSlotController(this, "[default]")

  /** The unique messages of `errors`. */
  get messages(): string[] {
    const messages = (this.errors ?? []).map((e) => (typeof e === "string" ? e : e?.message)).filter((m): m is string => !!m)
    return [...new Set(messages)]
  }

  /** Whether the error is currently displayed (see the element description). */
  get displayed(): boolean {
    const field = this.#field.value
    const hasOwn = this.#slots.test("[default]") || this.messages.length > 0
    if (!field) return hasOwn
    return field.invalid && (hasOwn || !!field.validationMessage)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.id) this.id = uniqueId("tec-field-error")
    this.internals.role = "alert"
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("displayed", this.displayed)
    if (changed.has("errors")) (this.closest("tec-field") as (Element & { refresh?(): void }) | null)?.refresh?.()
  }

  protected override render() {
    const messages = this.messages
    const fallback = this.#field.value?.validationMessage ?? ""
    let generated: unknown = nothing
    if (messages.length === 1) generated = messages[0]
    else if (messages.length > 1) generated = html`<ul part="list">${messages.map((m) => html`<li>${m}</li>`)}</ul>`
    else if (fallback) generated = fallback
    const own = this.#slots.test("[default]")
    return html`<div class="base" part="base"><slot></slot>${own ? nothing : generated}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-field-error": TecFieldError
  }
}
