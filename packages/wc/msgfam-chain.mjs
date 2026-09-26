import { chromium } from "playwright-core"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto(`http://127.0.0.1:4800/docs/components/message-scroller/`, { waitUntil: "load", timeout: 120000 })
await p.waitForTimeout(3000)
console.log(await p.evaluate(() => {
  let el = document.querySelector('[data-example="message-scroller-opening-position"] tec-message-scroller-content')
  const out = []
  while (el && el.localName !== "figure") {
    const cs = getComputedStyle(el)
    out.push(`${el.localName}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0,3).join(".") : ""} h=${Math.round(el.getBoundingClientRect().height)} disp=${cs.display} flex=${cs.flex} minh=${cs.minHeight} ov=${cs.overflowY}`)
    el = el.assignedSlot ?? el.parentElement ?? el.getRootNode().host
  }
  return out.join("\n")
}))
await b.close()
