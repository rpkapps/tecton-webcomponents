import { html } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import {
  emptyContentStyles,
  emptyDescriptionStyles,
  emptyHeaderStyles,
  emptyMediaStyles,
  emptyStyles,
  emptyTitleStyles,
} from "./empty.styles.js"

export type EmptyVariant = "default" | "outline" | "muted"
export type EmptyMediaVariant = "default" | "icon"

/**
 * Compose `tec-empty > tec-empty-header > (tec-empty-media, tec-empty-title, tec-empty-description)`
 * and put the next step (buttons, a search field) in `tec-empty-content`. The parts are layout and
 * type only; they add no roles. Use a heading element inside `tec-empty-title` when the empty state
 * heads a region of the page.
 *
 * @summary Displays an empty state: why a list, table or panel has nothing to show and what to do next.
 *
 * @tag tec-empty
 *
 * @slot - A `tec-empty-header` and a `tec-empty-content` (and any trailing link).
 *
 * @csspart base - The centred box (padding, dashed border of the `outline` variant, background of the `muted` variant).
 *
 * @cssprop --tec-empty-radius - Corner radius (default `--tec-radius-lg`).
 * @cssprop --tec-empty-padding - Padding of the box (default 3rem).
 */
export class TecEmpty extends TectonElement {
  static styles = [hostStyles, emptyStyles]

  /** The surface: `default` (none), `outline` (dashed border) or `muted` (a faint muted background). */
  @property({ reflect: true }) variant: EmptyVariant = "default"

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Groups the media, title and description of an empty state.
 *
 * @tag tec-empty-header
 *
 * @slot - `tec-empty-media`, `tec-empty-title`, `tec-empty-description`.
 */
export class TecEmptyHeader extends TectonElement {
  static styles = [hostStyles, emptyHeaderStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * `variant="icon"` puts an icon (or a `tec-spinner`) on a rounded muted tile and sizes it to 24px;
 * the default variant shows an avatar, an avatar group or an illustration at its own size.
 *
 * @summary The icon, avatar or illustration of an empty state.
 *
 * @tag tec-empty-media
 *
 * @slot - The media. Mark icons `aria-hidden="true"`.
 *
 * @csspart base - The media box (the tile of the `icon` variant).
 *
 * @cssprop --tec-icon-size - Size of a slotted icon in the `icon` variant (default 1.5rem).
 */
export class TecEmptyMedia extends TectonElement {
  static styles = [hostStyles, emptyMediaStyles]

  /** `default` (transparent) or `icon` (a 40px muted tile with a 24px icon). */
  @property({ reflect: true }) variant: EmptyMediaVariant = "default"

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary The title of an empty state.
 *
 * @tag tec-empty-title
 *
 * @slot - The title text (or a heading element).
 */
export class TecEmptyTitle extends TectonElement {
  static styles = [hostStyles, emptyTitleStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The description of an empty state. Links in it are underlined.
 *
 * @tag tec-empty-description
 *
 * @slot - The description text.
 */
export class TecEmptyDescription extends TectonElement {
  static styles = [hostStyles, emptyDescriptionStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * @summary The actions of an empty state: buttons, a search field, a help link.
 *
 * @tag tec-empty-content
 *
 * @slot - The actions (stacked; add `class="flex-row justify-center gap-2"` for a row of buttons).
 */
export class TecEmptyContent extends TectonElement {
  static styles = [hostStyles, emptyContentStyles]

  protected override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-empty": TecEmpty
    "tec-empty-header": TecEmptyHeader
    "tec-empty-media": TecEmptyMedia
    "tec-empty-title": TecEmptyTitle
    "tec-empty-description": TecEmptyDescription
    "tec-empty-content": TecEmptyContent
  }
}
