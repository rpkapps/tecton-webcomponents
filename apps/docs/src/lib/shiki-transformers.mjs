// Shiki setup shared by markdown fences (astro.config.mjs) and the highlighter used by
// <CodeBlock> / <ComponentPreview> (src/lib/highlight.ts).
//
// Every block renders as
//   <figure data-code-block data-not-typeset>
//     <figcaption data-code-block-title>title</figcaption>   (fence meta title="…")
//     <tec-copy-button value="…"></tec-copy-button>           (unless the meta says noCopy)
//     <pre class="astro-code shiki" data-language="html">…</pre>
//   </figure>
// Colours are dual-theme CSS variables (defaultColor: false): app.css picks
// --shiki-light or --shiki-dark from the page's mode.
import { iconHast } from "./icons.mjs"

export const SHIKI_THEMES = { light: "github-light-high-contrast", dark: "github-dark-dimmed" }

export const SHIKI_LANGS = ["html", "ts", "tsx", "js", "jsx", "css", "bash", "json", "vue", "svelte", "angular-html", "diff", "ini"]

function parseMeta(raw = "") {
  const title = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(raw)
  return {
    title: title ? (title[1] ?? title[2] ?? title[3]) : undefined,
    noCopy: /(?:^|\s)noCopy(?:\s|$)/.test(raw),
  }
}

export function copyButtonHast(value = "") {
  return {
    type: "element",
    tagName: "tec-copy-button",
    properties: {
      value,
      "copy-label": "Copy code",
      className: [
        "docs-copy-button",
        "absolute",
        "top-3",
        "end-2",
        "z-10",
        "size-7",
        "bg-code",
      ],
    },
    children: [],
  }
}

/**
 * @param {{ copy?: boolean }} [options]
 * @returns {import("shiki").ShikiTransformer}
 */
export function codeBlockTransformer(options = {}) {
  return {
    name: "tecton-docs:code-block",
    pre(node) {
      node.properties["data-language"] = this.options.lang
    },
    code(node) {
      node.properties["data-language"] = this.options.lang
    },
    line(node) {
      node.properties["data-line"] = ""
    },
    root(root) {
      const meta = parseMeta(this.options.meta?.__raw)
      const pre = root.children.find((n) => n.type === "element" && n.tagName === "pre")
      if (!pre) return
      const children = []
      if (meta.title) {
        children.push({
          type: "element",
          tagName: "figcaption",
          properties: { dataCodeBlockTitle: "", dataLanguage: this.options.lang },
          children: [
            iconHast("file-code", "size-4 opacity-70"),
            { type: "element", tagName: "span", properties: { className: ["truncate"] }, children: [{ type: "text", value: meta.title }] },
          ],
        })
      }
      if (options.copy !== false && !meta.noCopy) children.push(copyButtonHast(this.source.replace(/\n$/, "")))
      children.push(pre)
      root.children = [
        {
          type: "element",
          tagName: "figure",
          properties: { dataCodeBlock: "", dataNotTypeset: "" },
          children,
        },
      ]
    },
  }
}
