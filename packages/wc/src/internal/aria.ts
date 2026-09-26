/**
 * @module aria
 * ARIA delegation for elements that wrap one native control in their shadow root (`tec-button` →
 * `<button>`, `tec-checkbox` → `<input type="checkbox">`, `tec-input` → `<input>` …).
 *
 * Authors and other components put ARIA on the **host** (`<tec-button aria-label="Close">`,
 * `aria-expanded` set by a popup controller on its slotted trigger, `aria-describedby="hint"` set by a
 * field). {@link AriaDelegateController} mirrors those host attributes onto the inner control, which is
 * the node assistive technology actually sees:
 *
 * - plain attributes (`aria-label`, `aria-expanded`, `aria-haspopup`, `aria-pressed` …) are copied;
 * - ID-reference attributes (`aria-labelledby`, `aria-describedby`, `aria-controls` …) are resolved in
 *   the host's tree scope and set as element references (`ariaLabelledByElements` …), because ids
 *   never resolve across a shadow boundary;
 * - the host keeps its attributes (they stay the source of truth: frameworks can update/remove them,
 *   tests can read them). Hosts have no role, so the attributes are inert there (axe agrees).
 *
 * ```ts
 * class TecButton extends TectonElement {
 *   #aria = new AriaDelegateController(this, { target: () => this.shadowRoot?.querySelector(".base") })
 * }
 * ```
 *
 * Code that sets ARIA on an element it did not render (e.g. `PopupController` on a slotted trigger)
 * just sets the attribute on that element — delegation is the wrapped element's job.
 */
import type { ReactiveController, ReactiveControllerHost } from "lit"

/** Host attributes mirrored onto the inner control. */
export const DELEGATED_ARIA_ATTRIBUTES = [
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-description",
  "aria-details",
  "aria-errormessage",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-expanded",
  "aria-haspopup",
  "aria-pressed",
  "aria-current",
  "aria-invalid",
  "aria-keyshortcuts",
  "aria-roledescription",
  "aria-autocomplete",
  "aria-busy",
] as const

type ElementListProp =
  | "ariaLabelledByElements"
  | "ariaDescribedByElements"
  | "ariaDetailsElements"
  | "ariaErrorMessageElements"
  | "ariaControlsElements"
  | "ariaOwnsElements"

/** ID-reference attributes and the element-reflection property that replaces them. */
export const IDREF_ARIA: Record<string, ElementListProp | "ariaActiveDescendantElement"> = {
  "aria-labelledby": "ariaLabelledByElements",
  "aria-describedby": "ariaDescribedByElements",
  "aria-details": "ariaDetailsElements",
  "aria-errormessage": "ariaErrorMessageElements",
  "aria-controls": "ariaControlsElements",
  "aria-owns": "ariaOwnsElements",
  "aria-activedescendant": "ariaActiveDescendantElement",
}

/** Resolves a space-separated id list in `scope`'s tree (document or shadow root). Missing ids are skipped. */
export function resolveIdRefs(scope: Node, ids: string | null): Element[] {
  if (!ids) return []
  const root = scope.getRootNode() as Document | ShadowRoot
  return ids
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => root.getElementById?.(id) ?? null)
    .filter((el): el is HTMLElement => el !== null)
}

/** Sets (or, with `null`/`undefined`, removes) an element-reflection ARIA property. */
export function setAriaElements(
  el: Element,
  prop: ElementListProp | "ariaActiveDescendantElement",
  value: Element[] | Element | null | undefined
): void {
  const target = el as unknown as Record<string, unknown>
  if (prop === "ariaActiveDescendantElement") {
    target[prop] = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
    return
  }
  const list = value == null ? null : Array.isArray(value) ? value : [value]
  target[prop] = list && list.length ? list : null
}

/** Options of {@link AriaDelegateController}. */
export interface AriaDelegateOptions {
  /** The inner control (re-evaluated on every sync, so it may change between renders). */
  target: () => Element | null | undefined
  /** Attributes the component manages itself on the control (never overwritten). */
  exclude?: readonly string[]
  /**
   * Label elements used when the host has neither `aria-labelledby` nor `aria-label` — e.g. the
   * `<label for>` elements of a form control (`internals.labels`). Empty → the control's native
   * label (its content or a shadow `<label>`) applies.
   */
  labels?: () => Element[]
}

/**
 * Mirrors the host's `aria-*` attributes onto an inner control (see the module docs). Syncs on
 * connect, after every host update, whenever a host `aria-*` attribute changes, and on `focusin`
 * (so id references that appeared later are picked up before assistive technology reads the name).
 */
export class AriaDelegateController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement
  readonly #options: AriaDelegateOptions
  #observer?: MutationObserver
  /** Attributes this controller wrote on the current target (to remove them when the host drops them). */
  #written = new Set<string>()
  #lastTarget: Element | null = null

  constructor(host: ReactiveControllerHost & HTMLElement, options: AriaDelegateOptions) {
    this.#host = host
    this.#options = options
    host.addController(this)
  }

  hostConnected(): void {
    this.#observer ??= new MutationObserver(() => this.sync())
    this.#observer.observe(this.#host, { attributes: true, attributeFilter: [...DELEGATED_ARIA_ATTRIBUTES] })
    this.#host.addEventListener("focusin", this.#onFocusIn)
    this.sync()
  }

  hostDisconnected(): void {
    this.#observer?.disconnect()
    this.#host.removeEventListener("focusin", this.#onFocusIn)
  }

  hostUpdated(): void {
    this.sync()
  }

  #onFocusIn = () => this.sync()

  /** Re-applies every delegated attribute to the current target. Cheap; call it whenever in doubt. */
  sync(): void {
    const target = this.#options.target()
    if (!target) return
    if (target !== this.#lastTarget) {
      this.#written.clear()
      this.#lastTarget = target
    }
    const host = this.#host
    const exclude = this.#options.exclude ?? []
    for (const name of DELEGATED_ARIA_ATTRIBUTES) {
      if (exclude.includes(name)) continue
      const value = host.getAttribute(name)
      const prop = IDREF_ARIA[name]
      if (prop) {
        if (name === "aria-labelledby") continue // handled below together with `labels`
        if (value !== null) {
          setAriaElements(target, prop, resolveIdRefs(host, value))
          this.#written.add(name)
        } else if (this.#written.delete(name)) {
          setAriaElements(target, prop, null)
        }
        continue
      }
      if (value !== null) {
        if (target.getAttribute(name) !== value) target.setAttribute(name, value)
        this.#written.add(name)
      } else if (this.#written.delete(name)) {
        target.removeAttribute(name)
      }
    }
    if (!exclude.includes("aria-labelledby")) this.#syncLabelledBy(target)
  }

  #syncLabelledBy(target: Element): void {
    const host = this.#host
    const explicit = host.getAttribute("aria-labelledby")
    let elements: Element[] | null = null
    if (explicit !== null) elements = resolveIdRefs(host, explicit)
    else if (!host.hasAttribute("aria-label")) elements = this.#options.labels?.() ?? null
    if (elements && elements.length) {
      setAriaElements(target, "ariaLabelledByElements", elements)
      this.#written.add("aria-labelledby")
    } else if (this.#written.delete("aria-labelledby")) {
      setAriaElements(target, "ariaLabelledByElements", null)
    }
  }
}
