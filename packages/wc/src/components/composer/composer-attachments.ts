import { ContextConsumer } from "@lit/context"
import { X } from "lucide"
import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { icon } from "../../internal/icons.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerAttachmentStyles, composerAttachmentsStyles } from "./composer.styles.js"

/**
 * What goes with the message besides its text (a selection from the page, a file), as removable
 * chips in a grid: one tab stop, the arrow keys move between the chips, Delete or Backspace removes
 * the focused one, and so does its remove button. Hidden while it holds no attachment.
 *
 * @summary Removable context chips above the textarea.
 *
 * @tag tec-composer-attachments
 *
 * @slot - `tec-composer-attachment` elements.
 *
 * @csspart base - The wrapping row of chips.
 *
 * @cssstate empty - No attachment (the element is hidden).
 */
export class TecComposerAttachments extends TectonElement {
  static styles = [hostStyles, composerAttachmentsStyles]

  /** The group's accessible name (an `aria-label` on the element wins). */
  @property() label = "Attachments"

  #roving = new RovingFocusController<TecComposerAttachment>(this, {
    items: () => this.attachments,
    orientation: "both",
    loop: false,
  })

  /** The attachments, in order. */
  get attachments(): TecComposerAttachment[] {
    return [...this.querySelectorAll<TecComposerAttachment>(":scope > tec-composer-attachment")]
  }

  #sync = () => {
    this.#roving.update()
    this.toggleState("empty", this.attachments.length === 0)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "grid"
    this.internals.ariaLabel = this.label
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("empty", this.attachments.length === 0)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${this.#sync}></slot></div>`
  }
}

/**
 * Removing it (Delete, Backspace, or its remove button) fires a cancelable `tec-remove`, then takes the
 * element out of the page and moves focus to the next chip, the previous one, or — after the last —
 * the textarea. Cancel the event to remove it yourself (from the application's state).
 *
 * @summary One removable attachment chip.
 *
 * @tag tec-composer-attachment
 *
 * @slot - The label.
 * @slot start - A leading icon.
 * @slot description - A longer description, after the label (or use the `description` attribute).
 *
 * @csspart base - The chip (the grid cell).
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart remove - The remove button.
 *
 * @cssstate has-start - The `start` slot has an icon.
 *
 * @fires tec-remove - The user removed the attachment. Cancelable: `preventDefault()` keeps the element.
 */
export class TecComposerAttachment extends TectonElement {
  static styles = [hostStyles, composerAttachmentStyles]

  /** A longer description, shown after the label in muted text. */
  @property() description = ""

  /** The remove button's accessible name (followed by the label). */
  @property({ attribute: "remove-label" }) removeLabel = "Remove"

  /** An attachment that cannot be removed has no remove button. */
  @property({ type: Boolean, attribute: "not-removable" }) notRemovable = false

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })
  #slots = new HasSlotController(this, "start", "description", { states: true })

  constructor() {
    super()
    this.addEventListener("keydown", (event) => {
      if (event.target !== this || (event.key !== "Delete" && event.key !== "Backspace")) return
      event.preventDefault()
      this.requestRemove()
    })
  }

  /** Removes the attachment as the user would: fires `tec-remove`, then removes the element and moves focus on. */
  requestRemove(): void {
    if (this.notRemovable || this.#composer.value?.disabled) return
    const parent = this.parentElement
    const siblings = parent ? [...parent.children].filter((el): el is TecComposerAttachment => el.localName === "tec-composer-attachment") : [this]
    const index = siblings.indexOf(this)
    const next = siblings[index + 1] ?? siblings[index - 1]
    const hadFocus = this.matches(":focus-within")
    if (!this.emit("tec-remove", { cancelable: true })) return
    const composer = this.#composer.value?.composer
    this.remove()
    if (!hadFocus) return
    if (next) next.focus()
    else composer?.focus()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "row"
    // The row is named by its label and description, not by its remove button.
    const text = [...this.childNodes]
      .filter((node) => !(node instanceof Element && node.getAttribute("slot") === "start"))
      .map((node) => node.textContent ?? "")
      .join(" ")
    this.internals.ariaLabel = [text, this.description].join(" ").replace(/\s+/g, " ").trim() || null
  }

  protected override render() {
    const hasDescription = !!this.description || this.#slots.test("description")
    return html`<div class="base" part="base" role="gridcell">
      <slot name="start"></slot>
      <span class="label" part="label" id="label"><slot></slot></span>
      ${hasDescription
        ? html`<span class="description" part="description"><slot name="description">${this.description}</slot></span>`
        : html`<slot name="description" hidden></slot>`}
      ${this.notRemovable
        ? nothing
        : html`<button
            class="remove"
            part="remove"
            type="button"
            tabindex="-1"
            id="remove"
            aria-label=${this.removeLabel}
            aria-labelledby="remove label"
            ?disabled=${this.#composer.value?.disabled ?? false}
            @click=${() => this.requestRemove()}
          >
            ${icon(X, { size: 12 })}
          </button>`}
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-attachments": TecComposerAttachments
    "tec-composer-attachment": TecComposerAttachment
  }
}
