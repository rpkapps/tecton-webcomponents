// Vite plugin of the docs site.
//
// 1. `virtual:tecton-components` registers every `tec-*` element. It imports the
//    package entry (`@tecton/wc`) when the package exposes one, and otherwise every
//    family's `src/components/<name>/define.ts`, so a page never breaks while the
//    library is incomplete: an element that is not built yet simply stays undefined.
//
// 2. `/src/examples/<name>.html?example-script` is the `<script type="module">` of an
//    example as a real module, so its imports (`import "@tecton/wc/dialog"`) go
//    through Vite in dev and in the build. <ComponentPreview> strips the script from
//    the inline markup and loads this module instead.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const COMPONENTS_ID = "virtual:tecton-components"
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

function defineFiles() {
  const dir = join(wcPackageDir(), "src/components")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(dir, d.name, "define.ts"))
    .filter((file) => existsSync(file))
    .sort()
}

export function tectonDocs() {
  let server
  return {
    name: "tecton-docs",
    enforce: "pre",
    configureServer(s) {
      server = s
      const dir = join(wcPackageDir(), "src/components")
      if (existsSync(dir)) server.watcher.add(dir)
      const refresh = (file) => {
        if (!/[\\/]define\.ts$/.test(file) && !/[\\/]index\.ts$/.test(file)) return
        const mod = server.moduleGraph.getModuleById("\0" + COMPONENTS_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: "full-reload" })
      }
      server.watcher.on("add", refresh)
      server.watcher.on("unlink", refresh)
    },
    async resolveId(id, importer) {
      if (id === COMPONENTS_ID) return "\0" + COMPONENTS_ID
      if (id.endsWith(EXAMPLE_QUERY)) {
        const path = id.slice(0, -EXAMPLE_QUERY.length)
        const file = path.startsWith("/src/") ? join(docsRoot, path) : resolve(importer ? dirname(importer) : docsRoot, path)
        // A virtual id: no other plugin treats it as an HTML document.
        return EXAMPLE_PREFIX + file
      }
    },
    async load(id) {
      if (id === "\0" + COMPONENTS_ID) {
        const entry = await this.resolve("@tecton/wc", join(docsRoot, "src/index.ts"), { skipSelf: true }).catch(
          () => null,
        )
        if (entry && !entry.external) return `import "@tecton/wc";\n`
        const files = defineFiles()
        for (const file of files) this.addWatchFile(file)
        return files.map((file) => `import ${JSON.stringify(file)};`).join("\n") + "\nexport {};\n"
      }
      if (id.startsWith(EXAMPLE_PREFIX)) {
        const file = id.slice(EXAMPLE_PREFIX.length)
        this.addWatchFile(file)
        if (!existsSync(file)) return "export {};\n"
        const code = extractExampleScript(readFileSync(file, "utf8"))
        return code.trim() ? code + "\nexport {};\n" : "export {};\n"
      }
    },
  }
}
