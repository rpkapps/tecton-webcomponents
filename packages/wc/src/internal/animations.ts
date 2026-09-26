/**
 * @module animations
 * Enter/exit motion equivalent to the tw-animate-css utilities the Tecton spec uses
 * (`animate-in fade-in-0 zoom-in-95 slide-in-from-top-2`, `animate-out fade-out-0 zoom-out-95`),
 * as shadow-root keyframes driven by custom properties, plus {@link animateOut} to let an exit
 * animation finish before an element is hidden.
 *
 * Keyframes are tree-scoped, so include {@link animationStyles} in the shadow root that animates.
 * Everything is wrapped in `prefers-reduced-motion: no-preference`.
 *
 * **Anchored popups** (`PopupController` sets `data-state="open|closed"` and `data-side` on the popup):
 *
 * ```ts
 * static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".content"), styles]
 * ```
 *
 * **Anything else** — set the variables and the animation yourself:
 *
 * ```css
 * .panel[data-state="open"]   { animation: tec-enter var(--tec-duration-fast) var(--tec-ease-out); --tec-enter-opacity: 0; --tec-enter-scale: 0.95; }
 * .panel[data-state="closed"] { animation: tec-exit var(--tec-duration-fast) var(--tec-ease-out) forwards; --tec-exit-opacity: 0; }
 * ```
 *
 * | tw-animate-css | variable |
 * | --- | --- |
 * | `fade-in-0` / `fade-out-0` | `--tec-enter-opacity: 0` / `--tec-exit-opacity: 0` |
 * | `zoom-in-95` / `zoom-out-95` | `--tec-enter-scale: 0.95` / `--tec-exit-scale: 0.95` |
 * | `slide-in-from-top-2` | `--tec-enter-translate-y: -0.5rem` |
 * | `slide-in-from-bottom-2` | `--tec-enter-translate-y: 0.5rem` |
 * | `slide-in-from-left-2` | `--tec-enter-translate-x: -0.5rem` |
 * | `slide-in-from-right-2` | `--tec-enter-translate-x: 0.5rem` |
 */
import { css, unsafeCSS, type CSSResult } from "lit"
import { prefersReducedMotion } from "./styles.js"

/** `@keyframes tec-enter` / `tec-exit` (tw-animate-css `enter` / `exit`). */
export const animationStyles = css`
  @keyframes tec-enter {
    from {
      opacity: var(--tec-enter-opacity, 1);
      transform: translate3d(var(--tec-enter-translate-x, 0), var(--tec-enter-translate-y, 0), 0)
        scale3d(var(--tec-enter-scale, 1), var(--tec-enter-scale, 1), var(--tec-enter-scale, 1));
    }
  }
  @keyframes tec-exit {
    to {
      opacity: var(--tec-exit-opacity, 1);
      transform: translate3d(var(--tec-exit-translate-x, 0), var(--tec-exit-translate-y, 0), 0)
        scale3d(var(--tec-exit-scale, 1), var(--tec-exit-scale, 1), var(--tec-exit-scale, 1));
    }
  }
`

/**
 * The standard Tecton popup motion for `selector` — `data-open:animate-in fade-in-0 zoom-in-95`,
 * `data-closed:animate-out fade-out-0 zoom-out-95`, `data-[side=bottom]:slide-in-from-top-2` (and the
 * other three sides), `duration-100` — keyed on the `data-state` / `data-side` attributes that
 * `PopupController` maintains. `transform-origin` follows the anchor (`--tec-popup-transform-origin`).
 *
 * @param duration CSS time (default `var(--tec-duration-fast)` = 100ms).
 */
export function popupMotion(selector: string, duration = "var(--tec-duration-fast)"): CSSResult {
  const s = unsafeCSS(selector)
  const d = unsafeCSS(duration)
  return css`
    ${s} {
      transform-origin: var(--tec-popup-transform-origin, center);
    }
    @media (prefers-reduced-motion: no-preference) {
      ${s}[data-state="open"] {
        animation: tec-enter ${d} var(--tec-ease-out);
        --tec-enter-opacity: 0;
        --tec-enter-scale: 0.95;
      }
      ${s}[data-state="closed"] {
        animation: tec-exit ${d} var(--tec-ease-out) forwards;
        --tec-exit-opacity: 0;
        --tec-exit-scale: 0.95;
      }
      ${s}[data-state="open"][data-side="bottom"] {
        --tec-enter-translate-y: -0.5rem;
      }
      ${s}[data-state="open"][data-side="top"] {
        --tec-enter-translate-y: 0.5rem;
      }
      ${s}[data-state="open"][data-side="left"] {
        --tec-enter-translate-x: 0.5rem;
      }
      ${s}[data-state="open"][data-side="right"] {
        --tec-enter-translate-x: -0.5rem;
      }
    }
  `
}

/**
 * Waits for the CSS animations currently running on `el` (and, with `subtree`, its shadow/light
 * descendants) to finish. Call it right after switching the element to its exit state, then hide it:
 *
 * ```ts
 * popup.dataset.state = "closed"
 * await animateOut(popup)
 * popup.hidePopover()
 * ```
 *
 * Resolves immediately under `prefers-reduced-motion: reduce`, when nothing animates, or when the
 * element is not rendered; never waits longer than `timeout` ms (default 1000) so a cancelled or
 * infinite animation cannot keep an element on screen.
 */
export async function animateOut(el: Element, options: { subtree?: boolean; timeout?: number } = {}): Promise<void> {
  if (prefersReducedMotion() || !el.isConnected) return
  // getAnimations() flushes style, so an animation started by the state change is already listed.
  const animations = el.getAnimations({ subtree: options.subtree ?? false }).filter((a) => a.playState !== "finished")
  if (!animations.length) return
  const finished = Promise.allSettled(animations.map((a) => a.finished))
  const timeout = new Promise((resolve) => setTimeout(resolve, options.timeout ?? 1000))
  await Promise.race([finished, timeout])
}
