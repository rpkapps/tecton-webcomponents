import { css, html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { live } from "lit/directives/live.js"
import { Search } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"

/**
 * A `type="search"` field that keeps focus while the arrow keys move a virtual highlight through
 * the `tec-command-list` (`aria-controls` / `aria-activedescendant` are managed by the parent
 * `tec-command`). Named by `label`, else by its placeholder, else "Search".
 *
 * @summary The search field of a `tec-command`.
 *
 * @tag tec-command-input
 *
 * @csspart base - The muted input group (search icon + input).
 * @csspart input - The native `<input type="search">`.
 *
 * @fires input - The search text changed (the native, composed event of the inner input).
 */
export class TecCommandInput extends TectonElement {
  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        font-size: var(--tec-text-sm);
        line-height: var(--tec-text-sm--line-height);
      }
      .wrapper {
        padding: 0.25rem 0.25rem 0;
      }
      .base {
        display: flex;
        height: 2rem;
        align-items: center;
        border: 1px solid transparent;
        border-radius: var(--tec-radius-lg);
        background-color: var(--tec-muted);
      }
      /* Visible focus: the field border takes the input colour (hover shows it too). */
      .base:hover,
      .base:has(input:focus-visible) {
        border-color: var(--tec-input-hover);
      }
      @media (prefers-reduced-motion: no-preference) {
        .base {
          transition: border-color var(--tec-duration-fast) var(--tec-ease);
        }
      }
      .base svg {
        order: -1;
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
        margin-inline-start: 0.5rem;
        opacity: 0.5;
      }
      input {
        all: unset;
        box-sizing: border-box;
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        height: 100%;
        padding-inline: 0.375rem 0.5rem;
        font: inherit;
        color: var(--tec-foreground);
      }
      input::placeholder {
        color: color-mix(in oklab, currentColor 50%, transparent);
      }
      input::-webkit-search-cancel-button {
        display: none;
      }
      input:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      @media (forced-colors: active) {
        .base {
          border-color: CanvasText;
        }
        .base:focus-within {
          outline: 2px solid Highlight;
        }
      }
    `,
  ]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Placeholder text (also the accessible name when there is no `label`). */
  @property() placeholder = ""

  /** Accessible name of the field. */
  @property() label = ""

  /** Disables the field. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** The search text. */
  @property({ attribute: false }) value = ""

  /** The inner `<input>` (the element that holds focus and `aria-activedescendant`). */
  @query("input") readonly input!: HTMLInputElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.input, exclude: ["aria-label", "aria-activedescendant", "aria-controls"] })
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.input.ariaLabel = this.label || this.getAttribute("aria-label") || this.placeholder || "Search"
  }

  #onInput(event: Event) {
    this.value = (event.target as HTMLInputElement).value
  }

  protected override render() {
    return html`<div class="wrapper">
      <div class="base" part="base">
        <input
          part="input"
          type="search"
          aria-autocomplete="list"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          .value=${live(this.value)}
          @input=${this.#onInput}
        />
        ${icon(Search, { size: 16 })}
      </div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-command-input": TecCommandInput
  }
}
