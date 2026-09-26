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
    // Resolve @tecton/wc to its TypeScript source (the "source" export condition), so the
    // site always shows the current components without a library build.
    resolve: { conditions: ["source", "module", "browser", "development|production"] },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Astro's own MDX modules carry a directive the bundler cannot keep; harmless.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") return
          warn(warning)
        },
      },
    },
  },
})
