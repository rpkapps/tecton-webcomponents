// Vite plugin of the docs site.
//
// 1. `virtual:tecton-components` registers every `tec-*` element by importing every
//    family's `src/components/<name>/define.ts` from the library source, so pages always
//    show the current components and a new family needs no edit here.
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
        // A virtual .js id: no other plugin (Astro's .html pages) treats it as HTML.
        return EXAMPLE_PREFIX + file + ".js"
      }
    },
    async load(id) {
      if (id === "\0" + COMPONENTS_ID) {
        // Every family's define.ts from the library source. In dev each family loads on its
        // own, so one broken family (work in progress) cannot take the others down; the
        // build imports them statically and fails loudly instead.
        const files = defineFiles()
        for (const file of files) this.addWatchFile(file)
        if (server)
          return (
            `const families = ${JSON.stringify(files)};\n` +
            `await Promise.all(families.map((f) => import(/* @vite-ignore */ "/@fs" + f).catch((e) => console.error("[tecton-docs] could not load", f, e))));\n` +
            "export {};\n"
          )
        return files.map((file) => `import ${JSON.stringify(file)};`).join("\n") + "\nexport {};\n"
      }
      if (id.startsWith(EXAMPLE_PREFIX)) {
        const file = id.slice(EXAMPLE_PREFIX.length, -".js".length)
        this.addWatchFile(file)
        if (!existsSync(file)) return "export {};\n"
        const code = extractExampleScript(readFileSync(file, "utf8"))
        return code.trim() ? code + "\nexport {};\n" : "export {};\n"
      }
    },
  }
}
