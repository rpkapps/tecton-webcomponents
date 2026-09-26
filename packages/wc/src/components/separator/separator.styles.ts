import { css } from "lit"

/*
 * The rule is the `.line` element(s) inside `part="base"`; the host only sizes itself
 * (`w-full h-px` horizontally, `w-px self-stretch` vertically, like the spec).
 */
export const separatorStyles = css`
  :host {
    --_color: var(--tec-border);
    display: block;
    flex-shrink: 0;
    width: 100%;
    height: 1px;
  }
  :host([orientation="vertical"]) {
    width: 1px;
    height: auto;
    align-self: stretch;
  }
  :host([emphasis="subtle"]) {
    --_color: var(--tec-border-subtle);
  }
  :host([emphasis="strong"]) {
    --_color: var(--tec-border-strong);
  }

  .base {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
  }
  .line {
    display: block;
    flex: 1 1 0%;
    align-self: stretch;
    background-color: var(--_color);
  }
  .label,
  .line.end {
    display: none;
  }

  /* ---------------------------------------------------------------- labelled */
  :host(:state(labelled)) {
    height: auto;
    color: var(--tec-muted-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
  }
  :host(:state(labelled)) .base {
    gap: 0.75rem;
  }
  :host(:state(labelled)) .label,
  :host(:state(labelled)) .line.end {
    display: block;
  }
  :host(:state(labelled)) .line {
    align-self: center;
    height: 1px;
  }
  :host(:state(labelled)[orientation="vertical"]) {
    width: auto;
  }
  :host(:state(labelled)[orientation="vertical"]) .base {
    flex-direction: column;
    gap: 0.5rem;
  }
  :host(:state(labelled)[orientation="vertical"]) .line {
    width: 1px;
    height: auto;
  }
  :host(:state(labelled)[align-label="start"]) .line.start,
  :host(:state(labelled)[align-label="end"]) .line.end {
    flex: 0 0 1rem;
  }

  @media (forced-colors: active) {
    .line {
      background-color: CanvasText;
    }
  }
`
