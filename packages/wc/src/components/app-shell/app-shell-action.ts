import { css, html, LitElement, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { EllipsisVertical, Search } from "lucide"
import { AriaDelegateController } from "../../internal/aria.js"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { icon } from "../../internal/icons.js"
import { PopupController, popupStyles } from "../../internal/popup.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { TecButton } from "../button/button.js"
import { shortcutKeys, shortcutKeysStyles, spokenShortcut } from "./shortcut-keys.js"

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

const tooltipStyles = css`
  .tooltip {
    box-sizing: border-box;
    align-items: center;
    gap: 0.375rem;
    width: max-content;
    max-width: 20rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-foreground);
    color: var(--tec-background);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: normal;
    text-align: start;
    white-space: normal;
    pointer-events: none;
    overflow: visible;
  }
  .tooltip:popover-open {
    display: inline-flex;
  }
  .tooltip.has-keys {
    padding-inline-end: 0.375rem;
  }
  .tooltip .keys {
    margin-inline-start: 0.25rem;
  }
  .tooltip .kbd {
    position: relative;
    background-color: light-dark(
      color-mix(in oklab, var(--tec-background) 20%, transparent),
      color-mix(in oklab, var(--tec-background) 10%, transparent)
    );
    color: var(--tec-background);
  }
  .tooltip .sep {
    color: inherit;
    opacity: 0.7;
  }
  .arrow {
    position: absolute;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 2px;
    background-color: var(--tec-foreground);
    rotate: 45deg;
    z-index: -1;
  }
  .arrow[data-side="bottom"] {
    top: 0;
    translate: 0 -50%;
  }
  .arrow[data-side="top"] {
    bottom: 0;
    translate: 0 50%;
  }
  .arrow[data-side="left"] {
    right: 0;
    translate: 50% 0;
  }
  .arrow[data-side="right"] {
    left: 0;
    translate: -50% 0;
  }
  @media (forced-colors: active) {
    .tooltip {
      border: 1px solid CanvasText;
    }
    .arrow {
      display: none;
    }
  }
`

/**
 * The button is a ghost icon button (`tec-button`, `icon-sm`) in muted colours; `label` is its
 * accessible name and the text of its tooltip, which opens on hover and on keyboard focus (not on a
 * mouse press) and closes on leave, blur, press and Escape. `shortcut` adds the key hint to the
 * tooltip (drawn for the platform) and to the button's description; it binds nothing — register the
 * key with the application's shortcut handling.
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
 * @csspart tooltip - The tooltip (top layer).
 * @csspart keys - The key caps of the shortcut in the tooltip.
 *
 * @cssstate tooltip-open - The tooltip is shown.
 */
export class TecAppShellAction extends TectonElement {
  static styles = [hostStyles, srOnly, popupStyles, animationStyles, popupMotion(".tooltip"), shortcutKeysStyles, quietButtonStyles, tooltipStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Accessible name of the button and text of the tooltip (required). */
  @property() label = ""

  /** Key hint shown in the tooltip, in shortcut syntax (`"mod+k"`, `"?"`, `"g w"`); `mod` is ⌘ or Ctrl. */
  @property() shortcut = ""

  /** Disables the button (no tooltip either). */
  @property({ type: Boolean, reflect: true }) disabled = false

  @query(".button") protected button!: TecButton
  @query(".tooltip") private tooltip!: HTMLElement
  @query(".arrow") private arrow!: HTMLElement
  @state() private tooltipOpen = false

  #popup = new PopupController(this, {
    popup: () => this.tooltip,
    trigger: () => this.button,
    haspopup: false,
    expanded: false,
    placement: () => ({ side: "bottom", align: "center", sideOffset: 4 }),
    arrow: () => this.arrow,
    focus: { initial: "none", restore: false },
    dismiss: { escape: true, outsidePress: false },
    onRequestClose: () => (this.tooltipOpen = false),
  })

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.button, exclude: ["aria-label", "aria-description"] })
    this.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch" && !this.disabled) this.tooltipOpen = true
    })
    this.addEventListener("pointerleave", () => (this.tooltipOpen = false))
    this.addEventListener("pointerdown", () => (this.tooltipOpen = false))
    this.addEventListener("focusin", () => {
      // Keyboard focus only (focus-visible), like React Aria's tooltip trigger.
      queueMicrotask(() => {
        if (!this.disabled && this.button?.matches(":state(focus-visible)")) this.tooltipOpen = true
      })
    })
    this.addEventListener("focusout", () => (this.tooltipOpen = false))
  }

  /** Clicks the inner button. */
  override click(): void {
    this.button?.click()
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("disabled") && this.disabled) this.tooltipOpen = false
    if (changed.has("tooltipOpen")) {
      void this.#popup.setOpen(this.tooltipOpen)
      this.toggleState("tooltip-open", this.tooltipOpen)
    }
  }

  protected override render() {
    return html`<tec-button
        class="button"
        part="button"
        variant="ghost"
        size="icon-sm"
        ?disabled=${this.disabled}
        aria-label=${this.label || nothing}
        aria-description=${this.shortcut ? spokenShortcut(this.shortcut) : nothing}
        ><slot></slot
      ></tec-button>
      <div class="tooltip ${this.shortcut ? "has-keys" : ""}" part="tooltip" popover="manual" role="tooltip" aria-hidden="true">
        ${this.label}${this.shortcut ? shortcutKeys(this.shortcut, { spoken: false }) : nothing}
        <div class="arrow"></div>
      </div>`
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
 * @csspart keys - The key hint.
 */
export class TecAppShellCommandTrigger extends TectonElement {
  static styles = [hostStyles, srOnly, shortcutKeysStyles, commandTriggerStyles]
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
      ${this.shortcut && !this.hideShortcut ? shortcutKeys(this.shortcut, { spoken: false }) : nothing}
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
  :host {
    display: inline-flex;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .wrap {
    display: inline-flex;
    margin-inline-start: 0.25rem;
  }
  .button {
    --tec-button-radius: 9999px;
  }
  .avatar {
    position: relative;
    display: flex;
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    user-select: none;
  }
  .avatar::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    border: 1px solid color-mix(in oklab, var(--tec-border) 60%, transparent);
  }
  .image {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    border-radius: 9999px;
    object-fit: cover;
  }
  .fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background-color: var(--tec-avatar);
    color: var(--tec-avatar-foreground);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
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
 * A round ghost button showing the signed-in user's avatar (the image, or the initials on the
 * avatar surface when there is none or it fails to load). Its accessible name is
 * "Account: <name>". Put it in `slot="trigger"` of a `tec-dropdown-menu` (`align="end"`) with the
 * account items.
 *
 * @summary The trigger of the shell header's user menu.
 *
 * @tag tec-app-shell-user-menu-trigger
 *
 * @csspart button - The inner round `tec-button`.
 * @csspart avatar - The 24px avatar.
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
  @state() private imageFailed = false

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.button, exclude: ["aria-label"] })
  }

  override click(): void {
    this.button?.click()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("image")) this.imageFailed = false
  }

  protected override render() {
    const label = this.label || (this.name ? `Account: ${this.name}` : "Account")
    const showImage = this.image && !this.imageFailed
    return html`<span class="wrap"
      ><tec-button class="button" part="button" variant="ghost" size="icon-sm" aria-label=${label}
        ><span class="avatar" part="avatar"
          >${showImage
            ? html`<img class="image" src=${this.image} alt="" @error=${() => (this.imageFailed = true)} />`
            : html`<span class="fallback">${this.initials || initialsOf(this.name)}</span>`}</span
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
