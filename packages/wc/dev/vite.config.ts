// Playground: `npx vite packages/wc/dev` (or `pnpm --filter @tecton/wc exec vite dev`) — every
// reference component from source, with dark / RTL toggles (?theme=dark&dir=rtl).
import { defineConfig } from "vite"

export default defineConfig({
  server: { port: 5178, fs: { allow: [".."] } },
})
