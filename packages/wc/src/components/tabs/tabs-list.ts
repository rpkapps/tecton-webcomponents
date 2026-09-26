import { ContextConsumer, ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { tabsContext, tabsListContext, type TabsListVariant } from "./tabs-context.js"
import type { TecTabsTrigger } from "./tabs-trigger.js"
import { tabsListStyles } from "./tabs.styles.js"

/**
 * @summary The row (or column) of tab triggers.
 *
 * @tag tec-tabs-list
 *
 * @slot - `tec-tabs-trigger` elements.
 *
 * @csspart base - The track holding the triggers.
 *
 * @cssstate vertical - The parent `tec-tabs` is vertical.
 */
export class TecTabsList extends TectonElement {
  static styles = [hostStyles, tabsListStyles]

  /** `default`: triggers on a card-coloured track. `line`: transparent, with an underline on the selected tab. */
  @property({ reflect: true }) variant: TabsListVariant = "default"

  #tabs = new ContextConsumer(this, { context: tabsContext, subscribe: true })
  #provider = new ContextProvider(this, { context: tabsListContext, initialValue: { variant: "default" } })
  #lastSelected: string | undefined

  #roving = new RovingFocusController<TecTabsTrigger>(this, {
    items: () => this.#triggers(),
    orientation: () => this.#tabs.value?.orientation ?? "horizontal",
    loop: true,
    activateOnFocus: () => this.#tabs.value?.activation !== "manual",
    onActivate: (trigger, event) => this.#tabs.value?.select(trigger.value, event),
  })

  constructor() {
    super()
    this.addEventListener("focusout", (event) => {
      // Re-entering the list focuses the selected tab (APG), not the last one arrowed to.
      if (!this.contains(event.relatedTarget as Node | null)) this.#focusSelectedNext()
    })
  }

  #triggers(): TecTabsTrigger[] {
    return [...this.querySelectorAll<TecTabsTrigger>("tec-tabs-trigger")].filter((t) => t.closest("tec-tabs-list") === this)
  }

  #focusSelectedNext(): void {
    const selected = this.#triggers().find((t) => t.value === this.#tabs.value?.value)
    if (selected && !selected.disabled) this.#roving.setActive(selected)
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("variant")) this.#provider.setValue({ variant: this.variant })
    this.internals.role = "tablist"
    this.internals.ariaOrientation = this.#tabs.value?.orientation ?? "horizontal"
    this.toggleState("vertical", this.#tabs.value?.orientation === "vertical")
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const selected = this.#tabs.value?.value
    if (selected !== this.#lastSelected) {
      this.#lastSelected = selected
      this.#focusSelectedNext()
    }
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.#roving.update()}></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tabs-list": TecTabsList
  }
}
