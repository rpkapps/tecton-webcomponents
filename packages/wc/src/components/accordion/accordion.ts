import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecAccordionItem } from "./accordion-item.js"
import { accordionStyles } from "./accordion.styles.js"

/** An item's value, also before it is upgraded (while the document is parsed). */
const valueOf = (item: TecAccordionItem): string => item.value ?? item.getAttribute("value") ?? ""

export type AccordionVariant = "default" | "outline" | "plain"

/** `detail` of `tec-value-change`. */
export interface AccordionValueChangeDetail {
  /** The first expanded item's value after the change (`""` when none). */
  value: string
  /** Every expanded item's value after the change. */
  values: string[]
}

/**
 * Implements the WAI-ARIA accordion pattern: each trigger is a button with `aria-expanded` and
 * `aria-controls` inside a heading, each panel a `group` named by its trigger. Tab moves through the
 * triggers; ↑ / ↓ move between them and Home / End jump to the first / last.
 *
 * One item is expanded at a time unless `multiple` is set. Expanded items can be collapsed again
 * (set `no-collapse` to keep one open in single mode).
 *
 * @summary A vertically stacked set of interactive headings that each reveal a section of content.
 *
 * @tag tec-accordion
 *
 * @slot - `tec-accordion-item` elements.
 *
 * @csspart base - The group box (border and radius of the `outline` variant).
 *
 * @cssprop --tec-accordion-radius - Corner radius of the group (default `--tec-radius-md`; `--tec-radius-lg` for `outline`).
 * @cssprop --tec-accordion-padding-inline - Inline padding of triggers and panels (default 0.5rem; 1rem for `outline`).
 *
 * @fires tec-value-change - The user expanded or collapsed an item. Cancelable (`preventDefault()` keeps the current state). `detail: { value, values }`.
 */
export class TecAccordion extends TectonElement {
  static styles = [hostStyles, accordionStyles]

  /** Allows several items to be expanded at once. */
  @property({ type: Boolean, reflect: true }) multiple = false

  /** Disables every item. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** In single mode, the expanded item cannot be collapsed by its trigger (one item stays open). */
  @property({ type: Boolean, reflect: true, attribute: "no-collapse" }) noCollapse = false

  /** The `aria-level` of the trigger headings. */
  @property({ type: Number, attribute: "heading-level" }) headingLevel = 3

  /** `default`: dividers between items. `outline`: a bordered, rounded group with wider padding. `plain`: no dividers. */
  @property({ reflect: true }) variant: AccordionVariant = "default"

  /** Values requested before the items existed (the `value` attribute while parsing). */
  #desired: string[] | null = null
  #lastOpen = new Set<TecAccordionItem>()

  #observer = new MutationObserver((records) => {
    const relevant = (n: Node) => n instanceof Element && (n.localName === "tec-accordion-item" || !!n.querySelector("tec-accordion-item"))
    if (records.some((r) => (r.type === "attributes" ? r.target instanceof Element && r.target.localName === "tec-accordion-item" : [...r.addedNodes, ...r.removedNodes].some(relevant)))) {
      this.#syncItems()
    }
  })

  constructor() {
    super()
    this.addEventListener("keydown", this.#onKeyDown)
  }

  /**
   * The value of the first expanded item (`""` when none). Setting it expands that item (and, in
   * single mode, collapses the others); the `value` attribute sets the initially expanded item.
   */
  @property()
  get value(): string {
    return this.values[0] ?? ""
  }
  set value(value: string) {
    const old = this.value
    this.values = value ? [value] : []
    this.requestUpdate("value", old)
  }

  /** The values of every expanded item. Setting it expands exactly those items. */
  get values(): string[] {
    if (this.#desired && !this.items.length) return [...this.#desired]
    return this.items.filter((i) => i.open).map((i) => i.value)
  }
  set values(values: string[]) {
    this.#desired = [...values]
    this.#applyDesired()
  }

  /** The items of this accordion (not of nested accordions), in DOM order. */
  get items(): TecAccordionItem[] {
    return [...this.querySelectorAll<TecAccordionItem>("tec-accordion-item")].filter((i) => i.parentElement?.closest("tec-accordion") === this)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "disabled", "value"] })
    this.#syncItems()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #applyDesired(): void {
    const desired = this.#desired
    const items = this.items
    if (!desired || !items.length) return
    let wanted = items.filter((i) => desired.includes(valueOf(i)))
    if (!this.multiple) wanted = wanted.slice(0, 1)
    for (const item of items) item.open = wanted.includes(item)
    // Keep the request until every requested value has an item (items may still be parsing).
    if (desired.every((v) => items.some((i) => valueOf(i) === v))) this.#desired = null
    this.#lastOpen = new Set(wanted)
  }

  #syncItems(): void {
    const items = this.items
    if (this.#desired) this.#applyDesired()
    if (!this.multiple) {
      const open = items.filter((i) => i.open)
      if (open.length > 1) {
        // Keep the item opened most recently (programmatically), else the first.
        const keep = open.find((i) => !this.#lastOpen.has(i)) ?? open[0]
        for (const item of open) if (item !== keep) item.open = false
      }
    }
    this.#lastOpen = new Set(items.filter((i) => i.open))
    const plain = this.variant === "plain"
    items.forEach((item, index) => {
      if (typeof item.setPosition === "function") item.setPosition(index === 0, index === items.length - 1, plain)
      else void customElements.whenDefined("tec-accordion-item").then(() => this.#syncItems())
    })
  }

  /**
   * Expands or collapses `item` on behalf of the user: applies single/multiple and `no-collapse`,
   * fires the cancelable `tec-value-change`. Returns whether the item ended up in the requested state.
   * @internal
   */
  requestItem(item: TecAccordionItem, open: boolean, _reason: "trigger" | "find" = "trigger"): boolean {
    if (item.open === open) return true
    if (this.disabled || item.disabled) return false
    if (!open && this.noCollapse && !this.multiple) return false
    const items = this.items
    const next = this.multiple ? items.filter((i) => (i === item ? open : i.open)) : open ? [item] : []
    const detail: AccordionValueChangeDetail = { value: next[0]?.value ?? "", values: next.map((i) => i.value) }
    if (!this.emit<AccordionValueChangeDetail>("tec-value-change", { detail, cancelable: true })) return false
    this.#desired = null
    for (const i of items) i.open = next.includes(i)
    this.#lastOpen = new Set(next)
    return true
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const path = event.composedPath()
    const buttons = this.items.map((i) => i.trigger?.button ?? null)
    const current = buttons.findIndex((b) => b && path.includes(b))
    if (current < 0) return
    const enabled = buttons.map((b, i) => (b && !b.disabled ? i : -1)).filter((i) => i >= 0)
    if (!enabled.length) return
    let target: number
    const pos = enabled.indexOf(current)
    if (event.key === "Home") target = enabled[0]!
    else if (event.key === "End") target = enabled[enabled.length - 1]!
    else if (event.key === "ArrowDown") target = enabled[(pos + 1) % enabled.length]!
    else target = enabled[(pos - 1 + enabled.length) % enabled.length]!
    event.preventDefault()
    buttons[target]?.focus()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("multiple") || changed.has("variant")) this.#syncItems()
    if (changed.has("disabled") || changed.has("headingLevel") || changed.has("noCollapse") || changed.has("multiple")) {
      for (const item of this.items) item.requestUpdate?.()
    }
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.#syncItems()}></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-accordion": TecAccordion
  }
}
