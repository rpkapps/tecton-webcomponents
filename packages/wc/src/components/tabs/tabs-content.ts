import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { getTabbables } from "../../internal/focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { tabsContext } from "./tabs-context.js"
import { tabsContentStyles } from "./tabs.styles.js"

/**
 * @summary The panel shown while the trigger with the same `value` is selected.
 *
 * @tag tec-tabs-content
 *
 * @slot - The panel content.
 *
 * @cssstate selected - The panel is shown.
 *
 * The panel is focusable (`tabindex="0"`) unless it contains focusable content, so keyboard users
 * can reach text-only panels (React Aria behaviour).
 */
export class TecTabsContent extends TectonElement {
  static styles = [hostStyles, tabsContentStyles]

  /** Matches the `value` of a `tec-tabs-trigger`. */
  @property({ reflect: true }) value = ""

  #tabs = new ContextConsumer(this, { context: tabsContext, subscribe: true })

  /** Whether the panel is shown. */
  get selected(): boolean {
    return !!this.#tabs.value && this.#tabs.value.value === this.value
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "tabpanel"
    this.toggleState("selected", this.selected)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const trigger = this.#tabs.value?.triggerFor(this.value)
    this.internals.ariaLabelledByElements = trigger ? [trigger] : null
    this.#syncTabIndex()
  }

  #syncTabIndex(): void {
    const hasTabbable = this.selected && getTabbables(this).some((el) => el !== this)
    if (hasTabbable) this.removeAttribute("tabindex")
    else if (this.getAttribute("tabindex") !== "0") this.tabIndex = 0
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.#syncTabIndex()}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tabs-content": TecTabsContent
  }
}
