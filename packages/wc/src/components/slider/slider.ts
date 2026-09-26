import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, queryAll } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { resolveIdRefs } from "../../internal/aria.js"
import { isRtl } from "../../internal/direction.js"
import { FocusVisibleController } from "../../internal/focus.js"
import { FormControlMixin, type FormValue } from "../../internal/form-control.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { localeOf } from "../../internal/locale.js"
import { sliderStyles } from "./slider.styles.js"

export type SliderOrientation = "horizontal" | "vertical"

function decimals(n: number): number {
  const s = String(n)
  if (s.includes("e-")) return Number(s.split("e-")[1])
  return s.includes(".") ? s.split(".")[1]!.length : 0
}

/** Rounds `value` to the nearest multiple of `step` from `min` and clamps it to [min, max]. */
function snap(value: number, min: number, max: number, step: number, base: number): number {
  const s = step > 0 ? step : 1
  let v = base + Math.round((value - base) / s) * s
  const places = Math.max(decimals(s), decimals(base))
  v = Number(v.toFixed(places))
  if (v < min) v = min
  if (v > max) v = max
  return v
}

/**
 * Follows React Aria's Slider: one `role="slider"` thumb per value, each with `aria-valuenow`,
 * `aria-valuemin`/`aria-valuemax` (bounded by its neighbours, so thumbs never cross),
 * `aria-valuetext` (locale-formatted with `formatOptions`) and `aria-orientation`.
 *
 * Keyboard (per thumb): Arrow Right/Up increase and Left/Down decrease by `step` (Left/Right are
 * mirrored in RTL), <kbd>Shift</kbd>+Arrow and PageUp/PageDown move by a page (a tenth of the range,
 * at least one step), Home/End jump to the thumb's minimum/maximum. Pressing the track moves the
 * closest thumb there and starts dragging it.
 *
 * Form-associated: with a `name` it submits one `name=value` entry per thumb. Reset restores the
 * `value` attribute; a disabled `<fieldset>` disables it.
 *
 * Name it with `aria-label`, `aria-labelledby` or a `<label for>` — every thumb gets that name. With
 * several thumbs, `thumb-labels` adds a per-thumb name ("Minimum", "Maximum").
 *
 * @summary An input where the user selects a value, or a range of values, within a given range.
 *
 * @tag tec-slider
 *
 * @csspart base - The positioning box of track and thumbs.
 * @csspart track - The track (the full range).
 * @csspart range - The filled part of the track (from the minimum to the value, or between the first and last thumb).
 * @csspart thumb - Every thumb.
 *
 * @cssprop --tec-slider-color - Colour of the range and thumbs (default `--tec-slider`); the track is this at 60%.
 *
 * @cssstate vertical - The slider is vertical.
 * @cssstate dragging - A thumb is being dragged.
 * @cssstate focus-visible - A thumb has keyboard focus.
 *
 * @fires input - A value changed by user interaction (continuously while dragging).
 * @fires change - The user finished a change (pointer released, or a key press).
 */
export class TecSlider extends FormControlMixin(TectonElement) {
  static styles = [hostStyles, srOnly, sliderStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The minimum value. */
  @property({ type: Number }) min = 0

  /** The maximum value. */
  @property({ type: Number }) max = 100

  /** The step between values (values snap to `min + n × step`). */
  @property({ type: Number }) step = 1

  /** Layout and axis: `vertical` grows upwards (give it a height, default min-height 10rem). */
  @property({ reflect: true }) orientation: SliderOrientation = "horizontal"

  /** Per-thumb accessible names for multi-thumb sliders, comma-separated (`"Minimum, Maximum"`). */
  @property({ attribute: "thumb-labels" }) thumbLabels = ""

  /** `Intl.NumberFormat` options for `aria-valuetext` (e.g. `{ style: "percent" }`, `{ style: "unit", unit: "celsius" }`). */
  @property({ attribute: false }) formatOptions?: Intl.NumberFormatOptions

  #values: number[] | undefined

  /**
   * The current values, one per thumb (property). Until set (or changed by the user) they follow
   * the `value` attribute: a number, or several separated by commas or spaces (`value="25, 75"`).
   */
  @property({ attribute: false })
  get values(): number[] {
    return this.#normalize(this.#values ?? this.#parse(this.defaultValue))
  }
  set values(values: number[]) {
    this.#values = (values ?? []).map(Number).filter((v) => Number.isFinite(v))
  }

  /** The current values as a comma-separated string (`"25,75"`); setting it sets `values`. */
  override get value(): string {
    return this.values.join(",")
  }
  override set value(value: string) {
    const old = this.values
    this.#values = this.#parse(value == null ? "" : String(value))
    this.requestUpdate("values", old)
  }

  @queryAll(".thumb") private thumbs!: NodeListOf<HTMLElement>
  @query(".base") private base!: HTMLElement

  #dragIndex = -1
  #dragging = false
  #dragChanged = false

  constructor() {
    super()
    new FocusVisibleController(this)
    this.addEventListener("click", (event) => {
      // `<label for>` clicks land on the host: focus the first thumb.
      if (event.composedPath()[0] === this && !this.isDisabled) this.thumbs[0]?.focus()
    })
  }

  #parse(value: string): number[] {
    const list = value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((v) => Number.isFinite(v))
    return list.length ? list : [this.min]
  }

  #normalize(values: number[]): number[] {
    const sorted = values.length ? [...values].sort((a, b) => a - b) : [this.min]
    return sorted.map((v) => snap(v, this.min, Math.max(this.min, this.max), this.step, this.min))
  }

  protected override formValue(): FormValue {
    if (!this.name) return null
    const values = this.values
    if (values.length === 1) return String(values[0])
    const data = new FormData()
    for (const v of values) data.append(this.name, String(v))
    return data
  }

  protected override formState(): FormValue {
    return this.value
  }

  protected override formResetValue(): void {
    super.formResetValue()
    const old = this.values
    this.#values = undefined
    this.requestUpdate("values", old)
  }

  protected override formRestoreState(state: FormValue): void {
    if (typeof state === "string") this.value = state
  }

  /** Focuses the first thumb. */
  override focus(options?: FocusOptions): void {
    this.thumbs[0]?.focus(options)
  }

  get #pageSize(): number {
    const range = this.max - this.min
    const step = this.step > 0 ? this.step : 1
    return Math.max(snap(range / 10, 0, range / 10 + step, step, 0), step)
  }

  #thumbMin(values: number[], index: number): number {
    return index === 0 ? this.min : values[index - 1]!
  }

  #thumbMax(values: number[], index: number): number {
    return index === values.length - 1 ? this.max : values[index + 1]!
  }

  /** Sets one thumb (snapped and bounded by its neighbours); returns whether it changed. */
  #setThumb(index: number, value: number): boolean {
    const values = [...this.values]
    const next = snap(value, this.#thumbMin(values, index), this.#thumbMax(values, index), this.step, this.min)
    if (next === values[index]) return false
    values[index] = next
    this.#values = values
    this.requestUpdate("values")
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    return true
  }

  #commit(): void {
    this.markInteracted()
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  #format(value: number): string {
    const lang = localeOf(this)
    try {
      return new Intl.NumberFormat(lang, this.formatOptions).format(value)
    } catch {
      return String(value)
    }
  }

  #onKeyDown(event: KeyboardEvent, index: number) {
    if (this.isDisabled || event.altKey || event.ctrlKey || event.metaKey) return
    const values = this.values
    const current = values[index]!
    const horizontal = this.orientation === "horizontal"
    const rtl = horizontal && isRtl(this)
    const delta = event.shiftKey ? this.#pageSize : this.step
    let next: number | undefined
    switch (event.key) {
      case "ArrowUp":
        next = current + delta
        break
      case "ArrowDown":
        next = current - delta
        break
      case "ArrowRight":
        next = current + (rtl ? -delta : delta)
        break
      case "ArrowLeft":
        next = current + (rtl ? delta : -delta)
        break
      case "PageUp":
        next = current + this.#pageSize
        break
      case "PageDown":
        next = current - this.#pageSize
        break
      case "Home":
        next = this.#thumbMin(values, index)
        break
      case "End":
        next = this.#thumbMax(values, index)
        break
      default:
        return
    }
    event.preventDefault()
    if (this.#setThumb(index, next)) this.#commit()
  }

  /** The value under a pointer position. */
  #valueAt(event: PointerEvent): number {
    const rect = this.base.getBoundingClientRect()
    let percent: number
    if (this.orientation === "vertical") percent = 1 - (event.clientY - rect.top) / rect.height
    else {
      percent = (event.clientX - rect.left) / rect.width
      if (isRtl(this)) percent = 1 - percent
    }
    percent = Math.min(1, Math.max(0, percent))
    return this.min + percent * (this.max - this.min)
  }

  #closestThumb(value: number): number {
    const values = this.values
    const split = values.findIndex((v) => value - v < 0)
    if (split === 0) return 0
    if (split === -1) return values.length - 1
    const lastLeft = values[split - 1]!
    const firstRight = values[split]!
    return Math.abs(lastLeft - value) < Math.abs(firstRight - value) ? split - 1 : split
  }

  #onPointerDown(event: PointerEvent) {
    if (this.isDisabled || event.button !== 0) return
    const thumbIndex = [...this.thumbs].findIndex((t) => event.composedPath().includes(t))
    const value = this.#valueAt(event)
    const index = thumbIndex >= 0 ? thumbIndex : this.#closestThumb(value)
    event.preventDefault()
    this.#dragIndex = index
    this.#dragging = true
    this.#dragChanged = false
    this.toggleState("dragging", true)
    this.thumbs[index]?.focus({ preventScroll: true })
    this.base.setPointerCapture?.(event.pointerId)
    // Pressing a thumb keeps its value until it moves; pressing the track jumps there.
    if (thumbIndex < 0 && this.#setThumb(index, value)) this.#dragChanged = true
  }

  #onPointerMove(event: PointerEvent) {
    if (!this.#dragging) return
    if (this.#setThumb(this.#dragIndex, this.#valueAt(event))) this.#dragChanged = true
  }

  #onPointerUp(event: PointerEvent) {
    if (!this.#dragging) return
    this.#dragging = false
    this.toggleState("dragging", false)
    if (this.base.hasPointerCapture?.(event.pointerId)) this.base.releasePointerCapture(event.pointerId)
    if (this.#dragChanged) this.#commit()
    this.#dragChanged = false
  }

  /** The label sources shared by every thumb (host aria-labelledby, `<label for>`, or the host aria-label mirrored into the shadow root). */
  #labelElements(): Element[] {
    const labelledBy = this.getAttribute("aria-labelledby")
    if (labelledBy !== null) return resolveIdRefs(this, labelledBy)
    if (this.hasAttribute("aria-label")) {
      const own = this.renderRoot.querySelector(".host-label")
      return own ? [own] : []
    }
    return this.formLabels()
  }

  #syncThumbAria(): void {
    const labels = this.#labelElements()
    const described = resolveIdRefs(this, this.getAttribute("aria-describedby"))
    for (const thumb of this.thumbs) {
      const own = thumb.querySelector(".thumb-label")
      const list = own ? [...labels, own] : labels
      const t = thumb as unknown as { ariaLabelledByElements: Element[] | null; ariaDescribedByElements: Element[] | null }
      t.ariaLabelledByElements = list.length ? list : null
      t.ariaDescribedByElements = described.length ? described : null
    }
  }

  #ariaObserver = new MutationObserver(() => this.requestUpdate())

  override connectedCallback(): void {
    super.connectedCallback()
    this.#ariaObserver.observe(this, { attributes: true, attributeFilter: ["aria-label", "aria-labelledby", "aria-describedby"] })
    this.addEventListener("focusin", this.#onFocusIn)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#ariaObserver.disconnect()
    this.removeEventListener("focusin", this.#onFocusIn)
  }

  #onFocusIn = () => this.#syncThumbAria()

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("vertical", this.orientation === "vertical")
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.#syncThumbAria()
  }

  protected override render() {
    const values = this.values
    const range = this.max - this.min || 1
    const pct = (v: number) => ((v - this.min) / range) * 100
    const vertical = this.orientation === "vertical"
    const start = values.length > 1 ? pct(values[0]!) : 0
    const end = pct(values[values.length - 1]!)
    const rangeStyle = vertical ? { bottom: `${start}%`, height: `${end - start}%` } : { insetInlineStart: `${start}%`, width: `${end - start}%` }
    const thumbLabels = this.thumbLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const disabled = this.isDisabled
    const hostLabel = this.getAttribute("aria-label")
    return html`<div
      class="base"
      part="base"
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerUp}
      @pointercancel=${this.#onPointerUp}
    >
      <div class="track" part="track"><div class="range" part="range" style=${styleMap(rangeStyle)}></div></div>
      ${values.map((v, i) => {
        const position = vertical ? { bottom: `${pct(v)}%` } : { insetInlineStart: `${pct(v)}%` }
        return html`<div
          class="thumb"
          part="thumb"
          role="slider"
          tabindex=${disabled ? nothing : "0"}
          aria-valuenow=${String(v)}
          aria-valuemin=${String(this.#thumbMin(values, i))}
          aria-valuemax=${String(this.#thumbMax(values, i))}
          aria-valuetext=${this.#format(v)}
          aria-orientation=${this.orientation}
          aria-disabled=${disabled ? "true" : nothing}
          aria-invalid=${this.showInvalid ? "true" : nothing}
          style=${styleMap(position)}
          @keydown=${(e: KeyboardEvent) => this.#onKeyDown(e, i)}
        >${thumbLabels[i] ? html`<span class="thumb-label" hidden>${thumbLabels[i]}</span>` : nothing}</div>`
      })}
      ${hostLabel !== null ? html`<span class="host-label" hidden>${hostLabel}</span>` : nothing}
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-slider": TecSlider
  }
}
