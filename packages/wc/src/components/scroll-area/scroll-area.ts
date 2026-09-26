import { css, html, type PropertyValues } from "lit"
import { getTabbables } from "../../internal/focus.js"
import { focusRing, hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/**
 * The element itself is the scroll container: give it a size (`class="h-72"`, `max-h-96`, or
 * `min-h-0 flex-1` in a flex column) and it scrolls whatever overflows, in both directions. The native
 * scrollbar is thin and uses the theme's border colour in every engine (`scrollbar-width` /
 * `scrollbar-color`), so the platform's scrolling behaviour (wheel, touch, keyboard, scroll
 * anchoring, RTL) is untouched.
 *
 * Keyboard access: while the content overflows and contains nothing focusable, the element puts
 * itself in the tab order (`tabindex="0"`) so it can be scrolled with the arrow keys; an author
 * `tabindex` is left alone. With an `aria-label` or `aria-labelledby` it is exposed as a named
 * `region`.
 *
 * @summary Augments native scroll functionality for custom, cross-browser styling.
 *
 * @tag tec-scroll-area
 *
 * @slot - The scrollable content. Put padding on a wrapper inside, so the scrollbar stays at the edge.
 *
 * @cssprop --tec-scroll-area-thumb - Colour of the scrollbar thumb (default `--tec-border`).
 */
export class TecScrollArea extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        position: relative;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--tec-scroll-area-thumb, var(--tec-border)) transparent;
        outline: none;
      }
    `,
    focusRing(":host"),
  ]

  /** Whether the current `tabindex` was set by this element (and may be removed again). */
  #ownTabindex = false
  #frame = 0
  #resize = new ResizeObserver(() => this.#schedule())
  #mutations = new MutationObserver(() => this.#schedule())
  #labels = new MutationObserver(() => this.#syncRole())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#resize.observe(this)
    this.#mutations.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["tabindex", "disabled", "hidden", "href"] })
    this.#labels.observe(this, { attributes: true, attributeFilter: ["aria-label", "aria-labelledby"] })
    this.#syncRole()
    this.#schedule()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#resize.disconnect()
    this.#mutations.disconnect()
    this.#labels.disconnect()
    cancelAnimationFrame(this.#frame)
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed)
    this.#schedule()
  }

  #schedule(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = requestAnimationFrame(() => this.#syncTabindex())
  }

  #syncRole(): void {
    const labelled = this.hasAttribute("aria-label") || this.hasAttribute("aria-labelledby")
    this.internals.role = labelled ? "region" : null
  }

  #syncTabindex(): void {
    // Size changes of the content are seen through the children: observe them too.
    for (const child of this.children) this.#resize.observe(child)
    if (this.hasAttribute("tabindex") && !this.#ownTabindex) return
    const overflows = this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth
    const needsStop = overflows && getTabbables(this).every((el) => el === this)
    if (needsStop && !this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0")
      this.#ownTabindex = true
    } else if (!needsStop && this.#ownTabindex) {
      this.removeAttribute("tabindex")
      this.#ownTabindex = false
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-scroll-area": TecScrollArea
  }
}
