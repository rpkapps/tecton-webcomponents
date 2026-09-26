/**
 * @module direction
 * Text direction helpers. Direction is read from the computed style of the element itself (which
 * inherits through shadow roots and honours `dir` on any ancestor), never from `document.dir`.
 */

/** Whether `el` is laid out right-to-left (`dir="rtl"` on it or on any ancestor, or CSS `direction`). */
export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === "rtl"
}

/**
 * Maps a physical horizontal arrow key to a logical step for `el`'s direction:
 * `ArrowRight` → `+1` in LTR and `-1` in RTL (and the inverse for `ArrowLeft`). Returns `0` for
 * any other key.
 */
export function horizontalStep(key: string, el: Element): -1 | 0 | 1 {
  if (key !== "ArrowRight" && key !== "ArrowLeft") return 0
  const forward = key === "ArrowRight"
  return (forward !== isRtl(el) ? 1 : -1) as -1 | 1
}
