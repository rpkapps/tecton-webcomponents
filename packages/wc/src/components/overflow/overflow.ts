import { html, nothing, type PropertyValues, type TemplateResult } from "lit"
import { property, query, state } from "lit/decorators.js"
import { Check, ChevronRight, Ellipsis } from "lucide"
import { animationStyles, popupMotion } from "../../internal/animations.js"
import { horizontalStep } from "../../internal/direction.js"
import { containsFlat, deepActiveElement } from "../../internal/focus.js"
import { icon } from "../../internal/icons.js"
import { uniqueId } from "../../internal/id.js"
import { PopupController, popupStyles } from "../../internal/popup.js"
import { RovingFocusController } from "../../internal/roving-focus.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import type { OverflowMenuEntry } from "./overflow-forms.js"
import { TecOverflowItem, type OverflowRowLike } from "./overflow-item.js"
import { TecOverflowDivider, TecOverflowGroup, TecOverflowSpacer } from "./overflow-parts.js"
import { overflowMenuStyles, overflowStyles } from "./overflow.styles.js"

export { TecOverflowItem, TecOverflowLabel } from "./overflow-item.js"
export type { OverflowLabelBehavior, OverflowMenuForm } from "./overflow-item.js"
export type { OverflowMenuEntry, OverflowMenuType } from "./overflow-forms.js"
export { TecOverflowDivider, TecOverflowGroup, TecOverflowSpacer } from "./overflow-parts.js"

/** Axis of an overflow row. */
export type OverflowOrientation = "horizontal" | "vertical"
/** `auto`: labels collapse before items leave; `always`: never collapse; `never`: icon-only from the start. */
export type OverflowLabels = "auto" | "always" | "never"
/** What a row does when its fixed items alone do not fit. */
export type OverflowLastResort = "wrap" | "scroll"

/** Detail of `tec-overflow-change`. */
export interface OverflowChangeDetail {
  /** `value`s of the items in the More menu, in row order. */
  hidden: string[]
}

type Entry =
  | { kind: "item"; el: TecOverflowItem; group: TecOverflowGroup | null }
  | { kind: "divider"; el: TecOverflowDivider }
  | { kind: "spacer"; el: TecOverflowSpacer }
  | { kind: "fixed"; el: HTMLElement }

/** Size assumed for an icon-only control (and the More button) before it has been measured. */
const ICON_ONLY = 32

const FOCUSABLE = "button, a[href], input:not([type=hidden]), select, textarea, [tabindex], [contenteditable]"

/**
 * The element that takes focus for `el`, looking through hosts that delegate focus (the native
 * control inside a `tec-button`, say). Roving tabindex goes on that element, so a host never becomes a
 * focusable generic node of its own.
 */
function focusTarget(el: Element): HTMLElement | null {
  const root = el.shadowRoot
  if (root?.delegatesFocus) {
    for (const child of root.querySelectorAll("*")) {
      const inner = child.matches(FOCUSABLE) || child.shadowRoot?.delegatesFocus ? focusTarget(child) : null
      if (inner) return inner
    }
    return null
  }
  if (el.matches(FOCUSABLE)) return el as HTMLElement
  for (const child of el.children) {
    const inner = focusTarget(child)
    if (inner) return inner
  }
  return null
}

function isTextField(el: Element | undefined): boolean {
  if (!el) return false
  if (el.localName === "textarea" || (el as HTMLElement).isContentEditable) return true
  if (el.localName !== "input") return false
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"].includes((el as HTMLInputElement).type)
}

/**
 * The row gives up space in stages as its container narrows, and takes it back in reverse order:
 *
 * 1. `elastic` items shrink to their minimum (CSS);
 * 2. labels collapse: items whose control has an icon become icon-only, with the label as tooltip
 *    (`labels="auto"`), all at once, and come back only when every item fits with its label;
 * 3. items move into the trailing More menu, lowest `priority` first, ties from the end of the row;
 * 4. the host compacts its own summary (container queries, see `tec-action-bar`);
 * 5. fixed items alone do not fit: the row wraps (`last-resort="wrap"`) or scrolls.
 *
 * Only `tec-overflow-item` children leave the row; other children are fixed. One `ResizeObserver`
 * per row measures the row and its children once and caches the sizes, so a resize is one pass over
 * the cache (no layout reads) and a pass that changes nothing writes nothing. Hidden items stay in
 * the DOM (`display: none`) and keep their state. Measurement and collapsing happen before paint,
 * so nothing flashes.
 *
 * @summary A row of controls that collapses labels to icons and moves items into a More menu as it gets narrow.
 *
 * @tag tec-overflow
 *
 * @slot - `tec-overflow-item`s, `tec-overflow-divider`s, `tec-overflow-spacer`s, `tec-overflow-group`s and fixed controls.
 * @slot menu-trigger - A custom More button (e.g. a smaller `tec-button` with an ellipsis icon). Default: a ghost icon button.
 *
 * @csspart menu - The wrapper of the More button (at the logical end of the row; present while an item is hidden).
 * @csspart menu-trigger - The default More button (`tec-button`).
 * @csspart menu-badge - The count badge on the More button (`overflow-badge`).
 * @csspart menu-content - The More menu.
 * @csspart submenu - The submenu of a select or dropdown in the More menu.
 * @csspart menu-item - A menu entry.
 *
 * @cssprop --tec-overflow-gap - Gap between the items (default 0.5rem).
 *
 * @cssstate overflowing - At least one item is in the More menu.
 * @cssstate compact - Labels are collapsed (items are icon-only).
 *
 * @fires tec-overflow-change - The set of items in the More menu changed (the container was resized, items were added …). `detail: { hidden }` lists their `value`s.
 */
export class TecOverflow extends TectonElement implements OverflowRowLike {
  static styles = [hostStyles, popupStyles, animationStyles, popupMotion(".menu-content"), overflowStyles, overflowMenuStyles]

  /** Axis of the row. A vertical row measures heights, never wraps and opens its menu to the side. */
  @property({ reflect: true }) orientation: OverflowOrientation = "horizontal"

  /** `auto` collapses labels to icons before hiding items, `always` keeps them, `never` is icon-only from the start. */
  @property({ reflect: true }) labels: OverflowLabels = "auto"

  /** Keep at least this many items in the row regardless of width (forces the last resort). */
  @property({ type: Number, attribute: "minimum-visible" }) minimumVisible = 0

  /** When fixed items alone do not fit: `wrap` to a second line or `scroll` inline. A vertical row always scrolls. */
  @property({ reflect: true, attribute: "last-resort" }) lastResort: OverflowLastResort = "wrap"

  /** Accessible name of the More button and its menu. */
  @property({ attribute: "menu-label" }) menuLabel = "More actions"

  /** Show how many items are in the More menu as a badge on its button. */
  @property({ type: Boolean, attribute: "overflow-badge" }) overflowBadge = false

  @state() private menuOpen = false
  @state() private submenuKey: string | null = null

  @query(".sizer") private sizer!: HTMLElement
  @query(".menu") private menuWrap!: HTMLElement
  @query(".menu-content:not(.submenu)") private menuEl!: HTMLElement
  @query(".submenu") private submenuEl!: HTMLElement

  // ---- layout state --------------------------------------------------------
  #ro: ResizeObserver | null = null
  #mo: MutationObserver | null = null
  #observed = new WeakSet<Element>()
  #sizes = new WeakMap<Element, number>()
  #full = new WeakMap<TecOverflowItem, number>()
  #compactSize = new WeakMap<TecOverflowItem, number>()
  #margins = new WeakMap<Element, number>()
  #outOfFlow = new WeakMap<Element, boolean>()
  #gap = 0
  #available = 0
  #triggerSize: number | null = null
  #hidden = new Set<TecOverflowItem>()
  #compact = false
  #minSize = -1
  #raf = 0
  #minRaf = 0
  #warnedLastResort = false

  // ---- menu state ----------------------------------------------------------
  #entryByKey = new Map<string, OverflowMenuEntry>()
  #openFocus: "first" | "last" | "menu" = "menu"
  #subFocus = false
  #hoverTimer: ReturnType<typeof setTimeout> | undefined
  #menuIds = new Map<string, string>()
  #skipRoving = false

  #roving = new RovingFocusController<HTMLElement>(this, {
    items: () => (this.isToolbar && !this.#skipRoving ? this.#stops() : []),
    orientation: () => this.orientation,
    loop: false,
    homeEnd: true,
  })

  #menuRoving = new RovingFocusController<HTMLElement>(this, {
    items: () => (this.menuEl ? [...this.menuEl.querySelectorAll<HTMLElement>("[data-key]")] : []),
    orientation: "vertical",
    loop: false,
    typeahead: (el) => el.dataset.label ?? "",
  })

  #subRoving = new RovingFocusController<HTMLElement>(this, {
    items: () => (this.submenuEl ? [...this.submenuEl.querySelectorAll<HTMLElement>("[data-key]")] : []),
    orientation: "vertical",
    loop: false,
    typeahead: (el) => el.dataset.label ?? "",
  })

  #menuPopup = new PopupController(this, {
    popup: () => this.menuEl,
    trigger: () => this.#trigger,
    haspopup: "menu",
    placement: () =>
      this.orientation === "vertical" ? { side: "inline-end", align: "start", sideOffset: 4 } : { side: "bottom", align: "end", sideOffset: 4 },
    focus: { initial: () => this.#initialMenuFocus(), restore: true },
    onRequestClose: () => this.#closeMenu(),
  })

  #subPopup = new PopupController(this, {
    popup: () => this.submenuEl,
    // Positioned against its menu item; the item's aria-haspopup/aria-expanded are rendered, not managed.
    anchor: () => this.#submenuTrigger,
    haspopup: false,
    expanded: false,
    placement: () => ({ side: "inline-end", align: "start", sideOffset: 2, alignOffset: -5 }),
    focus: { initial: () => (this.#subFocus ? this.#subItems()[0] : null), restore: true },
    onRequestClose: () => this.#closeSubmenu(),
  })

  constructor() {
    super()
    // Arrow keys in a text field move the caret, not the toolbar focus.
    this.addEventListener(
      "keydown",
      (event) => {
        const target = event.composedPath()[0] as Element | undefined
        const caretKeys = target?.localName === "textarea" ? ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"] : ["ArrowLeft", "ArrowRight", "Home", "End"]
        this.#skipRoving = isTextField(target) && caretKeys.includes(event.key)
      },
      true
    )
    // A press elsewhere in the row closes the menu (the row itself counts as "inside" for light dismiss).
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.menuOpen) return
        const path = event.composedPath()
        const inside = [this.menuEl, this.submenuEl, this.#trigger].some((el) => el && path.includes(el))
        if (!inside) this.#closeMenu()
      },
      true
    )
  }

  /** Whether the row is a toolbar (one tab stop, arrow keys). @internal */
  protected get isToolbar(): boolean {
    return false
  }

  /** The items currently in the More menu, in row order. */
  get hiddenItems(): TecOverflowItem[] {
    return this.#entries().flatMap((e) => (e.kind === "item" && this.#hidden.has(e.el) ? [e.el] : []))
  }

  /** Whether the item with `value` is currently in the row (not in the More menu). */
  isItemVisible(value: string): boolean {
    return !this.hiddenItems.some((item) => item.value === value)
  }

  /** Forgets every cached size and measures the row again (after a font or theme change, say). */
  recompute(): void {
    if (!this.#ro) return
    this.#detach()
    this.#attach()
  }

  /** Focuses the More button (when an item is hidden). @internal */
  focusMenuTrigger(): void {
    if (this.#hidden.size) this.#trigger?.focus()
  }

  /** An item, group, divider or spacer changed or connected. @internal */
  itemChanged(_source?: Element): void {
    if (!this.#ro) return
    this.#observeChildren()
    this.#schedule()
    if (this.menuOpen) this.requestUpdate()
  }

  get #trigger(): HTMLElement | null {
    return this.querySelector<HTMLElement>(":scope > [slot=menu-trigger]") ?? this.renderRoot?.querySelector<HTMLElement>(".trigger") ?? null
  }

  get #submenuTrigger(): HTMLElement | null {
    return this.submenuKey ? (this.menuEl?.querySelector<HTMLElement>(`[data-key="${this.submenuKey}"]`) ?? null) : null
  }

  get #horizontal(): boolean {
    return this.orientation !== "vertical"
  }

  // ---- lifecycle -------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback()
    this.toggleState("overflow-root", true)
    if (this.hasUpdated) this.#attach()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#detach()
    clearTimeout(this.#hoverTimer)
    this.menuOpen = false
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed)
    this.#attach()
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed)
    if (this.isToolbar) {
      this.internals.role = "toolbar"
      this.internals.ariaOrientation = this.orientation
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has("orientation") || changed.has("labels") || changed.has("minimumVisible") || changed.has("lastResort")) {
      if (changed.get("orientation") !== undefined || changed.get("labels") !== undefined || changed.get("minimumVisible") !== undefined || changed.get("lastResort") !== undefined) {
        this.recompute()
      }
    }
    for (const entry of this.#entries()) if (entry.kind === "divider") entry.el.setLayoutState(entry.el.matches(":state(overflowing)"), !this.#horizontal)
    if (changed.has("submenuKey")) void this.#subPopup.setOpen(this.submenuKey !== null && this.menuOpen)
    if (changed.has("menuOpen")) {
      if (!this.menuOpen) void this.#subPopup.setOpen(false)
      void this.#menuPopup.setOpen(this.menuOpen)
    }
    this.#menuRoving.update()
    this.#subRoving.update()
  }

  #attach(): void {
    if (this.#ro || !this.sizer) return
    this.#ro = new ResizeObserver(this.#onResize)
    this.#ro.observe(this.sizer)
    this.#ro.observe(this.menuWrap)
    this.#mo = new MutationObserver(() => this.itemChanged())
    this.#mo.observe(this, { childList: true })
    this.#observeChildren()
  }

  #detach(): void {
    this.#ro?.disconnect()
    this.#ro = null
    this.#mo?.disconnect()
    this.#mo = null
    this.#observed = new WeakSet()
    this.#sizes = new WeakMap()
    this.#full = new WeakMap()
    this.#compactSize = new WeakMap()
    this.#margins = new WeakMap()
    this.#outOfFlow = new WeakMap()
    this.#triggerSize = null
    this.#minSize = -1
    cancelAnimationFrame(this.#raf)
    cancelAnimationFrame(this.#minRaf)
    this.style.minInlineSize = ""
    this.style.minBlockSize = ""
    // Start expanded, so hidden items become measurable again.
    if (this.#hidden.size || this.#compact) this.#apply(this.#entries(), new Set(), false, null)
  }

  /** Observes every child (and every group's children) not observed yet. */
  #observeChildren(): void {
    if (!this.#ro) return
    for (const child of this.children) {
      if (child instanceof TecOverflowGroup || child.localName === "tec-overflow-group") {
        if (!this.#observed.has(child)) {
          this.#observed.add(child)
          this.#mo?.observe(child, { childList: true })
        }
        for (const inner of child.children) this.#observe(inner)
      } else this.#observe(child)
    }
  }

  #observe(el: Element): void {
    if (this.#observed.has(el) || el.getAttribute("slot") === "menu-trigger") return
    this.#observed.add(el)
    this.#ro?.observe(el)
  }

  // ---- measurement -----------------------------------------------------------

  #onResize = (records: ResizeObserverEntry[]) => {
    let root = false
    for (const record of records) {
      const box = (record.target === this.sizer ? record.contentBoxSize : record.borderBoxSize)[0]
      if (!box) continue
      const size = this.#horizontal ? box.inlineSize : box.blockSize
      if (record.target === this.sizer) {
        root = true
        const style = getComputedStyle(this)
        const pad = (a: string, b: string) => (Number.parseFloat(style.getPropertyValue(a)) || 0) + (Number.parseFloat(style.getPropertyValue(b)) || 0)
        this.#available = size - (this.#horizontal ? pad("padding-inline-start", "padding-inline-end") : pad("padding-block-start", "padding-block-end"))
        this.#gap = Number.parseFloat(this.#horizontal ? style.columnGap : style.rowGap) || 0
      } else if (record.target === this.menuWrap) {
        if (size > 0) this.#triggerSize = size
      } else if (size > 0) {
        this.#setSize(record.target, size + this.#margin(record.target))
      }
    }
    // Only a pass started by the row's own size runs synchronously (before paint); a pass started by
    // children alone waits a frame, so its writes never land at a depth the observer already delivered.
    if (root) this.#compute()
    else this.#schedule()
  }

  #schedule(): void {
    if (this.#raf) return
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0
      this.#compute()
    })
  }

  #margin(el: Element): number {
    let margin = this.#margins.get(el)
    if (margin === undefined) {
      const style = getComputedStyle(el)
      const [start, end] = this.#horizontal ? [style.marginInlineStart, style.marginInlineEnd] : [style.marginBlockStart, style.marginBlockEnd]
      margin = (Number.parseFloat(start) || 0) + (Number.parseFloat(end) || 0)
      this.#margins.set(el, margin)
    }
    return margin
  }

  #setSize(el: Element, size: number): void {
    if (size <= 0) return
    this.#sizes.set(el, size)
    if (!(el instanceof TecOverflowItem)) return
    if (el.elastic) {
      // An elastic item can always shrink to its minimum: that is its cost.
      const style = getComputedStyle(el)
      const min = Number.parseFloat(this.#horizontal ? style.minWidth : style.minHeight)
      if (min > 0) size = Math.min(size, min + this.#margin(el))
    }
    if (el.compact) this.#compactSize.set(el, size)
    else this.#full.set(el, size)
  }

  #rectSize(el: Element): number {
    const rect = el.getBoundingClientRect()
    return this.#horizontal ? rect.width : rect.height
  }

  /** Measures what the last write revealed and is not cached yet. Returns whether it measured anything. */
  #measureMissing(entries: Entry[]): boolean {
    let measured = false
    for (const entry of entries) {
      if (entry.kind !== "item" || entry.el.overflowing) continue
      const cache = entry.el.compact ? this.#compactSize : this.#full
      if (cache.has(entry.el)) continue
      const size = this.#rectSize(entry.el)
      if (size > 0) {
        this.#setSize(entry.el, size + this.#margin(entry.el))
        measured = true
      }
    }
    if (this.#hidden.size && this.#triggerSize === null) {
      const size = this.#rectSize(this.menuWrap)
      if (size > 0) {
        this.#triggerSize = size
        measured = true
      }
    }
    return measured
  }

  // ---- the pass --------------------------------------------------------------

  #entries(): Entry[] {
    const out: Entry[] = []
    const classify = (el: Element, group: TecOverflowGroup | null) => {
      if (el instanceof TecOverflowItem) {
        if (!el.fixed) out.push({ kind: "item", el, group })
        else out.push({ kind: "fixed", el })
      } else if (el instanceof TecOverflowDivider) out.push({ kind: "divider", el })
      else if (el instanceof TecOverflowSpacer) out.push({ kind: "spacer", el })
      else if (el.getAttribute("slot") !== "menu-trigger" && !this.#isOutOfFlow(el)) out.push({ kind: "fixed", el: el as HTMLElement })
    }
    for (const child of this.children) {
      if (child instanceof TecOverflowGroup) for (const inner of child.children) classify(inner, child)
      else classify(child, null)
    }
    return out
  }

  /** A fixed child outside the flex flow (hidden, absolutely positioned, a script…) costs nothing. */
  #isOutOfFlow(el: Element): boolean {
    let out = this.#outOfFlow.get(el)
    if (out === undefined) {
      const style = getComputedStyle(el)
      out = style.display === "none" || style.position === "absolute" || style.position === "fixed"
      this.#outOfFlow.set(el, out)
    }
    return out
  }

  #itemSize(item: TecOverflowItem, compact: boolean): number {
    const full = this.#full.get(item)
    const small = this.#compactSize.get(item)
    if (compact && item.resolvedLabelBehavior === "collapse") return small ?? Math.min(full ?? ICON_ONLY, ICON_ONLY)
    return full ?? small ?? 0
  }

  /** Running total of the space the row needs; `hide()` removes an item and places the dividers again. */
  #tally(entries: Entry[], compact: boolean) {
    const size = (entry: Entry) => (entry.kind === "item" ? this.#itemSize(entry.el, compact) : entry.kind === "spacer" ? 0 : (this.#sizes.get(entry.el) ?? 0))
    const between = (entry: Entry) => entry.kind === "divider" || entry.kind === "spacer"
    const visible = entries.map((entry) => !between(entry))
    const solid = (index: number) => visible[index] && !between(entries[index]!)
    let total = 0
    let count = 0
    let hiddenCount = 0
    const set = (index: number, shown: boolean) => {
      if (visible[index] === shown) return
      visible[index] = shown
      total += shown ? size(entries[index]!) : -size(entries[index]!)
      count += shown ? 1 : -1
    }
    entries.forEach((entry, index) => {
      if (!visible[index]) return
      total += size(entry)
      count += 1
    })
    // A divider or spacer shows only with something visible on both sides (the More button counts
    // for the end); of dividers with nothing visible between them only the last one shows.
    const place = () => {
      const before: boolean[] = []
      let seen = false
      entries.forEach((_, index) => {
        before[index] = seen
        if (solid(index)) seen = true
      })
      let after = hiddenCount > 0
      let untilDivider = after
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]!
        if (solid(index)) {
          after = untilDivider = true
        } else if (entry.kind === "spacer") {
          set(index, !!before[index] && after)
        } else if (entry.kind === "divider") {
          const shown = !!before[index] && untilDivider
          set(index, shown)
          if (shown) untilDivider = false
        }
      }
    }
    place()
    return {
      visible,
      need: () => {
        const trigger = hiddenCount > 0 ? (this.#triggerSize ?? ICON_ONLY) : 0
        const slots = count + (hiddenCount > 0 ? 1 : 0)
        return total + trigger + Math.max(0, slots - 1) * this.#gap
      },
      hide: (index: number) => {
        set(index, false)
        hiddenCount += 1
        place()
      },
    }
  }

  #compute(): void {
    if (!this.#ro || this.#available <= 0) return
    for (let pass = 0; pass < 4; pass++) {
      const entries = this.#entries()
      const decision = this.#decide(entries)
      const changed = this.#apply(entries, decision.hidden, decision.compact, decision.visible)
      // Read what the write revealed (one layout per pass, never interleaved per item) and decide again.
      if (!changed || !this.#measureMissing(entries)) break
    }
    this.#writeMinSize()
  }

  #decide(entries: Entry[]) {
    const items = entries.flatMap((e) => (e.kind === "item" ? [e] : []))
    const available = this.#available
    const compact = this.labels === "auto" ? this.#horizontal && this.#tally(entries, false).need() > available : this.labels === "never"
    const indexOf = new Map<TecOverflowItem, number>()
    entries.forEach((entry, index) => {
      if (entry.kind === "item") indexOf.set(entry.el, index)
    })
    // Lowest priority first; on a tie the one nearest the logical end leaves first.
    const order = items.map((entry, index) => ({ entry, index })).sort((a, b) => a.entry.el.priority - b.entry.el.priority || b.index - a.index)
    const tally = this.#tally(entries, compact)
    const hidden = new Set<TecOverflowItem>()
    for (const { entry } of order) {
      if (tally.need() <= available) break
      if (hidden.has(entry.el)) continue
      if (items.length - hidden.size <= this.minimumVisible) break
      // An item whose own menu, popover or listbox is open stays until it closes.
      if (entry.el.querySelector('[aria-expanded="true"], [open]')) continue
      const together = entry.group?.collapse === "together"
      for (const member of items) {
        if (hidden.has(member.el)) continue
        if (member === entry || (together && member.group === entry.group)) {
          hidden.add(member.el)
          tally.hide(indexOf.get(member.el) ?? -1)
        }
      }
    }
    if (!this.#warnedLastResort && tally.need() > available) {
      this.#warnedLastResort = true
      console.warn(
        `[tecton] <${this.localName}>: the row needs ${Math.ceil(tally.need())}px but has ${Math.floor(available)}px after moving every item it can into the More menu, so it ${
          this.#horizontal && this.lastResort === "wrap" ? "wraps" : "scrolls"
        }. Fixed items, minimum-visible or an open item's popup keep it from fitting.`,
        this
      )
    }
    return { hidden, compact, visible: tally.visible }
  }

  /** Writes a decision. Returns whether anything changed. */
  #apply(entries: Entry[], hidden: Set<TecOverflowItem>, compact: boolean, visible: boolean[] | null): boolean {
    const hiddenChanged = hidden.size !== this.#hidden.size || [...hidden].some((item) => !this.#hidden.has(item))
    const compactChanged = compact !== this.#compact
    const active = deepActiveElement()

    // Focus leaves with a hidden item and lands on the More button, in the same task.
    let focusTrigger = false
    for (const item of hidden) if (!this.#hidden.has(item) && containsFlat(item, active)) focusTrigger = true
    // The last hidden item returns while the More button or its menu has focus: focus goes to it.
    let returning: TecOverflowItem | null = null
    if (this.#hidden.size > 0 && hidden.size === 0) {
      const focusInMenu = this.menuOpen || containsFlat(this.menuWrap, active) || (!!this.#trigger && containsFlat(this.#trigger, active))
      if (focusInMenu) returning = entries.flatMap((e) => (e.kind === "item" && this.#hidden.has(e.el) ? [e.el] : []))[0] ?? null
    }

    this.#hidden = hidden
    this.#compact = compact
    let changed = hiddenChanged || compactChanged
    entries.forEach((entry, index) => {
      if (entry.kind === "item") {
        const wasCompact = entry.el.compact
        const nextCompact = compact && entry.el.resolvedLabelBehavior === "collapse"
        if (wasCompact !== nextCompact) changed = true
        entry.el.setLayoutState(hidden.has(entry.el), nextCompact)
      } else if (entry.kind === "fixed" && entry.el instanceof TecOverflowItem) {
        entry.el.setLayoutState(false, false)
      } else if (entry.kind === "divider" || entry.kind === "spacer") {
        const shown = visible ? !!visible[index] : true
        if (entry.el.matches(":state(overflowing)") === shown) changed = true
        if (entry.kind === "divider") entry.el.setLayoutState(!shown, !this.#horizontal)
        else entry.el.setLayoutState(!shown)
      }
    })
    this.toggleState("overflowing", hidden.size > 0)
    this.toggleState("compact", compact)

    if (hiddenChanged) {
      this.requestUpdate()
      if (hidden.size === 0 && this.menuOpen) this.#closeMenu()
      this.emit<OverflowChangeDetail>("tec-overflow-change", { detail: { hidden: this.hiddenItems.map((item) => item.value) } })
    }
    this.#roving.update()
    if (focusTrigger) this.#trigger?.focus()
    if (returning) {
      const target = focusTarget(returning)
      // The menu closes first (it would restore focus to its button), then the item takes focus.
      void this.updateComplete.then(() => target?.focus())
    }
    return changed
  }

  /** Fixed items plus the More button are the row's minimum size, so a flex parent cannot squeeze it below. */
  #writeMinSize(): void {
    const entries = this.#entries()
    const fixed = entries.filter((e) => e.kind === "fixed")
    let min = fixed.reduce((sum, e) => sum + (this.#sizes.get(e.el) ?? 0), 0)
    let count = fixed.length
    if (entries.some((e) => e.kind === "item")) {
      min += this.#triggerSize ?? ICON_ONLY
      count += 1
    }
    min = Math.ceil(min + Math.max(0, count - 1) * this.#gap)
    if (min === this.#minSize) return
    this.#minSize = min
    // Written a frame later: growing the row now would resize the observed row inside its own callback.
    cancelAnimationFrame(this.#minRaf)
    this.#minRaf = requestAnimationFrame(() => {
      this.style[this.#horizontal ? "minInlineSize" : "minBlockSize"] = min > 0 ? `${min}px` : ""
    })
  }

  /** Tab stops of a toolbar row: the visible controls in order, then the More button. */
  #stops(): HTMLElement[] {
    const stops: HTMLElement[] = []
    for (const entry of this.#entries()) {
      if (entry.kind === "divider" || entry.kind === "spacer") continue
      if (entry.kind === "item" && this.#hidden.has(entry.el)) continue
      const target = focusTarget(entry.el)
      if (target) stops.push(target)
    }
    const trigger = this.#trigger ? focusTarget(this.#trigger) : null
    if (this.#hidden.size && trigger) stops.push(trigger)
    return stops
  }

  // ---- the menu --------------------------------------------------------------

  #menuModel(): OverflowMenuEntry[] {
    const out: OverflowMenuEntry[] = []
    let pendingSeparator = false
    type Open = { group: TecOverflowGroup; entry: { entries: OverflowMenuEntry[] } }
    let current = null as Open | null
    for (const entry of this.#entries()) {
      if (entry.kind === "divider") {
        pendingSeparator = out.length > 0
        continue
      }
      if (entry.kind !== "item" || !this.#hidden.has(entry.el)) continue
      if (pendingSeparator) {
        out.push({ type: "separator" })
        pendingSeparator = false
        current = null
      }
      const forms = entry.el.menuEntries()
      if (entry.group) {
        const open = current as Open | null
        if (open && open.group === entry.group) open.entry.entries.push(...forms)
        else {
          const group: OverflowMenuEntry & { entries: OverflowMenuEntry[] } = { type: "group", label: entry.group.label || undefined, entries: [...forms] }
          out.push(group)
          current = { group: entry.group, entry: group }
        }
      } else {
        out.push(...forms)
        current = null
      }
    }
    return out
  }

  #initialMenuFocus(): HTMLElement | null {
    const items = this.#menuItems()
    if (this.#openFocus === "first") return items.find((i) => i.getAttribute("aria-disabled") !== "true") ?? this.menuEl
    if (this.#openFocus === "last") return [...items].reverse().find((i) => i.getAttribute("aria-disabled") !== "true") ?? this.menuEl
    return this.menuEl
  }

  #menuItems(): HTMLElement[] {
    return this.menuEl ? [...this.menuEl.querySelectorAll<HTMLElement>("[data-key]")] : []
  }

  #subItems(): HTMLElement[] {
    return this.submenuEl ? [...this.submenuEl.querySelectorAll<HTMLElement>("[data-key]")].filter((i) => i.getAttribute("aria-disabled") !== "true") : []
  }

  #openMenu(focus: "first" | "last" | "menu"): void {
    this.#openFocus = focus
    this.menuOpen = true
  }

  #closeMenu(): void {
    clearTimeout(this.#hoverTimer)
    this.submenuKey = null
    this.menuOpen = false
  }

  #closeSubmenu(): void {
    clearTimeout(this.#hoverTimer)
    this.submenuKey = null
  }

  #openSubmenu(key: string, focus: boolean): void {
    clearTimeout(this.#hoverTimer)
    this.#subFocus = focus
    if (this.submenuKey === key) {
      if (focus) this.#subItems()[0]?.focus()
      return
    }
    if (this.submenuKey !== null) {
      // Another submenu is open: close it first, then open this one.
      this.submenuKey = null
      void this.updateComplete.then(() => {
        this.submenuKey = key
      })
      return
    }
    this.submenuKey = key
  }

  #onTriggerClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    if (this.menuOpen) this.#closeMenu()
    else this.#openMenu(event.detail === 0 ? "first" : "menu")
  }

  #onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    event.stopPropagation()
    this.#openMenu(event.key === "ArrowDown" ? "first" : "last")
    if (this.menuOpen) void this.updateComplete.then(() => this.#initialMenuFocus()?.focus())
  }

  #itemFromEvent(event: Event): HTMLElement | null {
    return (event.composedPath().find((t) => t instanceof HTMLElement && t.dataset.key !== undefined) as HTMLElement | undefined) ?? null
  }

  #activate(el: HTMLElement, viaKeyboard: boolean): void {
    const key = el.dataset.key!
    const entry = this.#entryByKey.get(key)
    if (!entry || !("label" in entry) || entry.type === "group" || entry.type === "label") return
    if ("disabled" in entry && entry.disabled) return
    if (entry.type === "submenu") {
      this.#openSubmenu(key, viaKeyboard)
      return
    }
    const run = "onSelect" in entry ? entry.onSelect : undefined
    if (entry.type === "checkbox") {
      // Checkbox items keep the menu open; the entry re-reads the control's state.
      run?.()
      void Promise.resolve().then(() => this.requestUpdate())
      return
    }
    this.#closeMenu()
    run?.()
  }

  #onMenuClick = (event: MouseEvent) => {
    const el = this.#itemFromEvent(event)
    if (el) this.#activate(el, event.detail === 0)
  }

  #onMenuKeyDown = (event: KeyboardEvent) => {
    const inSubmenu = event.composedPath().includes(this.submenuEl)
    const el = this.#itemFromEvent(event)
    if (event.key === "Tab") {
      event.preventDefault()
      this.#closeMenu()
      return
    }
    if (!el) {
      // Focus is on the menu itself (opened with the pointer): arrows go to the first / last item.
      const items = inSubmenu ? this.#subItems() : this.#menuItems()
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const enabled = items.filter((i) => i.getAttribute("aria-disabled") !== "true")
        ;(event.key === "ArrowDown" ? enabled[0] : enabled[enabled.length - 1])?.focus()
      }
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      this.#activate(el, true)
      return
    }
    const step = horizontalStep(event.key, this)
    if (step === 1 && !inSubmenu && el.getAttribute("aria-haspopup") === "menu") {
      event.preventDefault()
      this.#openSubmenu(el.dataset.key!, true)
    } else if (step === -1 && inSubmenu) {
      event.preventDefault()
      this.#closeSubmenu()
    }
  }

  #onMenuPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    const el = this.#itemFromEvent(event)
    if (!el) return
    const inSubmenu = event.composedPath().includes(this.submenuEl)
    if (el.getAttribute("aria-disabled") !== "true" && this.shadowRoot?.activeElement !== el) el.focus({ preventScroll: true })
    if (inSubmenu) {
      clearTimeout(this.#hoverTimer)
      return
    }
    const key = el.dataset.key!
    if (el.getAttribute("aria-haspopup") === "menu") {
      if (this.submenuKey === key) return
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = setTimeout(() => this.#openSubmenu(key, false), 200)
    } else if (this.submenuKey !== null) {
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = setTimeout(() => this.#closeSubmenu(), 100)
    }
  }

  #groupId(key: string): string {
    let id = this.#menuIds.get(key)
    if (!id) {
      id = uniqueId("tec-overflow-group")
      this.#menuIds.set(key, id)
    }
    return id
  }

  #renderEntries(entries: OverflowMenuEntry[], prefix: string): TemplateResult[] {
    return entries.map((entry, index) => {
      const key = `${prefix}${index}`
      switch (entry.type) {
        case "separator":
          return html`<div class="separator" role="separator"></div>`
        case "label":
          return html`<div class="label" role="presentation">${entry.label}</div>`
        case "group": {
          const id = this.#groupId(key)
          return html`<div class="group" role="group" aria-labelledby=${entry.label ? id : nothing}>
            ${entry.label ? html`<div class="label" id=${id}>${entry.label}</div>` : nothing} ${this.#renderEntries(entry.entries, `${key}.`)}
          </div>`
        }
        default: {
          this.#entryByKey.set(key, entry)
          const checkable = entry.type === "checkbox" || entry.type === "radio"
          const submenu = entry.type === "submenu"
          const role = entry.type === "checkbox" ? "menuitemcheckbox" : entry.type === "radio" ? "menuitemradio" : "menuitem"
          const iconNode = entry.icon ? (entry.icon.cloneNode(true) as Element) : null
          iconNode?.removeAttribute("slot")
          iconNode?.setAttribute("aria-hidden", "true")
          return html`<div
            class="item"
            part="menu-item"
            role=${role}
            tabindex="-1"
            data-key=${key}
            data-label=${entry.label}
            data-variant=${entry.destructive ? "destructive" : nothing}
            ?data-checkable=${checkable}
            ?data-open=${submenu && this.submenuKey === key}
            aria-disabled=${entry.disabled ? "true" : nothing}
            aria-checked=${checkable ? String(entry.checked) : nothing}
            aria-haspopup=${submenu ? "menu" : nothing}
            aria-expanded=${submenu ? String(this.submenuKey === key) : nothing}
          >
            ${iconNode ?? nothing}<span class="item-label">${entry.label}</span>
            ${entry.shortcut ? html`<span class="shortcut">${entry.shortcut}</span>` : nothing}
            ${checkable ? html`<span class="indicator">${entry.checked ? icon(Check, { size: 16 }) : nothing}</span>` : nothing}
            ${submenu ? html`<span class="chevron">${icon(ChevronRight, { size: 16 })}</span>` : nothing}
          </div>`
        }
      }
    })
  }

  protected override render() {
    this.#entryByKey.clear()
    const model = this.menuOpen ? this.#menuModel() : []
    const main = this.menuOpen ? this.#renderEntries(model, "") : []
    const submenuEntry = this.submenuKey !== null ? this.#entryByKey.get(this.submenuKey) : undefined
    const sub = submenuEntry?.type === "submenu" ? this.#renderEntries(submenuEntry.entries, `${this.submenuKey}>`) : []
    const count = this.#hidden.size
    return html`<div class="sizer" aria-hidden="true"></div>
      <slot @slotchange=${() => this.itemChanged()}></slot>
      <span class="menu-wrap">
        <div class="menu" part="menu">
          <slot name="menu-trigger" @click=${this.#onTriggerClick} @keydown=${this.#onTriggerKeyDown} @slotchange=${() => this.requestUpdate()}>
            <tec-button class="trigger" part="menu-trigger" variant="ghost" size="icon" aria-label=${this.menuLabel}>${icon(Ellipsis, { size: 16 })}</tec-button>
          </slot>
          ${this.overflowBadge && count ? html`<span class="badge" part="menu-badge" aria-hidden="true">${count > 99 ? "99+" : count}</span>` : nothing}
          <div
            class="menu-content"
            part="menu-content"
            popover="manual"
            role="menu"
            tabindex="-1"
            aria-label=${this.menuLabel}
            @click=${this.#onMenuClick}
            @keydown=${this.#onMenuKeyDown}
            @pointermove=${this.#onMenuPointerMove}
          >
            ${main}
          </div>
          <div
            class="menu-content submenu"
            part="submenu"
            popover="manual"
            role="menu"
            tabindex="-1"
            aria-label=${submenuEntry && "label" in submenuEntry ? (submenuEntry.label ?? nothing) : nothing}
            @click=${this.#onMenuClick}
            @keydown=${this.#onMenuKeyDown}
            @pointermove=${this.#onMenuPointerMove}
          >
            ${sub}
          </div>
        </div>
      </span>`
  }
}

/**
 * The same row as `tec-overflow` with toolbar semantics (`role="toolbar"`): one tab stop, arrow keys
 * move between the visible controls in visual order (skipping hidden ones), Home and End go to the
 * first and last, and the More button is the last stop. Arrow keys inside a text field keep moving
 * the caret. Give it an `aria-label`.
 *
 * @summary A toolbar whose controls collapse into a More menu as it gets narrow.
 *
 * @tag tec-toolbar
 *
 * @slot - `tec-overflow-item`s, dividers, spacers, groups and fixed controls.
 * @slot menu-trigger - A custom More button.
 *
 * @csspart menu - The wrapper of the More button.
 * @csspart menu-trigger - The default More button (`tec-button`).
 * @csspart menu-badge - The count badge on the More button.
 * @csspart menu-content - The More menu.
 * @csspart submenu - A submenu in the More menu.
 * @csspart menu-item - A menu entry.
 *
 * @cssprop --tec-overflow-gap - Gap between the items (default 0.5rem).
 *
 * @cssstate overflowing - At least one item is in the More menu.
 * @cssstate compact - Labels are collapsed.
 *
 * @fires tec-overflow-change - The set of items in the More menu changed. `detail: { hidden }`.
 */
export class TecToolbar extends TecOverflow {
  protected override get isToolbar(): boolean {
    return true
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tec-overflow": TecOverflow
    "tec-toolbar": TecToolbar
  }
}
