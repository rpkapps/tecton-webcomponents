import { chromium } from "playwright-core"
const S = process.env.S
const [page, theme = "dark", ...names] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.addInitScript((t) => { try { localStorage.setItem("tecton-docs:theme", t) } catch {} }, theme)
await p.goto(`http://localhost:4437/docs/components/${page}`, { waitUntil: "networkidle" })
await p.waitForTimeout(2000)
for (const n of names) {
  const el = p.locator(`[data-example="${n}"] [data-slot=preview]`).first()
  await el.scrollIntoViewIfNeeded()
  await p.waitForTimeout(300)
  await el.screenshot({ path: `${S}/msgshots/${n}-${theme}.png` })
}
await b.close()
