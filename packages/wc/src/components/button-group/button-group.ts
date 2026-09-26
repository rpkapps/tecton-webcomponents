import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  buttonGroupSeparatorStyles,
  buttonGroupStyles,
  buttonGroupTextStyles,
  JOINED_RADIUS_PROPERTIES,
  TRIGGER_WRAPPERS,
} from "./button-group.styles.js"

export type ButtonGroupOrientation = "horizontal" | "vertical"

/** Controls whose border makes filled buttons in the same group take the outline border colour. */
const BORDERED = '[variant="outline"], tec-input, tec-textarea, tec-select, tec-native-select, tec-input-group, tec-button-group-text, input, textarea, select'

/** Inline properties the group writes on the trigger of a wrapped control (popover, menu, tooltip …). */
const TRIGGER_PROPERTIES = [...JOINED_RADIUS_PROPERTIES, "--tec-button-border-color", "margin-inline-start", "margin-block-start", "z-index"]

/**
 * Joins its children into one shape: inner corners are squared, adjacent borders overlap (1px), and
 * the hovered or focused control is drawn on top. Corners are logical, so the shape mirrors in RTL.
 * Nest groups to separate clusters: a group that contains groups adds a 0.5rem gap between them.
 *
 * Buttons, inputs, selects, input groups, `tec-button-group-text` and `tec-button-group-separator`
 * can be joined, and so can the `slot="trigger"` button of a dropdown menu, popover or tooltip placed
 * directly in the group (split buttons). The group sets the children's `--tec-<component>-radius`
 * custom properties; filled buttons next to outlined controls get `--tec-button-border-color`.
 *
 * The host has `role="group"`: name it with `aria-label` or `aria-labelledby`. For a row that is one
 * Tab stop with arrow-key navigation, use a toolbar instead.
 *
 * @summary A container that groups related buttons together with consistent styling.
 *
 * @tag tec-button-group
 *
 * @slot - Buttons, inputs, selects, menu triggers, `tec-button-group-text`, `tec-button-group-separator` or nested `tec-button-group`s.
 *
 * @cssprop --tec-button-group-radius - Radius of the outer corners (default `--tec-radius-md`; `9999px` for a pill).
 *
 * @cssstate has-groups - The group contains nested groups (spaced 0.5rem apart).
 * @cssstate bordered - The group contains an outlined control, so filled buttons get a border.
 */
export class TecButtonGroup extends TectonElement {
  static styles = [hostStyles, buttonGroupStyles]

  /** Lays the children out in a row or a column. */
  @property({ reflect: true }) orientation: ButtonGroupOrientation = "horizontal"

  #observer = new MutationObserver(() => this.#sync())
  /** Triggers the group currently styles inline, to clean up when they leave. */
  #styled = new Set<HTMLElement>()

  constructor() {
    super()
    for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) {
      this.addEventListener(type, () => requestAnimationFrame(() => this.#raise()))
    }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["variant", "slot", "aria-expanded"],
    })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#sync()
  }

  get #children(): HTMLElement[] {
    return [...this.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.hasAttribute("slot"))
  }

  /** The control a wrapper child joins with (its `slot="trigger"` element), or null. */
  #triggerOf(child: Element): HTMLElement | null {
    if (!TRIGGER_WRAPPERS.includes(child.localName)) return null
    return child.querySelector<HTMLElement>(":scope > [slot=trigger]")
  }

  #sync(): void {
    const children = this.#children
    const triggers = children.map((c) => this.#triggerOf(c))
    const joined = children.map((c, i) => triggers[i] ?? c)
    this.toggleState("has-groups", children.some((c) => c.localName === "tec-button-group"))
    const bordered = joined.some((c) => c.matches(BORDERED))
    this.toggleState("bordered", bordered)

    const vertical = this.orientation === "vertical"
    const seen = new Set<HTMLElement>()
    triggers.forEach((trigger, i) => {
      if (!trigger) return
      seen.add(trigger)
      this.#styled.add(trigger)
      const first = i === 0
      const last = i === children.length - 1
      const r = first && last ? "var(--_group-radius)" : first ? "var(--_group-first)" : last ? "var(--_group-last)" : "0"
      for (const p of JOINED_RADIUS_PROPERTIES) trigger.style.setProperty(p, r)
      trigger.style.setProperty(vertical ? "margin-block-start" : "margin-inline-start", first ? "" : "-1px")
      trigger.style.removeProperty(vertical ? "margin-inline-start" : "margin-block-start")
      if (bordered && trigger.localName === "tec-button" && trigger.getAttribute("variant") !== "outline") {
        trigger.style.setProperty("--tec-button-border-color", "var(--tec-outline-border)")
      } else trigger.style.removeProperty("--tec-button-border-color")
    })
    for (const el of this.#styled) {
      if (seen.has(el)) continue
      for (const p of TRIGGER_PROPERTIES) el.style.removeProperty(p)
      this.#styled.delete(el)
    }
    this.#raise()
    for (const sep of this.querySelectorAll<TecButtonGroupSeparator>(":scope > tec-button-group-separator")) sep.requestUpdate()
  }

  /** z-index for wrapped triggers (direct children are handled in CSS). */
  #raise(): void {
    for (const el of this.#styled) {
      const up = el.matches(":hover, :focus-within") || el.getAttribute("aria-expanded") === "true"
      if (up) el.style.setProperty("z-index", "10")
      else el.style.removeProperty("z-index")
    }
  }

  protected override render() {
    return html`<slot @slotchange=${() => this.#sync()}></slot>`
  }
}

/**
 * Static text joined to the group's controls, e.g. a unit, a prefix or a `<label>` for the input next
 * to it (slot a `<label for="…">`).
 *
 * @summary Text inside a button group.
 *
 * @tag tec-button-group-text
 *
 * @slot - The text, an icon, or a `<label>`.
 *
 * @csspart base - The box (border, background, padding).
 *
 * @cssprop --tec-button-group-text-radius - Corner radius (set by the group).
 */
export class TecButtonGroupText extends TectonElement {
  static styles = [hostStyles, buttonGroupTextStyles]

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * Buttons with `variant="outline"` need none (they have a border); use it between filled buttons.
 * It is vertical by default, and horizontal in a vertical group.
 *
 * @summary Visually divides the controls of a button group.
 *
 * @tag tec-button-group-separator
 *
 * @csspart base - The line.
 *
 * @cssstate vertical - The line is vertical.
 * @cssstate horizontal - The line is horizontal.
 */
export class TecButtonGroupSeparator extends TectonElement {
  static styles = [hostStyles, buttonGroupSeparatorStyles]

  /** Direction of the line. Default: across the group (vertical in a horizontal group). */
  @property({ reflect: true }) orientation?: ButtonGroupOrientation

  get #orientation(): ButtonGroupOrientation {
    if (this.orientation) return this.orientation
    const group = this.parentElement
    return group?.localName === "tec-button-group" && group.getAttribute("orientation") === "vertical" ? "horizontal" : "vertical"
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.requestUpdate()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const orientation = this.#orientation
    this.internals.role = "separator"
    this.internals.ariaOrientation = orientation
    this.toggleState("vertical", orientation === "vertical")
    this.toggleState("horizontal", orientation === "horizontal")
  }

  protected override render() {
    return html`<div class="base" part="base"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-button-group": TecButtonGroup
    "tec-button-group-text": TecButtonGroupText
    "tec-button-group-separator": TecButtonGroupSeparator
  }
}
