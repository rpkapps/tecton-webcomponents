import { chromium } from "playwright-core"
const S = process.env.S
const pages = process.argv.slice(2)
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
for (const name of pages) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()) })
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  p.on("requestfailed", (r) => errors.push("failed: " + r.url()))
  await p.goto(`http://localhost:4437/docs/components/${name}`, { waitUntil: "networkidle" })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${S}/msgshots/${name}.png`, fullPage: true })
  console.log(name, errors.length ? errors.slice(0, 8).join("\n  ") : "OK")
  await p.close()
}
await b.close()
