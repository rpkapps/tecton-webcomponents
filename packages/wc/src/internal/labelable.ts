/**
 * Helpers shared by `tec-label`, the `tec-field` family and `tec-input-group`: finding the control a
 * label or field is about, and adding/removing one id in an id-reference attribute
 * (`aria-labelledby`, `aria-describedby`) without disturbing the ids the author put there.
 *
 * Labels and fields reference their control through **host attributes with ids** (`aria-labelledby`
 * / `aria-describedby` on the control element): that works for native controls, for Tecton controls
 * (their `AriaDelegateController` resolves the ids in the host's scope and forwards them as element
 * references to the inner control) and for host-semantic controls (a radio group) alike.
 *
 * @internal
 */

const NATIVE_LABELABLE = new Set(["input", "select", "textarea", "button", "meter", "output", "progress"])

/** Whether `el` can be labelled by a `<label>`: native labelable elements and form-associated custom elements. */
export function isLabelable(el: Element): el is HTMLElement {
  const name = el.localName
  if (name === "input") return (el as HTMLInputElement).type !== "hidden"
  if (NATIVE_LABELABLE.has(name)) return true
  if (!name.includes("-")) return false
  const ctor = customElements.get(name) as (CustomElementConstructor & { formAssociated?: boolean }) | undefined
  return !!ctor?.formAssociated
}

const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset", "image"])

/**
 * Whether `el` is a value control a field describes: a labelable element that is not a button
 * (`<button>`, `<input type="submit">`, `tec-button`, `tec-input-group-button` …).
 */
export function isFieldControl(el: Element): el is HTMLElement {
  if (!isLabelable(el)) return false
  const name = el.localName
  if (name === "button" || name.endsWith("-button")) return false
  if (name === "input" && BUTTON_INPUT_TYPES.has((el as HTMLInputElement).type)) return false
  return true
}

/**
 * The first element under `root` (not `root` itself, light DOM only) matching `test`, skipping the
 * subtrees for which `skip` returns true.
 */
export function findDescendant(
  root: Element,
  test: (el: Element) => boolean,
  skip: (el: Element) => boolean = () => false
): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => (skip(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (test(node as Element)) return node as HTMLElement
  }
  return null
}

/** Every element under `root` matching `test`, skipping the subtrees for which `skip` returns true. */
export function findDescendants(root: Element, test: (el: Element) => boolean, skip: (el: Element) => boolean = () => false): HTMLElement[] {
  const found: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => (skip(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (test(node as Element)) found.push(node as HTMLElement)
  return found
}

function tokens(value: string | null): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : []
}

/**
 * Replaces the ids this caller previously added to `attribute` on `el` (`previous`) with `next`,
 * keeping every other id in place (ids the author wrote, ids other labels/fields added). Removes the
 * attribute when it ends up empty and only held ids added this way.
 */
export function updateIdRefs(el: Element, attribute: string, previous: readonly string[], next: readonly string[]): void {
  const current = tokens(el.getAttribute(attribute))
  const kept = current.filter((id) => !previous.includes(id) || next.includes(id))
  for (const id of next) if (!kept.includes(id)) kept.push(id)
  const value = kept.join(" ")
  if (value === current.join(" ")) return
  if (value) el.setAttribute(attribute, value)
  else el.removeAttribute(attribute)
}
