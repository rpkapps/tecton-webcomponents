import { css } from "lit"

export const textareaStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    field-sizing: content;
    min-height: 4rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--tec-textarea-radius, var(--tec-radius-md));
    resize: vertical;
  }
  :host([resize="none"]) .base {
    resize: none;
  }
  :host([resize="horizontal"]) .base {
    resize: horizontal;
  }
  :host([resize="both"]) .base {
    resize: both;
  }
`
