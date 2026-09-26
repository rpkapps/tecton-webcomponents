import { html, nothing, type PropertyValues } from "lit"
import { property, query, state } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { LightDomObserver } from "../../internal/light-dom-observer.js"
import {
  avatarBadgeStyles,
  avatarFallbackStyles,
  avatarGroupCountStyles,
  avatarGroupStyles,
  avatarImageStyles,
  avatarStyles,
} from "./avatar.styles.js"

export type AvatarSize = "default" | "sm" | "lg"
export type AvatarImageStatus = "loading" | "loaded" | "error"

/**
 * Compose it from a `tec-avatar-image`, a `tec-avatar-fallback` (initials, shown when there is no
 * picture or it fails to load) and an optional `tec-avatar-badge`. While the image is loading or
 * shown, the fallback is hidden. The avatar itself has no role: the image's `alt` (or the fallback
 * text) is what assistive technology reads.
 *
 * @summary An image element with a fallback for representing the user.
 *
 * @tag tec-avatar
 *
 * @slot - `tec-avatar-image`, `tec-avatar-fallback` and `tec-avatar-badge`.
 *
 * @csspart ring - The hairline ring drawn over the picture.
 *
 * @cssprop --tec-avatar-radius - Corner radius of the avatar, its picture and its fallback (default fully round, `9999px`).
 *
 * @cssstate image - A `tec-avatar-image` is loading or loaded (the fallback is hidden).
 */
export class TecAvatar extends TectonElement {
  static styles = [hostStyles, avatarStyles]

  /** The size: `sm` 24px, `default` 32px, `lg` 40px. The badge and the fallback text follow it. */
  @property({ reflect: true }) size: AvatarSize = "default"

  constructor() {
    super()
    new LightDomObserver(this, () => this.syncImage())
  }

  /** Re-reads the state of the slotted image (called by `tec-avatar-image` when it changes). @internal */
  syncImage(): void {
    const image = this.querySelector<TecAvatarImage>(":scope > tec-avatar-image")
    this.toggleState("image", !!image && image.status !== "error")
  }

  protected override render() {
    return html`<slot></slot><span class="ring light" part="ring"></span><span class="ring dark"></span>`
  }
}

/**
 * Tracks its loading state (`status`, and the custom states `loading`, `loaded`, `error`) and hides
 * itself when the picture fails to load or `src` is empty, so the avatar shows its fallback. Fires
 * `load` and `error` like a native `<img>` (they do not bubble).
 *
 * @summary The picture of an avatar.
 *
 * @tag tec-avatar-image
 *
 * @csspart image - The native `<img>`.
 *
 * @cssstate loading - The picture is loading.
 * @cssstate loaded - The picture loaded.
 * @cssstate error - There is no `src` or it failed to load (the element is hidden).
 *
 * @fires load - The picture loaded.
 * @fires error - The picture failed to load.
 */
export class TecAvatarImage extends TectonElement {
  static styles = [hostStyles, avatarImageStyles]

  /** The picture URL. */
  @property() src = ""

  /** Alternative text. Empty (the default) marks the picture decorative; set it when the picture carries the identity. */
  @property() alt = ""

  /** CORS mode of the request, like the native attribute. */
  @property() crossorigin?: "anonymous" | "use-credentials"

  /** Referrer policy of the request, like the native attribute. */
  @property() referrerpolicy?: ReferrerPolicy

  @state() private _status: AvatarImageStatus = "error"

  @query("img") private _img?: HTMLImageElement | null

  /** The loading state of the picture. */
  get status(): AvatarImageStatus {
    return this._status
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("src")) this._status = this.src ? "loading" : "error"
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    // A cached picture may be complete before the load listener runs.
    const img = this._img
    if (changed.has("src") && img?.complete && this._status === "loading") {
      this.#settle(img.naturalWidth > 0 ? "loaded" : "error")
    }
    if (changed.has("_status")) {
      for (const name of ["loading", "loaded", "error"]) this.toggleState(name, this._status === name)
      const avatar = this.parentElement as TecAvatar | null
      if (avatar?.localName === "tec-avatar") avatar.syncImage?.()
    }
  }

  #settle(status: AvatarImageStatus): void {
    if (this._status === status) return
    this._status = status
    if (status === "loaded") this.dispatchEvent(new Event("load"))
    else this.dispatchEvent(new Event("error"))
  }

  protected override render() {
    if (!this.src) return nothing
    return html`<img
      part="image"
      src=${this.src}
      alt=${this.alt}
      crossorigin=${ifDefined(this.crossorigin)}
      referrerpolicy=${ifDefined(this.referrerpolicy)}
      @load=${() => this.#settle("loaded")}
      @error=${() => this.#settle("error")}
    />`
  }
}

/**
 * Shown when the avatar has no `tec-avatar-image`, or when its picture fails to load.
 *
 * @summary The initials (or icon) shown in place of the avatar picture.
 *
 * @tag tec-avatar-fallback
 *
 * @slot - Initials or an icon.
 */
export class TecAvatarFallback extends TectonElement {
  static styles = [hostStyles, avatarFallbackStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Sits on the bottom end corner of the avatar and scales with its size (the icon is hidden in `sm`
 * avatars). Recolour it with `--tec-avatar-badge-color`, using a Tecton colour
 * (`style="--tec-avatar-badge-color: var(--tecton-palette-green-560)"`). The dot is visual only: set
 * `label` (e.g. "Online") to have it announced.
 *
 * @summary A status dot on an avatar, optionally with a small icon.
 *
 * @tag tec-avatar-badge
 *
 * @slot - An optional icon.
 *
 * @cssprop --tec-avatar-badge-color - Background of the dot (default `--tec-primary`).
 * @cssprop --tec-avatar-badge-foreground - Colour of the icon (default `--tec-primary-foreground`).
 */
export class TecAvatarBadge extends TectonElement {
  static styles = [hostStyles, avatarBadgeStyles]

  /** Accessible text for the status (the badge is then exposed as an image with this name). */
  @property() label?: string

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (changed.has("label")) {
      this.internals.role = this.label ? "img" : null
      this.internals.ariaLabel = this.label || null
    }
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * Overlaps its avatars and outlines each with the page background. A closing
 * `tec-avatar-group-count` takes the size of the avatars (`size="sm"` / `size="lg"`).
 *
 * @summary A row of overlapping avatars.
 *
 * @tag tec-avatar-group
 *
 * @slot - `tec-avatar` elements and a closing `tec-avatar-group-count`.
 *
 * @cssprop --tec-avatar-group-overlap - How far each avatar overlaps the next (0.5rem).
 *
 * @cssstate has-sm - An avatar uses `size="sm"`.
 * @cssstate has-lg - An avatar uses `size="lg"`.
 */
export class TecAvatarGroup extends TectonElement {
  static styles = [hostStyles, avatarGroupStyles]

  constructor() {
    super()
    new LightDomObserver(
      this,
      () => {
        const lg = !!this.querySelector("tec-avatar[size=lg]")
        this.toggleState("has-lg", lg)
        this.toggleState("has-sm", !lg && !!this.querySelector("tec-avatar[size=sm]"))
      },
      { childList: true, subtree: true, attributes: true, attributeFilter: ["size"] }
    )
  }

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The "+N" bubble that closes an avatar group.
 *
 * @tag tec-avatar-group-count
 *
 * @slot - The count (`+3`) or an icon.
 */
export class TecAvatarGroupCount extends TectonElement {
  static styles = [hostStyles, avatarGroupCountStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-avatar": TecAvatar
    "tec-avatar-image": TecAvatarImage
    "tec-avatar-fallback": TecAvatarFallback
    "tec-avatar-badge": TecAvatarBadge
    "tec-avatar-group": TecAvatarGroup
    "tec-avatar-group-count": TecAvatarGroupCount
  }
}
