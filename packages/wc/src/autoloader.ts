/**
 * `import "@tecton/wc/autoloader"` registers Tecton elements on demand: it looks for undefined
 * `tec-*` tags in the document (and in every open shadow root it can reach), imports only the
 * families they belong to, and keeps watching for tags added later. Pages then download only the
 * components they use instead of the whole library.
 *
 * Pair it with `@tecton/wc/cloak.css` so elements stay hidden until their family has loaded.
 *
 * ```html
 * <link rel="stylesheet" href="@tecton/wc/tecton.css" />
 * <link rel="stylesheet" href="@tecton/wc/cloak.css" />
 * <script type="module">import "@tecton/wc/autoloader"</script>
 * ```
 *
 * Call `discover(root)` yourself for content the observer cannot see (a closed shadow root, an
 * element that is not connected yet); it resolves once every family found has registered.
 */
import { loaders } from "./autoloader-map.js"

const loading = new Map<string, Promise<unknown>>()

function load(tag: string): Promise<unknown> | undefined {
  const loader = loaders[tag]
  if (!loader || customElements.get(tag)) return undefined
  let promise = loading.get(tag)
  if (!promise) {
    promise = loader().catch((error: unknown) => {
      loading.delete(tag)
      console.error(`[@tecton/wc] could not load <${tag}>`, error)
    })
    loading.set(tag, promise)
  }
  return promise
}

function collect(root: Element | Document | ShadowRoot | DocumentFragment, tags: Set<string>): void {
  if (root instanceof Element && root.localName.startsWith("tec-") && !customElements.get(root.localName)) {
    tags.add(root.localName)
  }
  for (const el of root.querySelectorAll(":not(:defined)")) {
    if (el.localName.startsWith("tec-")) tags.add(el.localName)
  }
  // Templates hold content that is cloned into the page later; load it up front.
  for (const template of root.querySelectorAll("template")) collect(template.content, tags)
}

/** Loads the families of every undefined `tec-*` element in `root`. */
export async function discover(root: Element | Document | ShadowRoot | DocumentFragment = document): Promise<void> {
  const tags = new Set<string>()
  collect(root, tags)
  await Promise.all([...tags].map(load))
}

let observer: MutationObserver | undefined

/** Starts watching `root` for added `tec-*` elements (the document by default). Idempotent per root. */
export function startAutoloader(root: Document | ShadowRoot = document): void {
  observer ??= new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof Element) void discover(node)
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  void discover(root)
}

if (typeof document !== "undefined") startAutoloader()
