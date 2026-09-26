/// <reference types="@vitest/browser-playwright" />
/**
 * Test-only helpers of the select / combobox / command families (import only from `*.test.ts`).
 */
import { cdp } from "vitest/browser"

interface DomNode {
  backendNodeId: number
  attributes?: string[]
  children?: DomNode[]
  shadowRoots?: DomNode[]
  contentDocument?: DomNode
}

function find(node: DomNode, token: string): DomNode | undefined {
  const attrs = node.attributes
  if (attrs) for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === "data-ad-probe" && attrs[i + 1] === token) return node
  for (const child of [...(node.shadowRoots ?? []), ...(node.children ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) {
    const hit = find(child, token)
    if (hit) return hit
  }
  return undefined
}

/**
 * The element Chrome's accessibility tree reports as the `aria-activedescendant` of `el` (resolved
 * through element reflection and shadow roots), found among `candidates`; `null` when none.
 */
export async function axActiveDescendant<T extends Element>(el: Element, candidates: T[]): Promise<T | null> {
  const session = cdp()
  const tokens = new Map<string, Element>()
  const all = [el, ...candidates]
  all.forEach((c, i) => {
    const token = `ad${i}-${Math.random().toString(36).slice(2)}`
    c.setAttribute("data-ad-probe", token)
    tokens.set(token, c)
  })
  try {
    const { root } = (await session.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: DomNode }
    const ids = new Map<number, Element>()
    for (const [token, element] of tokens) {
      const node = find(root, token)
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
    for (const c of all) c.removeAttribute("data-ad-probe")
  }
}
