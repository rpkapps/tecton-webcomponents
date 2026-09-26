import { css } from "lit"

export const copyButtonStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    flex-shrink: 0;
  }
  :host(:state(copied)) .button::part(base) {
    color: var(--tec-success);
  }
  :host(:state(error)) .button::part(base) {
    color: var(--tec-destructive);
  }
`
