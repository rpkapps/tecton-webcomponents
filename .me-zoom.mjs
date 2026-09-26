import { chromium } from "playwright-core"
const [, , url, sel, out, theme = "light", idx = "0"] = process.argv
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 3 })
await page.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
await page.goto(url, { waitUntil: "networkidle" })
await page.evaluate((t) => { document.documentElement.dataset.theme = t; document.documentElement.classList.toggle("dark", t === "dark") }, theme)
await page.waitForTimeout(800)
const el = (await page.$$(sel))[Number(idx)]
await el.scrollIntoViewIfNeeded()
await el.screenshot({ path: out })
await browser.close()
