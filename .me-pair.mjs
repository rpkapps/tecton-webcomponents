import { chromium } from "playwright-core"
import fs from "node:fs"
const d = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/me/shots"
const [, , pg, theme] = process.argv
let rows = ""
for (let i = 0; i < 20; i++) {
  const a = `${d}/${pg}-wc-${theme}-${i}.png`, b = `${d}/${pg}-react-${theme}-${i}.png`
  if (!fs.existsSync(a) && !fs.existsSync(b)) break
  const img = (f) => fs.existsSync(f) ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}">` : "<div>missing</div>"
  rows += `<div style="display:flex;gap:8px;margin-bottom:8px">${img(a)}${img(b)}</div>`
}
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } })
await page.setContent(`<body style="margin:0;background:red">${rows}</body>`)
await page.screenshot({ path: `${d}/${pg}-${theme}-pair.png`, fullPage: true })
await browser.close()
console.log(`${d}/${pg}-${theme}-pair.png`)
