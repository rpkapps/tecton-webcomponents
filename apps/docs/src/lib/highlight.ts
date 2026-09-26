import { createHighlighter, type Highlighter } from "shiki"

import { codeBlockTransformer, SHIKI_LANGS, SHIKI_THEMES } from "./shiki-transformers.mjs"

let highlighter: Promise<Highlighter> | undefined

function getHighlighter() {
  highlighter ??= createHighlighter({
    themes: Object.values(SHIKI_THEMES),
    langs: SHIKI_LANGS,
  })
  return highlighter
}

export interface HighlightOptions {
  lang?: string
  /** Shown above the code (a file name). */
  title?: string
  /** Render the copy button (default true). */
  copy?: boolean
}

/**
 * Highlighted code as a `figure[data-code-block]` (same markup as markdown fences).
 * Unknown languages fall back to plain text; highlighting never throws.
 */
export async function highlight(code: string, { lang = "html", title, copy = true }: HighlightOptions = {}) {
  const shiki = await getHighlighter()
  const language = shiki.getLoadedLanguages().includes(lang) ? lang : "text"
  return shiki.codeToHtml(code.replace(/\n+$/, ""), {
    lang: language,
    themes: SHIKI_THEMES,
    defaultColor: false,
    meta: { __raw: title ? `title="${title.replace(/"/g, "'")}"` : "" },
    transformers: [codeBlockTransformer({ copy })],
  })
}
