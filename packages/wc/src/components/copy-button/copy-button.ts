import { html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { Check, Copy, X } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { HasSlotController } from "../../internal/slot.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { ButtonSize, ButtonVariant, TecButton } from "../button/button.js"
import { copyButtonStyles } from "./copy-button.styles.js"

/** The feedback state. */
export type CopyStatus = "idle" | "copied" | "error"

/** Detail of `tec-copy`. */
export interface CopyDetail {
  value: string
}

/** Detail of `tec-copy-error`. */
export interface CopyErrorDetail {
  error: unknown
}

/**
 * One polite live region at the end of the body, shared by every copy button: a region beside each
 * button would be an extra sibling in button groups and toolbars, and one inside the button is
 * flattened into the button's name. Inline styles, so it stays hidden without any stylesheet.
 */
let liveRegion: HTMLElement | null = null

function announce(message: string): void {
  if (typeof document === "undefined") return
  if (!liveRegion?.isConnected) {
    liveRegion = document.createElement("div")
    liveRegion.dataset.tecCopyButtonAnnouncer = ""
    liveRegion.setAttribute("aria-live", "polite")
    liveRegion.setAttribute("aria-atomic", "true")
    Object.assign(liveRegion.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      padding: "0",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
      border: "0",
    })
    document.body.append(liveRegion)
  }
  const region = liveRegion
  // Emptied first and filled a moment later: a region that was just created is not tracked yet, and
  // a second "Copied" in a row must still be a change.
  region.textContent = ""
  setTimeout(() => {
    region.textContent = message
  }, 100)
}

/**
 * A `tec-button` that writes `value` to the clipboard. It then shows a check (success colour) for
 * `timeout` ms, or a cross (destructive colour) when the clipboard refuses the write (insecure
 * context, denied permission, no Clipboard API). Either outcome is announced through one shared
 * polite live region ("Copied" / "Copy failed"). Without a label the button is icon-only and names
 * itself "Copy", then "Copied" / "Copy failed" while the state lasts; an `aria-label` on the host
 * wins over that.
 *
 * @summary Copies a value to the clipboard with visual and announced feedback.
 *
 * @tag tec-copy-button
 *
 * @slot - An optional label ("Copy link"); the size then defaults to `sm` instead of `icon-sm`. Don't slot an icon: the component draws it.
 *
 * @csspart button - The inner `tec-button`.
 * @csspart base - The native `<button>` inside it.
 * @csspart icon - The copy / check / cross icon.
 *
 * @cssstate copied - The value was just copied.
 * @cssstate error - The last copy failed.
 *
 * @fires tec-copy - The value was written to the clipboard. `detail: { value }`.
 * @fires tec-copy-error - The clipboard refused the write. `detail: { error }`.
 */
export class TecCopyButton extends TectonElement {
  static styles = [hostStyles, copyButtonStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The text written to the clipboard. */
  @property() value = ""

  /** How long (ms) the check or the cross is shown. */
  @property({ type: Number }) timeout = 2000

  /** The button variant. */
  @property({ reflect: true }) variant: ButtonVariant = "ghost"

  /** The button size. Defaults to `icon-sm`, or `sm` when the button has a label. */
  @property({ reflect: true }) size?: ButtonSize

  /** Disables the button. */
  @property({ type: Boolean, reflect: true }) disabled = false

  /** Accessible name of the icon-only button at rest. */
  @property({ attribute: "copy-label" }) copyLabel = "Copy"

  /** Announced (and the icon-only button's name) after a successful copy. */
  @property({ attribute: "copied-label" }) copiedLabel = "Copied"

  /** Announced (and the icon-only button's name) after a failed copy. */
  @property({ attribute: "error-label" }) errorLabel = "Copy failed"

  /** The current feedback state. */
  @state() status: CopyStatus = "idle"

  @property({ attribute: "aria-label" }) private _hostLabel: string | null = null

  @query(".button") private _button!: TecButton

  #slots = new HasSlotController(this, "[default]")
  #timer?: ReturnType<typeof setTimeout>

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this._button?.control, exclude: ["aria-label"] })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    clearTimeout(this.#timer)
    this.status = "idle"
  }

  /** Clicks the inner button (copies). */
  override click(): void {
    this._button?.click()
  }

  #show(status: Exclude<CopyStatus, "idle">): void {
    this.status = status
    announce(status === "copied" ? this.copiedLabel : this.errorLabel)
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => (this.status = "idle"), this.timeout)
  }

  #onClick = async () => {
    if (this.disabled) return
    const value = this.value
    try {
      // Throws, rather than rejects, where the Clipboard API is missing.
      await navigator.clipboard.writeText(value)
    } catch (error) {
      this.#show("error")
      this.emit<CopyErrorDetail>("tec-copy-error", { detail: { error } })
      return
    }
    this.#show("copied")
    this.emit<CopyDetail>("tec-copy", { detail: { value } })
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.toggleState("copied", this.status === "copied")
    this.toggleState("error", this.status === "error")
  }

  protected override render() {
    const labelled = this.#slots.test("[default]")
    const size = this.size ?? (labelled ? "sm" : "icon-sm")
    const name = this._hostLabel ?? (labelled ? undefined : this.status === "copied" ? this.copiedLabel : this.status === "error" ? this.errorLabel : this.copyLabel)
    const node = this.status === "copied" ? Check : this.status === "error" ? X : Copy
    return html`<tec-button
      class="button"
      part="button"
      exportparts="base"
      variant=${this.variant}
      size=${size}
      ?disabled=${this.disabled}
      aria-label=${ifDefined(name ?? undefined)}
      data-status=${this.status === "idle" ? nothing : this.status}
      @click=${this.#onClick}
      >${icon(node, { size: 16, part: "icon" })}<slot></slot
    ></tec-button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-copy-button": TecCopyButton
  }
}
