import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { tabsContext, tabsListContext } from "./tabs-context.js"
import { tabsTriggerStyles } from "./tabs.styles.js"

/**
 * @summary A tab: selects the `tec-tabs-content` with the same `value`.
 *
 * @tag tec-tabs-trigger
 *
 * @slot - The label; icons placed here are sized to 1rem.
 * @slot start - A leading icon (tightens the leading padding).
 * @slot end - A trailing icon (tightens the trailing padding).
 *
 * @cssstate selected - This tab is selected.
 * @cssstate line - The list uses the `line` variant.
 * @cssstate vertical - The tabs are vertical.
 */
export class TecTabsTrigger extends TectonElement {
  static styles = [hostStyles, tabsTriggerStyles]

  /** Identifies the tab and its panel. */
  @property({ reflect: true }) value = ""

  /** Disables the tab (skipped by the arrow keys, cannot be selected). */
  @property({ type: Boolean, reflect: true }) disabled = false

  #tabs = new ContextConsumer(this, { context: tabsContext, subscribe: true })
  #list = new ContextConsumer(this, { context: tabsListContext, subscribe: true })

  constructor() {
    super()
    new HasSlotController(this, "start", "end", { states: true })
    this.addEventListener("click", (event) => {
      if (!this.disabled) this.#tabs.value?.select(this.value, event)
    })
    this.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !this.disabled && !event.defaultPrevented) {
        event.preventDefault()
        this.#tabs.value?.select(this.value, event)
      }
    })
  }

  /** Whether this tab is the selected one. */
  get selected(): boolean {
    return !!this.#tabs.value && this.#tabs.value.value === this.value
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const selected = this.selected
    this.internals.role = "tab"
    this.internals.ariaSelected = String(selected)
    this.internals.ariaDisabled = this.disabled ? "true" : null
    this.toggleState("selected", selected)
    this.toggleState("line", this.#list.value?.variant === "line")
    this.toggleState("vertical", this.#tabs.value?.orientation === "vertical")
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const content = this.#tabs.value?.contentFor(this.value)
    this.internals.ariaControlsElements = content ? [content] : null
  }

  protected override render() {
    return html`<slot name="start"></slot><slot></slot><slot name="end"></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tabs-trigger": TecTabsTrigger
  }
}
