// Vite plugin of the docs site.
//
// Components are registered on demand by `@tecton/wc/autoloader` (imported by the base layout):
// each page loads only the families its markup uses. In dev the library resolves to its source
// (the "source" export condition), so pages always show the current components.
//
// `/src/examples/<name>.html?example-script` is the `<script type="module">` of an example as a
// real module, so its imports (`import "@tecton/wc/dialog"`) go through Vite in dev and in the
// build. <ComponentPreview> strips the script from the inline markup and loads this module
// instead. The module first imports the families the example uses and waits for the page's
// components to be defined, so example code can call element methods right away.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const EXAMPLE_QUERY = "?example-script"
export const EXAMPLE_PREFIX = "\0tecton-example:"

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Directory of the @tecton/wc workspace package. */
export function wcPackageDir() {
  return resolve(docsRoot, "node_modules/@tecton/wc")
}

/** Every `<script type="module">…</script>` block of an example file. */
export const EXAMPLE_SCRIPT_RE = /<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi

const TAG_RE = /<(tec-[a-z0-9-]+)[\s/>]/g

/** tag → family, read from the library's generated autoloader map. */
export function familyOfTag() {
  const source = readFileSync(join(wcPackageDir(), "src/autoloader-map.ts"), "utf8")
  const map = new Map()
  for (const [, tag, family] of source.matchAll(/"(tec-[a-z0-9-]+)":\s*\(\)\s*=>\s*import\("\.\/components\/([a-z0-9-]+)\/define\.js"\)/g)) {
    map.set(tag, family)
  }
  if (!map.size) throw new Error("tecton-docs: no tags found in @tecton/wc/src/autoloader-map.ts")
  return map
}

/** Families whose tags appear in `html` (markup only: HTML-escaped code samples do not match). */
export function familiesIn(html, families = familyOfTag()) {
  const found = new Set()
  for (const [, tag] of html.matchAll(TAG_RE)) {
    const family = families.get(tag)
    if (family) found.add(family)
  }
  return [...found].sort()
}

export function extractExampleScript(source) {
  const blocks = [...source.matchAll(EXAMPLE_SCRIPT_RE)].map((m) => m[1])
  return blocks.join("\n")
}

export function tectonDocs() {
  return {
    name: "tecton-docs",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id.endsWith(EXAMPLE_QUERY)) {
        const path = id.slice(0, -EXAMPLE_QUERY.length)
        const file = path.startsWith("/src/") ? join(docsRoot, path) : resolve(importer ? dirname(importer) : docsRoot, path)
        // A virtual .js id: no other plugin (Astro's .html pages) treats it as HTML.
        return EXAMPLE_PREFIX + file + ".js"
      }
    },
    async load(id) {
      if (id.startsWith(EXAMPLE_PREFIX)) {
        const file = id.slice(EXAMPLE_PREFIX.length, -".js".length)
        this.addWatchFile(file)
        if (!existsSync(file)) return "export {};\n"
        const source = readFileSync(file, "utf8")
        const code = extractExampleScript(source)
        if (!code.trim()) return "export {};\n"
        // The families of every tag in the file (markup and script, e.g. elements a table's
        // cells render) load before the example runs; discover() catches anything else.
        const families = familiesIn(source, familyOfTag())
        const imports = families.map((family) => `import "@tecton/wc/${family}";\n`).join("")
        return `${imports}import { discover as __tecDiscover } from "@tecton/wc/autoloader";\nawait __tecDiscover();\n${code}\nexport {};\n`
      }
    },
  }
}
