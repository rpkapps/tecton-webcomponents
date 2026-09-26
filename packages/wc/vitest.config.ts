import { existsSync } from "node:fs"
import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

/**
 * The Chromium to test in: $CHROMIUM_PATH, else a preinstalled one if present (some Linux
 * containers), else Playwright's own download (`npx playwright install chromium`; Windows, macOS, CI).
 */
function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const preinstalled = "/opt/pw-browsers/chromium"
  return process.platform === "linux" && existsSync(preinstalled) ? preinstalled : undefined
}

export default defineConfig({
  // Pre-bundle every runtime dependency up front: a mid-run optimisation reloads the test page.
  optimizeDeps: {
    include: [
      "lit",
      "lit/decorators.js",
      "lit/directive.js",
      "lit/directives/class-map.js",
      "lit/directives/style-map.js",
      "lit/directives/if-defined.js",
      "lit/directives/live.js",
      "lit/directives/repeat.js",
      "lit/directives/unsafe-svg.js",
      "lit/directives/unsafe-html.js",
      "lit/directives/ref.js",
      "lit/static-html.js",
      "@lit/context",
      "@floating-ui/dom",
      "@internationalized/date",
      "@tanstack/table-core",
      "lucide",
      "axe-core",
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/internal/test-setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: { executablePath: chromiumPath() } }),
      instances: [{ browser: "chromium" }],
      screenshotFailures: false,
    },
  },
})
