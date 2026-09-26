/** Helpers shared by the segmented fields and the date pickers (focus and labelling of segments). */
import { resolveIdRefs, setAriaElements } from "../../internal/aria.js"

/** The focusable segments of a shadow root, in order. */
export function segmentsIn(root: ParentNode, field?: string): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(".segment[tabindex]")]
  return field ? all.filter((s) => s.dataset.field === field) : all
}

/** Moves focus from one segment to its neighbour (across fields of one owner). */
export function focusSibling(root: ParentNode, from: HTMLElement, direction: 1 | -1): void {
  const segments = segmentsIn(root)
  const next = segments[segments.indexOf(from) + direction]
  next?.focus()
}

/** The first empty segment, else the last one — where a press on the field puts the caret. */
export function segmentToFocus(root: ParentNode, field?: string): HTMLElement | undefined {
  const segments = segmentsIn(root, field)
  return segments.find((s) => s.hasAttribute("data-placeholder")) ?? segments.at(-1)
}

/** Label elements of a host: its `aria-labelledby` targets, else its `<label for>` / wrapping labels. */
export function hostLabels(host: HTMLElement, formLabels: Element[]): Element[] {
  const explicit = host.getAttribute("aria-labelledby")
  if (explicit !== null) return resolveIdRefs(host, explicit)
  return formLabels
}

/**
 * Names each segment "field name + label" (React Aria: `aria-labelledby="segment label"`), marks
 * invalid segments and describes the first segment with the host's `aria-describedby`.
 */
export function syncSegmentAria(root: ParentNode, labels: Element[], invalid: boolean, described: Element[] = []): void {
  const segments = segmentsIn(root)
  segments.forEach((segment, i) => {
    setAriaElements(segment, "ariaLabelledByElements", labels.length ? [segment, ...labels] : null)
    setAriaElements(segment, "ariaDescribedByElements", described.length && (i === 0 || invalid) ? described : null)
    if (invalid) segment.setAttribute("aria-invalid", "true")
    else segment.removeAttribute("aria-invalid")
  })
}
