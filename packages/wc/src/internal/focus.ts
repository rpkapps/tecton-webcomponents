/**
 * @module focus
 * Focus utilities that understand shadow DOM and slots (the *flat tree*): what is tabbable inside a
 * container, whether a node is inside a container as rendered, the deepest focused element, and a
 * Tab-key focus trap.
 *
 * ```ts
 * const first = getTabbables(panel)[0]            // walks slotted light DOM and nested shadow roots
 * if (containsFlat(panel, deepActiveElement())) … // focus is inside the rendered panel
 * const trap = new FocusTrap(() => panel); trap.activate(); … trap.deactivate()
 * ```
 */

/** The focused element, looking through open shadow roots. */
export function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let el: Element | null = root.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

/** The flat-tree parent of `node`: its assigned slot, else its parent, else its shadow root's host. */
export function flatParent(node: Node): Node | null {
  const slot = (node as Element | Text).assignedSlot
  if (slot) return slot
  if (node.parentNode instanceof ShadowRoot) return node.parentNode.host
  return node.parentNode
}

/**
 * Whether `node` is `container` or rendered inside it (following slot assignment and shadow hosts).
 * Use instead of `contains()` whenever slotted content or shadow roots are involved.
 */
export function containsFlat(container: Node | null | undefined, node: Node | null | undefined): boolean {
  if (!container || !node) return false
  for (let n: Node | null = node; n; n = flatParent(n)) if (n === container) return true
  return false
}

function isHiddenAnchor(el: Element): boolean {
  return (el.localName === "a" || el.localName === "area") && !el.hasAttribute("href") && !el.hasAttribute("tabindex")
}

/** Whether `el` can receive focus by Tab right now (visible, enabled, not inert, tabindex ≥ 0). */
export function isTabbable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false
  const focusable = el as HTMLElement
  if (focusable.tabIndex < 0 || isHiddenAnchor(el)) return false
  if (el.matches(":disabled") || (el as HTMLElement).inert) return false
  if (el.localName === "input" && (el as HTMLInputElement).type === "hidden") return false
  // Hosts that delegate focus are not tab stops themselves; their inner control is.
  if (el.shadowRoot?.delegatesFocus) return false
  return el.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)
}

/**
 * Every tabbable element rendered inside `container`, in flat-tree order: light children, shadow
 * roots (through their slots) and slotted content. Radio groups are not collapsed.
 */
export function getTabbables(container: Element | ShadowRoot): HTMLElement[] {
  const out: HTMLElement[] = []
  const visit = (node: Element) => {
    if ((node as HTMLElement).inert) return
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({ flatten: true })
      for (const child of assigned.length ? assigned : [...node.children]) visit(child)
      return
    }
    if (isTabbable(node)) out.push(node)
    const children = node.shadowRoot ? [...node.shadowRoot.children] : [...node.children]
    for (const child of children) visit(child)
  }
  const roots = container instanceof ShadowRoot ? [...container.children] : [container]
  for (const r of roots) visit(r)
  return out
}

/**
 * Moves focus to the first tabbable element inside `container`; falls back to `container` itself
 * (which then needs `tabindex="-1"`). Returns the element that received focus.
 */
export function focusFirst(container: HTMLElement, options: FocusOptions = {}): HTMLElement {
  const target = getTabbables(container)[0] ?? container
  target.focus(options)
  return target
}

/**
 * Keeps Tab / Shift+Tab inside a container (focus wraps from the last tabbable to the first and back),
 * for non-modal surfaces that must contain focus (popovers acting as dialogs). Native modal
 * `<dialog>`s don't need it.
 */
export class FocusTrap {
  readonly #container: () => HTMLElement | null | undefined
  #active = false

  constructor(container: () => HTMLElement | null | undefined) {
    this.#container = container
  }

  get active(): boolean {
    return this.#active
  }

  activate(): void {
    if (this.#active) return
    this.#active = true
    document.addEventListener("keydown", this.#onKeyDown, true)
  }

  deactivate(): void {
    this.#active = false
    document.removeEventListener("keydown", this.#onKeyDown, true)
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return
    const container = this.#container()
    if (!container) return
    const active = deepActiveElement()
    if (!containsFlat(container, active)) return
    const tabbables = getTabbables(container)
    if (!tabbables.length) {
      event.preventDefault()
      return
    }
    const first = tabbables[0]!
    const last = tabbables[tabbables.length - 1]!
    const index = tabbables.findIndex((t) => t === active || containsFlat(t, active))
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (index === -1 || index === tabbables.length - 1)) {
      event.preventDefault()
      first.focus()
    }
  }
}

/**
 * Mirrors "an element inside my shadow root matches `:focus-visible`" as the host custom state
 * `:state(focus-visible)` — hosts never match `:focus-visible` themselves, even with
 * `delegatesFocus`. Use it when the host is the styled box and the focusable element is inside:
 *
 * ```ts
 * #focusVisible = new FocusVisibleController(this)
 * // css: :host(:state(focus-visible)) { box-shadow: var(--tec-focus-ring) }
 * ```
 */
export class FocusVisibleController {
  readonly #host: HTMLElement & { internals: ElementInternals; addController(c: object): void }

  constructor(host: HTMLElement & { internals: ElementInternals; addController(c: object): void }) {
    this.#host = host
    host.addController(this)
  }

  hostConnected(): void {
    this.#host.addEventListener("focusin", this.#sync)
    this.#host.addEventListener("focusout", this.#clear)
    this.#host.addEventListener("keyup", this.#sync)
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("focusin", this.#sync)
    this.#host.removeEventListener("focusout", this.#clear)
    this.#host.removeEventListener("keyup", this.#sync)
    this.#host.internals.states.delete("focus-visible")
  }

  #sync = () => {
    const active = this.#host.shadowRoot?.activeElement ?? null
    const visible = !!active && active.matches(":focus-visible")
    if (visible) this.#host.internals.states.add("focus-visible")
    else this.#host.internals.states.delete("focus-visible")
  }

  #clear = () => {
    this.#host.internals.states.delete("focus-visible")
  }
}
