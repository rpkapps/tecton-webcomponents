import { chromium } from "playwright-core"
const S = process.env.S
const [page, dark, ...idx] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto(`http://127.0.0.1:3000/docs/components/${page}`, { waitUntil: "networkidle" })
await p.evaluate((d) => document.documentElement.classList.toggle("dark", d === "dark"), dark)
await p.waitForSelector(".preview", { timeout: 15000 }); await p.waitForTimeout(1500)
const previews = p.locator(".preview")
console.log("count", await previews.count())
for (const i of idx) {
  const el = previews.nth(Number(i))
  await el.scrollIntoViewIfNeeded()
  await el.screenshot({ path: `${S}/msgshots/react-${page}-${i}-${dark}.png` })
}
await b.close()
