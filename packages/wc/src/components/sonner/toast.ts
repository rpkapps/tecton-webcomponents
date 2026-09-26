/**
 * The imperative toast API (`toast()`, `toast.success()` …) and the store every `<tec-toaster>`
 * subscribes to. Toasts created before a toaster connects are shown when it does.
 */

export type ToastType = "default" | "success" | "info" | "warning" | "error" | "loading"
export type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
export type ToastId = string | number
/** Text, a DOM node, or a function returning either (called on every render). */
export type ToastContent = string | Node | (() => string | Node)

/** A button rendered in the toast. The toast closes after `onClick` unless it calls `event.preventDefault()`. */
export interface ToastAction {
  label: string
  onClick?: (event: MouseEvent) => void
}

export interface ToastOptions {
  /** Reuse an id to update a toast in place (e.g. a repeated "Saved"). */
  id?: ToastId
  /** Secondary text under the title. */
  description?: ToastContent
  /** Milliseconds before the toast closes (default: the toaster's `duration`, 4000). `Infinity` keeps it open. */
  duration?: number
  /** The primary button (e.g. Undo). */
  action?: ToastAction
  /** A secondary button that closes the toast. */
  cancel?: ToastAction
  /** A custom icon (node), or `null` for none. */
  icon?: Node | null
  /** Shows the close button on this toast (overrides the toaster's `close-button`). */
  closeButton?: boolean
  /** `false`: the toast cannot be swiped or closed by the user. Default `true`. */
  dismissible?: boolean
  /** Where this toast appears (overrides the toaster's `position`). */
  position?: ToastPosition
  /** Only the `<tec-toaster toaster-id="…">` with this id shows the toast. */
  toasterId?: string
  /** Called when the user closes the toast (close button, swipe, cancel) or `toast.dismiss()` is called. */
  onDismiss?: (toast: ToastData) => void
  /** Called when the toast closes after its duration. */
  onAutoClose?: (toast: ToastData) => void
  /** Class names added to the toast element (styles must reach it, e.g. through `::part(toast)`). */
  className?: string
}

/** A toast as the toaster renders it. */
export interface ToastData extends ToastOptions {
  id: ToastId
  type: ToastType
  title?: ToastContent
  /** Created by `toast.promise()`. */
  promise?: boolean
}

/** Store message: a toast to add or update, or a dismissal. */
export type ToastMessage = ToastData | { id: ToastId; dismiss: true }

type Subscriber = (message: ToastMessage) => void

let counter = 1

class ToastStore {
  #subscribers = new Set<Subscriber>()
  #active: ToastData[] = []

  subscribe(subscriber: Subscriber): () => void {
    this.#subscribers.add(subscriber)
    for (const t of this.#active) subscriber(t)
    return () => this.#subscribers.delete(subscriber)
  }

  #publish(message: ToastMessage): void {
    for (const s of this.#subscribers) s(message)
  }

  create(data: Omit<ToastData, "id"> & { id?: ToastId }): ToastId {
    const id = data.id !== undefined && data.id !== "" ? data.id : counter++
    const existing = this.#active.find((t) => t.id === id)
    const next: ToastData = existing ? { ...existing, ...data, id } : { ...data, id }
    this.#active = existing ? this.#active.map((t) => (t.id === id ? next : t)) : [...this.#active, next]
    this.#publish(next)
    return id
  }

  dismiss(id?: ToastId): ToastId | undefined {
    const targets = id === undefined ? [...this.#active] : this.#active.filter((t) => t.id === id)
    this.#active = id === undefined ? [] : this.#active.filter((t) => t.id !== id)
    for (const t of targets) this.#publish({ id: t.id, dismiss: true })
    if (id !== undefined && !targets.length) this.#publish({ id, dismiss: true })
    return id
  }

  /** Drops a toast the toaster already removed (no message). */
  forget(id: ToastId): void {
    this.#active = this.#active.filter((t) => t.id !== id)
  }

  get active(): ToastData[] {
    return [...this.#active]
  }
}

/** @internal The shared store (one per page / module instance). */
export const toastStore = new ToastStore()

type Message = ToastContent
type PromiseResult<T> = Message | ((value: T) => Message | (ToastOptions & { message: Message }))

export interface PromiseOptions<T> extends Omit<ToastOptions, "description"> {
  loading?: Message
  success?: PromiseResult<T>
  error?: PromiseResult<unknown>
  description?: Message | ((value: unknown) => Message)
  finally?: () => void
}

const make =
  (type: ToastType) =>
  (message: Message, options: ToastOptions = {}): ToastId =>
    toastStore.create({ ...options, title: message, type })

function resolveResult<T>(result: PromiseResult<T> | undefined, value: T): { title?: Message } & ToastOptions {
  if (result === undefined) return {}
  const r = typeof result === "function" && !(result as unknown as Node).nodeType ? (result as (v: T) => unknown)(value) : result
  if (r && typeof r === "object" && "message" in (r as object)) {
    const { message, ...rest } = r as ToastOptions & { message: Message }
    return { ...rest, title: message }
  }
  return { title: r as Message }
}

function promise<T>(input: Promise<T> | (() => Promise<T>), options: PromiseOptions<T>): { id: ToastId | undefined; unwrap: () => Promise<T> } {
  const { loading, success, error, description, finally: onFinally, ...rest } = options
  let id: ToastId | undefined
  if (loading !== undefined) {
    id = toastStore.create({ ...rest, promise: true, type: "loading", title: loading, description: typeof description === "function" ? undefined : description })
  }
  const p = Promise.resolve(typeof input === "function" ? input() : input)
  const settle = (type: "success" | "error", result: PromiseResult<never> | undefined, value: unknown) => {
    if (result === undefined) {
      if (id !== undefined) toastStore.dismiss(id)
      return
    }
    const r = resolveResult(result as PromiseResult<unknown>, value)
    const desc = typeof description === "function" ? description(value) : description
    const created = toastStore.create({ ...rest, description: desc, ...r, id, type, promise: true })
    id ??= created
  }
  const tracked = p
    .then((value) => {
      settle("success", success as PromiseResult<never>, value)
      return value
    })
    .catch((reason: unknown) => {
      settle("error", error as PromiseResult<never>, reason)
      throw reason
    })
    .finally(() => onFinally?.())
  // Unhandled rejections are the caller's business only when they unwrap.
  tracked.catch(() => {})
  return { id, unwrap: () => tracked }
}

/**
 * Shows a toast in the `<tec-toaster>` of the page and returns its id.
 *
 * ```ts
 * import { toast } from "@tecton/wc/sonner"
 * toast("Event has been created", { description: "Sunday at 9:00", action: { label: "Undo", onClick: undo } })
 * toast.success("Saved")
 * toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Could not save" })
 * toast.dismiss(id)
 * ```
 */
export const toast = Object.assign(make("default"), {
  /** A plain toast (same as `toast()`). */
  message: make("default"),
  /** A success toast (green outline and check icon). */
  success: make("success"),
  /** An info toast. */
  info: make("info"),
  /** A warning toast. */
  warning: make("warning"),
  /** An error toast (announced assertively). */
  error: make("error"),
  /** A loading toast with a spinner; it stays until updated (same `id`) or dismissed. */
  loading: make("loading"),
  /** A loading toast that turns into a success or error toast when the promise settles. */
  promise,
  /** Closes one toast, or every toast without an id. */
  dismiss: (id?: ToastId) => toastStore.dismiss(id),
  /** The toasts currently shown. */
  getToasts: () => toastStore.active,
})
