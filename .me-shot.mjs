import { chromium } from "playwright-core"
const out = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/me/shots"
import fs from "node:fs"; fs.mkdirSync(out, { recursive: true })
const [, , page_, theme = "light", which = "wc"] = process.argv
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: theme })
const page = await ctx.newPage()
const errors = []
page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
page.on("pageerror", (e) => errors.push(String(e)))
page.on("requestfailed", (r) => errors.push("FAILED " + r.url()))
if (which === "wc") {
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
  await page.goto(`http://127.0.0.1:4437/docs/components/${page_}`, { waitUntil: "networkidle" })
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; document.documentElement.classList.toggle("dark", t === "dark") }, theme)
  const dir = "/home/user/tecton-webcomponents/packages/wc/src/components"
  const mine = process.env.INJECT ? ["card","aspect-ratio","scroll-area","item","avatar","badge","input","label","toggle-group","separator","dropdown-menu","button"] : []; const files = fs.readdirSync(dir).filter((d) => mine.includes(d) && fs.existsSync(`${dir}/${d}/define.ts`)).map((d) => `/@fs${dir}/${d}/define.ts`)
  let failed = []
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      failed = await page.evaluate(async (files) => { const bad = []; for (const f of files) await import(f).catch((e) => bad.push(f + " " + e)); return bad }, files)
      await page.waitForTimeout(1500)
      await page.evaluate(() => 1)
      break
    } catch (e) { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500); await page.evaluate((t) => { document.documentElement.dataset.theme = t; document.documentElement.classList.toggle("dark", t === "dark") }, theme).catch(()=>{}) }
  }
  if (failed.length) console.log("import failures", failed.map(f=>f.split("/components/")[1]).join("; ").slice(0, 600))
} else {
  await page.goto(`http://127.0.0.1:3000/docs/components/${page_}`, { waitUntil: "networkidle" })
  await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme)
}
await page.waitForTimeout(800)
const sel = which === "wc" ? ".preview" : "[data-slot=preview] , .preview"
const previews = await page.$$(which === "wc" ? ".preview" : "[data-name] , [data-slot=component-preview]")
let els = previews
if (which !== "wc") {
  // React site: find preview containers by heuristic
  els = await page.$$("div[class*='preview']")
}
let i = 0
for (const el of els.slice(0, 14)) {
  const box = await el.boundingBox(); if (!box || box.height < 40) continue
  await el.screenshot({ path: `${out}/${page_}-${which}-${theme}-${i++}.png` })
}
console.log(page_, which, theme, "shots:", i, "errors:", JSON.stringify(errors.slice(0, 8)))
await browser.close()
