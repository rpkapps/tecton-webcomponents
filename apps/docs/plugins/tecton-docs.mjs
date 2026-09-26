// Vite plugin of the docs site.
//
// Components are registered on demand by `@tecton/wc/autoloader` (imported by the base layout):
// each page loads only the families its markup uses. In dev the library resolves to its source
// (the "source" export condition), so pages always show the current components.
//
// `/src/examples/<name>.html?example-script` is the `<script type="module">` of an example as a
// real module, so its imports (`import "@tecton/wc/dialog"`) go through Vite in dev and in the
// build. <ComponentPreview> strips the script from the inline markup and loads this module
// instead. The module first waits for the page's components to be defined, so example code can
// call element methods right away.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const EXAMPLE_QUERY = "?example-script"
const EXAMPLE_PREFIX = "\0tecton-example:"

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Directory of the @tecton/wc workspace package. */
export function wcPackageDir() {
  return resolve(docsRoot, "node_modules/@tecton/wc")
}

/** Every `<script type="module">…</script>` block of an example file. */
export const EXAMPLE_SCRIPT_RE = /<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi

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
        const code = extractExampleScript(readFileSync(file, "utf8"))
        if (!code.trim()) return "export {};\n"
        return `import { discover as __tecDiscover } from "@tecton/wc/autoloader";\nawait __tecDiscover();\n${code}\nexport {};\n`
      }
    },
  }
}
