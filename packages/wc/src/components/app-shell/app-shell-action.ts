import { css, html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { EllipsisVertical, Search } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecButton } from "../button/button.js"
import { describeShortcut } from "../shortcuts/registry.js"
import type { TecTooltip } from "../tooltip/tooltip.js"

/* Key chords read left to right in every script (Ctrl + K). */
const keysDirectionStyles = css`
  tec-shortcut-keys {
    direction: ltr;
    unicode-bidi: isolate;
  }
`

/*
 * The icon buttons of the header are `tec-button`s (ghost, icon-sm) rendered in the shadow root;
 * `text-muted-foreground hover:text-foreground` is applied through their public `base` part.
 */
const quietButtonStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .button::part(base) {
    color: var(--tec-muted-foreground);
  }
  .button:hover::part(base),
  .button:state(focus-visible)::part(base),
  .button[aria-expanded="true"]::part(base) {
    color: var(--tec-foreground);
  }
  .button svg {
    width: 1rem;
    height: 1rem;
  }
`

/*
 * The tooltip is a `tec-tooltip` rendered in the shadow root around the button. Its bubble and the
 * key caps of `tec-shortcut-keys` are styled through their public parts: the caps invert inside the
 * bubble and the bubble tightens its end padding around them, like `tec-kbd` in a tooltip.
 */
const tooltipStyles = css`
  .tooltip.has-keys::part(tooltip) {
    padding-inline-end: 0.375rem;
  }
  .tip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .keys {
    margin-inline-start: 0.25rem;
  }
  .keys::part(kbd) {
    background-color: light-dark(
      color-mix(in oklab, var(--tec-background) 20%, transparent),
      color-mix(in oklab, var(--tec-background) 10%, transparent)
    );
    color: var(--tec-background);
  }
  .keys::part(separator),
  .keys::part(then) {
    color: inherit;
    opacity: 0.7;
  }
`

/**
 * The button is a ghost icon button (`tec-button`, `icon-sm`) in muted colours; `label` is its
 * accessible name and the text of its `tec-tooltip` (placed below it), which opens on hover and on
 * keyboard focus (not on a mouse press), closes on leave, blur, press and Escape, and shares the
 * page's tooltip timing (moving between actions switches the tooltip at once). `shortcut` adds the
 * key hint to the tooltip (a `tec-shortcut-keys`, drawn for the platform) and to the button's
 * description; it binds nothing — register the key with a `tec-shortcut`.
 *
 * It can be the `slot="trigger"` of a `tec-dropdown-menu` or `tec-popover`: `aria-expanded` and
 * `aria-haspopup` set on it reach the inner button.
 *
 * @summary An icon action of the shell header with a tooltip.
 *
 * @tag tec-app-shell-action
 *
 * @slot - The icon (`<svg>` or `tec-icon`, sized 16px).
 *
 * @csspart button - The inner `tec-button`.
 * @csspart tooltip - The tooltip bubble (the `content` part of the inner `tec-tooltip`, top layer).
 * @csspart tooltip-arrow - The tooltip's arrow.
 * @csspart keys - The `tec-shortcut-keys` in the tooltip.
 *
 * @cssstate tooltip-open - The tooltip is shown.
 */
export class TecAppShellAction extends TectonElement {
  static styles = [hostStyles, keysDirectionStyles, quietButtonStyles, tooltipStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Accessible name of the button and text of the tooltip (required). */
  @property() label = ""

  /** Key hint shown in the tooltip, in shortcut syntax (`"mod+k"`, `"?"`, `"g w"`); `mod` is ⌘ or Ctrl. */
  @property() shortcut = ""

  /** Disables the button (no tooltip either). */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".button") protected button!: TecButton
  @query(".tooltip") private tooltip!: TecTooltip

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.button, exclude: ["aria-label", "aria-description"] })
  }

  /** Clicks the inner button. */
  override click(): void {
    this.button?.click()
  }

  /*
   * The tooltip belongs to the action: its `tec-open-change` stays inside (a menu the action
   * triggers must not see it), and its state is mirrored as `:state(tooltip-open)`.
   */
  #onTooltipChange = (event: Event) => {
    event.stopPropagation()
    void this.tooltip?.updateComplete.then(() => this.toggleState("tooltip-open", !!this.tooltip?.open))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("disabled") && this.disabled) this.toggleState("tooltip-open", false)
  }

  protected override render() {
    // The label is the button's name already: inside the tooltip it is hidden from assistive
    // technology, so the description (the key hint) never repeats it.
    return html`<tec-tooltip
      class="tooltip ${this.shortcut ? "has-keys" : ""}"
      side="bottom"
      exportparts="content:tooltip, arrow:tooltip-arrow"
      ?disabled=${this.disabled}
      @tec-open-change=${this.#onTooltipChange}
    >
      <tec-button
        slot="trigger"
        class="button"
        part="button"
        variant="ghost"
        size="icon-sm"
        ?disabled=${this.disabled}
        aria-label=${this.label || nothing}
        aria-description=${this.shortcut ? describeShortcut(this.shortcut) : nothing}
        ><slot></slot
      ></tec-button>
      <span class="tip"
        ><span aria-hidden="true">${this.label}</span>${this.shortcut
          ? html`<tec-shortcut-keys class="keys" part="keys" keys=${this.shortcut}></tec-shortcut-keys>`
          : nothing}</span
      >
    </tec-tooltip>`
  }
}

const commandTriggerStyles = css`
  :host {
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: normal;
    white-space: nowrap;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: min(var(--tec-radius-md), 10px);
    background-color: transparent;
    background-clip: padding-box;
    color: var(--tec-muted-foreground);
    font: inherit;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }
  .base:hover {
    background-color: var(--tec-outline-hover);
    border-color: var(--tec-outline-hover-border);
    color: var(--tec-foreground);
  }
  .base:focus-visible {
    outline: none;
    background-color: var(--tec-outline-hover);
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
    color: var(--tec-foreground);
  }
  .base:active {
    background-color: var(--tec-outline-pressed);
    border-color: var(--tec-outline-pressed-border);
  }
  .base[aria-expanded="true"] {
    background-color: var(--tec-outline-active);
    border-color: var(--tec-outline-active-border);
    color: var(--tec-foreground);
  }
  .base:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .label {
    display: none;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
  }
  .keys {
    display: none;
    pointer-events: none;
  }
  @media (width >= 48rem) {
    .base {
      justify-content: flex-start;
      width: 10rem;
      margin-inline-end: 0.25rem;
      padding-inline: 0.5rem;
      border-color: var(--tec-border);
      background-color: color-mix(in oklab, var(--tec-muted) 40%, transparent);
    }
    .icon {
      width: 0.875rem;
      height: 0.875rem;
    }
    .label {
      display: inline;
    }
  }
  @media (width >= 64rem) {
    .base {
      width: 14rem;
    }
    .keys {
      display: inline-flex;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition-property: color, background-color, border-color, box-shadow;
      transition-duration: var(--tec-duration);
      transition-timing-function: var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: ButtonText;
    }
    .base:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`

/**
 * A search-field look from the `md` breakpoint up (the key hint shows from `lg`), an icon button
 * below it. The accessible name is `aria-label` if set, else the slotted text, else "Search". It
 * fires a native `click`; open the command palette from there. The hint defaults to `mod+k` drawn
 * for the platform (⌘ K on Apple keyboards, Ctrl + K elsewhere) and binds nothing — register the key
 * with the application's shortcut handling.
 *
 * @summary The command palette trigger of the shell header.
 *
 * @tag tec-app-shell-command-trigger
 *
 * @slot - The placeholder text (default "Search").
 *
 * @csspart base - The native `<button>`.
 * @csspart keys - The key hint (a `tec-shortcut-keys`).
 */
export class TecAppShellCommandTrigger extends TectonElement {
  static styles = [hostStyles, keysDirectionStyles, commandTriggerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Key hint at the end, in shortcut syntax. */
  @property() shortcut = "mod+k"

  /** Hides the key hint. */
  @property({ type: Boolean, attribute: "hide-shortcut" }) hideShortcut = false

  /** Disables the trigger. */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".base") readonly control!: HTMLButtonElement
  @state() private text = ""

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control, exclude: ["aria-label"] })
    new MutationObserver(() => this.requestUpdate()).observe(this, { attributes: true, attributeFilter: ["aria-label"] })
  }

  override click(): void {
    this.control?.click()
  }

  #onSlotChange = (event: Event) => {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    this.text = nodes.map((n) => n.textContent ?? "").join("").trim()
  }

  protected override render() {
    const label = this.getAttribute("aria-label") || this.text || "Search"
    return html`<button class="base" part="base" type="button" ?disabled=${this.disabled} aria-label=${label}>
      ${icon(Search, { class: "icon", size: 16 })}
      <span class="label"><slot @slotchange=${this.#onSlotChange}>Search</slot></span>
      ${this.shortcut && !this.hideShortcut
        ? html`<tec-shortcut-keys class="keys" part="keys" keys=${this.shortcut} aria-hidden="true"></tec-shortcut-keys>`
        : nothing}
    </button>`
  }
}

/**
 * The ghost icon button with a vertical ellipsis that opens the "More" menu of a narrow header. Put
 * it in `slot="trigger"` of a `tec-dropdown-menu` (`align="end"`) holding the actions that the header
 * hides below a breakpoint.
 *
 * @summary The trigger of the shell header's overflow menu.
 *
 * @tag tec-app-shell-overflow-trigger
 *
 * @csspart button - The inner `tec-button`.
 */
export class TecAppShellOverflowTrigger extends TectonElement {
  static styles = [hostStyles, quietButtonStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Accessible name of the button. */
  @property() label = "More"

  @query(".button") protected button!: TecButton

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.button, exclude: ["aria-label"] })
  }

  override click(): void {
    this.button?.click()
  }

  protected override render() {
    return html`<tec-button class="button" part="button" variant="ghost" size="icon-sm" aria-label=${this.label}
      >${icon(EllipsisVertical, { size: 16 })}</tec-button
    >`
  }
}

const userMenuTriggerStyles = css`
  .wrap {
    display: inline-flex;
    margin-inline-start: 0.25rem;
  }
  .button {
    --tec-button-radius: 9999px;
  }
`

/** Initials of a name: the first letters of the first and last words ("Sarah Elliott" → "SE"). */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ""
  const first = [...words[0]][0] ?? ""
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : ""
  return (first + last).toLocaleUpperCase()
}

/**
 * A round ghost button showing the signed-in user's small `tec-avatar` (the image, or the initials
 * on the avatar surface when there is none or it fails to load). Its accessible name is
 * "Account: <name>". Put it in `slot="trigger"` of a `tec-dropdown-menu` (`align="end"`) with the
 * account items.
 *
 * @summary The trigger of the shell header's user menu.
 *
 * @tag tec-app-shell-user-menu-trigger
 *
 * @csspart button - The inner round `tec-button`.
 * @csspart avatar - The 24px `tec-avatar` (`size="sm"`).
 */
export class TecAppShellUserMenuTrigger extends TectonElement {
  static styles = [hostStyles, quietButtonStyles, userMenuTriggerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** The user's name (accessible name "Account: <name>"). */
  @property() name = ""

  /** Initials shown without an image. Default: derived from `name`. */
  @property() initials = ""

  /** URL of the user's picture. */
  @property() image = ""

  /** Accessible name of the button. Default: "Account: <name>". */
  @property() label = ""

  @query(".button") protected button!: TecButton

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.button, exclude: ["aria-label"] })
  }

  override click(): void {
    this.button?.click()
  }

  protected override render() {
    const label = this.label || (this.name ? `Account: ${this.name}` : "Account")
    return html`<span class="wrap"
      ><tec-button class="button" part="button" variant="ghost" size="icon-sm" aria-label=${label}
        ><tec-avatar class="avatar" part="avatar" size="sm"
          >${this.image ? html`<tec-avatar-image src=${this.image} alt=""></tec-avatar-image>` : nothing}<tec-avatar-fallback
            >${this.initials || initialsOf(this.name)}</tec-avatar-fallback
          ></tec-avatar
        ></tec-button
      ></span
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-app-shell-action": TecAppShellAction
    "tec-app-shell-command-trigger": TecAppShellCommandTrigger
    "tec-app-shell-overflow-trigger": TecAppShellOverflowTrigger
    "tec-app-shell-user-menu-trigger": TecAppShellUserMenuTrigger
  }
}
