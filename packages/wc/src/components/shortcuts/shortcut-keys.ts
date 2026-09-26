import { html, nothing } from "lit"
import { property } from "lit/decorators.js"
import { hostStyles, srOnly } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { kbdStyles } from "./kbd.styles.js"
import { formatShortcut, isMacPlatform } from "./registry.js"
import { shortcutKeysStyles } from "./shortcuts.styles.js"

/** Which keyboard the caps are drawn for. */
export type ShortcutPlatform = "auto" | "mac" | "other"

/**
 * The keys of a chord are joined with "+" (`Ctrl + K`, ⌘ on Apple keyboards), the steps of a
 * sequence with "then" (`G then W`). Screen readers get the same as text ("Ctrl + K", "G, then W");
 * the caps are hidden from them, so no key is read out twice.
 *
 * @summary Renders a shortcut in the registry key syntax as key caps.
 *
 * @tag tec-shortcut-keys
 *
 * @csspart base - The row of caps (hidden from assistive technology).
 * @csspart kbd - Each key cap.
 * @csspart separator - The "+" between the keys of a chord.
 * @csspart then - The "then" between the steps of a sequence.
 */
export class TecShortcutKeys extends TectonElement {
  static styles = [hostStyles, srOnly, kbdStyles, shortcutKeysStyles]

  /** The shortcut, in the registry syntax (`mod+k`, `shift+?`, `g w`). */
  @property() keys = ""

  /** The keyboard to draw: `auto` detects an Apple one (⌘ ⌥ ⇧ ⌃ instead of Ctrl, Alt, Shift). */
  @property() platform: ShortcutPlatform = "auto"

  /** The word between the steps of a sequence. */
  @property({ attribute: "then-label" }) thenLabel = "then"

  protected override render() {
    const isMac = this.platform === "auto" ? isMacPlatform() : this.platform === "mac"
    const chords = formatShortcut(this.keys, isMac)
    if (!chords.length) return nothing
    const spoken = chords.map((chord) => chord.join(" + ")).join(`, ${this.thenLabel} `)
    return html`<span class="base kbd-group" part="base" aria-hidden="true"
        >${chords.map(
          (chord, step) =>
            html`${step > 0 ? html`<span class="text" part="then">${this.thenLabel}</span>` : nothing}${chord.map(
              (cap, index) =>
                html`${index > 0 ? html`<span class="text" part="separator">+</span>` : nothing}<kbd class="kbd" part="kbd">${cap}</kbd>`
            )}`
        )}</span
      ><span class="sr-only">${spoken}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-shortcut-keys": TecShortcutKeys
  }
}
