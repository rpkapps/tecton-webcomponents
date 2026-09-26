/**
 * Displays a keyboard shortcut hint (`"mod+k"`, `"?"`, `"g w"`) as key caps, drawn for the platform:
 * `mod` is ⌘ on Apple keyboards and Ctrl elsewhere; chords join their keys with "+", sequences
 * their steps with "then". Screen readers get the same as text ("Ctrl + K", "G, then W"); the caps
 * are hidden from them so no key is read twice.
 *
 * This only *draws* the hint; it binds nothing.
 */
import { css, html, type TemplateResult } from "lit"

const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  esc: "Esc",
  enter: "↵",
  backspace: "⌫",
  delete: "Del",
  tab: "⇥",
  space: "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
}

/** Whether the keyboard is (most likely) an Apple one. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** Display labels of a shortcut: one array of key caps per step of the sequence. */
export function formatShortcut(keys: string, isMac = isMacPlatform()): string[][] {
  return keys
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) => {
      const parts = step.split("+").filter(Boolean)
      if (step.endsWith("+") && step.length > 1) parts.push("+")
      let ctrl = false
      let alt = false
      let shift = false
      let meta = false
      let key = ""
      for (const raw of parts) {
        const part = raw.toLowerCase()
        if (part === "mod") {
          if (isMac) meta = true
          else ctrl = true
        } else if (part === "ctrl" || part === "control") ctrl = true
        else if (part === "alt" || part === "option") alt = true
        else if (part === "shift") shift = true
        else if (part === "meta" || part === "cmd" || part === "command") meta = true
        else key = raw
      }
      const caps: string[] = []
      if (ctrl) caps.push(isMac ? "⌃" : "Ctrl")
      if (alt) caps.push(isMac ? "⌥" : "Alt")
      if (shift) caps.push(isMac ? "⇧" : "Shift")
      if (meta) caps.push(isMac ? "⌘" : "Win")
      if (key) caps.push(KEY_LABELS[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key))
      return caps
    })
}

/** The spoken form of a shortcut ("Ctrl + K", "G, then W"). */
export function spokenShortcut(keys: string, isMac = isMacPlatform()): string {
  return formatShortcut(keys, isMac)
    .map((chord) => chord.join(" + "))
    .join(", then ")
}

/** Key caps (hidden from assistive technology) followed by the spoken text in `.sr-only`. */
export function shortcutKeys(keys: string, options: { spoken?: boolean } = {}): TemplateResult {
  const chords = formatShortcut(keys)
  return html`<span class="keys" part="keys"
    ><span class="caps" aria-hidden="true"
      >${chords.map(
        (chord, step) =>
          html`${step > 0 ? html`<span class="sep">then</span>` : ""}${chord.map(
            (cap, i) => html`${i > 0 ? html`<span class="sep">+</span>` : ""}<kbd class="kbd">${cap}</kbd>`,
          )}`,
      )}</span
    >${options.spoken === false ? "" : html`<span class="sr-only">${spokenShortcut(keys)}</span>`}</span
  >`
}

/** Styles of {@link shortcutKeys} (the Tecton `Kbd` cap). */
export const shortcutKeysStyles = css`
  .keys {
    display: inline-flex;
    align-items: center;
  }
  .caps {
    /* Key chords read left to right in every script (Ctrl + K). */
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .sep {
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    color: var(--tec-muted-foreground);
  }
  .kbd {
    pointer-events: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    height: 1.25rem;
    min-width: 1.25rem;
    padding-inline: 0.25rem;
    border-radius: var(--tec-radius-sm);
    background-color: var(--tec-muted);
    color: var(--tec-muted-foreground);
    font-family: var(--tec-font-sans);
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    user-select: none;
  }
`
