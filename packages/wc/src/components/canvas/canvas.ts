import { html, nothing, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { focusTargetOf } from "../../internal/focus.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  canvasLegendItemStyles,
  canvasLegendStyles,
  canvasOverlayStyles,
  canvasStyles,
  canvasSurfaceStyles,
  canvasToolbarStyles,
} from "./canvas.styles.js"

/** Edge or corner a `tec-canvas-overlay` is pinned to. `left`/`right` are the inline start/end sides. */
export type CanvasOverlayPosition = "top-left" | "top" | "top-right" | "left" | "right" | "bottom-left" | "bottom" | "bottom-right"

/** Direction of a `tec-canvas-toolbar`. */
export type CanvasToolbarOrientation = "vertical" | "horizontal"

/**
 * The canvas takes the remaining space of a flex column (`flex: 1; min-height: 0`) or the full
 * height of a parent with a definite height; give it a height (`class="h-72"`) when it is embedded
 * in normal flow. It clips its content and is its own stacking context.
 *
 * @summary A full-bleed work surface (map, schematic, 3D view) with floating chrome.
 *
 * @tag tec-canvas
 *
 * @slot - A `tec-canvas-surface` and any number of `tec-canvas-overlay`s.
 *
 * @csspart base - The surface box (the muted background; its radius follows the element's).
 */
export class TecCanvas extends TectonElement {
  static styles = [hostStyles, canvasStyles]

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary The layer that fills the canvas: put the map, SVG, `<canvas>` or WebGL view here.
 *
 * @tag tec-canvas-surface
 *
 * @slot - The rendering engine's element.
 */
export class TecCanvasSurface extends TectonElement {
  static styles = [hostStyles, canvasSurfaceStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Corners and sides stack their children in a column (aligned to the edge), `top` and `bottom` in a
 * row. The overlay ignores the pointer between its children, so the surface keeps receiving drags
 * and wheel events around the floating controls. Positions are logical: `left` is the inline start
 * side, so the chrome mirrors in right-to-left layouts.
 *
 * @summary Pins floating controls to an edge or corner of the canvas.
 *
 * @tag tec-canvas-overlay
 *
 * @slot - Toolbars, legends, buttons or cards.
 */
export class TecCanvasOverlay extends TectonElement {
  static styles = [hostStyles, canvasOverlayStyles]

  /** Edge or corner the overlay is pinned to. */
  @property({ reflect: true }) position: CanvasOverlayPosition = "top-left"

  protected override render() {
    return html`<slot></slot>`
  }
}

const isSeparator = (el: Element) =>
  el.localName === "hr" || el.localName === "tec-separator" || el.getAttribute("role") === "separator" || el.hasAttribute("data-toolbar-skip")

/**
 * A toolbar (`role="toolbar"`) on a frosted floating surface. It is one tab stop: the arrow keys
 * move between its controls (Up/Down when vertical, Left/Right when horizontal, mirrored in
 * right-to-left layouts), Home/End jump to the ends, and Tab leaves the rail. Coming back returns to
 * the control used last. Give it an `aria-label`.
 *
 * @summary The floating tool rail of a canvas.
 *
 * @tag tec-canvas-toolbar
 *
 * @slot - The controls (usually `<tec-button variant="ghost" size="icon-sm" aria-label="…">`). Separators are skipped.
 *
 * @csspart base - The floating surface.
 */
export class TecCanvasToolbar extends TectonElement {
  static styles = [hostStyles, canvasToolbarStyles]

  /** Direction of the rail, and of the arrow keys that move along it. */
  @property({ reflect: true }) orientation: CanvasToolbarOrientation = "vertical"

  #roving = new RovingFocusController<HTMLElement>(this, {
    items: () => [...this.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !isSeparator(el)),
    orientation: () => this.orientation,
    loop: false,
    homeEnd: true,
    focusTarget: focusTargetOf,
  })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "toolbar"
    this.internals.ariaOrientation = this.orientation
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${() => this.#roving.update()}></slot></div>`
  }
}

/**
 * A list (`role="list"`) of `tec-canvas-legend-item`s, so assistive technology reads the symbol
 * names in order. Give it an `aria-label` ("Legend").
 *
 * @summary The symbology of the canvas on a floating surface.
 *
 * @tag tec-canvas-legend
 *
 * @slot - `tec-canvas-legend-item` elements.
 *
 * @csspart base - The floating surface.
 */
export class TecCanvasLegend extends TectonElement {
  static styles = [hostStyles, canvasLegendStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "list"
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * The swatch is decorative (hidden from assistive technology); the text is the symbol's name.
 *
 * @summary One symbol of a canvas legend: a swatch followed by its name.
 *
 * @tag tec-canvas-legend-item
 *
 * @slot - The name of the symbol.
 * @slot swatch - A custom swatch (a pattern, an icon, an SVG) instead of the `swatch` colour.
 *
 * @csspart swatch - The 12px swatch box.
 * @csspart label - The name (truncated with an ellipsis).
 */
export class TecCanvasLegendItem extends TectonElement {
  static styles = [hostStyles, canvasLegendItemStyles]

  /** Colour of the symbol: any CSS colour or paint (`var(--tec-chart-1)`, `#1f77b4`, a gradient). */
  @property() swatch = ""

  override connectedCallback(): void {
    super.connectedCallback()
    this.internals.role = "listitem"
  }

  protected override render() {
    return html`<span class="swatch" part="swatch" aria-hidden="true"
        ><slot name="swatch">${this.swatch ? html`<span class="fill" style=${styleMap({ background: this.swatch })}></span>` : nothing}</slot></span
      ><span class="label" part="label"><slot></slot></span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-canvas": TecCanvas
    "tec-canvas-surface": TecCanvasSurface
    "tec-canvas-overlay": TecCanvasOverlay
    "tec-canvas-toolbar": TecCanvasToolbar
    "tec-canvas-legend": TecCanvasLegend
    "tec-canvas-legend-item": TecCanvasLegendItem
  }
}
