import { chromium } from "playwright-core"
const pages = process.argv.slice(2)
const out = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/forms-agent"
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
for (const spec of pages) {
  const [name, theme = "light"] = spec.split(":")
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
  await page.goto(`http://localhost:4437/docs/components/${name}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/${name}-${theme}.png`, fullPage: true })
  console.log(name, theme, errors.length ? errors.slice(0, 5) : "no errors")
  await page.close()
}
await browser.close()
