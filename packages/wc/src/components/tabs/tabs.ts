import { ContextProvider } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { tabsContext, type TabsActivation, type TabsContextValue, type TabsOrientation } from "./tabs-context.js"
import type { TecTabsContent } from "./tabs-content.js"
import type { TecTabsTrigger } from "./tabs-trigger.js"
import { tabsStyles } from "./tabs.styles.js"

export type { TabsActivation, TabsListVariant, TabsOrientation } from "./tabs-context.js"

/**
 * Implements the WAI-ARIA tabs pattern: `tablist` / `tab` / `tabpanel` semantics, roving focus with
 * the arrow keys (Left/Right, or Up/Down when vertical; mirrored in RTL), Home/End, and automatic
 * (focus selects) or manual (Enter/Space selects) activation.
 *
 * @summary A set of layered sections of content (tab panels) that are displayed one at a time.
 *
 * @tag tec-tabs
 *
 * @slot - A `tec-tabs-list` with `tec-tabs-trigger`s, and one `tec-tabs-content` per trigger (matched by `value`).
 *
 * @fires tec-value-change - The user selected another tab. Cancelable (`preventDefault()` keeps the current tab). `detail: { value }`.
 */
export class TecTabs extends TectonElement {
  static styles = [hostStyles, tabsStyles]

  /** The selected tab's `value`. Defaults to the first enabled trigger. */
  @property() value = ""

  /** Layout and arrow-key axis. */
  @property({ reflect: true }) orientation: TabsOrientation = "horizontal"

  /** `automatic`: moving focus with the arrow keys selects the tab. `manual`: Enter/Space selects. */
  @property({ reflect: true }) activation: TabsActivation = "automatic"

  #provider = new ContextProvider(this, { context: tabsContext, initialValue: undefined })
  // Re-sync when triggers/panels are added, removed or change value/disabled — not on every change
  // inside a panel.
  #observer = new MutationObserver((records) => {
    const relevant = (n: Node) => n instanceof Element && (n.localName === "tec-tabs-trigger" || n.localName === "tec-tabs-content" || !!n.querySelector("tec-tabs-trigger, tec-tabs-content"))
    if (records.some((r) => (r.type === "attributes" ? relevant(r.target) : [...r.addedNodes, ...r.removedNodes].some(relevant)))) this.requestUpdate()
  })

  /** The triggers of this tabs element (not of nested tabs), in DOM order. */
  get triggers(): TecTabsTrigger[] {
    return [...this.querySelectorAll<TecTabsTrigger>("tec-tabs-trigger")].filter((t) => t.closest("tec-tabs") === this)
  }

  /** The panels of this tabs element, in DOM order. */
  get contents(): TecTabsContent[] {
    return [...this.querySelectorAll<TecTabsContent>("tec-tabs-content")].filter((c) => c.closest("tec-tabs") === this)
  }

  /** The value actually shown: `value` if a trigger has it, else the first enabled trigger. */
  get selectedValue(): string {
    const triggers = this.triggers
    const match = triggers.find((t) => t.value === this.value && !t.disabled)
    return (match ?? triggers.find((t) => !t.disabled))?.value ?? this.value
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "disabled"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #select = (value: string, _event?: Event) => {
    if (value === this.selectedValue) return
    if (this.emit<{ value: string }>("tec-value-change", { detail: { value }, cancelable: true })) this.value = value
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const value: TabsContextValue = {
      value: this.selectedValue,
      orientation: this.orientation,
      activation: this.activation,
      select: this.#select,
      triggerFor: (v) => this.triggers.find((t) => t.value === v) ?? null,
      contentFor: (v) => this.contents.find((c) => c.value === v) ?? null,
    }
    // A new object on every update: consumers (lists, triggers, panels) re-render with it.
    this.#provider.setValue(value, true)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-tabs": TecTabs
  }
}
