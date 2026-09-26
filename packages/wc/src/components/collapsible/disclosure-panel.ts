/**
 * The panel half of a disclosure (`tec-collapsible-content`, `tec-accordion-content`): a `group`
 * labelled by its trigger, animated between 0 and its natural height, and hidden with
 * `hidden="until-found"` while collapsed so the browser's find-in-page still finds (and reveals) its
 * text. The owning element (collapsible, accordion item) drives it through {@link DisclosurePanel.sync}.
 */
import { css, html, nothing, type PropertyValues } from "lit"
import { state } from "lit/decorators.js"
import { prefersReducedMotion } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/** Duration of the height animation (Tailwind `accordion-down` / `accordion-up`: 200ms ease-out). */
const DURATION = 200
const EASING = "cubic-bezier(0, 0, 0.2, 1)"

export const disclosurePanelStyles = css`
  :host {
    display: block;
  }
  .region.animating {
    overflow: clip;
  }
  /* hostStyles hide every [hidden] element; until-found must stay in the layout (content-visibility). */
  .region[hidden="until-found"] {
    display: block !important;
    content-visibility: hidden;
    height: 0;
    overflow: clip;
  }
`

/** What the owner tells its panel. */
export interface DisclosurePanelState {
  /** Whether the panel is expanded. */
  expanded: boolean
  /** The element that names the panel (the trigger), when it is in the panel's tree scope. */
  labelledBy?: Element | null
  /** A plain-text name, used when no element can be referenced. */
  label?: string
  /** Called when find-in-page (or a fragment link) reveals collapsed content; return false to keep it closed. */
  onReveal?: () => boolean
}

export class DisclosurePanel extends TectonElement {
  /** Whether the region is rendered (true while expanded and during the collapse animation). */
  @state() private visibleRegion = false

  #expanded = false
  #onReveal?: () => boolean
  #animation?: Animation
  #initialized = false

  /** Whether the panel is expanded. Set by the owning element. */
  get expanded(): boolean {
    return this.#expanded
  }

  /**
   * Applies the owner's state (expanded, label). Animates the height unless it is the first sync or
   * the user prefers reduced motion.
   * @internal
   */
  sync(next: DisclosurePanelState): void {
    this.#onReveal = next.onReveal
    const internals = this.internals
    internals.role = "group"
    if (next.labelledBy) {
      internals.ariaLabelledByElements = [next.labelledBy]
      internals.ariaLabel = null
    } else {
      internals.ariaLabelledByElements = null
      internals.ariaLabel = next.label || null
    }
    if (next.expanded === this.#expanded && this.#initialized) return
    const animate = this.#initialized && this.hasUpdated && !prefersReducedMotion()
    this.#initialized = true
    this.#expanded = next.expanded
    internals.ariaHidden = next.expanded ? null : "true"
    this.toggleState("open", next.expanded)
    if (next.expanded) {
      this.visibleRegion = true
      if (animate) void this.updateComplete.then(() => this.#animate(true))
    } else if (animate && this.visibleRegion) {
      this.#animate(false)
    } else {
      this.#animation?.cancel()
      this.visibleRegion = false
    }
  }

  protected get region(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".region")
  }

  #animate(open: boolean): void {
    const region = this.region
    if (!region) return
    // Start from the current (possibly mid-animation) height.
    const from = this.#animation ? region.getBoundingClientRect().height : open ? 0 : region.getBoundingClientRect().height
    this.#animation?.cancel()
    const to = open ? region.scrollHeight : 0
    region.classList.add("animating")
    const animation = region.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: DURATION, easing: EASING })
    this.#animation = animation
    animation.onfinish = () => {
      if (this.#animation !== animation) return
      this.#animation = undefined
      region.classList.remove("animating")
      if (!open) this.visibleRegion = false
    }
    animation.oncancel = () => {
      if (this.#animation === animation) this.#animation = undefined
      region.classList.remove("animating")
    }
  }

  #onBeforeMatch = () => {
    // The browser removes `hidden` right after this event; re-hide if the owner vetoes.
    const revealed = this.#onReveal?.() ?? false
    if (!revealed) {
      requestAnimationFrame(() => {
        if (!this.#expanded) this.region?.setAttribute("hidden", "until-found")
      })
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // Keep the attribute in sync even when the browser removed it (find-in-page) and Lit's cache didn't change.
    const region = this.region
    if (region && !this.visibleRegion && region.getAttribute("hidden") !== "until-found" && !this.#animation) {
      region.setAttribute("hidden", "until-found")
    }
  }

  /** The region markup; subclasses wrap their content in it. */
  protected renderRegion(content: unknown) {
    return html`<div
      class="region"
      part="region"
      hidden=${this.visibleRegion ? nothing : "until-found"}
      @beforematch=${this.#onBeforeMatch}
    >${content}</div>`
  }
}
