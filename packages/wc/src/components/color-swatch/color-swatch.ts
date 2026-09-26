import { html, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { PopupController, popupStyles, type PopupCloseReason } from "../../internal/popup.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { colorSwatchStyles } from "./color-swatch.styles.js"

/** Swatch size 12 / 16 / 24 / 32 / 48 px. */
export type ColorSwatchSize = "xs" | "sm" | "md" | "lg" | "xl"
/** Corner radius. */
export type ColorSwatchShape = "square" | "rounded" | "circle"
/** A preset of the editable picker: a CSS colour, or a colour with a name. */
export type ColorSwatchPreset = string | { color: string; label?: string }

/** The Tecton accent fills, the default presets of an editable swatch. */
export const colorSwatchPresets: readonly string[] = [
  "var(--tecton-color-accent-saffron-fill)",
  "var(--tecton-color-accent-lime-fill)",
  "var(--tecton-color-accent-blue-fill)",
  "var(--tecton-color-accent-pink-fill)",
  "var(--tecton-color-accent-lemon-fill)",
  "var(--tecton-color-accent-graphite-fill)",
]

/** Why the picker opened or closed. */
export type ColorSwatchOpenChangeReason = "trigger" | PopupCloseReason

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
/** An unlikely colour the probe inherits when the value does not resolve. */
const PROBE_SENTINEL = "rgba(1, 2, 3, 0.004)"

/** Parses `#rgb` / `#rrggbb` (with or without `#`) to lowercase `#rrggbb`, or `null`. */
export function parseHex(value: string): string | null {
  const match = HEX.exec(value.trim())
  if (!match) return null
  let digits = match[1]!.toLowerCase()
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("")
  return `#${digits}`
}

let canvasContext: CanvasRenderingContext2D | null | undefined

/** Converts any computed CSS colour (rgb(), oklch(), color()) to `#rrggbb` by painting one pixel. */
function computedToHex(color: string): string | null {
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (rgb) return `#${rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`
  if (canvasContext === undefined) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    canvasContext = canvas.getContext("2d", { willReadFrequently: true })
  }
  const ctx = canvasContext
  if (!ctx) return null
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Resolves any CSS colour — a hex, `oklch()`, a named colour or `var(--token)` — to `#rrggbb` in the
 * context of `root` (so tokens resolve with the theme in effect there), or `null` when it is not a
 * colour. The probe sits inside a parent painted with a sentinel: an invalid colour or an unresolved
 * `var()` inherits the sentinel and reads as "unresolved".
 */
export function resolveColorToHex(color: string, root: Element | ShadowRoot): string | null {
  const hex = parseHex(color)
  if (hex && color.trim().startsWith("#")) return hex
  if (typeof document === "undefined") return null
  const parent = document.createElement("span")
  parent.style.color = PROBE_SENTINEL
  parent.style.display = "none"
  const probe = document.createElement("span")
  probe.style.color = color
  parent.append(probe)
  root.append(parent)
  const sentinel = getComputedStyle(parent).color
  const computed = getComputedStyle(probe).color
  parent.remove()
  if (!computed || computed === sentinel) return null
  return computedToHex(computed)
}

/** A readable name for a preset: its label, the Tecton accent name of a token, or the value itself. */
function presetName(preset: ColorSwatchPreset): string {
  if (typeof preset !== "string") return preset.label ?? preset.color
  const token = /^var\(--tecton-color-accent-([a-z]+)-fill\)$/.exec(preset.trim())
  if (token) return token[1]!.charAt(0).toUpperCase() + token[1]!.slice(1)
  return preset
}

interface ResolvedPreset {
  color: string
  hex: string
  name: string
}

/**
 * The swatch is a `role="img"` named by `aria-label` (or the colour value); with a visible `label`
 * and `value` it is decorative and the text carries the meaning.
 *
 * With `editable` the swatch becomes a button ("Edit colour", or the host's `aria-label`) that opens
 * a picker: a listbox of preset colours (the Tecton accent fills by default; replace them with the
 * `presets` property), the platform colour picker and a hex field. Picking a colour sets `color` to a
 * `#rrggbb` string and fires `input` and `change`. The picker is a non-modal dialog in the top layer:
 * <kbd>Escape</kbd> or a press outside closes it and focus returns to the swatch.
 *
 * @summary A colour preview with an optional label and value, optionally editable with a preset and hex picker.
 *
 * @tag tec-color-swatch
 *
 * @csspart base - The row of swatch and text.
 * @csspart swatch - The colour box.
 * @csspart trigger - The button around the swatch (with `editable`).
 * @csspart label - The label text.
 * @csspart value - The value text (mono).
 * @csspart picker - The picker panel (with `editable`).
 * @csspart presets - The preset listbox.
 * @csspart preset - One preset option.
 * @csspart native - The swatch that opens the platform colour picker.
 * @csspart hex - The hex text field.
 *
 * @cssprop --tec-color-swatch-size - Width and height of the swatch (defaults per `size`).
 * @cssprop --tec-color-swatch-radius - Corner radius of the swatch (defaults per `shape`).
 *
 * @fires input - The user is picking a colour (every preset, hex commit or native picker move). Read `color`.
 * @fires change - The user committed a colour. Read `color`.
 * @fires tec-open-change - The user opened or closed the picker. Cancelable. `detail: { open, reason }`.
 */
export class TecColorSwatch extends TectonElement {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".picker"), colorSwatchStyles]

  /** Any CSS colour: a hex, `oklch()`, a named colour or `var(--token)`. An editable swatch sets it to the picked `#rrggbb`. */
  @property() color = ""

  /** Swatch size: 12 / 16 / 24 / 32 / 48 px. */
  @property({ reflect: true }) size: ColorSwatchSize = "md"

  /** Corner radius. */
  @property({ reflect: true }) shape: ColorSwatchShape = "rounded"

  /** Text next to the swatch (a name such as "Sandstone"). */
  @property() label = ""

  /** Secondary text under the label, in mono (e.g. the hex value). */
  @property() value = ""

  /** Makes the swatch a button that opens the colour picker. */
  @property({ type: Boolean, reflect: true }) editable = false

  /** Disables the editable swatch's button. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Whether the picker is open (with `editable`). */
  @property({ type: Boolean, reflect: true }) open = false

  /** Preset colours of the picker: CSS colours or `{ color, label }`. Values that do not resolve to a colour are left out. */
  @property({ type: Array }) presets: ColorSwatchPreset[] = [...colorSwatchPresets]

  /** Accessible name of the editable swatch's button (the host's `aria-label` wins). */
  @property({ attribute: "edit-label" }) editLabel = "Edit colour"

  /** Heading of the preset row. */
  @property({ attribute: "presets-label" }) presetsLabel = "Presets"

  /** Heading of the custom row. */
  @property({ attribute: "custom-label" }) customLabel = "Custom"

  /** Accessible name of the platform colour picker. */
  @property({ attribute: "pick-label" }) pickLabel = "Pick a custom colour"

  /** Accessible name of the hex field. */
  @property({ attribute: "hex-label" }) hexLabel = "Hex colour"

  /** Accessible name of the swatch image, or of the editable swatch's button and picker. */
  @property({ attribute: "aria-label" }) private _hostLabel: string | null = null

  @state() private _resolved: { current: string | null; presets: ResolvedPreset[] } = { current: null, presets: [] }

  @query(".trigger") private _trigger?: HTMLButtonElement
  @query(".picker") private _picker?: HTMLElement
  @query(".hex") private _hex?: HTMLInputElement

  #popup = new PopupController(this, {
    popup: () => this._picker,
    trigger: () => this._trigger,
    haspopup: "dialog",
    placement: () => ({ side: "bottom", align: "center", sideOffset: 4 }),
    focus: { initial: "first", trap: true, restore: true },
    onRequestClose: (reason) => this.#requestOpen(false, reason),
  })

  #roving = new RovingFocusController<HTMLElement>(this, {
    items: () => [...(this.renderRoot?.querySelectorAll<HTMLElement>(".preset") ?? [])],
    orientation: "both",
    loop: true,
    homeEnd: true,
  })

  /** The current colour as `#rrggbb` (tokens resolved in this element's context), or `null`. */
  get hex(): string | null {
    return this.color && this.isConnected ? resolveColorToHex(this.color, this.shadowRoot ?? this) : null
  }

  /** Opens the picker (with `editable`; no event). */
  show(): void {
    if (this.editable) this.open = true
  }

  /** Closes the picker (no event). */
  hide(): void {
    this.open = false
  }

  #requestOpen(open: boolean, reason: ColorSwatchOpenChangeReason): void {
    if (open === this.open) return
    if (this.emit("tec-open-change", { detail: { open, reason }, cancelable: true })) this.open = open
  }

  #resolve(): void {
    const root = this.shadowRoot ?? this
    const presets: ResolvedPreset[] = []
    for (const preset of this.presets ?? []) {
      const color = typeof preset === "string" ? preset : preset.color
      const hex = resolveColorToHex(color, root)
      if (hex) presets.push({ color, hex, name: presetName(preset) })
    }
    this._resolved = { current: this.color ? resolveColorToHex(this.color, root) : null, presets }
  }

  #commit(hex: string, kind: "input" | "both"): void {
    if (hex !== this.color) this.color = hex
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    if (kind === "both") this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }

  #onPresetActivate = (event: Event) => {
    const option = (event.currentTarget as HTMLElement) ?? null
    const hex = option?.dataset.hex
    if (hex) this.#commit(hex, "both")
  }

  #onPresetKeyDown = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      this.#onPresetActivate(event)
    }
  }

  #onHexKeyDown = (event: KeyboardEvent) => {
    const input = event.currentTarget as HTMLInputElement
    if (event.key === "Enter") {
      this.#commitHexField(input)
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const current = parseHex(input.value) ?? this._resolved.current ?? "#000000"
      const next = Math.min(0xffffff, Math.max(0, parseInt(current.slice(1), 16) + (event.key === "ArrowUp" ? 1 : -1)))
      event.preventDefault()
      const hex = `#${next.toString(16).padStart(6, "0")}`
      input.value = hex
      this.#commit(hex, "both")
    }
  }

  #commitHexField(input: HTMLInputElement): void {
    const hex = parseHex(input.value)
    if (hex) {
      input.value = hex
      if (hex !== this._resolved.current) this.#commit(hex, "both")
    } else {
      input.value = this._resolved.current ?? ""
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("editable") && !this.editable) this.open = false
    if (this.editable && this.isConnected && (changed.has("color") || changed.has("presets") || (changed.has("open") && this.open) || changed.has("editable"))) {
      this.#resolve()
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("open")) {
      if (this.open) {
        const selected = this.renderRoot.querySelector<HTMLElement>('.preset[aria-selected="true"]')
        this.#roving.setActive(selected)
      }
      void this.#popup.setOpen(this.open && this.editable)
    }
    // Keep the hex field in sync unless the user is typing in it.
    const hex = this._hex
    if (hex && this.shadowRoot?.activeElement !== hex) hex.value = this._resolved.current ?? ""
  }

  #renderSwatch(decorative: boolean) {
    const style = styleMap({ background: this.color || "transparent" })
    if (decorative || this.editable) return html`<span class="swatch" part="swatch" style=${style} aria-hidden="true"></span>`
    const name = this._hostLabel || this.label || this.color
    return html`<span class="swatch" part="swatch" style=${style} role="img" aria-label=${name}></span>`
  }

  #renderPicker() {
    const { current, presets } = this._resolved
    return html`<div class="picker" part="picker" popover="manual" role="dialog" tabindex="-1" aria-label=${this._hostLabel || this.editLabel}>
      ${presets.length
        ? html`<div class="section">
              <span class="heading" id="presets-heading">${this.presetsLabel}</span>
              <div class="presets" part="presets" role="listbox" aria-labelledby="presets-heading" aria-orientation="horizontal">
                ${presets.map(
                  (p) => html`<div
                    class="preset"
                    part="preset"
                    role="option"
                    aria-label=${p.name}
                    aria-selected=${String(p.hex === current)}
                    data-hex=${p.hex}
                    @click=${this.#onPresetActivate}
                    @keydown=${this.#onPresetKeyDown}
                  >
                    <span class="swatch" style=${styleMap({ background: p.color })}></span>
                  </div>`
                )}
              </div>
            </div>
            <hr class="separator" />`
        : nothing}
      <div class="section">
        <span class="heading">${this.customLabel}</span>
        <div class="custom">
          <label class="native swatch" part="native" style=${styleMap({ background: current ?? "#000000" })}>
            <input
              type="color"
              aria-label=${this.pickLabel}
              .value=${current ?? "#000000"}
              @input=${(e: Event) => this.#commit((e.target as HTMLInputElement).value, "input")}
              @change=${() => this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))}
            />
          </label>
          <input
            class="hex"
            part="hex"
            type="text"
            aria-label=${this.hexLabel}
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            maxlength="7"
            @keydown=${this.#onHexKeyDown}
            @change=${(e: Event) => this.#commitHexField(e.target as HTMLInputElement)}
          />
        </div>
      </div>
    </div>`
  }

  protected override render() {
    const hasText = !!this.label || !!this.value
    const swatch = this.#renderSwatch(!!this.label && !!this.value)
    return html`<span class="base" part="base"
      >${this.editable
        ? html`<button
              class="trigger"
              part="trigger"
              type="button"
              aria-label=${this._hostLabel || this.editLabel}
              ?disabled=${this.disabled}
              @click=${() => this.#requestOpen(!this.open, "trigger")}
            >
              ${swatch}
            </button>
            ${this.#renderPicker()}`
        : swatch}${hasText
        ? html`<span class="text"
            >${this.label ? html`<span class="label" part="label">${this.label}</span>` : nothing}${this.value
              ? html`<span class="value" part="value">${this.value}</span>`
              : nothing}</span
          >`
        : nothing}</span
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-color-swatch": TecColorSwatch
  }
}
