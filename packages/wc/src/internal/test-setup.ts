/// <reference types="vite/client" />
/**
 * @module test-setup
 * Loaded before every test file (see `vitest.config.ts`):
 * - the Tecton theme, so `--tec-*` variables resolve and axe's colour-contrast check sees real colours;
 * - the reset of Tailwind's preflight (`* { border: 0 solid; margin: 0; padding: 0 }`), because real
 *   applications have it and it beats `:host` rules — components must render correctly under it;
 * - fixture cleanup after each test.
 */
import { afterEach } from "vitest"
import "../styles/tecton.css"
import { cleanupFixtures } from "./test-utils.js"

const preflight = document.createElement("style")
preflight.dataset.testPreflight = ""
preflight.textContent = `*, ::after, ::before, ::backdrop { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }`
document.head.append(preflight)

afterEach(() => {
  cleanupFixtures()
})
