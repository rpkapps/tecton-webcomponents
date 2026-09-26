import { css } from "lit"

/*
 * Avatar parts have no padding, margin or border, so their round box (size, radius, background,
 * ring) is the host itself: document resets (`* { padding: 0; margin: 0; border: 0 }`) do not touch
 * those properties, and colour/size utilities on the element (`class="bg-green-560"` on a badge,
 * `class="size-10"` on an avatar) apply directly. The one border — the hairline ring over the
 * picture — is drawn inside the shadow root.
 *
 * `tec-avatar` publishes private custom properties for its badge and fallback (sizes per avatar
 * size); `tec-avatar-group` does the same for its count bubble.
 */
export const avatarStyles = css`
  :host {
    --_tec-avatar-badge-size: 0.625rem;
    --_tec-avatar-badge-icon-size: 0.5rem;
    --_tec-avatar-badge-icon-display: block;
    --_tec-avatar-fallback-size: var(--tec-text-sm);
    --_tec-avatar-fallback-line-height: var(--tec-text-sm--line-height);
    position: relative;
    display: flex;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    user-select: none;
    -webkit-user-select: none;
  }
  :host([size="sm"]) {
    --_tec-avatar-badge-size: 0.5rem;
    --_tec-avatar-badge-icon-display: none;
    --_tec-avatar-fallback-size: var(--tec-text-xs);
    --_tec-avatar-fallback-line-height: var(--tec-text-xs--line-height);
    width: 1.5rem;
    height: 1.5rem;
  }
  :host([size="lg"]) {
    --_tec-avatar-badge-size: 0.75rem;
    width: 2.5rem;
    height: 2.5rem;
  }
  /* While a picture is shown (or loading), the fallback stays hidden. */
  :host(:state(image)) ::slotted(tec-avatar-fallback) {
    display: none;
  }
  /*
   * The hairline ring over the picture blends with it (darken in light mode, lighten in dark mode).
   * Blend modes cannot follow the colour scheme, so there are two rings: each is transparent in the
   * other scheme.
   */
  .ring {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid transparent;
    pointer-events: none;
  }
  .ring.light {
    border-color: light-dark(var(--tec-border), transparent);
    mix-blend-mode: darken;
  }
  .ring.dark {
    border-color: light-dark(transparent, var(--tec-border));
    mix-blend-mode: lighten;
  }
  @media (forced-colors: active) {
    .ring.light {
      border-color: CanvasText;
      mix-blend-mode: normal;
    }
  }
`

export const avatarImageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    border-radius: 9999px;
    overflow: hidden;
  }
  :host(:state(error)) {
    display: none;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }
`

export const avatarFallbackStyles = css`
  :host {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background-color: var(--tec-avatar);
    color: var(--tec-avatar-foreground);
    font-size: var(--_tec-avatar-fallback-size, var(--tec-text-sm));
    line-height: var(--_tec-avatar-fallback-line-height, var(--tec-text-sm--line-height));
    font-weight: var(--tec-font-weight-medium);
  }
`

export const avatarBadgeStyles = css`
  :host {
    position: absolute;
    inset-inline-end: 0;
    bottom: 0;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--_tec-avatar-badge-size, 0.625rem);
    height: var(--_tec-avatar-badge-size, 0.625rem);
    border-radius: 9999px;
    background-color: var(--tec-primary);
    color: var(--tec-primary-foreground);
    box-shadow: 0 0 0 2px var(--tec-background);
    user-select: none;
    -webkit-user-select: none;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    display: var(--_tec-avatar-badge-icon-display, block);
    width: var(--_tec-avatar-badge-icon-size, 0.5rem);
    height: var(--_tec-avatar-badge-icon-size, 0.5rem);
    pointer-events: none;
  }
  @media (forced-colors: active) {
    :host {
      outline: 1px solid CanvasText;
    }
  }
`

export const avatarGroupStyles = css`
  :host {
    --_tec-avatar-group-count-size: 2rem;
    --_tec-avatar-group-count-icon-size: 1rem;
    display: flex;
  }
  :host(:state(has-sm)) {
    --_tec-avatar-group-count-size: 1.5rem;
    --_tec-avatar-group-count-icon-size: 0.75rem;
  }
  :host(:state(has-lg)) {
    --_tec-avatar-group-count-size: 2.5rem;
    --_tec-avatar-group-count-icon-size: 1.25rem;
  }
  /* Overlap. Important: margins of slotted elements would otherwise lose to document resets. */
  ::slotted(:not(:last-child)) {
    margin-inline-end: calc(-1 * var(--tec-avatar-group-overlap, 0.5rem)) !important;
  }
  ::slotted(tec-avatar) {
    box-shadow: 0 0 0 2px var(--tec-background);
  }
`

export const avatarGroupCountStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--_tec-avatar-group-count-size, 2rem);
    height: var(--_tec-avatar-group-count-size, 2rem);
    border-radius: 9999px;
    background-color: var(--tec-muted);
    color: var(--tec-muted-foreground);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    box-shadow: 0 0 0 2px var(--tec-background);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--_tec-avatar-group-count-icon-size, 1rem);
    height: var(--_tec-avatar-group-count-icon-size, 1rem);
    pointer-events: none;
  }
`
