import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { progressLabelStyles, progressStyles, progressValueStyles } from "./progress.styles.js"

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

/** The language of `el`: its closest `lang` attribute, else the browser's. */
function localeOf(el: Element): string {
  return el.closest("[lang]")?.getAttribute("lang") || navigator.language || "en"
}

/**
 * Implements the WAI-ARIA `progressbar` role on the element itself: `aria-valuenow`, `-valuemin`,
 * `-valuemax` and `aria-valuetext` (the formatted value) as default semantics. While `indeterminate`
 * it exposes no value.
 *
 * Name it with a `tec-progress-label` child (it labels the bar) or with `aria-label`. A
 * `tec-progress-value` child prints the formatted value (`56%`), localised for the closest `lang`.
 *
 * The bar is always rendered after the children, across the full width; the label and the value
 * share the line above it. An indeterminate bar animates a sliding segment; with reduced motion it
 * is a full, still bar.
 *
 * @summary Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.
 *
 * @tag tec-progress
 *
 * @slot - A `tec-progress-label` and a `tec-progress-value`.
 *
 * @csspart base - The flex box that holds the children and the track.
 * @csspart track - The track (4px, the progress colour at 38%).
 * @csspart indicator - The filled part of the track.
 *
 * @cssstate indeterminate - The progress is indeterminate.
 */
export class TecProgress extends TectonElement {
  static styles = [hostStyles, progressStyles]

  /** The current value, between `min` and `max`. */
  @property({ type: Number }) value = 0

  /** The value of an empty bar. */
  @property({ type: Number }) min = 0

  /** The value of a full bar. State it when the scale is not 0–100 (`value="0.66" max="1"`). */
  @property({ type: Number }) max = 100

  /** The total is unknown: animates the bar and exposes no value. */
  @property({ type: Boolean, reflect: true }) indeterminate = false

  /** Replaces the formatted value text (announced and shown by `tec-progress-value`), e.g. `"3 of 8 files"`. */
  @property({ attribute: "value-label" }) valueLabel?: string

  /**
   * `Intl.NumberFormat` options for the value text. The default (`{ style: "percent" }`) formats the
   * percentage; any other style formats `value` itself.
   */
  @property({ attribute: false }) formatOptions: Intl.NumberFormatOptions = { style: "percent" }

  #observer = new MutationObserver(() => this.requestUpdate())

  /** The fraction of the bar that is filled (0–1). */
  get percentage(): number {
    const range = this.max - this.min
    return range > 0 ? clamp((this.value - this.min) / range, 0, 1) : 0
  }

  /** The formatted value (`"56%"`), or `undefined` while indeterminate. */
  get valueText(): string | undefined {
    if (this.indeterminate) return undefined
    if (this.valueLabel != null) return this.valueLabel
    const options = this.formatOptions ?? { style: "percent" }
    const n = options.style === "percent" ? this.percentage : clamp(this.value, this.min, this.max)
    return new Intl.NumberFormat(localeOf(this), options).format(n)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "progressbar"
    this.#observer.observe(this, { childList: true, subtree: true })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  #own<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((el) => el.closest("tec-progress") === this)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const internals = this.internals
    const valueText = this.valueText
    internals.ariaValueMin = String(this.min)
    internals.ariaValueMax = String(this.max)
    internals.ariaValueNow = this.indeterminate ? null : String(clamp(this.value, this.min, this.max))
    internals.ariaValueText = valueText ?? null
    this.toggleState("indeterminate", this.indeterminate)
    const labels = this.#own<TecProgressLabel>("tec-progress-label")
    ;(internals as ElementInternals & { ariaLabelledByElements: Element[] | null }).ariaLabelledByElements = labels.length ? labels : null
    for (const el of this.#own<TecProgressValue>("tec-progress-value")) el.valueText = valueText ?? ""
  }

  protected override render() {
    const width = this.indeterminate ? nothing : styleMap({ width: `${this.percentage * 100}%` })
    return html`<div class="base" part="base">
      <slot></slot>
      <div class="track" part="track"><span class="indicator" part="indicator" style=${width}></span></div>
    </div>`
  }
}

/**
 * Labels the enclosing `tec-progress` (the bar's accessible name).
 *
 * @summary The label of a progress bar.
 *
 * @tag tec-progress-label
 *
 * @slot - The label text.
 */
export class TecProgressLabel extends TectonElement {
  static styles = [hostStyles, progressLabelStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.closest("tec-progress")?.requestUpdate()
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Shows the formatted value of the enclosing `tec-progress` (`56%`, localised for the closest
 * `lang`; `value-label` and `formatOptions` on the progress change it). Content placed inside
 * replaces the text.
 *
 * @summary The value of a progress bar.
 *
 * @tag tec-progress-value
 *
 * @slot - Replaces the formatted value.
 */
export class TecProgressValue extends TectonElement {
  static styles = [hostStyles, progressValueStyles]

  /** The formatted value, set by the enclosing `tec-progress`. */
  @property({ attribute: false }) valueText = ""

  override connectedCallback(): void {
    super.connectedCallback()
    this.closest("tec-progress")?.requestUpdate()
  }

  protected override render() {
    return html`<slot>${this.valueText}</slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-progress": TecProgress
    "tec-progress-label": TecProgressLabel
    "tec-progress-value": TecProgressValue
  }
}
