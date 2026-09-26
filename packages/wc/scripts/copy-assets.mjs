#!/usr/bin/env node
/**
 * Copies the non-TypeScript assets into dist/ after `tsc`:
 *   src/styles/*.css     → dist/styles/        (tecton.css, tailwind.css, tokens/palette/theme/base)
 *   src/utilities/*.css  → dist/utilities/     (utility classes + Tailwind variant)
 *   dist/fonts.css       (generated: the Fontsource faces of the Tecton fonts)
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
mkdirSync(dist, { recursive: true })

for (const dir of ["styles", "utilities"]) {
  const from = join(root, "src", dir)
  if (!existsSync(from)) continue
  mkdirSync(join(dist, dir), { recursive: true })
  for (const file of readdirSync(from).filter((f) => f.endsWith(".css"))) cpSync(join(from, file), join(dist, dir, file))
}

writeFileSync(
  join(dist, "fonts.css"),
  `/* The Tecton fonts (Figtree, IBM Plex Mono) from Fontsource. Import once per document, next to tecton.css. */
@import "@fontsource/figtree/400.css";
@import "@fontsource/figtree/500.css";
@import "@fontsource/figtree/600.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
`
)
console.log("copied styles, utilities, fonts.css")
