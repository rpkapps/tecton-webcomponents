import { css } from "lit"

export const progressStyles = css`
  /* The host is the layout box (\`flex flex-wrap gap-3\`): layout classes on the element apply to it. */
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .base {
    display: contents;
  }
  .track {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 0.25rem;
    overflow: hidden;
    border-radius: 0;
    background-color: color-mix(in oklab, var(--tec-progress) 38%, transparent);
  }
  .indicator {
    display: block;
    height: 100%;
    background-color: var(--tec-progress);
  }

  /*
   * Indeterminate: a 40% segment slides from the start edge to the end edge (logical inset, so it
   * follows RTL). Under reduced motion the bar is full and still, like the reference.
   */
  :host([indeterminate]) .indicator {
    width: 100%;
  }
  @keyframes tec-progress-indeterminate {
    from {
      inset-inline-start: -40%;
    }
    to {
      inset-inline-start: 100%;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .indicator {
      transition: width var(--tec-duration-slow) var(--tec-ease);
    }
    :host([indeterminate]) .indicator {
      position: absolute;
      inset-block: 0;
      width: 40%;
      transition: none;
      animation: tec-progress-indeterminate 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    }
  }
  @media (forced-colors: active) {
    .track {
      outline: 1px solid CanvasText;
    }
    .indicator {
      background-color: Highlight;
      forced-color-adjust: none;
    }
  }
`

export const progressLabelStyles = css`
  :host {
    display: inline-block;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
  }
`

export const progressValueStyles = css`
  :host {
    display: inline-block;
    /* ml-auto: a margin on the host would be reset by page CSS, so the value grows and aligns to the end. */
    flex: 1 1 auto;
    text-align: end;
    color: var(--tec-muted-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-variant-numeric: tabular-nums;
  }
`
