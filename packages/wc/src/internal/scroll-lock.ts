/**
 * @module scroll-lock
 * Reference-counted page scroll lock for modal surfaces (dialog, sheet, drawer, alert dialog):
 * `overflow: hidden` on `<html>` with the scrollbar width compensated (`padding-inline-end`) so the
 * page does not shift. Nested modals share the lock; it is released when the last owner unlocks.
 *
 * ```ts
 * show() { this.dialog.showModal(); lockScroll(this) }
 * close() { this.dialog.close(); unlockScroll(this) }
 * ```
 */

const owners = new Set<object>()
let saved: { overflow: string; paddingInlineEnd: string } | null = null

/** Locks page scrolling on behalf of `owner` (idempotent per owner). */
export function lockScroll(owner: object): void {
  owners.add(owner)
  if (saved) return
  const root = document.documentElement
  const scrollbar = window.innerWidth - root.clientWidth
  saved = { overflow: root.style.overflow, paddingInlineEnd: root.style.paddingInlineEnd }
  root.style.overflow = "hidden"
  if (scrollbar > 0) {
    const current = parseFloat(getComputedStyle(root).paddingInlineEnd) || 0
    root.style.paddingInlineEnd = `${current + scrollbar}px`
  }
}

/** Releases `owner`'s lock; scrolling returns when no owner is left. */
export function unlockScroll(owner: object): void {
  owners.delete(owner)
  if (owners.size || !saved) return
  const root = document.documentElement
  root.style.overflow = saved.overflow
  root.style.paddingInlineEnd = saved.paddingInlineEnd
  saved = null
}

/** Whether any owner holds the lock. */
export function isScrollLocked(): boolean {
  return owners.size > 0
}
