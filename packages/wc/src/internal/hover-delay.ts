/**
 * @module hover-delay
 * Open/close timing shared by `tec-tooltip` and `tec-hover-card`, with the global warm-up / cool-down
 * behaviour of React Aria's tooltip state:
 *
 * - the first tooltip waits `delay` ms before it opens (the *warm-up*);
 * - once one is open, the whole page is *warm*: moving to another trigger opens its tooltip at once,
 *   without the enter animation, and closes the previous one instantly;
 * - leaving a trigger closes after `closeDelay` ms; the page cools down `max(500, closeDelay)` ms after
 *   the last tooltip closed;
 * - only one tooltip / hover card is open at a time.
 */

const COOLDOWN = 500
const DESCRIBED = Symbol("tec-described")

let globalWarmedUp = false
let globalWarmUpTimeout: ReturnType<typeof setTimeout> | null = null
let globalCooldownTimeout: ReturnType<typeof setTimeout> | null = null
const registry = new Set<HoverDelayState>()

/** Options of {@link HoverDelayState}. */
export interface HoverDelayOptions {
  /** Warm-up delay in ms (read on every open). */
  delay: () => number
  /** Close delay in ms (read on every close). */
  closeDelay: () => number
  /** Whether the owner is currently open. */
  isOpen: () => boolean
  /** Open now. `instant`: the page is warm — skip the enter animation. */
  onOpen: (instant: boolean) => void
  /** Close now. `instant`: replaced by another tooltip — skip the exit animation. */
  onClose: (instant: boolean) => void
}

/** The open/close timer of one tooltip-like element. See the module documentation. */
export class HoverDelayState {
  readonly #options: HoverDelayOptions
  #closeTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(options: HoverDelayOptions) {
    this.#options = options
  }

  /** Requests to open: after the warm-up unless `immediate` (focus) or the page is warm. */
  open(immediate = false): void {
    const delay = this.#options.delay()
    if (!immediate && delay > 0 && !this.#closeTimeout) this.#warmup(delay)
    else this.#show(globalWarmedUp)
  }

  /** Requests to close: after `closeDelay` unless `immediate`. */
  close(immediate = false, instant = false): void {
    const closeDelay = this.#options.closeDelay()
    if (immediate || closeDelay <= 0) {
      this.#clearClose()
      if (this.#options.isOpen()) this.#options.onClose(instant)
    } else if (!this.#closeTimeout) {
      this.#closeTimeout = setTimeout(() => {
        this.#closeTimeout = null
        this.#options.onClose(false)
      }, closeDelay)
    }
    if (globalWarmUpTimeout) {
      clearTimeout(globalWarmUpTimeout)
      globalWarmUpTimeout = null
    }
    if (globalWarmedUp) {
      if (globalCooldownTimeout) clearTimeout(globalCooldownTimeout)
      globalCooldownTimeout = setTimeout(() => {
        registry.delete(this)
        globalCooldownTimeout = null
        globalWarmedUp = false
      }, Math.max(COOLDOWN, closeDelay))
    }
  }

  /** Keeps an open element open (cancels a pending close). */
  keepOpen(): void {
    if (this.#closeTimeout) this.#show(true)
  }

  /** Cancels timers (on disconnect). */
  dispose(): void {
    this.#clearClose()
    registry.delete(this)
  }

  #clearClose(): void {
    if (this.#closeTimeout) clearTimeout(this.#closeTimeout)
    this.#closeTimeout = null
  }

  #closeOthers(): void {
    for (const other of registry) {
      if (other === this) continue
      other.#clearClose()
      if (other.#options.isOpen()) other.#options.onClose(true)
      registry.delete(other)
    }
  }

  #show(instant: boolean): void {
    this.#clearClose()
    this.#closeOthers()
    registry.add(this)
    globalWarmedUp = true
    if (!this.#options.isOpen()) this.#options.onOpen(instant)
    if (globalWarmUpTimeout) {
      clearTimeout(globalWarmUpTimeout)
      globalWarmUpTimeout = null
    }
    if (globalCooldownTimeout) {
      clearTimeout(globalCooldownTimeout)
      globalCooldownTimeout = null
    }
  }

  #warmup(delay: number): void {
    this.#closeOthers()
    registry.add(this)
    if (this.#options.isOpen()) return
    if (!globalWarmedUp) {
      if (globalWarmUpTimeout) clearTimeout(globalWarmUpTimeout)
      globalWarmUpTimeout = setTimeout(() => {
        globalWarmUpTimeout = null
        globalWarmedUp = true
        this.#show(false)
      }, delay)
    } else {
      this.#show(true)
    }
  }

  /** Cancels a pending warm-up of this element (the pointer left before it opened). */
  cancelWarmup(): void {
    if (globalWarmUpTimeout && registry.has(this) && !this.#options.isOpen()) {
      clearTimeout(globalWarmUpTimeout)
      globalWarmUpTimeout = null
    }
  }
}

/** Resets the global warm-up state (tests). @internal */
export function resetHoverDelay(): void {
  for (const s of registry) s.dispose()
  registry.clear()
  globalWarmedUp = false
  if (globalWarmUpTimeout) clearTimeout(globalWarmUpTimeout)
  if (globalCooldownTimeout) clearTimeout(globalCooldownTimeout)
  globalWarmUpTimeout = null
  globalCooldownTimeout = null
}

/**
 * The element whose accessible description should mention a popup: the inner control of a
 * wrapping custom element (`tec-button` → its `<button>`), else the trigger itself.
 */
export function describedControl(trigger: HTMLElement): Element {
  const control = (trigger as HTMLElement & { control?: unknown }).control
  if (control instanceof Element) return control
  return trigger
}

/**
 * Points the trigger's accessible description at the popup content while it is open. Element
 * content is referenced through ARIA element reflection (`ariaDescribedByElements` on the control,
 * the light-DOM content being in an ancestor scope of the control); content with bare text nodes
 * falls back to `aria-description` on the trigger (mirrored onto a `tec-button`'s inner control).
 */
export function describeTrigger(trigger: HTMLElement | null, content: Node[] | null): void {
  if (!trigger) return
  const control = describedControl(trigger) as Element & { ariaDescribedByElements?: Element[] | null }
  const significant = (content ?? []).filter((n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent!.trim()))
  const elements = significant.filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE)
  const wrote = (trigger as unknown as Record<symbol, string>)[DESCRIBED]
  if (!content || !significant.length) {
    if (wrote === "elements") control.ariaDescribedByElements = null
    if (wrote === "text") trigger.removeAttribute("aria-description")
    delete (trigger as unknown as Record<symbol, string>)[DESCRIBED]
    return
  }
  if (elements.length === significant.length) {
    control.ariaDescribedByElements = elements
    ;(trigger as unknown as Record<symbol, string>)[DESCRIBED] = "elements"
  } else {
    const text = significant.map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim()
    trigger.setAttribute("aria-description", text)
    ;(trigger as unknown as Record<symbol, string>)[DESCRIBED] = "text"
  }
}
