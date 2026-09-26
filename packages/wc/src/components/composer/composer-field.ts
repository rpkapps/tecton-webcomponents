import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerFieldStyles } from "./composer.styles.js"

/**
 * The bordered box around the textarea: it draws the focus ring while the textarea has focus, and
 * the command list opens above it.
 *
 * @summary The composer's box: attachments, the textarea and the toolbar.
 *
 * @tag tec-composer-field
 *
 * @slot - `tec-composer-commands`, `tec-composer-attachments`, `tec-composer-input`, `tec-composer-toolbar`.
 *
 * @csspart base - The bordered box.
 *
 * @cssstate focused - The textarea has focus.
 * @cssstate disabled - The composer is disabled.
 */
export class TecComposerField extends TectonElement {
  static styles = [hostStyles, composerFieldStyles]

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })

  constructor() {
    super()
    this.addEventListener("focusin", this.#syncFocus)
    this.addEventListener("focusout", this.#syncFocus)
  }

  #syncFocus = (event: FocusEvent) => {
    const input = event.composedPath().find((t) => t instanceof Element && t.localName === "tec-composer-input")
    if (!input) return
    this.toggleState("focused", event.type === "focusin")
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.toggleState("disabled", this.#composer.value?.disabled ?? false)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-field": TecComposerField
  }
}
