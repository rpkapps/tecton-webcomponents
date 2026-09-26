import { chromium } from "playwright-core"
const [name, theme = "light"] = process.argv.slice(2)
const out = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/forms-agent"
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`http://127.0.0.1:3000/docs/components/${name}`, { waitUntil: "networkidle" })
await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme)
await page.waitForTimeout(800)
let i = 0
for (const el of await page.$$("[data-slot=component-preview] [data-slot=preview]")) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); await el.screenshot({ path: `${out}/react-${name}-${i++}-${theme}.png` }) }
console.log(i)
await browser.close()
