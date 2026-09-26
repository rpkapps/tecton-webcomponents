/**
 * @module dismiss
 * Light dismiss for overlays: Escape and presses outside, with a shared **layer stack** so nested
 * overlays behave (Escape closes only the top-most layer; a press inside a nested layer — which is
 * rendered inside its parent's host — does not dismiss the parent).
 *
 * `PopupController` uses it; use it directly for surfaces that are not anchored popups (e.g. a
 * non-modal sheet).
 *
 * ```ts
 * #dismiss = new DismissController({
 *   inside: () => [this],                  // the host covers trigger + slotted content + shadow popup
 *   onDismiss: (reason) => this.requestClose(reason),
 * })
 * // when opening / closing:
 * this.#dismiss.activate(); this.#dismiss.deactivate()
 * ```
 */

/** Why a layer asked to be dismissed. */
export type DismissReason = "escape" | "outside" | "focus-out"

/** Options of {@link DismissController}. */
export interface DismissOptions {
  /**
   * Elements that count as *inside* the layer. An event whose composed path contains any of them is
   * inside (composed paths follow slots and shadow roots, so a host covers its slotted content and its
   * shadow popup).
   */
  inside: () => (EventTarget | null | undefined)[]
  /** Called when the layer should close. The owner decides (and may emit a cancelable event). */
  onDismiss: (reason: DismissReason, event: Event) => void
  /** Close on Escape when this is the top-most layer. Default `true`. */
  escape?: boolean
  /** Close on a pointer press outside. Default `true`. */
  outsidePress?: boolean
  /** Close when focus moves outside (non-modal, non-trapping surfaces). Default `false`. */
  focusOut?: boolean
}

const stack: DismissController[] = []
let listening = false

function topmost(): DismissController | undefined {
  return stack[stack.length - 1]
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return
  const layer = topmost()
  if (!layer || layer.options.escape === false) return
  // Escape is consumed by the top-most layer (it must not also close a parent layer or a <dialog>).
  event.preventDefault()
  event.stopPropagation()
  layer.options.onDismiss("escape", event)
}

function onPointerDown(event: PointerEvent) {
  const path = event.composedPath()
  // Iterate from the top; every layer the press is outside of is dismissed.
  for (const layer of [...stack].reverse()) {
    if (layer.options.outsidePress === false) continue
    if (!layer.isInside(path)) layer.options.onDismiss("outside", event)
  }
}

function onFocusIn(event: FocusEvent) {
  const path = event.composedPath()
  for (const layer of [...stack].reverse()) {
    if (layer.options.focusOut && !layer.isInside(path)) layer.options.onDismiss("focus-out", event)
  }
}

function listen(on: boolean) {
  if (on === listening) return
  listening = on
  const method = on ? "addEventListener" : "removeEventListener"
  document[method]("keydown", onKeyDown as EventListener)
  document[method]("pointerdown", onPointerDown as EventListener, true)
  document[method]("focusin", onFocusIn as EventListener, true)
}

/**
 * One dismissable layer. `activate()` pushes it on the layer stack (top-most), `deactivate()` removes
 * it. Listeners are global and shared (one set for all layers).
 */
export class DismissController {
  readonly options: DismissOptions

  constructor(options: DismissOptions) {
    this.options = options
  }

  /** Whether the layer is on the stack. */
  get active(): boolean {
    return stack.includes(this)
  }

  /** Whether this layer is the top-most active layer. */
  get isTopmost(): boolean {
    return topmost() === this
  }

  /** Whether a composed path (from `event.composedPath()`) is inside the layer. */
  isInside(path: EventTarget[]): boolean {
    const inside = this.options.inside().filter(Boolean)
    return path.some((t) => inside.includes(t))
  }

  activate(): void {
    if (this.active) return
    stack.push(this)
    listen(true)
  }

  deactivate(): void {
    const i = stack.indexOf(this)
    if (i >= 0) stack.splice(i, 1)
    if (!stack.length) listen(false)
  }
}
