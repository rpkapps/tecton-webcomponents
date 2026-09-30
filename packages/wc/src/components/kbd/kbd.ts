import { html } from "lit"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { kbdGroupStyles, kbdStyles } from "./kbd.styles.js"

/**
 * Renders a `<kbd>` in its shadow root. Inside a tooltip (`tec-tooltip`, or any element with
 * `role="tooltip"`) the key cap uses the tooltip's text colour; the `--tec-kbd-background` /
 * `--tec-kbd-foreground` custom properties override the colours anywhere.
 *
 * @summary Displays a keyboard key or shortcut.
 *
 * @tag tec-kbd
 *
 * @slot - The key label (`⌘`, `Ctrl`, `K`) or a small icon.
 *
 * @csspart base - The `<kbd>` key cap.
 *
 * @cssprop --tec-kbd-background - Key cap background (default `--tec-muted`).
 * @cssprop --tec-kbd-foreground - Key cap text colour (default `--tec-muted-foreground`).
 *
 * @cssstate in-tooltip - The key is inside a tooltip (matching tooltip text and a subtle surface).
 */
export class TecKbd extends TectonElement {
  static styles = [hostStyles, kbdStyles]

  override connectedCallback(): void {
    super.connectedCallback()
    this.toggleState("in-tooltip", !!this.closest("tec-tooltip, tec-tooltip-content, [role=tooltip]"))
  }

  protected override render() {
    return html`<kbd class="base" part="base"><slot></slot></kbd>`
  }
}

/**
 * @summary Groups keys of a shortcut (`Ctrl` `B`), rendered as a `<kbd>` around them.
 *
 * @tag tec-kbd-group
 *
 * @slot - `tec-kbd` elements and separators (`+`, `then`).
 *
 * @csspart base - The `<kbd>` row (gap 0.25rem).
 */
export class TecKbdGroup extends TectonElement {
  static styles = [hostStyles, kbdGroupStyles]
  protected override render() {
    return html`<kbd class="base" part="base"><slot></slot></kbd>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-kbd": TecKbd
    "tec-kbd-group": TecKbdGroup
  }
}
