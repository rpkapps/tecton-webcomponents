// Astro integration of the docs site: every page registers the Tecton families it uses before
// its first paint.
//
// The autoloader (imported by the base layout) defines elements on demand, after the page has
// rendered: until then cloak.css hides them, so on each navigation the header buttons, the
// examples and the page's controls would disappear for a frame and then pop in, moving the
// content around them, and the examples' scripts would fill their previews a moment later.
// Instead, each page gets a render-blocking module in its <head> that statically imports the
// families found in its HTML and the scripts of its examples:
//
//   <script type="module" blocking="render">import "/_astro/tec-button.X.js";…
//     import "/_astro/example-data-table-demo.Y.js";</script>
//
// Module scripts run once the document is parsed, so the examples find their markup.
// Browsers that support `blocking="render"` keep painting the previous page until those modules
// have run (they are cached after the first page, so this costs a few milliseconds); the others
// load the script like any module and the cloak covers the gap as before. The autoloader and
// <ComponentPreview> later import the same URLs, so nothing loads or runs twice.
//
// Build: family chunks are named `_astro/tec-<family>.<hash>.js`, example scripts
// `_astro/example-<name>.<hash>.js`, and the HTML is rewritten once the site is written.
// Dev: HTML responses get imports of the families' source (`/@fs/…`) and of the examples.
import { readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { EXAMPLE_PREFIX, familiesIn, familyOfTag, wcPackageDir } from "./tecton-docs.mjs"

const DEFINE_RE = /[\\/]components[\\/]([a-z0-9-]+)[\\/]define\.ts$/
const EXAMPLE_RE = /[\\/]src[\\/]examples[\\/]([\w-]+)\.html\.js$/
const EXAMPLE_ATTR_RE = /\bdata-example-script="([\w-]+)"/g

/** Names of the examples on a page that have a script (<ComponentPreview data-example-script>). */
function examplesIn(html) {
  return [...new Set([...html.matchAll(EXAMPLE_ATTR_RE)].map((m) => m[1]))]
}

function inject(html, urls) {
  if (!urls.length || !html.includes("</head>")) return html
  const imports = urls.map((url) => `import ${JSON.stringify(url)};`).join("")
  return html.replace("</head>", `<script type="module" blocking="render">${imports}</script></head>`)
}

/** Client chunk name of a family's define module: `_astro/tec-<family>.<hash>.js`. */
export function chunkFileNames(assets = "_astro") {
  return (chunk) => {
    const id = chunk.facadeModuleId ?? ""
    const family = id.match(DEFINE_RE)?.[1]
    if (family) return `${assets}/tec-${family}.[hash].js`
    const example = id.startsWith(EXAMPLE_PREFIX) && id.match(EXAMPLE_RE)?.[1]
    if (example) return `${assets}/example-${example}.[hash].js`
    return `${assets}/[name].[hash].js`
  }
}

export function componentPreload() {
  return {
    name: "tecton-component-preload",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const wcSrc = realpathSync(join(wcPackageDir(), "src")).replaceAll("\\", "/")
        const devUrl = (family) => `/@fs/${wcSrc.replace(/^\//, "")}/components/${family}/define.ts`
        server.middlewares.use((req, res, next) => {
          if (req.method !== "GET" || !req.headers.accept?.includes("text/html")) return next()
          const chunks = []
          const { write, end, writeHead } = res
          let html = false
          const isHtml = () => String(res.getHeader("content-type") ?? "").includes("text/html")
          res.writeHead = function (...args) {
            html = isHtml() || JSON.stringify(args).includes("text/html")
            if (html) res.removeHeader("content-length")
            return writeHead.apply(this, args)
          }
          res.write = function (chunk, ...args) {
            if (!(html || isHtml())) return write.call(this, chunk, ...args)
            chunks.push(Buffer.from(chunk))
            return true
          }
          res.end = function (chunk, ...args) {
            if (!(html || isHtml())) return end.call(this, chunk, ...args)
            if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk))
            const page = Buffer.concat(chunks).toString("utf8")
            const urls = [
              ...familiesIn(page, familyOfTag()).map(devUrl),
              ...examplesIn(page).map((name) => `/src/examples/${name}.html?example-script`),
            ]
            const out = inject(page, urls)
            if (!res.headersSent) res.removeHeader("content-length")
            write.call(this, out)
            return end.call(this)
          }
          next()
        })
      },
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir)
        const chunks = new Map()
        const exampleChunks = new Map()
        for (const file of readdirSync(join(out, "_astro"))) {
          const family = file.match(/^tec-([a-z0-9-]+)\.[\w-]+\.js$/)?.[1]
          if (family) chunks.set(family, `/_astro/${file}`)
          const example = file.match(/^example-([\w-]+)\.[\w-]+\.js$/)?.[1]
          if (example) exampleChunks.set(example, `/_astro/${file}`)
        }
        if (!chunks.size) throw new Error("component-preload: no _astro/tec-<family>.*.js chunks (chunkFileNames not applied?)")
        const families = familyOfTag()
        let pages = 0
        const walk = (path) => {
          for (const entry of readdirSync(path, { withFileTypes: true })) {
            const file = join(path, entry.name)
            if (entry.isDirectory()) walk(file)
            else if (entry.name.endsWith(".html")) {
              const html = readFileSync(file, "utf8")
              const urls = familiesIn(html, families).map((family) => {
                const url = chunks.get(family)
                if (!url) throw new Error(`component-preload: no chunk for the "${family}" family`)
                return url
              })
              for (const name of examplesIn(html)) {
                const url = exampleChunks.get(name)
                if (!url) throw new Error(`component-preload: no chunk for the script of example "${name}"`)
                urls.push(url)
              }
              writeFileSync(file, inject(html, urls))
              pages++
            }
          }
        }
        walk(out)
        logger.info(`render-blocking component imports added to ${pages} pages`)
      },
    },
  }
}
