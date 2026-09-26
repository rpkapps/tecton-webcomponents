// @ts-check
import mdx from "@astrojs/mdx"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

import { tectonDocs } from "./plugins/tecton-docs.mjs"
import { codeBlockTransformer, SHIKI_THEMES } from "./src/lib/shiki-transformers.mjs"

export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: SHIKI_THEMES,
      defaultColor: false,
      transformers: [codeBlockTransformer()],
    },
  },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss(), tectonDocs()],
  },
})
