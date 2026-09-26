import { chromium } from "playwright-core"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto("http://127.0.0.1:3000/docs/components/attachment", { waitUntil: "networkidle" })
const r = await p.evaluate(() => [...document.querySelectorAll("[data-slot=attachment]")].slice(0, 12).map(e => { const s = getComputedStyle(e); return [e.dataset.orientation, e.dataset.size, e.dataset.state, s.padding, s.gap, s.width, s.borderRadius, s.backgroundColor, e.querySelector("[data-slot=attachment-content]") ? "C" : "", e.querySelector("[data-slot=attachment-media]") ? "M" : ""].join(" | ") }))
console.log(r.join("\n"))
await b.close()
