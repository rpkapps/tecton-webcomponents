import { css } from "lit"

/*
 * The element is as thick as the track (4px); thumbs overhang it. Track: 4px, `slider` colour at 60%, fully rounded; range: `slider`; thumbs: 20px `slider` circles
 * with a 4px `slider`/30 ring on hover and the 2px focus ring on keyboard focus. Thumb centres sit on
 * the value (so they overhang the ends of the track by half their size, as in the spec).
 */
export const sliderStyles = css`
  :host {
    --_color: var(--tec-slider-color, var(--tec-slider));

    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  :host([orientation="vertical"]) {
    flex-direction: column;
    width: auto;
    height: 100%;
    min-height: 10rem;
  }
  :host([disabled]),
  :host(:disabled) {
    opacity: 0.5;
  }

  .base {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 0.25rem;
  }
  /* The box is as thick as the track (thumbs overhang it, as in the spec); this widens the pointer target. */
  .base::before {
    content: "";
    position: absolute;
    inset: -0.5rem 0;
  }
  :host([orientation="vertical"]) .base {
    flex: 1 1 auto;
    flex-direction: column;
    justify-content: center;
    width: 0.25rem;
    height: auto;
  }
  :host([orientation="vertical"]) .base::before {
    inset: 0 -0.5rem;
  }

  .track {
    position: relative;
    flex-grow: 1;
    overflow: hidden;
    width: 100%;
    height: 0.25rem;
    border-radius: 9999px;
    background-color: color-mix(in oklab, var(--_color) 60%, transparent);
  }
  :host([orientation="vertical"]) .track {
    width: 0.25rem;
    height: 100%;
  }

  .range {
    position: absolute;
    top: 0;
    bottom: 0;
    background-color: var(--_color);
  }
  :host([orientation="vertical"]) .range {
    top: auto;
    left: 0;
    right: 0;
  }

  .thumb {
    position: absolute;
    top: 50%;
    display: block;
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    background-color: var(--_color);
    transform: translate(-50%, -50%);
    outline: none;
  }
  :host(:dir(rtl)) .thumb {
    transform: translate(50%, -50%);
  }
  :host([orientation="vertical"]) .thumb {
    top: auto;
    left: 50%;
    transform: translate(-50%, 50%);
  }
  .thumb:hover {
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--_color) 30%, transparent);
  }
  .thumb:focus-visible {
    box-shadow: var(--tec-focus-ring);
  }
  :host([disabled]) .thumb,
  :host(:disabled) .thumb {
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .thumb {
      transition-property: color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .track {
      background-color: GrayText;
    }
    .range,
    .thumb {
      background-color: Highlight;
      forced-color-adjust: none;
    }
    .thumb:focus-visible {
      outline: 2px solid CanvasText;
      outline-offset: 2px;
    }
  }
`
