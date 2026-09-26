import { chromium } from "playwright-core"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })
async function probe(url, vpSel, itemSel, idx) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  await p.goto(url, { waitUntil: "load", timeout: 90000 })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(([vpSel, itemSel, idx]) => {
    const vp = document.querySelectorAll(vpSel)[idx]
    const top = vp.getBoundingClientRect().top
    const content = vp.firstElementChild
    const cs = getComputedStyle(content)
    return { ch: vp.clientHeight, sh: vp.scrollHeight, st: vp.scrollTop, pad: cs.paddingTop + "/" + cs.paddingBottom, gap: cs.rowGap,
      items: [...vp.querySelectorAll(itemSel)].map((i) => { const r = i.getBoundingClientRect(); return [Math.round(r.top - top + vp.scrollTop), Math.round(r.height)] }) }
  }, [vpSel, itemSel, idx])
  console.log(url.includes("3000") ? "REACT" : "WC", idx, JSON.stringify(r))
  await p.close()
}
await probe("http://localhost:4440/docs/components/message-scroller", "tec-message-scroller-viewport", "tec-message-scroller-item", 1)

await probe("http://localhost:4440/docs/components/message-scroller", "tec-message-scroller-viewport", "tec-message-scroller-item", 2)
await b.close()
