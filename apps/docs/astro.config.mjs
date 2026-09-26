import { fileURLToPath } from "node:url"
// @ts-check
import mdx from "@astrojs/mdx"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

import { chunkFileNames, componentPreload } from "./plugins/component-preload.mjs"
import { tectonDocs } from "./plugins/tecton-docs.mjs"
import { codeBlockTransformer, SHIKI_THEMES } from "./src/lib/shiki-transformers.mjs"

const wcSource = (path) => fileURLToPath(new URL(`../../packages/wc/${path}`, import.meta.url))

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
  integrations: [mdx(), componentPreload()],
  vite: {
    plugins: [tailwindcss(), tectonDocs()],
    // Resolve @tecton/wc to its TypeScript source (the "source" export condition), so the
    // site always shows the current components without a library build.
    resolve: {
      conditions: ["source", "module", "browser", "development|production"],
      // CSS @imports do not use export conditions: point the stylesheet entries at source too.
      alias: [
        { find: /^@tecton\/wc\/tecton\.css$/, replacement: wcSource("src/styles/tecton.css") },
        { find: /^@tecton\/wc\/cloak\.css$/, replacement: wcSource("src/styles/cloak.css") },
        { find: /^@tecton\/wc\/tailwind\.css$/, replacement: wcSource("src/styles/tailwind.css") },
        { find: /^@tecton\/wc\/utilities\.css$/, replacement: wcSource("src/utilities/utilities.css") },
        { find: /^@tecton\/wc\/tailwind-utilities\.css$/, replacement: wcSource("src/utilities/tailwind-utilities.css") },
      ],
    },
    // Family chunks get stable names (_astro/tec-<family>.<hash>.js) for componentPreload().
    environments: {
      client: { build: { rolldownOptions: { output: { chunkFileNames: chunkFileNames() } } } },
    },
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
