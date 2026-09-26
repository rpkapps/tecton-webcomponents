/**
 * The keyboard shortcut registry: a plain object with no DOM or framework dependency, so a host shell
 * can create one, listen for keys once, and hand it to the applications it mounts (micro-frontends),
 * which register their own shortcuts against it and get them listed in the shell's help and command
 * palette.
 *
 * Key syntax: chords are `+`-separated (`mod+k`, `shift+?`, `alt+enter`), sequences are
 * space-separated (`g w`). `mod` is ⌘ on macOS and Ctrl elsewhere.
 *
 * The {@link ShortcutRegistry} shape and the {@link Shortcut} fields are versioned public API: they
 * only change in a major version, so a registry can cross a micro-frontend boundary between
 * applications built against different versions of `@tecton/wc`.
 */

/** One keyboard shortcut. */
export interface Shortcut {
  /** Stable id; registering the same id again replaces the earlier one. */
  id: string
  /** Key chord or sequence, e.g. `"mod+k"`, `"?"`, `"g w"`. */
  keys: string
  /** Shown in shortcut lists. */
  label: string
  /** Heading the shortcut is listed under (default "General"). */
  group?: string
  onAction: (event: KeyboardEvent) => void
  /**
   * Fire while typing in an input, textarea or editable element. Defaults to true for chords with
   * Ctrl / ⌘ / Alt and false otherwise.
   */
  allowInInput?: boolean
  /** Skip the shortcut (and let the key through) when this returns false. */
  isEnabled?: () => boolean
  /** Keep the shortcut out of lists. */
  hidden?: boolean
  /**
   * Fire again while the key is held (auto-repeat). Default false: a held key fires once, so a toggle
   * does not flicker; the repeats are still swallowed so the browser's own action does not run either.
   */
  allowRepeat?: boolean
}

/** The registry (see the module documentation). */
export interface ShortcutRegistry {
  /** Registers one or more shortcuts; returns a function that removes them. */
  register: (shortcut: Shortcut | Shortcut[]) => () => void
  unregister: (id: string) => void
  /** Registered shortcuts, in registration order. */
  getAll: () => Shortcut[]
  subscribe: (listener: () => void) => () => void
  /** Dispatches a key event; returns true when a shortcut handled it. */
  handleKeyDown: (event: KeyboardEvent) => boolean
}

interface Chord {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** Shift may or may not be held for symbol keys such as `?`. */
  looseShift: boolean
}

/** A pressed chord: the character typed and, where it hides the key, the physical key. */
interface PressedChord extends Chord {
  /**
   * The key from `event.code` (`KeyK` → `k`, `Digit1` → `1`), set only when the character typed is
   * not the key's own: Option on a Mac turns K into "˚", Shift turns 1 into "!", a non-Latin layout
   * types "л". Everything else matches by character, so other Latin layouts keep their letters.
   */
  code?: string
}

const SEQUENCE_TIMEOUT = 1000

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  space: " ",
  spacebar: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  plus: "+",
}

/** Whether the keyboard is an Apple one, so ⌘ is shown (and `mod` means ⌘) where others use Ctrl. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
}

function parseChord(source: string, isMac: boolean): Chord {
  const parts = source.split("+").filter(Boolean)
  const chord: Chord = { key: "", ctrl: false, alt: false, shift: false, meta: false, looseShift: false }
  for (const raw of parts) {
    const part = raw.toLowerCase()
    if (part === "mod") {
      if (isMac) chord.meta = true
      else chord.ctrl = true
    } else if (part === "ctrl" || part === "control") chord.ctrl = true
    else if (part === "alt" || part === "option") chord.alt = true
    else if (part === "shift") chord.shift = true
    else if (part === "meta" || part === "cmd" || part === "command") chord.meta = true
    else chord.key = KEY_ALIASES[part] ?? part
  }
  if (source.endsWith("+") && !chord.key) chord.key = "+"
  // A single non-alphanumeric key ("?", "/", ".") is typed with or without shift depending on the
  // layout, so shift is not required to match.
  chord.looseShift = chord.key.length === 1 && !/[a-z0-9]/i.test(chord.key)
  return chord
}

function parseKeys(keys: string, isMac: boolean): Chord[] {
  return keys
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((chord) => parseChord(chord, isMac))
}

function chordFromEvent(event: KeyboardEvent): PressedChord {
  const key = event.key.toLowerCase()
  const code = event.code || ""
  const letter = /^Key([A-Z])$/.exec(code)?.[1]?.toLowerCase()
  const digit = /^Digit([0-9])$/.exec(code)?.[1]
  const nonAscii = key.length === 1 && key.charCodeAt(0) > 127
  let physical: string | undefined
  if (letter !== undefined && (event.altKey || nonAscii)) physical = letter
  else if (digit !== undefined && (event.altKey || event.shiftKey)) physical = digit
  return {
    key,
    code: physical !== key ? physical : undefined,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    looseShift: false,
  }
}

function chordMatches(expected: Chord, actual: PressedChord): boolean {
  return (
    (expected.key === actual.key || (actual.code !== undefined && expected.key === actual.code)) &&
    expected.ctrl === actual.ctrl &&
    expected.alt === actual.alt &&
    expected.meta === actual.meta &&
    (expected.looseShift || expected.shift === actual.shift)
  )
}

function hasModifier(chord: Chord): boolean {
  return chord.ctrl || chord.alt || chord.meta
}

function isEditableTarget(event: KeyboardEvent): boolean {
  // Inside a shadow root the event is retargeted to the host; the path still starts at the element
  // that has focus (a `tec-*` text field's inner <input>). Empty for an event not being dispatched.
  const target = event.composedPath()[0] ?? event.target
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

/**
 * Creates a registry. The host owns it, listens for keys with it (`<tec-shortcuts .registry=${r}>`
 * or `document.addEventListener("keydown", (e) => r.handleKeyDown(e))`) and hands it to the mounted
 * applications.
 */
export function createShortcutRegistry(): ShortcutRegistry {
  const shortcuts = new Map<string, Shortcut>()
  // Keys are parsed once, when a shortcut is registered.
  const parsed = new WeakMap<Shortcut, Chord[]>()
  const listeners = new Set<() => void>()
  let snapshot: Shortcut[] = []
  let pending: PressedChord[] = []
  let pendingAt = 0
  const isMac = isMacPlatform()

  const notify = () => {
    snapshot = [...shortcuts.values()]
    listeners.forEach((listener) => listener())
  }

  const register = (input: Shortcut | Shortcut[]) => {
    const list = Array.isArray(input) ? input : [input]
    for (const shortcut of list) {
      // Re-insert so the latest registration takes precedence.
      shortcuts.delete(shortcut.id)
      shortcuts.set(shortcut.id, shortcut)
      parsed.set(shortcut, parseKeys(shortcut.keys, isMac))
    }
    notify()
    return () => {
      for (const shortcut of list) {
        if (shortcuts.get(shortcut.id) === shortcut) shortcuts.delete(shortcut.id)
      }
      notify()
    }
  }

  const unregister = (id: string) => {
    if (shortcuts.delete(id)) notify()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return false
    // A keydown with no key at all: Chrome's autofill sends these.
    if (typeof event.key !== "string" || event.key === "") return false
    const key = event.key.toLowerCase()
    if (["shift", "control", "alt", "meta"].includes(key)) return false

    const chord = chordFromEvent(event)
    const now = Date.now()
    if (now - pendingAt > SEQUENCE_TIMEOUT) pending = []
    pending.push(chord)
    pendingAt = now

    const editable = isEditableTarget(event)
    const candidates = [...shortcuts.values()].reverse()

    const attempt = (buffer: PressedChord[]): "handled" | "pending" | "none" => {
      let prefix = false
      for (const shortcut of candidates) {
        let sequence = parsed.get(shortcut)
        if (sequence === undefined) {
          sequence = parseKeys(shortcut.keys, isMac)
          parsed.set(shortcut, sequence)
        }
        if (sequence.length < buffer.length) continue
        const matches = buffer.every((entry, index) => chordMatches(sequence[index]!, entry))
        if (!matches) continue
        const allowed = shortcut.allowInInput ?? sequence.every(hasModifier)
        if (editable && !allowed) continue
        if (shortcut.isEnabled && !shortcut.isEnabled()) continue
        if (sequence.length === buffer.length) {
          event.preventDefault()
          pending = []
          if (!event.repeat || shortcut.allowRepeat) shortcut.onAction(event)
          return "handled"
        }
        prefix = true
      }
      return prefix ? "pending" : "none"
    }

    let result = attempt(pending)
    if (result === "none" && pending.length > 1) {
      pending = [chord]
      result = attempt(pending)
    }
    if (result === "pending") {
      event.preventDefault()
      return true
    }
    if (result === "none") pending = []
    return result === "handled"
  }

  return {
    register,
    unregister,
    getAll: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    handleKeyDown,
  }
}

const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  enter: "↵",
  backspace: "⌫",
  delete: "Del",
  tab: "⇥",
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
}

/**
 * Display labels for a shortcut: one array of key caps per chord (`formatShortcut("mod+k")` →
 * `[["⌘", "K"]]` on a Mac, `[["Ctrl", "K"]]` elsewhere).
 */
export function formatShortcut(keys: string, isMac = isMacPlatform()): string[][] {
  return parseKeys(keys, isMac).map((chord) => {
    const caps: string[] = []
    if (chord.ctrl) caps.push(isMac ? "⌃" : "Ctrl")
    if (chord.alt) caps.push(isMac ? "⌥" : "Alt")
    if (chord.shift) caps.push(isMac ? "⇧" : "Shift")
    if (chord.meta) caps.push(isMac ? "⌘" : "Win")
    if (chord.key) caps.push(KEY_LABELS[chord.key] ?? chord.key.toUpperCase())
    return caps
  })
}

/**
 * What a screen reader should hear for a shortcut: the keys of a chord joined with " + ", the steps
 * of a sequence with ", then " (`"G, then W"`, `"Ctrl + K"`).
 */
export function describeShortcut(keys: string, isMac = isMacPlatform()): string {
  return formatShortcut(keys, isMac)
    .map((chord) => chord.join(" + "))
    .join(", then ")
}
