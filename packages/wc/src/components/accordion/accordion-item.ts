import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecAccordion } from "./accordion.js"
import type { TecAccordionContent } from "./accordion-content.js"
import { LABEL_CHANGE, type TecAccordionTrigger } from "./accordion-trigger.js"
import { accordionItemStyles } from "./accordion.styles.js"

/**
 * An item needs a `value` when the accordion's `value` / `values` refer to it. Outside a
 * `tec-accordion` it works on its own as a single disclosure.
 *
 * @summary One section of a `tec-accordion`: a `tec-accordion-trigger` and a `tec-accordion-content`.
 *
 * @tag tec-accordion-item
 *
 * @slot - A `tec-accordion-trigger` followed by a `tec-accordion-content`.
 *
 * @csspart base - The item box (divider, rounded corners of the first/last item).
 *
 * @cssstate first - The first item of the accordion.
 * @cssstate last - The last item of the accordion.
 * @cssstate plain - The accordion uses the `plain` variant (no dividers).
 */
export class TecAccordionItem extends TectonElement {
  static styles = [hostStyles, accordionItemStyles]

  /** Identifies the item in the accordion's `value` / `values` and `tec-value-change`. */
  @property({ reflect: true }) value = ""

  /** Whether the item is expanded. Set it (or the accordion's `value`) to expand it programmatically. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Disables the item: its trigger cannot be focused or pressed, and it keeps its current state. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #observer = new MutationObserver(() => this.requestUpdate())

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
    this.addEventListener(LABEL_CHANGE, (e) => {
      if (e.target !== this) this.requestUpdate()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    // Trigger text edits rename the panel.
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** The accordion this item belongs to (the closest ancestor `tec-accordion`), if any. */
  get accordion(): TecAccordion | null {
    return this.parentElement?.closest<TecAccordion>("tec-accordion") ?? null
  }

  /** The item's trigger. */
  get trigger(): TecAccordionTrigger | null {
    return this.querySelector<TecAccordionTrigger>(":scope > tec-accordion-trigger")
  }

  /** The item's content. */
  get content(): TecAccordionContent | null {
    return this.querySelector<TecAccordionContent>(":scope > tec-accordion-content")
  }

  /** Whether the item is disabled, directly or through its accordion. */
  get isDisabled(): boolean {
    return this.disabled || !!this.accordion?.disabled
  }

  /**
   * Called by the accordion.
   * @internal
   */
  setPosition(first: boolean, last: boolean, plain: boolean): void {
    this.toggleState("first", first)
    this.toggleState("last", last)
    this.toggleState("plain", plain)
    this.requestUpdate()
  }

  #onClick = (event: MouseEvent) => {
    const button = this.trigger?.button
    if (!button || event.defaultPrevented || !event.composedPath().includes(button)) return
    if (this.isDisabled || button.getAttribute("aria-disabled") === "true") return
    this.#request(!this.open, "trigger")
  }

  #request(open: boolean, reason: "trigger" | "find"): boolean {
    const accordion = this.accordion
    if (accordion) return accordion.requestItem(this, open, reason)
    this.open = open
    return true
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const accordion = this.accordion
    const trigger = this.trigger
    const content = this.content
    const disabled = this.isDisabled
    if (trigger && typeof trigger.sync === "function") {
      trigger.sync({
        expanded: this.open,
        disabled,
        locked: this.open && !!accordion?.noCollapse && !accordion.multiple,
        level: accordion?.headingLevel ?? 3,
        controls: content,
      })
    } else if (trigger) {
      void customElements.whenDefined("tec-accordion-trigger").then(() => this.requestUpdate())
    }
    if (content && typeof content.sync === "function") {
      content.sync({
        expanded: this.open,
        label: trigger && typeof trigger.sync === "function" ? trigger.label : trigger?.textContent?.trim(),
        onReveal: () => !disabled && this.#request(true, "find"),
      })
    } else if (content) {
      void customElements.whenDefined("tec-accordion-content").then(() => this.requestUpdate())
    }
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-accordion-item": TecAccordionItem
  }
}
