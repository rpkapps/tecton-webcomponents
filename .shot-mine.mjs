import { chromium } from "playwright-core"
const S = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/shots"
import { mkdirSync } from "fs"; mkdirSync(S, { recursive: true })
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const pages = process.argv.slice(2)
for (const name of pages) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  p.on("pageerror", (e) => errors.push(String(e)))
  await p.goto(`http://127.0.0.1:4461/docs/tecton/${name}`, { waitUntil: "networkidle", timeout: 90000 })
  await p.waitForTimeout(4000)
  errors.length = 0
  await p.goto(`http://127.0.0.1:4461/docs/tecton/${name}`, { waitUntil: "networkidle", timeout: 90000 })
  await p.waitForTimeout(1500)
  for (const theme of ["light", "dark"]) {
    await p.evaluate((t) => { document.documentElement.dataset.theme = t; document.documentElement.classList.toggle("dark", t === "dark") }, theme)
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${S}/wc-${name}-${theme}.png`, fullPage: true })
  }
  console.log(name, "errors:", errors.slice(0, 5))
  await p.close()
}
await b.close()
