import { css, html, nothing, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { X } from "lucide"
import { DismissController } from "../../internal/dismiss.js"
import { containsFlat } from "../../internal/focus.js"
import { icon } from "../../internal/icons.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecToolbar } from "../overflow/overflow.js"

/** Where the bar sits. */
export type ActionBarPlacement = "toolbar" | "floating"

const barStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  :host([placement="floating"]) {
    position: sticky;
    bottom: 1rem;
    z-index: 20;
  }
  .base {
    container-type: inline-size;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.375rem;
    min-width: 0;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    border-radius: var(--tec-radius-md);
    background: var(--tec-muted);
    padding: 0.375rem 0.5rem;
  }
  :host([placement="floating"]) .base {
    margin-inline: 1rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-radius-lg);
    background: var(--tec-popover);
    color: var(--tec-popover-foreground);
    box-shadow: var(--tec-shadow-lg);
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      animation: tec-action-bar-in var(--tec-duration, 150ms) var(--tec-ease-out, ease-out);
    }
    :host([placement="floating"]) .base {
      --tec-action-bar-from: 0.5rem;
    }
  }
  @keyframes tec-action-bar-in {
    from {
      opacity: 0;
      transform: translateY(var(--tec-action-bar-from, 0));
    }
  }
  @media (forced-colors: active) {
    .base {
      border: 1px solid CanvasText;
    }
  }
`

/**
 * A `region` landmark: give it an `aria-label`. Show it while there is something to act on (hide it
 * with the `hidden` attribute otherwise); it plays a short enter transition each time it appears.
 * Escape while focus is inside the bar fires `tec-dismiss` (an open menu or popover inside the bar
 * takes its own Escape first) — clear the selection or discard the changes there.
 *
 * The summary (`tec-action-bar-selection`, `tec-action-bar-message`) compacts with container queries
 * after the actions (`tec-action-bar-actions`, an overflow toolbar) have collapsed.
 *
 * @summary A transient bar for acting on a selection or on unsaved changes.
 *
 * @tag tec-action-bar
 *
 * @slot - A `tec-action-bar-selection` or `tec-action-bar-message`, then a `tec-action-bar-actions`.
 *
 * @csspart base - The bar (the query container of its parts).
 *
 * @fires tec-dismiss - Escape was pressed while focus was inside the bar.
 */
export class TecActionBar extends TectonElement {
  static styles = [hostStyles, barStyles]

  /** `toolbar` fills a row (a table's toolbar); `floating` is a sticky card at the bottom of its scroll container. */
  @property({ reflect: true }) placement: ActionBarPlacement = "toolbar"

  #dismiss = new DismissController({
    inside: () => [this],
    outsidePress: false,
    onDismiss: (reason) => {
      if (reason === "escape") this.emit("tec-dismiss")
    },
  })

  constructor() {
    super()
    // The bar is a dismiss layer while focus is inside it, so overlays opened from it (the More
    // menu) sit above it on the layer stack and take Escape first.
    this.addEventListener("focusin", () => this.#dismiss.activate())
    this.addEventListener("focusout", (event) => {
      if (!containsFlat(this, event.relatedTarget as Node | null)) this.#dismiss.deactivate()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "region"
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#dismiss.deactivate()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (this.hidden) this.#dismiss.deactivate()
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * How long the live region stays empty after it appears, and how long a change waits: screen readers
 * only announce changes to a region they already track, and the bar appears together with the first
 * selection. The same delay also coalesces a burst of selection changes into one announcement.
 */
const ANNOUNCE_DELAY = 100

const selectionStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    font-variant-numeric: tabular-nums;
  }
  .summary {
    font-weight: 500;
    white-space: nowrap;
  }
  .medium,
  .compact,
  .clear-icon {
    display: none;
  }
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.25rem;
    min-width: 1.25rem;
    padding-inline: 0.375rem;
    border-radius: 9999px;
    background: var(--tec-primary);
    color: var(--tec-primary-foreground);
    font-size: var(--tec-text-xs);
    line-height: 1;
  }
  @container (width < 32rem) {
    .full {
      display: none;
    }
    .medium {
      display: inline;
    }
  }
  @container (width < 24rem) {
    .medium,
    .clear-text {
      display: none;
    }
    .compact {
      display: inline;
    }
    .clear-icon {
      display: inline-flex;
    }
  }
`

/**
 * "12 of 340 wells selected · Clear". As the bar narrows it compacts to "12 selected" (below 32rem)
 * and then to a count badge with an X button (below 24rem). A visually hidden polite live region always
 * announces the full text, a moment after the bar appears and after each change.
 *
 * @summary The selection summary of an action bar, with an optional Clear button.
 *
 * @tag tec-action-bar-selection
 *
 * @csspart summary - The visible summary text.
 * @csspart count - The count badge of the compact form.
 * @csspart clear - The Clear button.
 * @csspart clear-icon - The icon-only Clear button of the compact form.
 *
 * @fires tec-clear - The Clear button was pressed.
 */
export class TecActionBarSelection extends TectonElement {
  static styles = [hostStyles, srOnly, selectionStyles]

  /** Number of selected items. */
  @property({ type: Number }) count = 0

  /** Total number of items; adds "of N". */
  @property({ type: Number }) total?: number

  /** Noun after the count, e.g. "wells". */
  @property() label = ""

  /** Show a Clear button (fires `tec-clear`). */
  @property({ type: Boolean }) clearable = false

  /** Accessible name of the icon-only Clear button. */
  @property({ attribute: "clear-label" }) clearLabel = "Clear selection"

  @state() private announced = ""
  #timer: ReturnType<typeof setTimeout> | undefined

  get #full(): string {
    const noun = this.label ? ` ${this.label}` : ""
    return this.total !== undefined && this.total !== null && !Number.isNaN(this.total) ? `${this.count} of ${this.total}${noun} selected` : `${this.count}${noun} selected`
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    clearTimeout(this.#timer)
    this.announced = ""
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#announce()
  }

  #announce(): void {
    clearTimeout(this.#timer)
    const text = this.#full
    this.#timer = setTimeout(() => (this.announced = text), ANNOUNCE_DELAY)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("count") || changed.has("total") || changed.has("label")) this.#announce()
  }

  #clear = () => this.emit("tec-clear")

  protected override render() {
    return html`<span class="sr-only" aria-live="polite" aria-atomic="true">${this.announced}</span>
      <span class="summary" part="summary" aria-hidden="true">
        <span class="full">${this.#full}</span><span class="medium">${this.count} selected</span
        ><span class="compact"><span class="count" part="count">${this.count}</span></span>
      </span>
      ${this.clearable
        ? html`<tec-button class="clear-text" part="clear" variant="ghost" size="sm" @click=${this.#clear}>Clear</tec-button>
            <tec-button class="clear-icon" part="clear-icon" variant="ghost" size="icon-sm" aria-label=${this.clearLabel} @click=${this.#clear}
              >${icon(X, { size: 16 })}</tec-button
            >`
        : nothing}`
  }
}

/**
 * @summary A text summary in an action bar instead of a selection, e.g. "You have unsaved changes".
 *
 * @tag tec-action-bar-message
 *
 * @slot - The message. It truncates when the bar is narrow.
 */
export class TecActionBarMessage extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }
    `,
  ]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "paragraph"
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * An overflow toolbar (one tab stop, arrow keys) named "Actions" unless it has an `aria-label`. Wrap
 * the actions that may leave in `tec-overflow-item`; leave the primary action bare so it never does.
 * Accepts every `tec-toolbar` attribute.
 *
 * @summary The actions of an action bar: an overflow toolbar.
 *
 * @tag tec-action-bar-actions
 *
 * @slot - `tec-overflow-item`s, dividers and fixed controls.
 * @slot menu-trigger - A custom More button.
 *
 * @csspart menu - The wrapper of the More button.
 * @csspart menu-trigger - The default More button.
 * @csspart menu-badge - The count badge on the More button.
 * @csspart menu-content - The More menu.
 * @csspart submenu - A submenu in the More menu.
 * @csspart menu-item - A menu entry.
 *
 * @cssprop --tec-overflow-gap - Gap between the items (default 0.5rem).
 *
 * @cssstate overflowing - At least one item is in the More menu.
 * @cssstate compact - Labels are collapsed.
 *
 * @fires tec-overflow-change - The set of items in the More menu changed. `detail: { hidden }`.
 */
export class TecActionBarActions extends TecToolbar {
  static styles = [
    ...TecToolbar.styles,
    css`
      :host {
        flex: 1 1 0%;
        justify-content: flex-end;
      }
    `,
  ]

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.ariaLabel = "Actions"
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-action-bar": TecActionBar
    "tec-action-bar-selection": TecActionBarSelection
    "tec-action-bar-message": TecActionBarMessage
    "tec-action-bar-actions": TecActionBarActions
  }
}
