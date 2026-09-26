import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { findDescendant, isLabelable, updateIdRefs } from "../../internal/labelable.js"
import { labelStyles } from "./label.styles.js"

/**
 * Works like a native `<label>` for any control — native elements and Tecton controls alike, whose
 * real input lives in a shadow root that a native `<label for>` can reach but other markup cannot:
 *
 * - **Association**: the `for` attribute names the control's `id`; without it, the label labels the
 *   control it contains, or else the control of the enclosing `<tec-field>`.
 * - **Name**: the label adds its `id` (generated when missing) to the control's `aria-labelledby`,
 *   keeping any ids already there. A control with an `aria-label` keeps that name.
 * - **Activation**: clicking the label focuses the control and clicks it, so a checkbox, switch or
 *   radio toggles and a text field takes focus. Links and buttons inside the label keep their own
 *   behaviour.
 * - **State**: the label dims while its control is disabled (`:state(disabled)`).
 *
 * A native `<label for>` also works with every Tecton form control; use `tec-label` for the Tecton
 * label style or when the association must follow the markup (containment, fields).
 *
 * @summary Renders an accessible label associated with a control.
 *
 * @tag tec-label
 *
 * @slot - The label text, optionally with icons or badges.
 *
 * @csspart base - The box around the label content (flex row, `gap: 0.5rem`).
 *
 * @cssstate disabled - The labelled control is disabled.
 */
export class TecLabel extends TectonElement {
  static styles = [hostStyles, labelStyles]

  /**
   * The `id` of the labelled control, like `<label for>` (the property is `htmlFor`, as on
   * `HTMLLabelElement`). Resolved in the label's own document or shadow root.
   */
  @property({ attribute: "for" }) htmlFor = ""

  #control: HTMLElement | null = null
  /** Ids this label added to the control's `aria-labelledby`. */
  #refs: string[] = []
  #controlObserver = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === "aria-label")) this.refresh()
    else this.syncControlState()
  })
  #selfObserver = new MutationObserver(() => this.refresh())
  #frame = 0

  /** The labelled control (like `HTMLLabelElement.control`), or `null`. */
  get control(): HTMLElement | null {
    return this.isConnected ? this.resolveControl() : null
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.id) this.id = uniqueId(this.localName)
    this.addEventListener("click", this.#onClick)
    this.#selfObserver.observe(this, { childList: true, subtree: true })
    // Controls parsed after the label, or defined later, are picked up on the next frame.
    this.#frame = requestAnimationFrame(() => this.refresh())
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    cancelAnimationFrame(this.#frame)
    this.removeEventListener("click", this.#onClick)
    this.#selfObserver.disconnect()
    this.refresh()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("htmlFor")) this.refresh()
  }

  /**
   * Re-resolves the control and re-applies the association. Called automatically; call it after
   * moving a control into place with script if the label does not pick it up.
   */
  refresh(): void {
    const control = this.isConnected ? this.resolveControl() : null
    if (control !== this.#control) {
      if (this.#control) updateIdRefs(this.#control, "aria-labelledby", this.#refs, [])
      this.#refs = []
      this.#controlObserver.disconnect()
      this.#control = control
      if (control) this.#controlObserver.observe(control, { attributes: true, attributeFilter: ["disabled", "aria-label"] })
    }
    if (control) {
      const next = control.hasAttribute("aria-label") || !this.id ? [] : [this.id]
      updateIdRefs(control, "aria-labelledby", this.#refs, next)
      this.#refs = next
    }
    this.syncControlState()
  }

  /** Finds the labelled control: `for`, then containment, then the enclosing field's control. */
  protected resolveControl(): HTMLElement | null {
    if (this.htmlFor) {
      const root = this.getRootNode() as Document | ShadowRoot
      const target = root.getElementById?.(this.htmlFor) ?? null
      return target && isLabelable(target) ? target : null
    }
    const contained = findDescendant(this, isLabelable)
    if (contained) return contained
    const field = this.closest("tec-field") as (Element & { control?: HTMLElement | null }) | null
    return field?.control ?? null
  }

  /** Updates the states that mirror the control (`:state(disabled)`). */
  protected syncControlState(): void {
    const control = this.#control
    this.toggleState("disabled", !!control && control.matches(":disabled"))
  }

  #onClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    const control = this.control
    if (!control || control.matches(":disabled")) return
    const path = event.composedPath()
    if (path.includes(control)) return
    for (const node of path) {
      if (node === this) break
      if (node instanceof HTMLElement && node.matches("a[href], button, input, select, textarea, [contenteditable], tec-button, [role=button], [role=link]"))
        return
    }
    control.focus()
    control.click()
  }

  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-label": TecLabel
  }
}
