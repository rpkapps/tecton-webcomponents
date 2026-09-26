import { ContextConsumer } from "@lit/context"
import { html, type PropertyValues } from "lit"
import { property } from "lit/decorators.js"
import { focusTargetOf } from "../../internal/focus.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { composerContext } from "./composer-context.js"
import { composerToolbarStyles } from "./composer.styles.js"

/**
 * One tab stop: the arrow keys move between its buttons (mirrored in RTL), Home and End jump.
 * `tec-composer-submit` goes at its end. A press on its empty space focuses the textarea.
 *
 * @summary The row under the textarea: actions, and the send button at its end.
 *
 * @tag tec-composer-toolbar
 *
 * @slot - Buttons (`tec-button variant="ghost" size="icon-sm"` …) and `tec-composer-submit`.
 *
 * @csspart base - The row (padding and layout).
 */
export class TecComposerToolbar extends TectonElement {
  static styles = [hostStyles, composerToolbarStyles]

  /** The toolbar's accessible name (an `aria-label` on the element wins). */
  @property() label = "Message actions"

  #composer = new ContextConsumer(this, { context: composerContext, subscribe: true })

  #roving = new RovingFocusController<HTMLElement>(this, {
    items: () => [...this.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden),
    orientation: "horizontal",
    loop: false,
    focusTarget: focusTargetOf,
  })

  #onClick = (event: MouseEvent) => {
    const pressed = event.composedPath().some((t) => t !== this && t instanceof HTMLElement && this.contains(t))
    if (pressed) return
    this.#composer.value?.composer.focus()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.internals.role = "toolbar"
    this.internals.ariaLabel = this.label
  }

  protected override render() {
    return html`<div class="base" part="base" @click=${this.#onClick}>
      <slot @slotchange=${() => this.#roving.update()}></slot><span class="spacer"></span>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-composer-toolbar": TecComposerToolbar
  }
}
