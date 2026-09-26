import { css, html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/** Surface style of a panel. */
export type PanelVariant = "default" | "elevated" | "flat" | "outline"
/** Padding scale of a panel. */
export type PanelSize = "sm" | "md" | "lg"

/** Whether `el` is an overflow row (`tec-overflow`, `tec-toolbar` or a row built on them). */
function isOverflowRow(el: Element): boolean {
  if (el.localName === "tec-overflow" || el.localName === "tec-toolbar") return true
  try {
    return el.matches(":state(overflow-root)")
  } catch {
    return false
  }
}

const panelStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    color: var(--tec-card-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    --tec-panel-px: 1rem;
    --tec-panel-py: 0.75rem;
  }
  :host([size="sm"]) {
    --tec-panel-px: 0.75rem;
    --tec-panel-py: 0.5rem;
  }
  :host([size="lg"]) {
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
    --tec-panel-px: 1.5rem;
    --tec-panel-py: 1rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--tec-foreground) 10%, transparent);
    border-radius: var(--tec-panel-radius, var(--tec-radius-xl));
    background: var(--tec-card);
  }
  :host([variant="elevated"]) .base {
    box-shadow: var(--tec-shadow-md);
  }
  :host([variant="flat"]) .base {
    border-color: transparent;
  }
  :host([variant="outline"]) .base {
    border-color: var(--tec-border);
    background: transparent;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

/**
 * The application chrome around a tool: it fills the height its container gives it, scrolls its
 * `tec-panel-content` and pins its `tec-panel-footer`. The edge is a border inside the panel's box,
 * so a panel inside a clipping container (a resizable split) keeps it.
 *
 * @summary A titled application surface: side panels, tool panels and dashboard sections.
 *
 * @tag tec-panel
 *
 * @slot - `tec-panel-header`, `tec-panel-content`, `tec-panel-footer`.
 *
 * @csspart base - The panel surface (border, radius, background, shadow).
 *
 * @cssprop --tec-panel-px - Inline padding of the header, content and footer (set by `size`).
 * @cssprop --tec-panel-py - Block padding of the header, content and footer (set by `size`).
 * @cssprop --tec-panel-radius - Corner radius (default `--tec-radius-xl`).
 */
export class TecPanel extends TectonElement {
  static styles = [hostStyles, panelStyles]

  /** `default` with a hairline edge, `elevated` with a shadow, `flat` without an edge, `outline` with a visible border on a transparent background. */
  @property({ reflect: true }) variant: PanelVariant = "default"

  /** Padding scale of header, content and footer. */
  @property({ reflect: true }) size: PanelSize = "md"

  protected override render() {
    return html`<section class="base" part="base"><slot></slot></section>`
  }
}

const headerStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
  }
  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    column-gap: 0.5rem;
    row-gap: 0.25rem;
    padding: var(--tec-panel-py, 0.75rem) var(--tec-panel-px, 1rem);
    border-bottom: 1px solid var(--tec-border);
  }
  :host(:state(has-actions)) .base {
    align-items: center;
  }
  /* Beside an overflow row the title keeps its natural width up to 60% of the header. */
  :host(:state(has-overflow)) ::slotted(tec-panel-title) {
    flex: 0 1 auto;
    max-width: 60%;
  }
  ::slotted(tec-panel-description) {
    order: 9999;
    flex-basis: 100%;
  }
`

/**
 * The row wraps: a `tec-panel-description` takes a line of its own below the title and the actions,
 * so the title keeps the width the actions leave.
 *
 * @summary The header row of a panel: title, description and actions.
 *
 * @tag tec-panel-header
 *
 * @slot - `tec-panel-title`, `tec-panel-description`, `tec-panel-actions`.
 *
 * @csspart base - The header row (padding and bottom border).
 *
 * @cssstate has-actions - The header has a `tec-panel-actions`.
 * @cssstate has-overflow - The actions hold an overflow row.
 */
export class TecPanelHeader extends TectonElement {
  static styles = [hostStyles, headerStyles]

  /** Re-reads what the header holds. @internal */
  sync = () => {
    const actions = this.querySelector(":scope > tec-panel-actions")
    this.toggleState("has-actions", !!actions)
    this.toggleState("has-overflow", !!actions && [...actions.children].some(isOverflowRow))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.sync()
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${this.sync}></slot></div>`
  }
}

/**
 * A heading (level 2 by default) that truncates on one line.
 *
 * @summary The title of a panel.
 *
 * @tag tec-panel-title
 *
 * @slot - The title text.
 */
export class TecPanelTitle extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        flex: 1 1 0%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--tec-text-sm);
        line-height: 1;
        font-weight: 500;
      }
    `,
  ]

  /** Heading level exposed to assistive technology. */
  @property({ type: Number }) level = 2

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "heading"
    this.internals.ariaLevel = String(this.level)
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary A line of supporting text under the panel title.
 *
 * @tag tec-panel-description
 *
 * @slot - The description.
 */
export class TecPanelDescription extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        font-size: var(--tec-text-xs);
        line-height: var(--tec-text-xs--line-height);
        color: var(--tec-muted-foreground);
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

const actionsStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    margin-block: -0.25rem;
    margin-inline-end: -0.5rem;
  }
  :host(:state(has-overflow)) {
    flex: 1 1 0%;
    min-width: 0;
  }
  :host(:state(has-overflow)) .base {
    justify-content: flex-end;
  }
  :host(:state(has-overflow)) ::slotted(*) {
    flex: 1 1 0%;
    min-width: 0;
    justify-content: flex-end;
  }
`

/**
 * One to three icon buttons beside the title. For more, put a `tec-toolbar` (or `tec-overflow`)
 * inside: the slot then takes the width the title leaves and the actions collapse into a More menu.
 *
 * @summary The trailing actions of a panel header.
 *
 * @tag tec-panel-actions
 *
 * @slot - Icon buttons, or one overflow row.
 *
 * @csspart base - The actions row.
 *
 * @cssstate has-overflow - Holds an overflow row.
 */
export class TecPanelActions extends TectonElement {
  static styles = [hostStyles, actionsStyles]

  #sync = () => {
    this.toggleState("has-overflow", [...this.children].some(isOverflowRow))
    const header = this.parentElement as TecPanelHeader | null
    if (header?.localName === "tec-panel-header") header.sync?.()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#sync()
    // Overflow rows upgraded after the first slot assignment report their state here.
    void Promise.all(["tec-overflow", "tec-toolbar"].map((tag) => customElements.whenDefined(tag).catch(() => undefined))).then(this.#sync)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${this.#sync}></slot></div>`
  }
}

const contentStyles = css`
  :host {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    min-height: 0;
  }
  .base {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: var(--tec-panel-py, 0.75rem) var(--tec-panel-px, 1rem);
  }
`

/**
 * The flex child that takes the panel's remaining height and scrolls. Lay out its content with a
 * wrapper element inside it.
 *
 * @summary The scrolling body of a panel.
 *
 * @tag tec-panel-content
 *
 * @slot - The body.
 *
 * @csspart base - The scroll container (padding).
 */
export class TecPanelContent extends TectonElement {
  static styles = [hostStyles, contentStyles]

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

const footerStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
  }
  .base {
    display: flex;
    align-items: center;
    justify-content: var(--tec-panel-footer-justify, flex-start);
    gap: 0.5rem;
    padding: var(--tec-panel-py, 0.75rem) var(--tec-panel-px, 1rem);
    border-top: 1px solid var(--tec-border);
  }
  :host([justify="end"]) .base {
    justify-content: flex-end;
  }
  :host([justify="between"]) .base {
    justify-content: space-between;
  }
`

/**
 * @summary The footer of a panel: actions pinned to the bottom.
 *
 * @tag tec-panel-footer
 *
 * @slot - Buttons and other footer content.
 *
 * @csspart base - The footer row (padding and top border).
 */
export class TecPanelFooter extends TectonElement {
  static styles = [hostStyles, footerStyles]

  /** Distribution of the footer's content: `start`, `end` or `between`. */
  @property({ reflect: true }) justify: "start" | "end" | "between" = "start"

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-panel": TecPanel
    "tec-panel-header": TecPanelHeader
    "tec-panel-title": TecPanelTitle
    "tec-panel-description": TecPanelDescription
    "tec-panel-actions": TecPanelActions
    "tec-panel-content": TecPanelContent
    "tec-panel-footer": TecPanelFooter
  }
}
