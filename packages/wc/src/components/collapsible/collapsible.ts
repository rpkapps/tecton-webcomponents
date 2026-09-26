import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { uniqueId } from "../../internal/id.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecCollapsibleContent } from "./collapsible-content.js"
import type { TecCollapsibleTrigger } from "./collapsible-trigger.js"

export type CollapsibleOpenChangeReason = "trigger" | "find"

const styles = css`
  :host {
    display: block;
  }
`

/** Attribute this element added to a trigger (so it only removes what it set). */
const OWNED_DISABLED = "data-tec-collapsible-disabled"

/**
 * Implements the WAI-ARIA disclosure pattern: the trigger is a button with `aria-expanded` and
 * `aria-controls`, and the content is a `group` named by the trigger. The element itself has no
 * styling — use it (and `class`) for layout.
 *
 * The trigger is either a direct child with `slot="trigger"` (rendered first), or any element wrapped
 * in a `<tec-collapsible-trigger>` anywhere inside — use the wrapper when the trigger sits inside a
 * header row or after the content.
 *
 * @summary An interactive component which expands/collapses a panel.
 *
 * @tag tec-collapsible
 *
 * @slot - The content: a `tec-collapsible-content`, `tec-collapsible-trigger`s and any other markup.
 * @slot trigger - A button (e.g. `<tec-button>`) that toggles the content, rendered before the default slot.
 *
 * @fires tec-open-change - The user expanded or collapsed the content. Cancelable. `detail: { open, reason }` (`reason`: `"trigger"` or `"find"` for find-in-page).
 */
export class TecCollapsible extends TectonElement {
  static styles = [hostStyles, styles]

  /** Whether the content is expanded. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Disables the trigger(s): the content keeps its current state. */
  @property({ type: Boolean, reflect: true }) disabled = false

  #observer = new MutationObserver((records) => {
    if (records.some((r) => r.target !== this || r.type === "childList")) this.requestUpdate()
  })

  constructor() {
    super()
    this.addEventListener("click", this.#onClick)
    this.addEventListener("tec-trigger-change", () => this.requestUpdate())
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["slot"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  /** Expands the content (no event). */
  show(): void {
    this.open = true
  }

  /** Collapses the content (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the content (no event). */
  toggle(): void {
    this.open = !this.open
  }

  #owns(el: Element): boolean {
    return el.parentElement?.closest("tec-collapsible") === this
  }

  /** The `tec-collapsible-content` of this collapsible (not of a nested one). */
  get content(): TecCollapsibleContent | null {
    return [...this.querySelectorAll<TecCollapsibleContent>("tec-collapsible-content")].find((c) => this.#owns(c)) ?? null
  }

  #wrappers(): TecCollapsibleTrigger[] {
    return [...this.querySelectorAll<TecCollapsibleTrigger>("tec-collapsible-trigger")].filter((t) => this.#owns(t))
  }

  /** The elements that toggle this collapsible. */
  #controls(): { control: HTMLElement; wrapper?: TecCollapsibleTrigger }[] {
    const slotted = [...this.children]
      .filter((el): el is HTMLElement => el.getAttribute("slot") === "trigger")
      .map((control) => ({ control }))
    const wrapped = this.#wrappers()
      .map((wrapper) => ({ control: wrapper.control, wrapper }))
      .filter((c): c is { control: HTMLElement; wrapper: TecCollapsibleTrigger } => !!c.control)
    return [...slotted, ...wrapped]
  }

  #onClick = (event: MouseEvent) => {
    if (this.disabled || event.defaultPrevented) return
    const path = event.composedPath()
    const hit = this.#controls().find(({ control }) => path.includes(control))
    if (!hit) return
    if (hit.control.matches(":disabled, [aria-disabled='true']")) return
    this.#request(!this.open, "trigger")
  }

  #request(open: boolean, reason: CollapsibleOpenChangeReason): boolean {
    if (open === this.open) return true
    if (!this.emit<{ open: boolean; reason: CollapsibleOpenChangeReason }>("tec-open-change", { detail: { open, reason }, cancelable: true })) return false
    this.open = open
    return true
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const content = this.content
    if (content && !content.id) content.id = uniqueId("tec-collapsible-content")
    for (const wrapper of this.#wrappers()) {
      if (typeof wrapper.setState !== "function") {
        void customElements.whenDefined("tec-collapsible-trigger").then(() => this.requestUpdate())
        continue
      }
      // A bare-button wrapper renders aria-expanded / disabled itself.
      wrapper.setState(this.open, this.disabled)
      if (!wrapper.matches(":state(wrapper)")) {
        void wrapper.updateComplete.then(() => {
          const button = wrapper.control as (HTMLElement & { ariaControlsElements: Element[] | null }) | null
          if (button) button.ariaControlsElements = content ? [content] : null
        })
      }
    }
    const controls = this.#controls()
    for (const { control, wrapper } of controls) {
      if (wrapper && !wrapper.matches(":state(wrapper)")) continue
      control.setAttribute("aria-expanded", String(this.open))
      if (content && control.getRootNode() === content.getRootNode()) control.setAttribute("aria-controls", content.id)
      if (this.disabled && !control.hasAttribute("disabled")) {
        control.setAttribute("disabled", "")
        control.setAttribute(OWNED_DISABLED, "")
      } else if (!this.disabled && control.hasAttribute(OWNED_DISABLED)) {
        control.removeAttribute("disabled")
        control.removeAttribute(OWNED_DISABLED)
      }
    }
    if (content && typeof content.sync !== "function") {
      void customElements.whenDefined("tec-collapsible-content").then(() => this.requestUpdate())
    } else if (content) {
      const first = controls[0] ?? this.#wrappers().map((wrapper) => ({ control: wrapper, wrapper }))[0]
      let label: Element | null = null
      if (first) label = first.control.getRootNode() === content.getRootNode() ? first.control : (first.wrapper ?? null)
      content.sync({ expanded: this.open, labelledBy: label, onReveal: () => this.#request(true, "find") })
    }
  }

  protected override render() {
    return html`<slot name="trigger"></slot><slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-collapsible": TecCollapsible
  }
}
