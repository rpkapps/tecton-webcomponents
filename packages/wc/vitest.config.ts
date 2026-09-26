import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/internal/test-setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? (process.env.CI ? undefined : "/opt/pw-browsers/chromium") } }),
      instances: [{ browser: "chromium" }],
      screenshotFailures: false,
    },
  },
})
