import { html, nothing, type PropertyValues } from "lit"
import { property, state } from "lit/decorators.js"
import { repeat } from "lit/directives/repeat.js"
import { styleMap } from "lit/directives/style-map.js"
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert, X } from "lucide"
import { icon } from "../../internal/icons.js"
import { hostStyles } from "../../internal/styles.js"
import { TectonElement } from "../../internal/tecton-element.js"
import { toastStore, type ToastContent, type ToastData, type ToastId, type ToastMessage, type ToastPosition } from "./toast.js"
import { toasterStyles } from "./toaster.styles.js"

const TOAST_WIDTH = 356
const TIME_BEFORE_UNMOUNT = 200
const SWIPE_THRESHOLD = 45
const ANNOUNCE_CLEAR = 5000

type SwipeDirection = "top" | "bottom" | "left" | "right"

interface ToastRecord {
  data: ToastData
  mounted: boolean
  removed: boolean
  height: number
  needsMeasure: boolean
  offsetBeforeRemove: number
  swiping: boolean
  swiped: boolean
  swipeOut: boolean
  swipeAxis: "x" | "y" | null
  swipeOutDirection: "left" | "right" | "up" | "down" | null
  pointerStart: { x: number; y: number } | null
  dragStart: number
  remaining: number
  duration: number
  timerStart: number
  timer: number | undefined
}

interface Hotkey {
  code: string
  alt: boolean
  ctrl: boolean
  shift: boolean
  meta: boolean
  label: string
}

function parseHotkeys(value: string): Hotkey[] {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((combo) => {
      const parts = combo.split("+")
      const key = parts.pop() ?? ""
      const mods = parts.map((p) => p.toLowerCase())
      const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : key
      return {
        code,
        alt: mods.includes("alt"),
        ctrl: mods.includes("ctrl") || mods.includes("control"),
        shift: mods.includes("shift"),
        meta: mods.includes("meta") || mods.includes("cmd"),
        label: [...mods, key.length === 1 ? key.toUpperCase() : key].join("+"),
      }
    })
}

const textOf = (content: ToastContent | undefined): string => {
  const value = typeof content === "function" ? content() : content
  if (value === undefined || value === null) return ""
  return (typeof value === "string" ? value : (value.textContent ?? "")).replace(/\s+/g, " ").trim()
}

const render = (content: ToastContent | undefined) => (typeof content === "function" ? content() : content)

/** Toasters in the page, per `toaster-id` ("" = default). Only the first connected one shows toasts. */
const registry = new Map<string, TecToaster[]>()

/**
 * Mount one toaster per page (per `toaster-id`), anywhere — usually at the end of `<body>` — and call
 * `toast()` from `@tecton/wc/sonner` anywhere else. Toasts stack in a corner, expand on hover, pause
 * their timers while hovered, focused or while the tab is hidden, and can be swiped away. The toast
 * region renders in the top layer (above dialogs). When several toasters share a `toaster-id`, only
 * the first connected one shows toasts.
 *
 * Accessibility: the toasts are a list in a region landmark named "Notifications alt+T"; new toasts
 * are announced through a polite live region (`role="status"`), error toasts through an assertive one
 * (`role="alert"`). Alt+T (and F6) move focus to the toasts, Escape returns it. Timers pause while
 * focus is inside.
 *
 * Colours follow the theme: toasts use the popover surface, and `success` / `info` / `warning` /
 * `error` toasts the Tecton outlined status colours.
 *
 * @summary An opinionated toast notification stack. Show toasts with the `toast()` function.
 *
 * @tag tec-toaster
 *
 * @csspart region - The region landmark (a manual popover covering the viewport, click-through).
 * @csspart list - A stack of toasts (one per position in use).
 * @csspart toast - A toast. Also has the part of its type: `success`, `info`, `warning`, `error`, `loading`, `default`.
 * @csspart icon - The type icon.
 * @csspart content - The title and description wrapper.
 * @csspart title - The title.
 * @csspart description - The description.
 * @csspart action - The action button.
 * @csspart cancel - The cancel button.
 * @csspart close-button - The close button.
 */
export class TecToaster extends TectonElement {
  static styles = [hostStyles, toasterStyles]

  /** Where toasts appear. */
  @property({ reflect: true }) position: ToastPosition = "bottom-right"

  /** Shows every toast expanded instead of stacked. */
  @property({ type: Boolean, reflect: true }) expand = false

  /** Adds a close button to every toast. */
  @property({ type: Boolean, reflect: true, attribute: "close-button" }) closeButton = false

  /** Default time (ms) before a toast closes. */
  @property({ type: Number }) duration = 4000

  /** How many toasts are visible in a stack. */
  @property({ type: Number, attribute: "visible-toasts" }) visibleToasts = 3

  /** Space (px) between expanded toasts. */
  @property({ type: Number }) gap = 14

  /** Distance of the stack from the viewport edges (CSS length). */
  @property() offset = "24px"

  /** Distance from the edges on screens narrower than 600px. */
  @property({ attribute: "mobile-offset" }) mobileOffset = "16px"

  /** Space-separated key combinations that move focus to the toasts (`event.code` based: `Alt+T` works on any layout). */
  @property() hotkey = "Alt+T F6"

  /** Name of the region landmark (the first hotkey is appended). */
  @property() label = "Notifications"

  /** Accessible name of the close buttons. */
  @property({ attribute: "close-label" }) closeLabel = "Close toast"

  /** Shows only toasts created with the same `toasterId` (and makes this toaster independent of the default one). */
  @property({ attribute: "toaster-id" }) toasterId = ""

  @state() private records: ToastRecord[] = []
  @state() private expanded = false
  @state() private politeMessage = ""
  @state() private assertiveMessage = ""

  #interacting = false
  #focusWithin = false
  #documentHidden = typeof document !== "undefined" && document.hidden
  #lastFocused: HTMLElement | null = null
  #unsubscribe: (() => void) | null = null
  #registeredId: string | null = null
  #clearAnnouncement?: number

  override connectedCallback(): void {
    super.connectedCallback()
    this.#register()
    document.addEventListener("keydown", this.#onDocumentKeyDown)
    document.addEventListener("visibilitychange", this.#onVisibilityChange)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unregister()
    document.removeEventListener("keydown", this.#onDocumentKeyDown)
    document.removeEventListener("visibilitychange", this.#onVisibilityChange)
    for (const r of this.records) clearTimeout(r.timer)
  }

  /** Whether this toaster is the one showing toasts for its `toaster-id`. */
  get active(): boolean {
    return this.#unsubscribe !== null
  }

  #register(): void {
    const id = this.toasterId
    this.#registeredId = id
    const list = registry.get(id) ?? []
    list.push(this)
    registry.set(id, list)
    if (list[0] === this) this.#activate()
  }

  #unregister(): void {
    const id = this.#registeredId ?? ""
    const list = (registry.get(id) ?? []).filter((t) => t !== this)
    if (list.length) registry.set(id, list)
    else registry.delete(id)
    const wasActive = this.active
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.records = []
    const next = list[0]
    if (wasActive && next) next.#activate()
  }

  #activate(): void {
    if (this.#unsubscribe) return
    this.#unsubscribe = toastStore.subscribe(this.#onMessage)
  }

  #onMessage = (message: ToastMessage) => {
    const existing = this.records.find((r) => r.data.id === message.id)
    if ("dismiss" in message) {
      if (existing && !existing.removed) {
        existing.data.onDismiss?.(existing.data)
        this.#delete(existing)
      }
      return
    }
    const data = message
    if ((data.toasterId ?? "") !== this.toasterId) return
    if (existing && !existing.removed) {
      const duration = data.duration ?? this.duration
      if (duration !== existing.duration) {
        existing.duration = duration
        existing.remaining = duration
      }
      const announce = existing.data.type !== data.type || textOf(existing.data.title) !== textOf(data.title)
      existing.data = data
      existing.needsMeasure = true
      this.records = [...this.records]
      if (announce) this.#announce(data)
      return
    }
    const duration = data.duration ?? this.duration
    const record: ToastRecord = {
      data,
      mounted: false,
      removed: false,
      height: 0,
      needsMeasure: true,
      offsetBeforeRemove: 0,
      swiping: false,
      swiped: false,
      swipeOut: false,
      swipeAxis: null,
      swipeOutDirection: null,
      pointerStart: null,
      dragStart: 0,
      remaining: duration,
      duration,
      timerStart: 0,
      timer: undefined,
    }
    this.records = [record, ...this.records.filter((r) => r !== existing)]
    this.#announce(data)
    this.#raise = true
  }

  /** Bring the region to the top of the top layer when a toast arrives (e.g. above a newer dialog). */
  #raise = false

  #announce(data: ToastData): void {
    const text = [textOf(data.title), textOf(data.description)].filter(Boolean).join(". ")
    if (!text) return
    const assertive = data.type === "error"
    // Clear first so a repeated message is announced again.
    this.politeMessage = ""
    this.assertiveMessage = ""
    clearTimeout(this.#clearAnnouncement)
    setTimeout(() => {
      if (assertive) this.assertiveMessage = text
      else this.politeMessage = text
      this.#clearAnnouncement = window.setTimeout(() => {
        this.politeMessage = ""
        this.assertiveMessage = ""
      }, ANNOUNCE_CLEAR)
    }, 100)
  }

  // ------------------------------------------------------------------ layout helpers

  #positionOf(r: ToastRecord): ToastPosition {
    return r.data.position ?? this.position
  }

  #list(position: ToastPosition): ToastRecord[] {
    return this.records.filter((r) => this.#positionOf(r) === position)
  }

  #offsetOf(r: ToastRecord): number {
    if (r.removed) return r.offsetBeforeRemove
    const list = this.#list(this.#positionOf(r))
    let offset = 0
    for (const other of list) {
      if (other === r) break
      if (!other.removed && other.height) offset += other.height + this.gap
    }
    return offset
  }

  #element(r: ToastRecord): HTMLLIElement | null {
    return this.renderRoot.querySelector<HTMLLIElement>(`li[data-id="${CSS.escape(String(r.data.id))}"]`)
  }

  // ------------------------------------------------------------------ timers

  get #paused(): boolean {
    return this.expanded || this.#interacting || this.#documentHidden || this.#focusWithin
  }

  #syncTimers(): void {
    const now = Date.now()
    for (const r of this.records) {
      const run = !r.removed && r.mounted && r.data.type !== "loading" && r.duration !== Infinity && !this.#paused
      if (r.timer !== undefined && !run) {
        clearTimeout(r.timer)
        r.timer = undefined
        r.remaining -= now - r.timerStart
      } else if (r.timer === undefined && run) {
        r.timerStart = now
        r.timer = window.setTimeout(() => {
          r.timer = undefined
          r.data.onAutoClose?.(r.data)
          this.#delete(r)
        }, Math.max(0, r.remaining))
      }
    }
  }

  #delete(r: ToastRecord): void {
    if (r.removed) return
    r.offsetBeforeRemove = this.#offsetOf(r)
    clearTimeout(r.timer)
    r.timer = undefined
    // Move focus off a toast that goes away.
    const el = this.#element(r)
    const active = this.shadowRoot?.activeElement
    if (el && active && el.contains(active)) {
      const list = this.#list(this.#positionOf(r)).filter((o) => o !== r && !o.removed)
      const next = list[0] ? this.#element(list[0]) : null
      if (next) next.focus({ preventScroll: true })
      else this.#restoreFocus()
    }
    r.removed = true
    this.records = [...this.records]
    toastStore.forget(r.data.id)
    setTimeout(() => {
      this.records = this.records.filter((o) => o !== r)
      if (this.records.length <= 1) this.expanded = false
    }, TIME_BEFORE_UNMOUNT)
  }

  #restoreFocus(): void {
    const target = this.#lastFocused
    this.#lastFocused = null
    if (target?.isConnected) target.focus({ preventScroll: true })
  }

  // ------------------------------------------------------------------ interaction

  get #hotkeys(): Hotkey[] {
    return parseHotkeys(this.hotkey)
  }

  #onDocumentKeyDown = (event: KeyboardEvent) => {
    if (!this.active || event.defaultPrevented) return
    const hit = this.#hotkeys.find(
      (h) => event.code === h.code && event.altKey === h.alt && event.ctrlKey === h.ctrl && event.metaKey === h.meta && (!h.shift || event.shiftKey)
    )
    if (hit) {
      if (!this.records.some((r) => !r.removed)) return
      event.preventDefault()
      if (this.#focusWithin && hit.code === "F6") {
        this.#restoreFocus()
        return
      }
      if (!this.#focusWithin) this.#lastFocused = this.#deepActive()
      this.expanded = true
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>("ol")?.focus({ preventScroll: true }))
      return
    }
    if (event.key === "Escape" && this.#focusWithin) {
      this.expanded = false
      this.#restoreFocus()
    }
  }

  #deepActive(): HTMLElement | null {
    let el = document.activeElement
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
    return (el as HTMLElement | null) ?? null
  }

  #onVisibilityChange = () => {
    this.#documentHidden = document.hidden
    this.#syncTimers()
  }

  #onFocusIn = (event: FocusEvent) => {
    if (!this.#focusWithin) {
      this.#focusWithin = true
      const from = event.relatedTarget as HTMLElement | null
      if (!this.#lastFocused && from && !this.shadowRoot!.contains(from)) this.#lastFocused = from
      this.expanded = true
      this.#syncTimers()
    }
  }

  #onFocusOut = (event: FocusEvent) => {
    const to = event.relatedTarget as Node | null
    if (to && this.shadowRoot!.contains(to)) return
    this.#focusWithin = false
    if (!this.#interacting) this.expanded = false
    // Focus was lost (e.g. the focused toast closed): return it to where it came from.
    if (!to) this.#restoreFocus()
    else this.#lastFocused = null
    this.#syncTimers()
  }

  #onListPointerDown = (event: PointerEvent) => {
    const target = event.composedPath()[0] as HTMLElement | undefined
    if (target?.closest?.("li")?.dataset.dismissible === "false") return
    this.#interacting = true
    this.#syncTimers()
  }

  #onListPointerUp = () => {
    this.#interacting = false
    this.#syncTimers()
  }

  #onListMouseEnter = () => {
    this.expanded = true
  }

  #onListMouseLeave = () => {
    if (!this.#interacting && !this.#focusWithin) this.expanded = false
  }

  #dismissByUser(r: ToastRecord): void {
    if (r.data.dismissible === false || r.data.type === "loading") return
    r.data.onDismiss?.(r.data)
    this.#delete(r)
  }

  #swipeDirections(r: ToastRecord): SwipeDirection[] {
    const [y, x] = this.#positionOf(r).split("-") as [string, string]
    return [y, x].filter((d): d is SwipeDirection => d === "top" || d === "bottom" || d === "left" || d === "right")
  }

  #onToastPointerDown(r: ToastRecord, event: PointerEvent): void {
    if (event.button === 2) return
    if (r.data.type === "loading" || r.data.dismissible === false) return
    r.dragStart = Date.now()
    r.offsetBeforeRemove = this.#offsetOf(r)
    const target = event.composedPath()[0] as HTMLElement
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      /* no active pointer (synthetic event) */
    }
    if (target.localName === "button") return
    r.swiping = true
    r.pointerStart = { x: event.clientX, y: event.clientY }
    this.records = [...this.records]
  }

  #onToastPointerMove(r: ToastRecord, event: PointerEvent): void {
    if (!r.pointerStart || r.data.dismissible === false) return
    if ((window.getSelection()?.toString().length ?? 0) > 0) return
    const dy = event.clientY - r.pointerStart.y
    const dx = event.clientX - r.pointerStart.x
    if (!r.swipeAxis && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) r.swipeAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    const directions = this.#swipeDirections(r)
    const dampen = (d: number) => {
      const damped = d * (1 / (1.5 + Math.abs(d) / 20))
      return Math.abs(damped) < Math.abs(d) ? damped : d
    }
    const amount = { x: 0, y: 0 }
    if (r.swipeAxis === "y" && (directions.includes("top") || directions.includes("bottom"))) {
      amount.y = (directions.includes("top") && dy < 0) || (directions.includes("bottom") && dy > 0) ? dy : dampen(dy)
    } else if (r.swipeAxis === "x" && (directions.includes("left") || directions.includes("right"))) {
      amount.x = (directions.includes("left") && dx < 0) || (directions.includes("right") && dx > 0) ? dx : dampen(dx)
    }
    if (amount.x || amount.y) r.swiped = true
    const el = this.#element(r)
    el?.style.setProperty("--swipe-amount-x", `${amount.x}px`)
    el?.style.setProperty("--swipe-amount-y", `${amount.y}px`)
    this.records = [...this.records]
  }

  #onToastPointerUp(r: ToastRecord): void {
    if (r.swipeOut || r.data.dismissible === false) return
    r.pointerStart = null
    const el = this.#element(r)
    const ax = Number(el?.style.getPropertyValue("--swipe-amount-x").replace("px", "") || 0)
    const ay = Number(el?.style.getPropertyValue("--swipe-amount-y").replace("px", "") || 0)
    const time = Math.max(1, Date.now() - r.dragStart)
    const amount = r.swipeAxis === "x" ? ax : ay
    const velocity = Math.abs(amount) / time
    const directions = this.#swipeDirections(r)
    const allowed = r.swipeAxis === "x" ? directions.includes(ax > 0 ? "right" : "left") : r.swipeAxis === "y" ? directions.includes(ay > 0 ? "bottom" : "top") : false
    if (allowed && amount !== 0 && (Math.abs(amount) >= SWIPE_THRESHOLD || velocity > 0.11)) {
      r.swipeOutDirection = r.swipeAxis === "x" ? (ax > 0 ? "right" : "left") : ay > 0 ? "down" : "up"
      r.swipeOut = true
      r.data.onDismiss?.(r.data)
      this.#delete(r)
      return
    }
    el?.style.setProperty("--swipe-amount-x", "0px")
    el?.style.setProperty("--swipe-amount-y", "0px")
    r.swiped = false
    r.swiping = false
    r.swipeAxis = null
    this.records = [...this.records]
  }

  #onAction(r: ToastRecord, event: MouseEvent): void {
    const action = r.data.action
    action?.onClick?.(event)
    if (!event.defaultPrevented) this.#delete(r)
  }

  #onCancel(r: ToastRecord, event: MouseEvent): void {
    if (r.data.dismissible === false) return
    r.data.cancel?.onClick?.(event)
    this.#delete(r)
  }

  // ------------------------------------------------------------------ lifecycle

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const region = this.renderRoot.querySelector<HTMLElement>(".region")
    if (region) {
      const shown = region.matches(":popover-open")
      if (this.records.length && (!shown || (this.#raise && !this.#focusWithin))) {
        if (shown) region.hidePopover()
        region.showPopover()
      } else if (!this.records.length && shown) {
        region.hidePopover()
      }
      this.#raise = false
    }
    let mount = false
    for (const r of this.records) {
      if (!r.needsMeasure || r.removed) continue
      const el = this.#element(r)
      if (!el) continue
      const previous = el.style.height
      el.style.height = "auto"
      const height = el.offsetHeight
      el.style.height = previous
      r.needsMeasure = false
      if (height !== r.height) {
        r.height = height
        mount = true
      }
      if (!r.mounted) mount = true
    }
    if (mount) {
      requestAnimationFrame(() => {
        for (const r of this.records) r.mounted = true
        this.records = [...this.records]
      })
    }
    this.#syncTimers()
  }

  #renderIcon(r: ToastRecord) {
    const { type, promise } = r.data
    if (r.data.icon === null) return nothing
    const custom = r.data.icon
    if (type === "default" && !custom && !promise) return nothing
    const typeIcon =
      custom ??
      (type === "success"
        ? icon(CircleCheck, { size: 16 })
        : type === "info"
          ? icon(Info, { size: 16 })
          : type === "warning"
            ? icon(TriangleAlert, { size: 16 })
            : type === "error"
              ? icon(OctagonX, { size: 16 })
              : nothing)
    const loader =
      type === "loading" || promise
        ? html`<div class="loader" data-visible=${type === "loading" ? "true" : "false"}>${icon(LoaderCircle, { size: 16, class: "spin" })}</div>`
        : nothing
    return html`<div data-icon part="icon">${loader}${type === "loading" ? nothing : typeIcon}</div>`
  }

  #renderToast(r: ToastRecord, index: number, list: ToastRecord[]) {
    const [y, x] = this.#positionOf(r).split("-")
    const { data } = r
    const type = data.type ?? "default"
    const closeButton = (data.closeButton ?? this.closeButton) && type !== "loading"
    const dismissible = data.dismissible !== false
    const styles = {
      "--index": String(index),
      "--toasts-before": String(index),
      "--z-index": String(list.length - index),
      "--offset": `${this.#offsetOf(r)}px`,
      "--initial-height": this.expand ? "auto" : `${r.height}px`,
    }
    return html`<li
      class=${data.className ?? ""}
      part="toast ${type}"
      tabindex="0"
      data-id=${String(data.id)}
      data-type=${type === "default" ? nothing : type}
      data-mounted=${String(r.mounted)}
      data-removed=${String(r.removed)}
      data-visible=${String(index + 1 <= this.visibleToasts)}
      data-front=${String(index === 0)}
      data-y-position=${y ?? "bottom"}
      data-x-position=${x ?? "right"}
      data-swiping=${String(r.swiping)}
      data-swiped=${String(r.swiped)}
      data-swipe-out=${String(r.swipeOut)}
      data-swipe-direction=${r.swipeOutDirection ?? nothing}
      data-expanded=${String(this.expanded || (this.expand && r.mounted))}
      data-promise=${String(!!data.promise)}
      data-dismissible=${String(dismissible)}
      style=${styleMap(styles)}
      @pointerdown=${(e: PointerEvent) => this.#onToastPointerDown(r, e)}
      @pointermove=${(e: PointerEvent) => this.#onToastPointerMove(r, e)}
      @pointerup=${() => this.#onToastPointerUp(r)}
      @keydown=${(e: KeyboardEvent) => {
        if ((e.key === "Delete" || e.key === "Backspace") && e.target === e.currentTarget && dismissible) {
          e.preventDefault()
          this.#dismissByUser(r)
        }
      }}
    >
      ${closeButton
        ? html`<button
            type="button"
            data-close-button
            part="close-button"
            aria-label=${this.closeLabel}
            ?disabled=${!dismissible}
            @click=${() => this.#dismissByUser(r)}
          >${icon(X, { size: 12, strokeWidth: 1.5 })}</button>`
        : nothing}
      ${this.#renderIcon(r)}
      <div data-content part="content">
        <div data-title part="title">${render(data.title)}</div>
        ${data.description ? html`<div data-description part="description">${render(data.description)}</div>` : nothing}
      </div>
      ${data.cancel
        ? html`<button type="button" data-button data-cancel part="cancel" @click=${(e: MouseEvent) => this.#onCancel(r, e)}>${data.cancel.label}</button>`
        : nothing}
      ${data.action
        ? html`<button type="button" data-button data-action part="action" @click=${(e: MouseEvent) => this.#onAction(r, e)}>${data.action.label}</button>`
        : nothing}
    </li>`
  }

  protected override render() {
    const positions = [...new Set([this.position, ...this.records.map((r) => this.#positionOf(r))])]
    const hotkeys = this.#hotkeys
    const hotkeyLabel = hotkeys[0] ? hotkeys[0].label.replace(/^(alt|ctrl|shift|meta)\+/i, (m) => m.toLowerCase()) : ""
    const dir = getComputedStyle(this).direction === "rtl" ? "rtl" : "ltr"
    const offsets = (value: string, prefix: string) =>
      Object.fromEntries(["top", "right", "bottom", "left"].map((side) => [`${prefix}-${side}`, value]))
    return html`<section
      class="region"
      part="region"
      popover="manual"
      aria-label=${[this.label, hotkeyLabel].filter(Boolean).join(" ")}
      tabindex="-1"
      @focusin=${this.#onFocusIn}
      @focusout=${this.#onFocusOut}
    >
      ${positions.map((position) => {
        const list = this.#list(position)
        if (!list.length) return nothing
        const [y, x] = position.split("-")
        const front = list.find((r) => !r.removed)
        const styles = {
          "--front-toast-height": `${front?.height ?? 0}px`,
          "--width": `${TOAST_WIDTH}px`,
          "--gap": `${this.gap}px`,
          ...offsets(this.offset, "--offset"),
          ...offsets(this.mobileOffset, "--mobile-offset"),
        }
        return html`<ol
          part="list"
          dir=${dir}
          tabindex="-1"
          data-y-position=${y ?? "bottom"}
          data-x-position=${x ?? "right"}
          style=${styleMap(styles)}
          @mouseenter=${this.#onListMouseEnter}
          @mousemove=${this.#onListMouseEnter}
          @mouseleave=${this.#onListMouseLeave}
          @pointerdown=${this.#onListPointerDown}
          @pointerup=${this.#onListPointerUp}
        >
          ${repeat(list, (r) => r.data.id, (r, i) => this.#renderToast(r, i, list))}
        </ol>`
      })}
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this.politeMessage}</div>
      <div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true">${this.assertiveMessage}</div>
    </section>`
  }
}

export type { ToastId }

declare global {
  interface HTMLElementTagNameMap {
    "tec-toaster": TecToaster
  }
}
