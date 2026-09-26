import { ContextConsumer } from "@lit/context"
import { html, LitElement, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { fieldContext } from "./field-context.js"
import {
  fieldContentStyles,
  fieldDescriptionStyles,
  fieldGroupStyles,
  fieldLegendStyles,
  fieldSeparatorStyles,
  fieldSetStyles,
  fieldTitleStyles,
} from "./field.styles.js"

/**
 * Stacks fields (gap 1.75rem; nested groups 1rem) and is the size container of
 * `orientation="responsive"` fields: they turn horizontal once the group is at least 28rem wide.
 * Layout classes on the element (`class="grid grid-cols-2 gap-4"`) replace the stack.
 *
 * @summary Stacks related fields; the container of responsive fields.
 *
 * @tag tec-field-group
 *
 * @slot - `tec-field`, `tec-field-set`, `tec-field-separator` or layout elements.
 */
export class TecFieldGroup extends TectonElement {
  static styles = [hostStyles, fieldGroupStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Renders a native `<fieldset>` in its shadow root: the group is named by its `tec-field-legend`
 * (assigned to the fieldset's `<legend>` automatically, wherever it is among the children).
 *
 * Disabling a whole group of controls needs a native ancestor (`<fieldset disabled>`): a shadow
 * fieldset does not disable light-DOM controls.
 *
 * @summary A semantic group of fields with a legend and an optional description.
 *
 * @tag tec-field-set
 *
 * @slot - A `tec-field-legend`, `tec-field-description`, and the fields (usually in a `tec-field-group`).
 *
 * @csspart base - The `<fieldset>` (flex column; the gap follows the host's `gap`, 1.5rem).
 * @csspart legend - The `<legend>` holding the `tec-field-legend`.
 *
 * @cssstate compact - A `tec-radio-group` is a direct child (the gap tightens to 0.75rem).
 */
export class TecFieldSet extends TectonElement {
  static styles = [hostStyles, fieldSetStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: "manual" }

  #observer = new MutationObserver(() => this.#assign())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  protected override firstUpdated(): void {
    this.#assign()
  }

  #assign(): void {
    const root = this.shadowRoot
    if (!root) return
    const legendSlot = root.querySelector<HTMLSlotElement>("slot[name=legend]")
    const defaultSlot = root.querySelector<HTMLSlotElement>("slot:not([name])")
    if (!legendSlot || !defaultSlot) return
    const legend = this.querySelector(":scope > tec-field-legend")
    const rest = [...this.childNodes].filter(
      (n): n is Element | Text => n !== legend && (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE)
    )
    legendSlot.assign(...(legend ? [legend] : []))
    defaultSlot.assign(...rest)
    const legendEl = root.querySelector("legend")
    if (legendEl) legendEl.hidden = !legend
    this.toggleState("compact", !!this.querySelector(":scope > tec-radio-group"))
  }

  protected override render() {
    return html`<fieldset class="base" part="base">
      <legend part="legend"><slot name="legend"></slot></legend>
      <slot></slot>
    </fieldset>`
  }
}

/**
 * @summary The legend of a `tec-field-set`.
 *
 * @tag tec-field-legend
 *
 * @slot - The legend text.
 *
 * @csspart base - The text box (0.75rem bottom margin).
 */
export class TecFieldLegend extends TectonElement {
  static styles = [hostStyles, fieldLegendStyles]
  /** `legend` (base size) for a section heading; `label` (small) for a group of choices or a nested set. */
  @property({ reflect: true }) variant: "legend" | "label" = "legend"
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Groups a field's label and description beside a control (horizontal fields, choice cards).
 *
 * @tag tec-field-content
 *
 * @slot - `tec-field-label` or `tec-field-title`, and `tec-field-description`.
 */
export class TecFieldContent extends TectonElement {
  static styles = [hostStyles, fieldContentStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Label-styled text that labels nothing: the heading inside a choice card, whose `tec-field-label`
 * already names the control, or the title of a control that has its own `aria-label` (a slider).
 *
 * @summary A title with label styling, for use inside `tec-field-content`.
 *
 * @tag tec-field-title
 *
 * @slot - The title text.
 *
 * @cssstate field-disabled - The enclosing field is disabled.
 */
export class TecFieldTitle extends TectonElement {
  static styles = [hostStyles, fieldTitleStyles]
  #field = new ContextConsumer(this, { context: fieldContext, subscribe: true })
  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("field-disabled", !!this.#field.value?.disabled)
  }
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Inside a `tec-field` it describes the field's control (`aria-describedby`, wired by the field).
 * Links inside are underlined.
 *
 * @summary Helper text of a form field.
 *
 * @tag tec-field-description
 *
 * @slot - The help text (inline markup and links allowed).
 *
 * @csspart base - The text box.
 */
export class TecFieldDescription extends TectonElement {
  static styles = [hostStyles, fieldDescriptionStyles]
  #field = new ContextConsumer(this, { context: fieldContext, subscribe: true })
  #siblings = new MutationObserver(() => this.#syncPosition())

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.id) this.id = uniqueId("tec-field-description")
    if (this.parentElement) this.#siblings.observe(this.parentElement, { childList: true })
    this.#syncPosition()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#siblings.disconnect()
  }

  /** Spacing tweaks that depend on the neighbours (after a legend, before the last part, last). */
  #syncPosition(): void {
    const parent = this.parentElement
    const siblings = parent ? [...parent.children] : []
    const index = siblings.indexOf(this)
    const previous = siblings[index - 1]
    this.toggleState("after-legend", !!previous && previous.localName === "tec-field-legend" && previous.getAttribute("variant") !== "label")
    this.toggleState("last", index === siblings.length - 1)
    this.toggleState("second-last", index === siblings.length - 2)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("horizontal", this.#field.value?.orientation === "horizontal")
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary A divider between sections of a field group, with optional centred text.
 *
 * @tag tec-field-separator
 *
 * @slot - Optional text shown on the line ("Or continue with").
 *
 * @csspart base - The 1.25rem-tall box (negative block margins).
 * @csspart line - The 1px line.
 * @csspart content - The text box over the line.
 *
 * @cssprop --tec-field-separator-background - Background behind the text (default `--tec-background`); set it on cards.
 *
 * @cssstate has-default - The separator has text.
 */
export class TecFieldSeparator extends TectonElement {
  static styles = [hostStyles, fieldSeparatorStyles]
  #slots = new HasSlotController(this, "[default]", { states: true })
  protected override render() {
    const hasText = this.#slots.test("[default]")
    return html`<div class="base" part="base">
      <div class="line" part="line" role=${hasText ? "none" : "separator"}></div>
      <span class="content" part="content"><slot></slot></span>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-field-group": TecFieldGroup
    "tec-field-set": TecFieldSet
    "tec-field-legend": TecFieldLegend
    "tec-field-content": TecFieldContent
    "tec-field-title": TecFieldTitle
    "tec-field-description": TecFieldDescription
    "tec-field-separator": TecFieldSeparator
  }
}
