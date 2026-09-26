import { css, html, nothing, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { X } from "lucide"
import { animateOut, animationStyles } from "../../internal/animations.js"
import { deepActiveElement } from "../../internal/focus.js"
import { icon } from "../../internal/icons.js"
import { lockScroll, unlockScroll } from "../../internal/scroll-lock.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecCommand } from "./command.js"

/** Why the dialog opened or closed. */
export type CommandDialogOpenChangeReason = "escape" | "outside" | "select" | "close-button"

/** Detail of `tec-open-change`. */
export interface CommandDialogOpenChangeDetail {
  open: boolean
  reason: CommandDialogOpenChangeReason
}

/**
 * A modal `<dialog>` (top layer, inert page, scroll lock) holding a `tec-command`, placed a third
 * of the way down the viewport. Opening clears the search and focuses it; Escape (with an empty
 * search), a press on the backdrop or activating an item closes it, and focus returns to where it
 * was. The dialog is named by `label` and described by `description` (visually hidden).
 *
 * Open it from a button (`dialog.show()`) or a global shortcut (see the examples).
 *
 * @summary A command palette in a modal dialog.
 *
 * @tag tec-command-dialog
 *
 * @slot - The `tec-command`.
 *
 * @csspart base - The `<dialog>` surface.
 * @csspart close - The close button (`close-button`).
 *
 * @cssprop --tec-command-dialog-width - Maximum width of the dialog (default 28rem from 40rem viewports).
 *
 * @fires tec-open-change - The user closed the dialog (Escape, backdrop press, item activation, close button). Cancelable. `detail: { open, reason }`.
 */
export class TecCommandDialog extends TectonElement {
  static styles = [
    hostStyles,
    srOnly,
    animationStyles,
    css`
      :host {
        display: contents;
      }
      dialog {
        position: fixed;
        inset: auto;
        top: 33.333%;
        left: 50%;
        translate: -50% 0;
        box-sizing: border-box;
        width: 100%;
        max-width: calc(100% - 2rem);
        max-height: calc(66.666% - 1rem);
        margin: 0;
        padding: 0;
        border: 0;
        overflow: hidden;
        border-radius: var(--tec-radius-xl);
        background-color: var(--tec-popover);
        color: var(--tec-popover-foreground);
        font-family: var(--tec-font-sans);
        font-size: var(--tec-text-sm);
        line-height: var(--tec-text-sm--line-height);
        text-align: start;
        box-shadow: 0 0 0 1px color-mix(in oklab, var(--tec-foreground) 10%, transparent);
        outline: none;
      }
      @media (min-width: 40rem) {
        dialog {
          max-width: var(--tec-command-dialog-width, 28rem);
        }
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
      }
      dialog::backdrop {
        background-color: color-mix(in oklab, var(--tecton-palette-black, #000) 10%, transparent);
        backdrop-filter: blur(4px);
      }
      ::slotted(tec-command) {
        flex: 1 1 auto;
        min-height: 0;
      }
      .close {
        all: unset;
        box-sizing: border-box;
        position: absolute;
        top: 1rem;
        inset-inline-end: 1rem;
        display: inline-flex;
        width: 1.75rem;
        height: 1.75rem;
        align-items: center;
        justify-content: center;
        border-radius: var(--tec-radius-md);
        color: var(--tec-ghost-foreground);
      }
      .close:hover {
        background-color: var(--tec-ghost-hover);
        color: var(--tec-ghost-hover-foreground);
      }
      .close:focus-visible {
        box-shadow: var(--tec-focus-ring);
      }
      .close svg {
        width: 1rem;
        height: 1rem;
      }
      @media (prefers-reduced-motion: no-preference) {
        dialog[data-state="open"] {
          animation: tec-enter var(--tec-duration-fast) var(--tec-ease-out);
          --tec-enter-opacity: 0;
          --tec-enter-scale: 0.95;
        }
        dialog[data-state="closed"] {
          animation: tec-exit var(--tec-duration-fast) var(--tec-ease-out) forwards;
          --tec-exit-opacity: 0;
          --tec-exit-scale: 0.95;
        }
      }
      @media (forced-colors: active) {
        dialog {
          border: 1px solid CanvasText;
        }
      }
    `,
  ]

  /** Whether the dialog is open. */
  @property({ type: Boolean, reflect: true }) open = false

  /** Accessible name of the dialog (visually hidden title). */
  @property() label = "Command Palette"

  /** Accessible description of the dialog (visually hidden). */
  @property() description = "Search for a command to run..."

  /** Shows a close button in the corner. */
  @property({ type: Boolean, attribute: "close-button" }) closeButton = false

  /** Accessible name of the close button. */
  @property({ attribute: "close-label" }) closeLabel = "Close"

  @query("dialog") private _dialog!: HTMLDialogElement

  #restore: HTMLElement | null = null

  constructor() {
    super()
    this.addEventListener("tec-select", (event) => {
      // Let every listener run (and maybe cancel) before closing.
      queueMicrotask(() => {
        if (!event.defaultPrevented) this.#requestOpen(false, "select")
      })
    })
  }

  /** The `tec-command` inside. */
  get command(): TecCommand | null {
    return this.querySelector("tec-command")
  }

  /** Opens the dialog (no event). */
  show(): void {
    this.open = true
  }

  /** Closes the dialog (no event). */
  hide(): void {
    this.open = false
  }

  /** Toggles the dialog (no event). */
  toggle(): void {
    this.open = !this.open
  }

  #requestOpen(open: boolean, reason: CommandDialogOpenChangeReason): void {
    if (open === this.open) return
    if (this.emit<CommandDialogOpenChangeDetail>("tec-open-change", { detail: { open, reason }, cancelable: true })) this.open = open
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    unlockScroll(this)
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("open")) {
      if (this.open) this.#show()
      else if (changed.get("open") === true) void this.#hide()
    }
  }

  #show(): void {
    const dialog = this._dialog
    if (!dialog || dialog.open) return
    this.#restore = deepActiveElement() as HTMLElement | null
    this.command?.reset()
    dialog.dataset.state = "open"
    dialog.showModal()
    lockScroll(this)
    const command = this.command
    if (command) void command.updateComplete.then(() => command.focus())
  }

  async #hide(): Promise<void> {
    const dialog = this._dialog
    if (!dialog?.open) return
    dialog.dataset.state = "closed"
    await animateOut(dialog)
    if (this.open) return
    dialog.close()
    unlockScroll(this)
    const restore = this.#restore
    this.#restore = null
    if (restore?.isConnected) restore.focus({ preventScroll: true })
  }

  #onCancel(event: Event) {
    // Escape: close through the cancelable event (and the exit animation).
    event.preventDefault()
    this.#requestOpen(false, "escape")
  }

  #onClose() {
    // Closed by the browser (e.g. a repeated Escape): sync the state.
    if (this.open) {
      this.open = false
      unlockScroll(this)
    }
  }

  #onClick(event: MouseEvent) {
    if (event.target !== this._dialog) return
    const rect = this._dialog.getBoundingClientRect()
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    if (!inside) this.#requestOpen(false, "outside")
  }

  protected override render() {
    return html`<dialog
      part="base"
      aria-labelledby="title"
      aria-describedby="description"
      @cancel=${this.#onCancel}
      @close=${this.#onClose}
      @click=${this.#onClick}
    >
      <h2 id="title" class="sr-only">${this.label}</h2>
      <p id="description" class="sr-only">${this.description}</p>
      <slot></slot>
      ${this.closeButton
        ? html`<button class="close" part="close" type="button" aria-label=${this.closeLabel} @click=${() => this.#requestOpen(false, "close-button")}>
            ${icon(X, { size: 16 })}
          </button>`
        : nothing}
    </dialog>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-command-dialog": TecCommandDialog
  }
}
