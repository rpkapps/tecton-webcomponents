import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { ChevronDown, ChevronUp } from "lucide"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { accordionTriggerStyles } from "./accordion.styles.js"

/** Internal event: the heading text changed (the item re-labels its panel). */
export const LABEL_CHANGE = "tec-accordion-label-change"
const notify = (el: Element) => el.dispatchEvent(new Event(LABEL_CHANGE, { bubbles: true }))

/** What the item tells its trigger. @internal */
export interface AccordionTriggerState {
  expanded: boolean
  disabled: boolean
  /** Expanded and not collapsible (`no-collapse`): announced as `aria-disabled`. */
  locked: boolean
  level: number
  controls: Element | null
}

/**
 * Renders a heading (`aria-level` from `heading-level`, default 3) containing the button that
 * toggles the item, and the chevron (do not add your own). The `start`, `secondary` and `actions`
 * slots build the Tecton row: icon, label, secondary text, action buttons, chevron. Actions sit
 * outside the toggle button (interactive content cannot be nested in a button), so they are separate
 * tab stops.
 *
 * @summary The heading and button of a `tec-accordion-item`.
 *
 * @tag tec-accordion-trigger
 *
 * @slot - The heading text.
 * @slot start - A leading icon.
 * @slot secondary - Secondary text, shown in muted colour in the middle of the row.
 * @slot actions - Action buttons (e.g. `<tec-button size="icon-xs" variant="ghost">`), shown before the chevron.
 *
 * @csspart row - The grid holding the heading and the actions.
 * @csspart heading - The `role="heading"` element.
 * @csspart base - The toggle `<button>`.
 * @csspart start - Wrapper of the `start` slot.
 * @csspart label - Wrapper of the heading text.
 * @csspart secondary - Wrapper of the `secondary` slot.
 * @csspart icon - The chevron.
 * @csspart actions - Wrapper of the `actions` slot.
 *
 * @cssstate expanded - The item is expanded.
 * @cssstate disabled - The item is disabled.
 * @cssstate focus-visible - The toggle button has keyboard focus.
 */
export class TecAccordionTrigger extends TectonElement {
  static styles = [hostStyles, accordionTriggerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Heading level of this trigger. Defaults to the accordion's `heading-level` (3). */
  @property({ type: Number, attribute: "heading-level" }) headingLevel?: number

  @state() private itemState: AccordionTriggerState = { expanded: false, disabled: false, locked: false, level: 3, controls: null }

  /** The toggle `<button>`. */
  @query(".base") readonly button!: HTMLButtonElement | null

  constructor() {
    super()
    new HasSlotController(this, "start", "secondary", "actions", { states: true })
    this.addEventListener("focusin", this.#syncFocus)
    this.addEventListener("focusout", this.#syncFocus)
    this.addEventListener("keyup", this.#syncFocus)
  }

  #syncFocus = () => {
    const active = this.shadowRoot?.activeElement
    this.toggleState("focus-visible", !!active && active === this.button && active.matches(":focus-visible"))
  }

  /** The heading text (the default slot's text), used to name the panel. */
  get label(): string {
    const slot = this.renderRoot?.querySelector?.<HTMLSlotElement>(".label slot")
    const nodes = slot ? slot.assignedNodes({ flatten: true }) : [...this.childNodes].filter((n) => !(n instanceof Element && n.slot))
    return nodes
      .map((n) => n.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  }

  /**
   * Called by the parent item.
   * @internal
   */
  sync(next: AccordionTriggerState): void {
    this.itemState = next
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("expanded", this.itemState.expanded)
    this.toggleState("disabled", this.itemState.disabled)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const button = this.button as (HTMLButtonElement & { ariaControlsElements: Element[] | null }) | null
    if (button) button.ariaControlsElements = this.itemState.controls ? [this.itemState.controls] : null
  }

  protected override render() {
    const { expanded, disabled, locked } = this.itemState
    const level = this.headingLevel ?? this.itemState.level
    return html`<div class="row" part="row">
      <div class="heading" part="heading" role="heading" aria-level=${level}>
        <button
          class="base"
          part="base"
          type="button"
          aria-expanded=${expanded ? "true" : "false"}
          aria-disabled=${locked ? "true" : nothing}
          ?disabled=${disabled}
        >
          <span class="start" part="start"><slot name="start"></slot></span>
          <span class="label" part="label"><slot @slotchange=${() => notify(this)}></slot></span>
          <span class="secondary" part="secondary"><slot name="secondary"></slot></span>
          <span class="icon" part="icon">${expanded ? icon(ChevronUp, { size: 20 }) : icon(ChevronDown, { size: 20 })}</span>
        </button>
      </div>
      <div class="actions" part="actions"><slot name="actions"></slot></div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-accordion-trigger": TecAccordionTrigger
  }
}
