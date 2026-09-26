/**
 * @module styles
 * Shared Lit style fragments. Lit shares one constructable stylesheet per `css` result across every
 * shadow root that adopts it, so importing these costs nothing per instance.
 *
 * ```ts
 * static styles = [hostStyles, focusRing(".base"), styles]
 * ```
 */
import { css, unsafeCSS, type CSSResult } from "lit"

/**
 * Include first in every component: border-box sizing, font/colour inheritance for form controls
 * rendered in the shadow root, and `[hidden]` support for the host and its internals.
 *
 * It does **not** set the host `display`; every component sets its own (`:host { display: … }`).
 */
export const hostStyles = css`
  :host {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }
  :host([hidden]),
  [hidden] {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
    margin: 0;
  }
  svg {
    flex-shrink: 0;
  }
`

/**
 * Focus ring for `selector` (`focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring`):
 * the Tecton ring shadow in normal colours, and a system-coloured `outline` under
 * `forced-colors: active` (where box-shadows are not painted).
 *
 * ```ts
 * static styles = [hostStyles, focusRing(".control"), styles]
 * ```
 *
 * @param selector   The element that receives focus (a shadow-internal selector or `:host`).
 * @param trigger    The pseudo-class that shows the ring. `:focus-visible` (default); use
 *                   `:focus-within` for composite wrappers.
 */
export function focusRing(selector: string, trigger = ":focus-visible"): CSSResult {
  const target = unsafeCSS(selector === ":host" ? `:host(${trigger})` : `${selector}${trigger}`)
  return css`
    ${target} {
      outline: none;
      border-color: var(--tec-ring);
      box-shadow: var(--tec-focus-ring);
    }
    @media (forced-colors: active) {
      ${target} {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  `
}

/** {@link focusRing} for any element with the `focus-ring` class. */
export const focusRingStyles = focusRing(".focus-ring")

/**
 * The `.sr-only` utility (visually hidden, still announced). Use for hidden labels, and for live text
 * such as "Dismiss" buttons.
 */
export const srOnly = css`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }
`

/**
 * Wraps `styles` in `@media (prefers-reduced-motion: no-preference)`, so animations and transitions
 * only run for users who have not asked for reduced motion.
 *
 * ```ts
 * motionSafe(css`.base { transition: background-color var(--tec-duration) var(--tec-ease); }`)
 * ```
 */
export function motionSafe(styles: CSSResult): CSSResult {
  return css`
    @media (prefers-reduced-motion: no-preference) {
      ${styles}
    }
  `
}

/** Whether the user asked for reduced motion (`prefers-reduced-motion: reduce`). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Wraps `styles` in `@media (forced-colors: active)` (Windows High Contrast and similar). Use it to
 * keep borders and state indicators visible with system colours (`CanvasText`, `Highlight`,
 * `GrayText`, `ButtonText`).
 */
export function forcedColors(styles: CSSResult): CSSResult {
  return css`
    @media (forced-colors: active) {
      ${styles}
    }
  `
}

/**
 * Sizes slotted icons the way the Tecton spec does (`[&_svg:not([class*='size-'])]:size-4`):
 * top-level slotted `<svg>`, `<tec-icon>` and lucide `<i>`/`<svg>` elements get
 * `var(--tec-icon-size)` and never shrink or catch pointer events. Set `--tec-icon-size` on the host
 * (it inherits into slotted `tec-icon`s as well).
 */
export const slottedIconStyles = css`
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size, 1rem);
    height: var(--tec-icon-size, 1rem);
    flex-shrink: 0;
    pointer-events: none;
  }
`
