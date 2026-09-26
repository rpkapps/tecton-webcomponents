import { chromium } from "playwright-core"
const S = "/tmp/claude-0/-home-user/7824a982-3b74-50e1-abe5-6bb120608676/scratchpad/msgshots"
const [page, theme, ...names] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.addInitScript((t) => { try { localStorage.setItem("tecton-docs:theme", t) } catch {} }, theme)
await p.goto(`http://127.0.0.1:4800/docs/components/${page}/`, { waitUntil: "load", timeout: 120000 })
await p.waitForTimeout(3000)
for (const n of names) {
  const el = p.locator(`[data-example="${n}"] [data-slot=preview]`).first()
  await el.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1500)
  await el.screenshot({ path: `${S}/v2-${n}-${theme}.png` })
  const m = await el.evaluate((root) => {
    const vp = root.querySelector("tec-message-scroller-viewport")
    if (!vp) return null
    const top = vp.getBoundingClientRect().top
    return { st: vp.scrollTop, max: vp.scrollHeight - vp.clientHeight, anchors: [...vp.querySelectorAll("[scroll-anchor]")].map((a) => Math.round(a.getBoundingClientRect().top - top)) }
  })
  console.log(n, JSON.stringify(m))
}
await b.close()
