import { css, html } from "lit"
import { property } from "lit/decorators.js"
import { styleMap } from "lit/directives/style-map.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/**
 * Parses a ratio written as a number (`1.7778`, `1`) or a fraction (`16/9`, `16 / 9`, `16:9`) into a
 * CSS `aspect-ratio` value. Anything else (zero, negative, not a number) gives `null`.
 */
export function parseRatio(value: string | number | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? String(value) : null
  const match = /^\s*([\d.]+)\s*(?:[/:]\s*([\d.]+)\s*)?$/.exec(value)
  if (!match) return null
  const width = Number(match[1])
  const height = match[2] === undefined ? 1 : Number(match[2])
  if (!(width > 0) || !(height > 0)) return null
  return match[2] === undefined ? String(width) : `${width} / ${height}`
}

/**
 * The box keeps its ratio as its width changes: control the width from outside
 * (`class="w-full max-w-sm"`) and let the height follow. It is the containing block of its
 * content, so media fills it with `class="absolute inset-0 size-full object-cover"`.
 *
 * @summary Displays content within a desired ratio.
 *
 * @tag tec-aspect-ratio
 *
 * @slot - The content, usually an `<img>`, `<video>` or `<iframe>` that fills the box.
 *
 * @csspart base - The box that carries the ratio (and positions the content).
 */
export class TecAspectRatio extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        position: relative;
      }
      .base {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
      }
    `,
  ]

  /**
   * Width divided by height: a number (`1.7778`) or a fraction (`16/9`, `16:9`). Defaults to `1`
   * (square); an invalid value also falls back to `1`.
   */
  @property() ratio: string | number = 1

  protected override render() {
    return html`<div class="base" part="base" style=${styleMap({ aspectRatio: parseRatio(this.ratio) ?? "1" })}>
      <slot></slot>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-aspect-ratio": TecAspectRatio
  }
}
