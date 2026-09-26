import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { observeControl, unobserveControl, type ControlObserver } from "../../internal/form-control.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { inputGroupAddonStyles, inputGroupStyles, inputGroupTextStyles } from "./input-group.styles.js"

export type InputGroupAddonAlign = "inline-start" | "inline-end" | "block-start" | "block-end"

const CONTROL_SELECTOR = ":scope > :is(tec-input-group-input, tec-input-group-textarea, input, textarea, select, [data-slot=input-group-control])"

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector)
  } catch {
    return false
  }
}

/**
 * One bordered box around a control and its addons: the ring and the invalid style of the control
 * are drawn on the group. The control is a `tec-input-group-input` or `tec-input-group-textarea`
 * (or a native `<input>`/`<textarea>` with `data-slot="input-group-control"`); addons go before or
 * after it in any order — their `align` decides where they appear.
 *
 * Label the control as usual: a `tec-field-label` in the enclosing `tec-field`, `<label for>` on
 * the control's `id`, or `aria-label` on the control.
 *
 * @summary Adds icons, text or buttons around an input or textarea.
 *
 * @tag tec-input-group
 *
 * @slot - The control and `tec-input-group-addon` elements.
 *
 * @csspart base - The bordered box (flex row; a column with block addons).
 * @cssprop --tec-input-group-radius - Corner radius of the box (default `--tec-radius-md`; set by `tec-button-group`).
 *
 * @cssstate focused - The control has focus (the ring is shown).
 * @cssstate invalid - The control displays invalidity.
 * @cssstate disabled - Every control is disabled (addons dim).
 * @cssstate block - A `block-start` or `block-end` addon is present (the group stacks and grows).
 * @cssstate has-textarea - The control is a textarea (the group grows with it).
 */
export class TecInputGroup extends TectonElement {
  static styles = [hostStyles, inputGroupStyles]

  #controls: HTMLElement[] = []
  #observer = new MutationObserver(() => this.#sync())
  #link: ControlObserver = { controlChanged: () => this.#syncState() }

  constructor() {
    super()
    this.addEventListener("focusin", () => this.#syncFocus())
    this.addEventListener("focusout", (event) => {
      const next = event.relatedTarget as Node | null
      this.toggleState("focused", !!next && this.#controls.some((c) => c.contains(next)))
    })
    for (const type of ["input", "change"]) this.addEventListener(type, () => this.#syncState())
  }

  /** The group's controls (direct children). */
  get controls(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)]
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["align", "disabled", "aria-invalid", "invalid"] })
    this.#sync()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
    for (const control of this.#controls) unobserveControl(control, this.#link)
    this.#controls = []
  }

  #sync(): void {
    const controls = this.controls
    for (const control of this.#controls) if (!controls.includes(control)) unobserveControl(control, this.#link)
    this.#controls = controls
    for (const control of controls) observeControl(control, this.#link)
    const aligns = new Set(
      [...this.querySelectorAll<TecInputGroupAddon>(":scope > tec-input-group-addon")].map((addon) => addon.getAttribute("align") ?? addon.align ?? "inline-start")
    )
    for (const align of ["inline-start", "inline-end", "block-start", "block-end"]) this.toggleState(`has-${align}`, aligns.has(align))
    this.toggleState("block", aligns.has("block-start") || aligns.has("block-end"))
    this.toggleState("has-textarea", controls.some((c) => c.localName === "tec-input-group-textarea" || c.localName === "textarea"))
    this.#syncState()
  }

  #syncState(): void {
    const controls = this.#controls
    this.toggleState(
      "invalid",
      controls.some((c) => matches(c, ":state(user-invalid)") || c.getAttribute("aria-invalid") === "true")
    )
    this.toggleState("disabled", controls.length > 0 && controls.every((c) => matches(c, ":disabled")))
  }

  #syncFocus(): void {
    this.toggleState("focused", this.#controls.some((c) => c.matches(":focus-within")))
  }

  /** Focuses the (first) control. */
  override focus(options?: FocusOptions): void {
    this.#controls[0]?.focus(options)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.#sync()}></slot></div>`
  }
}

/**
 * An addon of a `tec-input-group`: icons, `tec-input-group-text`, `tec-input-group-button`,
 * `tec-kbd`, a spinner. Clicking the addon (outside its buttons) focuses the control.
 *
 * @summary An icon, text or button area inside an input group.
 *
 * @tag tec-input-group-addon
 *
 * @slot - The addon content.
 *
 * @csspart base - The addon box (padding, gap).
 *
 * @cssstate inline-start - Placed before the control (also `inline-end`, `block-start`, `block-end`).
 * @cssstate has-button - Holds a button (the outer padding tightens).
 * @cssstate has-kbd - Holds a key cap.
 */
export class TecInputGroupAddon extends TectonElement {
  static styles = [hostStyles, inputGroupAddonStyles]

  /**
   * Where the addon appears, whatever its position in the markup: `inline-start` (before the
   * control), `inline-end` (after it), `block-start` (a header row above) or `block-end` (a footer
   * row below). Not reflected; style with `:state(inline-end)` …
   */
  @property() align: InputGroupAddonAlign = "inline-start"

  #observer = new MutationObserver(() => this.#syncContent())

  constructor() {
    super()
    this.addEventListener("click", (event) => {
      for (const node of event.composedPath()) {
        if (node === this) break
        if (node instanceof HTMLElement && node.matches("button, a[href], input, select, textarea, tec-button, tec-input-group-button, [role=button]")) return
      }
      const group = this.parentElement
      const control = group?.querySelector<HTMLElement>(CONTROL_SELECTOR)
      control?.focus()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "group"
    this.#observer.observe(this, { childList: true })
    this.#syncContent()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #syncContent(): void {
    this.toggleState("has-button", !!this.querySelector(":scope > :is(button, tec-button, tec-input-group-button)"))
    this.toggleState("has-kbd", !!this.querySelector(":scope > :is(kbd, tec-kbd, tec-kbd-group)"))
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    for (const align of ["inline-start", "inline-end", "block-start", "block-end"]) this.toggleState(align, this.align === align)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Muted text (a unit, a prefix, a counter) inside an input group addon.
 *
 * @tag tec-input-group-text
 *
 * @slot - The text, optionally with an icon.
 */
export class TecInputGroupText extends TectonElement {
  static styles = [hostStyles, inputGroupTextStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-input-group": TecInputGroup
    "tec-input-group-addon": TecInputGroupAddon
    "tec-input-group-text": TecInputGroupText
  }
}
