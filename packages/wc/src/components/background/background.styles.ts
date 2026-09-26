import { css } from "lit"

/**
 * Styles of `<tec-background>`: the layer itself (absolute, behind the content, no pointer events),
 * the tone/intensity/speed variables and the ink derived from them, the pause and reduced-motion
 * rules, the keyframes the effects use, and the few HTML parts of the effects (grid, hexagon cells,
 * pressure blobs, horizon).
 */
export const backgroundStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
    z-index: -10;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;

    /* Attribute-driven defaults (tone="neutral", intensity="medium", speed="normal"). */
    --_tone: var(--tec-foreground);
    --_alpha: 0.16;
    --_duration: 36s;

    --bg-tone: var(--tec-background-tone, var(--_tone));
    --bg-alpha: var(--tec-background-alpha, var(--_alpha));
    --bg-duration: var(--tec-background-duration, var(--_duration));
    --bg-ink: color-mix(in oklab, var(--bg-tone) calc(var(--bg-alpha) * 100%), transparent);
    --bg-ink-soft: color-mix(in oklab, var(--bg-tone) calc(var(--bg-alpha) * 45%), transparent);
    --bg-ink-strong: color-mix(in oklab, var(--bg-tone) calc(var(--bg-alpha) * 180%), transparent);

    /* Public read-only aliases, for custom effects slotted into the layer. */
    --tec-background-ink: var(--bg-ink);
    --tec-background-ink-soft: var(--bg-ink-soft);
    --tec-background-ink-strong: var(--bg-ink-strong);
  }

  :host([tone="primary"]) {
    --_tone: var(--tec-primary);
  }
  :host([tone="azure"]) {
    --_tone: var(--tec-chart-1);
  }
  :host([tone="saffron"]) {
    --_tone: var(--tec-chart-2);
  }
  :host([tone="lime"]) {
    --_tone: var(--tec-chart-3);
  }
  :host([tone="blue"]) {
    --_tone: var(--tec-chart-4);
  }

  :host([intensity="low"]) {
    --_alpha: 0.08;
  }
  :host([intensity="high"]) {
    --_alpha: 0.32;
  }

  :host([speed="slow"]) {
    --_duration: 60s;
  }
  :host([speed="fast"]) {
    --_duration: 18s;
  }

  .base {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* Frozen on the static frame: static attribute, off screen / hidden tab, reduced motion. */
  :host([static]) .base *,
  .base[data-paused] * {
    animation-play-state: paused !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .base * {
      animation-play-state: paused !important;
    }
  }
  @media print, (forced-colors: active) {
    :host {
      display: none !important;
    }
  }

  .fill {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  svg {
    display: block;
    overflow: hidden;
  }

  /* Contour: 3rem of overshoot on every side for the wander. */
  .contour {
    position: absolute;
    inset: -3rem;
    width: calc(100% + 6rem);
    height: calc(100% + 6rem);
  }

  /* Drill: a 2000px bit centred in the layer. */
  .drill {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2000px;
    height: 2000px;
    translate: -50% -50%;
  }

  /* Pointer reveal: the layer shows through a circle around the pointer while it is over the parent. */
  .reveal {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .pointer[data-hover] > .reveal {
    opacity: 1;
  }
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .grid-node {
    position: absolute;
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 9999px;
    translate: -50% -50%;
    background: var(--bg-ink-strong);
  }

  .hex-cell {
    position: absolute;
    translate: -50% -50%;
    background: var(--bg-ink);
  }

  .blob {
    position: absolute;
    aspect-ratio: 1 / 1;
    border-radius: 9999px;
    background: radial-gradient(circle, var(--bg-ink), var(--bg-ink-soft) 45%, transparent 70%);
    filter: blur(24px);
  }

  .horizon-sky {
    position: absolute;
    inset-inline: 0;
    top: 0;
    height: 62%;
    background: linear-gradient(to bottom, transparent 30%, var(--bg-ink-soft));
    animation: tecton-bg-breathe calc(var(--bg-duration) * 1.5) ease-in-out infinite;
  }
  .horizon-line {
    position: absolute;
    inset-inline: 0;
    top: 62%;
    height: 1px;
    background: var(--bg-ink-strong);
  }
  .horizon-ground {
    position: absolute;
    inset-inline: 0;
    top: 62%;
    bottom: 0;
    background:
      repeating-linear-gradient(to bottom, var(--bg-ink-soft) 0 1px, transparent 1px 14px),
      linear-gradient(to bottom, var(--bg-ink), transparent 70%);
    animation: tecton-bg-breathe calc(var(--bg-duration) * 1.5) ease-in-out infinite;
    animation-delay: -10s;
  }

  @keyframes tecton-bg-drift-x {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(calc(-1 * var(--bg-tile-w)));
    }
  }
  @keyframes tecton-bg-wander {
    0% {
      transform: translate(0, 0);
    }
    50% {
      transform: translate(-40px, -24px);
    }
    100% {
      transform: translate(0, 0);
    }
  }
  @keyframes tecton-bg-breathe {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes tecton-bg-pulse {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes tecton-bg-flow {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: calc(-1 * var(--bg-dash, 260px));
    }
  }
  @keyframes tecton-bg-rotate {
    from {
      transform: rotate(0);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes tecton-bg-migrate {
    0% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(6%, -5%) scale(1.08);
    }
    66% {
      transform: translate(-5%, 5%) scale(0.94);
    }
    100% {
      transform: translate(0, 0) scale(1);
    }
  }
  @keyframes tecton-bg-ripple {
    from {
      transform: scale(0.05);
      opacity: 1;
    }
    to {
      transform: scale(1);
      opacity: 0;
    }
  }
`
