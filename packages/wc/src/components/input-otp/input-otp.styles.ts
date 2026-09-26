import { css } from "lit"

export const inputOtpStyles = css`
  :host {
    display: flex;
    width: fit-content;
    max-width: 100%;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
  :host(:disabled),
  :host([disabled]) {
    opacity: 0.5;
  }
  .base {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: text;
    user-select: none;
    -webkit-user-select: none;
  }
  /* The real input covers the slots: it takes taps (virtual keyboard), autofill and paste. */
  .input {
    all: unset;
    position: absolute;
    inset: 0;
    z-index: 20;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    font-size: max(16px, 1em);
    letter-spacing: -0.5em;
    cursor: text;
  }
  .input::selection {
    background: transparent;
  }
  .input:disabled {
    cursor: not-allowed;
  }
`

export const inputOtpGroupStyles = css`
  :host {
    display: flex;
  }
  .base {
    display: flex;
    align-items: center;
    border-radius: var(--tec-radius-md);
  }
  :host(:state(invalid)) .base {
    box-shadow: var(--tec-focus-ring-invalid);
  }
`

export const inputOtpSlotStyles = css`
  :host {
    position: relative;
    display: flex;
    width: var(--tec-input-otp-slot-width, 2rem);
    height: var(--tec-input-otp-slot-height, 2rem);
    font-size: var(--tec-input-otp-slot-font-size, var(--tec-text-sm));
  }
  :host(:state(active)) {
    z-index: 10;
  }
  .base {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: 1px solid var(--tec-input);
    border-inline-start-width: 0;
  }
  :host(:first-child) .base {
    border-inline-start-width: 1px;
    border-start-start-radius: var(--tec-radius-md);
    border-end-start-radius: var(--tec-radius-md);
  }
  :host(:last-child) .base {
    border-start-end-radius: var(--tec-radius-md);
    border-end-end-radius: var(--tec-radius-md);
  }
  :host(:state(invalid)) .base {
    border-color: var(--tec-destructive);
  }
  :host(:state(active)) .base {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(active):state(invalid)) .base {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  .caret {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .caret::after {
    content: "";
    width: 1px;
    height: 1rem;
    background-color: var(--tec-foreground);
  }
  @keyframes caret-blink {
    0%,
    70%,
    100% {
      opacity: 1;
    }
    20%,
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, box-shadow, border-color;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
    .caret::after {
      animation: caret-blink 1s ease-out infinite;
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
    :host(:state(active)) .base {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
    .caret::after {
      background-color: CanvasText;
    }
  }
`

export const inputOtpSeparatorStyles = css`
  :host {
    display: flex;
    align-items: center;
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
`
