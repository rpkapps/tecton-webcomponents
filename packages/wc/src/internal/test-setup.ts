/**
 * @module test-setup
 * Loaded before every test file (see `vitest.config.ts`): the Tecton theme (so `--tec-*` variables
 * resolve and axe's colour-contrast check sees real colours) and fixture cleanup after each test.
 */
import { afterEach } from "vitest"
import "../styles/tecton.css"
import { cleanupFixtures } from "./test-utils.js"

afterEach(() => {
  cleanupFixtures()
})
