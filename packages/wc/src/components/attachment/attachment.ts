import { ContextConsumer, ContextProvider, createContext } from "@lit/context"
import { html, LitElement, type PropertyValues } from "lit"
import { property, query } from "lit/decorators.js"
import { ifDefined } from "lit/directives/if-defined.js"
import { AriaDelegateController } from "../../internal/aria.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { TecButton, type ButtonSize, type ButtonVariant } from "../button/button.js"
import {
  attachmentActionsStyles,
  attachmentContentStyles,
  attachmentDescriptionStyles,
  attachmentGroupStyles,
  attachmentMediaStyles,
  attachmentStyles,
  attachmentTitleStyles,
  attachmentTriggerStyles,
} from "./attachment.styles.js"
import { ScrollFadeController } from "./scroll-fade.js"

export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done"
export type AttachmentSize = "default" | "sm" | "xs"
export type AttachmentOrientation = "horizontal" | "vertical"
export type AttachmentMediaVariant = "icon" | "image"

/** What `tec-attachment` shares with its parts. */
interface AttachmentContextValue {
  state: AttachmentState
  size: AttachmentSize
  orientation: AttachmentOrientation
}

const attachmentContext = createContext<AttachmentContextValue | undefined>(Symbol("tec-attachment"))

/**
 * The card has no role of its own: its name and metadata are text, `tec-attachment-action`s are
 * buttons (label each one with the action and the file, `aria-label="Remove report.pdf"`), and a
 * `tec-attachment-trigger` makes the whole card open a link or a dialog while the actions stay
 * separately focusable and clickable above it. Keep the failure reason of an `error` state in the
 * description so it is not conveyed by colour alone.
 *
 * @summary Displays a file or image attachment with media, metadata, upload state and actions.
 *
 * @tag tec-attachment
 *
 * @slot - `tec-attachment-media`, `tec-attachment-content`, `tec-attachment-actions` and optionally a `tec-attachment-trigger`.
 *
 * @csspart base - The card (border, radius, padding, background).
 *
 * @cssstate has-media - The attachment has a `tec-attachment-media`.
 * @cssstate has-content - The attachment has a `tec-attachment-content`.
 * @cssstate has-trigger - The attachment has a `tec-attachment-trigger` (the card highlights on hover).
 */
export class TecAttachment extends TectonElement {
  static styles = [hostStyles, attachmentStyles]

  /** The upload state: `idle` (dashed border), `uploading` / `processing` (the title shimmers), `error` (destructive tint), `done`. */
  @property({ reflect: true }) state: AttachmentState = "done"

  /** The size. */
  @property({ reflect: true }) size: AttachmentSize = "default"

  /** Lays the media beside (`horizontal`) or above (`vertical`) the content. */
  @property({ reflect: true }) orientation: AttachmentOrientation = "horizontal"

  #provider = new ContextProvider(this, { context: attachmentContext, initialValue: undefined })

  #syncParts = () => {
    const has = (tag: string) => [...this.children].some((c) => c.localName === tag)
    this.toggleState("has-media", has("tec-attachment-media"))
    this.toggleState("has-content", has("tec-attachment-content"))
    this.toggleState("has-trigger", has("tec-attachment-trigger"))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#syncParts()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    this.#provider.setValue({ state: this.state, size: this.size, orientation: this.orientation }, true)
  }

  protected override render() {
    return html`<div class="base" part="base"><slot @slotchange=${this.#syncParts}></slot></div>`
  }
}

/** Base of the parts that read the surrounding attachment. */
class AttachmentPart extends TectonElement {
  protected attachment = new ContextConsumer(this, { context: attachmentContext, subscribe: true })

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    const ctx = this.attachment.value
    const state = ctx?.state ?? "done"
    for (const s of ["idle", "uploading", "processing", "error", "done"] as const) this.toggleState(s, state === s)
    this.toggleState("busy", state === "uploading" || state === "processing")
    this.toggleState("vertical", ctx?.orientation === "vertical")
    this.toggleState("size-sm", ctx?.size === "sm")
    this.toggleState("size-xs", ctx?.size === "xs")
  }
}

/**
 * With `variant="image"`, put an `<img>` with a meaningful `alt` inside; the image is dimmed until
 * the attachment is `done` (or `idle`). Icons are decorative (`aria-hidden="true"`).
 *
 * @summary The media of an attachment: a file-type icon, a spinner or an image preview.
 * @tag tec-attachment-media
 * @slot - An icon (`<svg>`, `tec-icon`), a `tec-spinner`, or an `<img>`.
 * @csspart base - The square frame.
 * @cssprop --tec-icon-size - Size of the icon (1rem; 1.5rem when vertical; 0.875rem at `xs`).
 */
export class TecAttachmentMedia extends AttachmentPart {
  static styles = [hostStyles, attachmentMediaStyles]

  /** `icon` (a glyph on a muted square) or `image` (an `<img>` filling the square). */
  @property({ reflect: true }) variant: AttachmentMediaVariant = "icon"

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary Wraps the title and the description of an attachment.
 * @tag tec-attachment-content
 * @slot - `tec-attachment-title` and `tec-attachment-description`.
 * @csspart base - The wrapper.
 */
export class TecAttachmentContent extends AttachmentPart {
  static styles = [hostStyles, attachmentContentStyles]
  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

/**
 * @summary The file name of an attachment. Truncated to one line; shimmers while the attachment is `uploading` or `processing`.
 * @tag tec-attachment-title
 * @slot - The file name.
 * @csspart base - The truncated line.
 * @cssstate busy - The attachment is uploading or processing (the title shimmers, unless reduced motion is requested).
 */
export class TecAttachmentTitle extends AttachmentPart {
  static styles = [hostStyles, attachmentTitleStyles]
  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

/**
 * @summary Secondary metadata of an attachment: type, size, upload progress or the failure reason.
 * @tag tec-attachment-description
 * @slot - The metadata text.
 * @csspart base - The truncated line.
 * @cssstate error - The attachment failed (destructive colour).
 */
export class TecAttachmentDescription extends AttachmentPart {
  static styles = [hostStyles, attachmentDescriptionStyles]
  protected override render() {
    return html`<span class="base" part="base"><slot></slot></span>`
  }
}

/**
 * Sits above the `tec-attachment-trigger`, so the actions stay clickable over a full-card trigger.
 * In a vertical attachment the actions float over the top end corner of the media.
 *
 * @summary The actions of an attachment (remove, retry, download).
 * @tag tec-attachment-actions
 * @slot - `tec-attachment-action` elements.
 * @cssstate vertical - The attachment is vertical.
 */
export class TecAttachmentActions extends AttachmentPart {
  static styles = [hostStyles, attachmentActionsStyles]
  protected override render() {
    return html`<slot></slot>`
  }
}

/**
 * A `tec-button` with the attachment defaults (`variant="ghost"`, `size="icon-xs"`). It is usually
 * icon-only: give it an `aria-label` naming the action and the file (`"Remove report.pdf"`).
 *
 * @summary An action button of an attachment.
 * @tag tec-attachment-action
 */
export class TecAttachmentAction extends TecButton {
  constructor() {
    super()
    this.variant = "ghost" satisfies ButtonVariant
    this.size = "icon-xs" satisfies ButtonSize
  }
}

/**
 * The trigger has no text of its own: give it an `aria-label` for what activating it does
 * (`"Preview report.pdf"`, `"Open workspace.png"`). With `href` it renders a link; otherwise a
 * button (listen for `click`, e.g. to open a dialog).
 *
 * @summary A transparent full-card control that opens the attachment.
 * @tag tec-attachment-trigger
 * @csspart base - The `<button>` (or `<a>` with `href`) covering the card.
 */
export class TecAttachmentTrigger extends TectonElement {
  static styles = [hostStyles, attachmentTriggerStyles]
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  /** Renders the trigger as a link to this URL. */
  @property({ reflect: true }) href?: string

  /** Link target (with `href`). */
  @property() target?: string

  /** Link `rel` (with `href`). Defaults to `noreferrer noopener` for `target="_blank"`. */
  @property() rel?: string

  @query(".base") private control!: HTMLElement

  constructor() {
    super()
    new AriaDelegateController(this, { target: () => this.control })
  }

  /** Activates the trigger (a link navigates, a button fires `click`). */
  override click(): void {
    this.control?.click()
  }

  protected override render() {
    if (this.href !== undefined) {
      return html`<a
        class="base"
        part="base"
        href=${this.href}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel ?? (this.target === "_blank" ? "noreferrer noopener" : undefined))}
      ></a>`
    }
    return html`<button class="base" part="base" type="button"></button>`
  }
}

/**
 * The row scrolls horizontally with snapping and fades its edges while there is more to scroll. When
 * the attachments are interactive, keyboard users reach off-screen ones by tabbing; for a row of
 * presentational attachments make the group itself scrollable from the keyboard with
 * `tabindex="0"`, `role="group"` and an `aria-label`.
 *
 * @summary Lays out attachments in a horizontally scrollable, snapping row.
 * @tag tec-attachment-group
 * @slot - `tec-attachment` elements.
 * @csspart base - The row inside the scroll container.
 */
export class TecAttachmentGroup extends TectonElement {
  static styles = [hostStyles, attachmentGroupStyles]

  constructor() {
    super()
    new ScrollFadeController(this, { axis: "x", content: () => this.renderRoot?.querySelector?.(".base") })
  }

  protected override render() {
    return html`<div class="base" part="base"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-attachment": TecAttachment
    "tec-attachment-group": TecAttachmentGroup
    "tec-attachment-media": TecAttachmentMedia
    "tec-attachment-content": TecAttachmentContent
    "tec-attachment-title": TecAttachmentTitle
    "tec-attachment-description": TecAttachmentDescription
    "tec-attachment-actions": TecAttachmentActions
    "tec-attachment-action": TecAttachmentAction
    "tec-attachment-trigger": TecAttachmentTrigger
  }
}
