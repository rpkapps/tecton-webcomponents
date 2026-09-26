import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { hostStyles } from "../../internal/styles.js"
import { backgroundStyles } from "./background.styles.js"
import { backgroundEffects, interactiveEffects, isBackgroundEffect, renderEffect, type BackgroundEffectName } from "./effects.js"

export { backgroundEffects, type BackgroundEffectName }

/** Ink colours of `tone`, from the theme (`--tec-foreground`, `--tec-primary`, `--tec-chart-1…4`). */
export const backgroundTones = ["neutral", "primary", "azure", "saffron", "lime", "blue"] as const
/** Opacities of the ink: 8%, 16%, 32%. */
export const backgroundIntensities = ["low", "medium", "high"] as const
/** Base cycle lengths: 60s, 36s, 18s. */
export const backgroundSpeeds = ["slow", "normal", "fast"] as const

export type BackgroundTone = (typeof backgroundTones)[number]
export type BackgroundIntensity = (typeof backgroundIntensities)[number]
export type BackgroundSpeed = (typeof backgroundSpeeds)[number]

/**
 * A decorative, non-interactive background drawn from oil and gas imagery: seismic sections,
 * contour maps, strata, grids, flow lines, well logs, a drill bit, hexagon meshes, pressure fields,
 * a horizon and a perspective wireframe terrain.
 *
 * Place it as the **first child of a `relative isolate` container**; it fills the container
 * (`position: absolute; inset: 0; z-index: -10`), ignores the pointer, is hidden from assistive
 * technology, and is painted with a tone from the theme so it reads in light and dark mode alike.
 *
 * The effect freezes on its static frame with the `static` attribute, under
 * `prefers-reduced-motion: reduce`, while it is scrolled out of view and while the tab is hidden;
 * print and forced-colours mode hide it.
 *
 * Without an `effect` (or with an unknown name) the element is the plain layer: slot your own SVG
 * into it and paint it with `--tec-background-ink`, `--tec-background-ink-soft` and
 * `--tec-background-ink-strong` to get the same positioning, tone, print and forced-colours rules.
 *
 * @tag tec-background
 * @summary Decorative oil and gas background effects (seismic, contour, strata, grid, flow, …).
 *
 * @slot - Optional custom drawing, painted above the built-in effect (usually used without `effect`).
 *
 * @csspart base - The absolutely positioned wrapper of the effect and the slot.
 *
 * @cssprop [--tec-background-tone] - Overrides the ink colour chosen by `tone` (any colour).
 * @cssprop [--tec-background-alpha] - Overrides the ink opacity chosen by `intensity` (a number, 0.16 = 16%).
 * @cssprop [--tec-background-duration] - Overrides the base cycle chosen by `speed` (a time, e.g. `36s`).
 * @cssprop [--tec-background-ink] - Read-only: the ink (tone at the intensity), for slotted custom effects.
 * @cssprop [--tec-background-ink-soft] - Read-only: the ink at 45%, for fills.
 * @cssprop [--tec-background-ink-strong] - Read-only: the ink at 180%, for accents.
 *
 * @cssstate paused - The motion is paused because the element is off screen or the tab is hidden.
 */
export class TecBackground extends TectonElement {
  static styles = [hostStyles, backgroundStyles]

  /**
   * The effect to draw: `seismic`, `contour`, `strata`, `grid`, `flow`, `well-log`, `drill`,
   * `hexagons`, `pressure`, `horizon` or `terrain-grid`. Empty draws nothing (a plain layer for
   * slotted content).
   */
  @property({ reflect: true }) effect: BackgroundEffectName | "" = ""

  /** Ink colour from the theme: `neutral` (foreground), `primary`, or a chart accent (`azure`, `saffron`, `lime`, `blue`). */
  @property({ reflect: true }) tone: BackgroundTone = "neutral"

  /** Opacity of the ink: `low` 8%, `medium` 16%, `high` 32%. */
  @property({ reflect: true }) intensity: BackgroundIntensity = "medium"

  /** Base cycle length: `slow` 60s, `normal` 36s, `fast` 18s. */
  @property({ reflect: true }) speed: BackgroundSpeed = "normal"

  /**
   * Freezes the effect on its static frame. (Reduced motion, off screen and a hidden tab pause it
   * regardless.)
   */
  @property({ type: Boolean, reflect: true }) static = false

  /**
   * `contour` only: `map` colours the isolines by elevation with the chart accents (blue, azure,
   * lime, saffron); `tone` draws them in the single `tone`.
   */
  @property({ reflect: true }) palette: "map" | "tone" = "map"

  /** `contour` only: draw a survey grid under the isolines. */
  @property({ type: Boolean, reflect: true }) grid = false

  /**
   * `grid`, `hexagons` and `terrain-grid` only: reveal the pattern around the pointer as it moves
   * over the parent element (the background itself keeps `pointer-events: none`).
   */
  @property({ type: Boolean, reflect: true }) interactive = false

  #observer?: IntersectionObserver
  #onScreen = true
  #pointerTarget?: HTMLElement

  connectedCallback(): void {
    super.connectedCallback()
    this.internals.ariaHidden = "true"
    this.internals.role = "presentation"
    this.#observeVisibility()
    document.addEventListener("visibilitychange", this.#updatePaused)
    if (this.hasUpdated) this.#syncPointer()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#observer = undefined
    document.removeEventListener("visibilitychange", this.#updatePaused)
    this.#listenToPointer(undefined)
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("effect") || changed.has("interactive")) this.#syncPointer()
  }

  #syncPointer() {
    const wantsPointer = this.interactive && isBackgroundEffect(this.effect) && interactiveEffects.includes(this.effect)
    this.#listenToPointer(wantsPointer ? this.#parent() : undefined)
  }

  /** Whether the motion is currently paused because the element is off screen or the tab is hidden. */
  get paused(): boolean {
    return !this.#onScreen || document.visibilityState === "hidden"
  }

  #observeVisibility() {
    // Without IntersectionObserver the effect counts as always on screen; only the hidden-tab pause applies.
    if (typeof IntersectionObserver === "undefined") return
    this.#observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      this.#onScreen = entry.isIntersecting
      this.#updatePaused()
    })
    this.#observer.observe(this)
  }

  #updatePaused = () => {
    const paused = this.paused
    this.toggleState("paused", paused)
    this.renderRoot?.querySelector(".base")?.toggleAttribute("data-paused", paused)
  }

  /** The element the pointer reveal listens on: the parent (or the shadow host when the layer is a shadow root's child). */
  #parent(): HTMLElement | undefined {
    if (this.parentElement) return this.parentElement
    const root = this.getRootNode()
    return root instanceof ShadowRoot ? (root.host as HTMLElement) : undefined
  }

  #listenToPointer(target: HTMLElement | undefined) {
    if (target === this.#pointerTarget) return
    this.#pointerTarget?.removeEventListener("pointermove", this.#onPointerMove)
    this.#pointerTarget?.removeEventListener("pointerleave", this.#onPointerLeave)
    this.#pointerTarget = target
    target?.addEventListener("pointermove", this.#onPointerMove)
    target?.addEventListener("pointerleave", this.#onPointerLeave)
  }

  #onPointerMove = (event: PointerEvent) => {
    const layer = this.renderRoot.querySelector<HTMLElement>(".pointer")
    const parent = this.#pointerTarget
    if (!layer || !parent) return
    const rect = parent.getBoundingClientRect()
    layer.style.setProperty("--bg-x", `${event.clientX - rect.left}px`)
    layer.style.setProperty("--bg-y", `${event.clientY - rect.top}px`)
    layer.setAttribute("data-hover", "")
  }

  #onPointerLeave = () => {
    this.renderRoot.querySelector(".pointer")?.removeAttribute("data-hover")
  }

  render() {
    return html`<div part="base" class="base" aria-hidden="true" ?data-paused=${this.paused}>
      ${renderEffect(this.effect, { palette: this.palette === "tone" ? "tone" : "map", grid: this.grid, interactive: this.interactive })}
      <slot></slot>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-background": TecBackground
  }
}
