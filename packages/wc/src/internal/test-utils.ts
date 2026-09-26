/// <reference types="@vitest/browser-playwright" />
/**
 * @module test-utils
 * Helpers for Vitest browser-mode tests (Chromium via Playwright). Import only from `*.test.ts`.
 *
 * ```ts
 * import { html } from "lit"
 * import { userEvent } from "vitest/browser"
 * import { fixture, expectAccessible, axNode, oneEvent } from "../../internal/test-utils.js"
 * import "./define.js"
 *
 * it("toggles", async () => {
 *   const el = await fixture<TecCheckbox>(html`<tec-checkbox>Accept</tec-checkbox>`)
 *   await userEvent.click(el)
 *   expect(el.checked).toBe(true)
 *   expect(await axNode(el.shadowRoot!.querySelector("input")!)).toMatchObject({ role: "checkbox", name: "Accept", checked: "true" })
 *   await expectAccessible(el)
 * })
 * ```
 *
 * Fixtures are removed after each test by `test-setup.ts` (loaded through `vitest.config.ts`), which
 * also loads the Tecton theme so computed colours are real.
 */
import { render, type TemplateResult } from "lit"
import { expect } from "vitest"
import { cdp } from "vitest/browser"
import axe from "axe-core"

const containers = new Set<HTMLElement>()

/** Resolves when every `tec-*` element in `root` (including nested shadow roots) finished updating. */
export async function settle(root: ParentNode): Promise<void> {
  // Two passes: elements rendered by the first update (in shadow roots) settle in the second.
  for (let pass = 0; pass < 3; pass++) {
    const pending: Promise<unknown>[] = []
    for (const el of deepQueryAll(root, (e) => e.localName.startsWith("tec-"))) {
      if (!customElements.get(el.localName)) pending.push(customElements.whenDefined(el.localName))
      const update = (el as Partial<{ updateComplete: Promise<unknown> }>).updateComplete
      if (update) pending.push(update)
    }
    if (!pending.length) return
    await Promise.all(pending)
  }
}

/**
 * Renders `template` (a Lit template or an HTML string) into a fresh container attached to
 * `document.body`, waits until every `tec-*` element inside finished updating, and returns the first
 * element child. The container is removed after the test.
 */
export async function fixture<T extends Element = HTMLElement>(
  template: TemplateResult | string,
  options: { dir?: "ltr" | "rtl"; theme?: "light" | "dark" } = {}
): Promise<T> {
  const container = document.createElement("div")
  container.dataset.testFixture = ""
  if (options.dir) container.dir = options.dir
  if (options.theme) container.dataset.theme = options.theme
  document.body.append(container)
  containers.add(container)
  if (typeof template === "string") container.innerHTML = template
  else render(template, container)
  await settle(container)
  return container.firstElementChild as T
}

/** Removes every fixture container (called after each test by `test-setup.ts`). */
export function cleanupFixtures(): void {
  for (const c of containers) {
    render(null, c)
    c.remove()
  }
  containers.clear()
}

/** Resolves on the next animation frame. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Resolves after `ms` milliseconds. */
export function aTimeout(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Resolves when the CSS animations running on `el` and its subtree (e.g. a popup's enter motion) have
 * finished — measure positions or run axe (colour contrast) only after that.
 */
export async function animationsFinished(el: Element): Promise<void> {
  await nextFrame()
  await Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished))
}

/** Resolves with the next `name` event dispatched on `target`. */
export function oneEvent<E extends Event = CustomEvent>(target: EventTarget, name: string): Promise<E> {
  return new Promise((resolve) => target.addEventListener(name, (e) => resolve(e as E), { once: true }))
}

/** Records every `name` event dispatched on `target`; read `.events`, call `.stop()` when done. */
export function recordEvents<E extends Event = CustomEvent>(target: EventTarget, name: string) {
  const events: E[] = []
  const listener = (e: Event) => events.push(e as E)
  target.addEventListener(name, listener)
  return { events, stop: () => target.removeEventListener(name, listener) }
}

/** Polls `predicate` every frame until it returns truthy (or fails after `timeout` ms). */
export async function waitUntil(predicate: () => unknown, message = "condition", timeout = 2000): Promise<void> {
  const start = performance.now()
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error(`waitUntil timed out: ${message}`)
    await nextFrame()
  }
}

/** The focused element, looking through open shadow roots. */
export function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

/** Every element under `root` (light DOM and open shadow roots) that matches `predicate`. */
export function deepQueryAll(root: ParentNode, predicate: (el: Element) => boolean): Element[] {
  const out: Element[] = []
  const walk = (node: ParentNode) => {
    for (const el of node.querySelectorAll("*")) {
      if (predicate(el)) out.push(el)
      if (el.shadowRoot) walk(el.shadowRoot)
    }
  }
  walk(root)
  return out
}

// ------------------------------------------------------------------------------------------ axe

/**
 * Runs axe-core on `el` (it traverses open shadow roots and understands ARIA element reflection)
 * and fails with a readable list of violations. The `region` rule is off (fixtures are not in
 * landmarks); pass `rules: { "color-contrast": { enabled: false } }` etc. to adjust.
 */
export async function expectAccessible(el: Element, options: axe.RunOptions = {}): Promise<void> {
  await settle(el.parentNode ?? el)
  const results = await axe.run(el, {
    ...options,
    rules: { region: { enabled: false }, ...options.rules },
  })
  const report = results.violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${JSON.stringify(n.target)} ${n.failureSummary ?? ""}`).join("\n")}`)
    .join("\n\n")
  expect(report, "axe violations").toBe("")
}

// ------------------------------------------------------------------------------------------ Chrome AX tree

/** One node of Chrome's computed accessibility tree (see {@link axNode}). */
export interface AxNode {
  role: string
  name: string
  description?: string
  /** Every AX property (`expanded`, `checked`, `selected`, `disabled`, `level`, `invalid` …) as a string. */
  [property: string]: string | undefined
}

interface CdpAxNode {
  ignored: boolean
  role?: { value: string }
  name?: { value: string }
  description?: { value: string }
  properties?: { name: string; value: { type?: string; value?: unknown; relatedNodes?: { text?: string }[] } }[]
}

interface CdpDomNode {
  backendNodeId: number
  attributes?: string[]
  children?: CdpDomNode[]
  shadowRoots?: CdpDomNode[]
  contentDocument?: CdpDomNode
}

function findProbe(node: CdpDomNode, token: string): CdpDomNode | undefined {
  const attrs = node.attributes
  if (attrs) for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === "data-ax-probe" && attrs[i + 1] === token) return node
  for (const child of [...(node.shadowRoots ?? []), ...(node.children ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) {
    const hit = findProbe(child, token)
    if (hit) return hit
  }
  return undefined
}

const utf8 = new TextDecoder("utf-8", { fatal: true })

/**
 * Chrome returns some string-valued AX properties (e.g. `valuetext` from `aria-valuetext`) as UTF-8
 * bytes read as Latin-1 ("–" arrives as "\u00e2\u0080\u0093"). Re-decode such strings; anything
 * that is not a valid UTF-8 byte sequence is returned unchanged.
 */
function repairUtf8(value: string): string {
  if (!/[\u0080-\u00ff]/.test(value) || /[^\u0000-\u00ff]/.test(value)) return value
  try {
    return utf8.decode(Uint8Array.from(value, (c) => c.charCodeAt(0)))
  } catch {
    return value
  }
}

function toAxNode(n: CdpAxNode): AxNode {
  const out: AxNode = { role: n.role?.value ?? "", name: n.name?.value ?? "" }
  if (n.description?.value) out.description = n.description.value
  for (const p of n.properties ?? []) {
    const { value, relatedNodes } = p.value ?? {}
    // Relation properties (labelledby, describedby, controls …) carry nodes, not a value: their text.
    if (value === undefined && relatedNodes) out[p.name] = relatedNodes.map((r) => r.text ?? "").join(" ").trim()
    else out[p.name] = typeof value === "string" ? repairUtf8(value) : String(value)
  }
  return out
}

/**
 * Chrome's *computed* accessibility node for `el` — the ground truth for role, accessible name,
 * description and states, including names that come through shadow roots, slots, `<label for>`
 * association and ARIA element reflection (which axe can only approximate).
 *
 * `el` may be inside a shadow root (e.g. `button.shadowRoot.querySelector("button")`).
 * Ignored nodes (e.g. `aria-hidden` subtrees) return `{ role: "", name: "", ignored: "true" }`.
 *
 * ```ts
 * expect(await axNode(inner)).toMatchObject({ role: "button", name: "Open", expanded: "true" })
 * ```
 */
export async function axNode(el: Element): Promise<AxNode> {
  const token = `p${Math.random().toString(36).slice(2)}`
  el.setAttribute("data-ax-probe", token)
  try {
    const session = cdp()
    const { root } = (await session.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: CdpDomNode }
    const found = findProbe(root, token)
    if (!found) throw new Error("axNode: element not found in the DOM snapshot")
    const { nodes } = (await session.send("Accessibility.getPartialAXTree", {
      backendNodeId: found.backendNodeId,
      fetchRelatives: false,
    })) as { nodes: CdpAxNode[] }
    const node = nodes[0]
    if (!node || node.ignored) return { role: "", name: "", ignored: "true" }
    return toAxNode(node)
  } finally {
    el.removeAttribute("data-ax-probe")
  }
}

/**
 * The non-ignored accessibility nodes whose DOM node is `el` or inside it (flattened, document
 * order), as `"role: name"` strings plus notable states — handy for snapshot-style assertions:
 *
 * ```ts
 * expect(await axTree(tabs)).toEqual(["tablist", "tab: Account [selected]", "tab: Password", "tabpanel: Account"])
 * ```
 */
export async function axTree(el: Element): Promise<string[]> {
  const token = `p${Math.random().toString(36).slice(2)}`
  el.setAttribute("data-ax-probe", token)
  try {
    const session = cdp()
    const { root } = (await session.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: CdpDomNode }
    const found = findProbe(root, token)
    if (!found) throw new Error("axTree: element not found in the DOM snapshot")
    const { nodes } = (await session.send("Accessibility.queryAXTree", { backendNodeId: found.backendNodeId })) as {
      nodes: CdpAxNode[]
    }
    const states = ["selected", "checked", "expanded", "disabled", "pressed", "invalid", "required", "focused"]
    return nodes
      .filter((n) => !n.ignored && !["generic", "StaticText", "InlineTextBox", "none", ""].includes(n.role?.value ?? ""))
      .map((n) => {
        const a = toAxNode(n)
        const flags = states.filter((s) => a[s] && a[s] !== "false" && !(s === "invalid" && a[s] === "false")).map((s) => (a[s] === "true" ? s : `${s}=${a[s]}`))
        return `${a.role}${a.name ? `: ${a.name}` : ""}${flags.length ? ` [${flags.join(", ")}]` : ""}`
      })
  } finally {
    el.removeAttribute("data-ax-probe")
  }
}

/**
 * The element Chrome's accessibility tree reports as the `aria-activedescendant` of `el` (resolved
 * through element reflection and shadow roots), found among `candidates`; `null` when none.
 *
 * ```ts
 * expect(await axActiveDescendant(input, items)).toBe(items[1])
 * ```
 */
export async function axActiveDescendant<T extends Element>(el: Element, candidates: T[]): Promise<T | null> {
  const session = cdp()
  const tokens = new Map<string, Element>()
  const all = [el, ...candidates]
  all.forEach((c, i) => {
    const token = `ad${i}-${Math.random().toString(36).slice(2)}`
    c.setAttribute("data-ax-probe", token)
    tokens.set(token, c)
  })
  try {
    const { root } = (await session.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: CdpDomNode }
    const ids = new Map<number, Element>()
    for (const [token, element] of tokens) {
      const node = findProbe(root, token)
      if (node) ids.set(node.backendNodeId, element)
    }
    const own = [...ids].find(([, e]) => e === el)?.[0]
    if (own === undefined) throw new Error("axActiveDescendant: element not found")
    const { nodes } = (await session.send("Accessibility.getPartialAXTree", { backendNodeId: own, fetchRelatives: false })) as {
      nodes: { properties?: { name: string; value: { relatedNodes?: { backendDOMNodeId: number }[] } }[] }[]
    }
    const prop = nodes[0]?.properties?.find((p) => p.name === "activedescendant")
    const target = prop?.value.relatedNodes?.[0]?.backendDOMNodeId
    return target === undefined ? null : ((ids.get(target) as T | undefined) ?? null)
  } finally {
    for (const c of all) c.removeAttribute("data-ax-probe")
  }
}
