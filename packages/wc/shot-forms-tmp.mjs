import { chromium } from "playwright-core"
const [page_, theme = "light", ...only] = process.argv.slice(2)
const out = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/forms-agent"
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
page.on("pageerror", (e) => errors.push(String(e)))
await page.addInitScript((t) => { for (const k of ["tecton-docs:theme"]) localStorage.setItem(k, t) }, theme)
await page.goto(`http://localhost:4437/docs/components/${page_}`, { waitUntil: "networkidle" })
await page.waitForTimeout(800)
for (const el of await page.$$("[data-slot=component-preview]")) {
  const name = await el.getAttribute("data-example")
  if (only.length && !only.includes(name)) continue
  const preview = await el.$("[data-slot=preview]")
  await preview.screenshot({ path: `${out}/${name}-${theme}.png` })
}
console.log(page_, theme, errors.length ? errors.slice(0, 5) : "no errors")
await browser.close()
