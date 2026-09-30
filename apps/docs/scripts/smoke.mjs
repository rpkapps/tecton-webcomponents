#!/usr/bin/env node
// Smoke test of the built site (run `astro build` first; `pnpm --filter docs test` does both).
// Serves dist/, opens every page listed in the search index plus the landing page in
// Chromium, and fails on console errors, uncaught exceptions and failed same-origin requests.
// Also checks that example scripts ran and that the command menu opens.
//
//   node scripts/smoke.mjs            all pages
//   node scripts/smoke.mjs button     only pages whose URL contains "button"
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"

const dist = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist")
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing: run `pnpm --filter docs build` first.")
  process.exit(1)
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname)
  let file = join(dist, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html")
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`
  if (!file.startsWith(dist) || !existsSync(file)) {
    res.writeHead(404).end("not found")
    return
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
})
await new Promise((ok) => server.listen(0, "127.0.0.1", ok))
const base = `http://127.0.0.1:${server.address().port}`

const executablePath =
  process.env.CHROMIUM_PATH ??
  (process.platform === "linux" && existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined)
const browser = await chromium.launch({ executablePath })
const filter = process.argv[2]

const index = await (await fetch(`${base}/search-index.json`)).json()
const urls = [...new Set(["/", ...index.map((entry) => entry.u)])].filter((url) => !filter || url.includes(filter))

let failures = 0
for (const url of urls) {
  const page = await browser.newPage()
  const problems = []
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`)
  })
  page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) problems.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(base + url, { waitUntil: "networkidle" })
  const scripted = await page.locator("[data-example-script]").count()
  const emptyIcons = await page.locator("tec-icon").evaluateAll((icons) =>
    icons.filter((icon) => !icon.shadowRoot?.querySelector("svg > *"))
      .map((icon) => icon.getAttribute("name")),
  )
  if (emptyIcons.length) problems.push(`unrendered icons: ${emptyIcons.join(", ")}`)

  if (problems.length) {
    failures++
    console.log(`✗ ${url}\n  ${problems.join("\n  ")}`)
  } else {
    console.log(`✓ ${url}${scripted ? ` (${scripted} scripted examples)` : ""}`)
  }
  await page.close()
}

// State-dependent icon styling reaches the SVG part inside tec-icon's shadow DOM.
for (const [url, selector, activeAttribute] of [
  ["/docs/components/toggle", '[data-example="toggle-demo"] tec-toggle', "pressed"],
  ["/docs/components/input-group", '#input-group-button [data-action="favorite"]', "aria-pressed"],
]) {
  const page = await browser.newPage()
  await page.goto(base + url, { waitUntil: "networkidle" })
  const control = page.locator(selector)
  const icon = control.locator("tec-icon")
  const fill = () => icon.evaluate((el) => getComputedStyle(el.shadowRoot.querySelector("svg")).fill)
  const before = await fill()
  await control.click()
  const after = await fill()
  const active = await control.getAttribute(activeAttribute)
  await control.click()
  const restored = await fill()
  if (before !== "none" || after === "none" || restored !== "none" || active === null || active === "false") {
    failures++
    console.log(`✗ icon state: ${url} (${before} → ${after} → ${restored})`)
  } else console.log(`✓ icon state: ${url}`)
  await page.close()
}

// The command menu opens with Ctrl+K and finds a page.
{
  const page = await browser.newPage()
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" })
  await page.keyboard.press("Control+k")
  await page.locator("[data-command-input]").fill("install")
  const first = page.locator("[data-command-list] [role=option]").first()
  await first.waitFor({ timeout: 5000 }).catch(() => {})
  if (!(await first.count()) || !(await first.getAttribute("href"))?.includes("installation")) {
    failures++
    console.log("✗ command menu: no result for 'install'")
  } else console.log("✓ command menu")
  await page.close()
}

// Docs copy controls use the component's real legacy fallback when the Clipboard API is unusable.
for (const missing of [true, false]) {
  const page = await browser.newPage()
  await page.addInitScript((missing) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: missing ? undefined : { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
    })
  }, missing)
  try {
    for (const path of ["/", "/docs/tecton/copy-button"]) {
      await page.goto(base + path, { waitUntil: "networkidle" })
      const selector = path === "/" ? "tec-copy-button[copy-label='Copy install command']" : "[data-code-block] tec-copy-button"
      const button = page.locator(`${selector}:visible`).first()
      const valueMatches = await button.evaluate((el) => {
        const displayed = el.closest("[data-code-block]")?.querySelector("pre code")?.textContent ?? el.previousElementSibling?.textContent
        return el.value === displayed?.replace(/\n$/, "")
      })
      if (!valueMatches) throw new Error(`${path}: copy value differs from the displayed text`)
      await button.click({ timeout: 5000 })
      await page.waitForFunction((button) => button.status === "copied", await button.elementHandle(), { timeout: 5000 })
      const restored = await button.evaluate((el) => {
        const inner = el.shadowRoot.querySelector("tec-button")
        return inner.shadowRoot.activeElement === inner.control && !el.shadowRoot.querySelector("textarea")
      })
      if (!restored) throw new Error(`${path}: fallback did not clean up and restore focus`)
    }
    console.log(`✓ docs copy fallback (${missing ? "missing" : "denied"} Clipboard API)`)
  } catch (error) {
    failures++
    console.log(`✗ docs copy fallback: ${error.message}`)
  } finally {
    await page.close()
  }
}

await browser.close()
server.close()
console.log(failures ? `\n${failures} failure(s)` : `\nAll ${urls.length} pages OK`)
process.exit(failures ? 1 : 0)
