import { css, html, LitElement, nothing, type PropertyValues } from "lit"
import { state } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

const styles = css`
  :host {
    display: inline-block;
  }
  :host(:state(wrapper)) {
    display: contents;
  }
  .base {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    cursor: default;
    border-radius: var(--tec-radius-md);
    text-align: inherit;
    font: inherit;
    color: inherit;
  }
  .base:focus-visible {
    outline: none;
    box-shadow: var(--tec-focus-ring);
  }
  .base:disabled {
    opacity: 0.5;
  }
  @media (forced-colors: active) {
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

/**
 * Wrap the element that should toggle the collapsible — usually a `<tec-button>` — anywhere inside
 * the `tec-collapsible` (the direct child `slot="trigger"` works too). With only text inside, the
 * element renders an unstyled native `<button>` around it.
 *
 * The parent collapsible sets `aria-expanded` and `aria-controls` on the wrapped element, disables
 * it when the collapsible is disabled, and toggles on its `click` (mouse, Enter, Space).
 *
 * @summary Toggles the `tec-collapsible` it is in.
 *
 * @tag tec-collapsible-trigger
 *
 * @slot - The trigger: one button element (`<tec-button>`, `<button>`), or text for a bare button.
 *
 * @csspart base - The bare `<button>` rendered when the slot holds text only.
 *
 * @cssstate wrapper - The trigger wraps an element (and is `display: contents`).
 */
export class TecCollapsibleTrigger extends TectonElement {
  static styles = [hostStyles, styles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  @state() private wrapper = false
  @state() private expanded = false
  @state() private disabledByParent = false

  #observer = new MutationObserver(() => this.#detect())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true })
    this.#detect()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #detect(): void {
    const wrapper = [...this.children].some((el) => el.localName !== "template" && el.localName !== "style")
    if (wrapper !== this.wrapper) {
      this.wrapper = wrapper
      this.toggleState("wrapper", wrapper)
      this.dispatchEvent(new Event("tec-trigger-change", { bubbles: true, composed: false }))
    }
  }

  /** The element that receives `aria-expanded` and toggles: the wrapped element, or the bare button. */
  get control(): HTMLElement | null {
    if (this.wrapper) return (this.firstElementChild as HTMLElement | null) ?? null
    return this.renderRoot?.querySelector?.<HTMLButtonElement>("button") ?? null
  }

  /**
   * Called by the parent collapsible.
   * @internal
   */
  setState(expanded: boolean, disabled: boolean): void {
    this.expanded = expanded
    this.disabledByParent = disabled
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#detect()
  }

  protected override render() {
    if (this.wrapper) return html`<slot></slot>`
    return html`<button
      class="base"
      part="base"
      type="button"
      aria-expanded=${this.expanded ? "true" : "false"}
      ?disabled=${this.disabledByParent}
    ><slot></slot></button>${nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-collapsible-trigger": TecCollapsibleTrigger
  }
}
