import { css } from "lit"

/*
 * The host carries the size (`class="h-4 w-full"`) and the corner radius — radius is not touched by
 * CSS resets, so `class="rounded-full"` on the element works — and the base fills it, inheriting
 * the radius.
 */
export const skeletonStyles = css`
  :host {
    display: block;
    flex-shrink: 0;
    border-radius: var(--tec-skeleton-radius, var(--tec-radius-md));
  }
  .base {
    display: block;
    width: 100%;
    height: 100%;
    min-height: inherit;
    border-radius: inherit;
    background-color: var(--tec-muted);
  }
  @keyframes tec-skeleton-pulse {
    50% {
      opacity: 0.5;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      animation: tec-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  }
  @media (forced-colors: active) {
    .base {
      border: 1px dashed GrayText;
    }
  }
`
