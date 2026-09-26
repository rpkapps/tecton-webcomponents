/**
 * @module id
 * Unique ids for elements that need one (e.g. an inner `<input>` that a slotted `<label>` in the
 * same shadow root points at). Prefer ARIA element reflection over ids when the reference crosses
 * a shadow boundary — ids never resolve across shadow roots.
 */

let counter = 0
const seed = Math.random().toString(36).slice(2, 6)

/** Returns a document-unique id: `uniqueId("tec-tab")` → `"tec-tab-k3x9-12"`. */
export function uniqueId(prefix = "tec"): string {
  counter += 1
  return `${prefix}-${seed}-${counter}`
}
