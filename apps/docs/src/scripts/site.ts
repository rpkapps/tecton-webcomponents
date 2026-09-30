// Behaviour of the docs chrome: theme toggle, mobile menu, command menu,
// "On this page" highlighting. Plain DOM, no framework.

const THEME_KEY = "tecton-docs:theme"
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/* Theme ---------------------------------------------------------------------------- */

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // private mode: the choice lasts for this page only
  }
}

for (const button of document.querySelectorAll("[data-theme-toggle]")) {
  button.addEventListener("click", () => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
  })
}

/* Modal dialogs (mobile menu, command menu): close on backdrop press. ---------------- */

function lightDismiss(dialog: HTMLDialogElement) {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    const { clientX: x, clientY: y } = event
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) dialog.close()
  })
}

/* Mobile menu ---------------------------------------------------------------------- */

const mobileNav = document.querySelector<HTMLDialogElement>("[data-mobile-nav]")
const mobileTrigger = document.querySelector<HTMLElement>("[data-mobile-nav-trigger]")
if (mobileNav && mobileTrigger) {
  lightDismiss(mobileNav)
  mobileTrigger.addEventListener("click", () => {
    mobileNav.showModal()
    mobileTrigger.setAttribute("aria-expanded", "true")
    mobileNav.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "center" })
  })
  mobileNav.addEventListener("close", () => mobileTrigger.setAttribute("aria-expanded", "false"))
  mobileNav.querySelector("[data-mobile-nav-close]")?.addEventListener("click", () => mobileNav.close())
}

/* Command menu --------------------------------------------------------------------- */

interface SearchEntry {
  t: string
  u: string
  g: string
  d?: string
  k?: string[]
  h?: [string, string][]
}

interface Result {
  id: string
  title: string
  url: string
  group: string
  detail?: string
  kind: "page" | "component" | "heading" | "nav"
}

const menu = document.querySelector<HTMLDialogElement>("[data-command-menu]")
const input = menu?.querySelector<HTMLInputElement>("[data-command-input]")
const list = menu?.querySelector<HTMLElement>("[data-command-list]")
let index: Promise<SearchEntry[]> | undefined
let results: Result[] = []
let active = 0

function loadIndex() {
  index ??= fetch("/search-index.json")
    .then((r) => r.json() as Promise<SearchEntry[]>)
    .catch(() => {
      index = undefined
      return []
    })
  return index
}

function score(text: string, query: string) {
  const t = text.toLowerCase()
  if (t === query) return 100
  if (t.startsWith(query)) return 80
  if (t.split(/[\s/-]+/).some((w) => w.startsWith(query))) return 60
  if (t.includes(query)) return 40
  // all words of the query somewhere
  const words = query.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((w) => t.includes(w))) return 30
  // "theme" finds "theming": the query without its last letter
  if (query.length >= 4 && t.includes(query.slice(0, -1))) return 25
  return 0
}

function search(entries: SearchEntry[], raw: string): Result[] {
  const query = raw.trim().toLowerCase()
  const component = (e: SearchEntry) => /\/docs\/(components|tecton|utils)\//.test(e.u)
  if (!query) {
    return entries.map((e, i) => ({
      id: `r${i}`,
      title: e.t,
      url: e.u,
      group: e.g,
      kind: e.g === "Pages" ? "nav" : component(e) ? "component" : "page",
    }))
  }
  const scored: (Result & { s: number })[] = []
  entries.forEach((e, i) => {
    const s = Math.max(
      score(e.t, query) + 10,
      ...(e.k ?? []).map((tag) => score(tag, query) + 5),
      e.d ? score(e.d, query) / 4 : 0,
    )
    if (s > 10) {
      scored.push({ id: `r${i}`, title: e.t, url: e.u, group: e.g, detail: e.k?.map((k) => `<${k}>`).join(" "), kind: e.g === "Pages" ? "nav" : component(e) ? "component" : "page", s })
    }
    for (const [text, slug] of e.h ?? []) {
      const hs = score(text, query)
      if (hs >= 40) scored.push({ id: `r${i}-${slug}`, title: text, url: `${e.u}#${slug}`, group: e.g, detail: e.t, kind: "heading", s: hs - 30 })
    }
  })
  return scored.sort((a, b) => b.s - a.s).slice(0, 50)
}

const ICONS: Record<Result["kind"], string> = {
  nav: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  page: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  component: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>',
  heading: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
}

function renderResults() {
  if (!list || !input) return
  if (!results.length) {
    list.innerHTML = '<p class="py-12 text-center text-sm text-muted-foreground">No results found.</p>'
    input.removeAttribute("aria-activedescendant")
    return
  }
  const groups = new Map<string, Result[]>()
  for (const r of results) {
    if (!groups.has(r.group)) groups.set(r.group, [])
    groups.get(r.group)!.push(r)
  }
  let html = ""
  let n = 0
  for (const [group, items] of groups) {
    const gid = `cg-${group.replace(/\W+/g, "-")}`
    html += `<div role="group" aria-labelledby="${gid}"><div id="${gid}" class="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">${escapeHtml(group)}</div>`
    for (const item of items) {
      const i = n++
      html += `<a id="cmd-${i}" href="${escapeHtml(item.url)}" role="option" tabindex="-1" data-index="${i}" aria-selected="${i === active}" class="flex h-9 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium outline-none aria-selected:border-input aria-selected:bg-input/30"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-4 shrink-0 text-muted-foreground">${ICONS[item.kind]}</svg><span class="truncate">${escapeHtml(item.title)}</span>${item.detail ? `<span class="ml-auto truncate font-mono text-xs font-normal text-muted-foreground">${escapeHtml(item.detail)}</span>` : ""}</a>`
    }
    html += "</div>"
  }
  list.innerHTML = html
  // Results are in group order now; keep `results` in the same order.
  results = [...groups.values()].flat()
  updateActive(false)
}

function updateActive(scroll = true) {
  if (!list || !input) return
  for (const option of list.querySelectorAll<HTMLElement>("[role=option]")) {
    const selected = Number(option.dataset.index) === active
    option.setAttribute("aria-selected", String(selected))
    if (selected) {
      input.setAttribute("aria-activedescendant", option.id)
      if (scroll) option.scrollIntoView({ block: "nearest" })
    }
  }
}

async function refresh() {
  if (!input) return
  const entries = await loadIndex()
  results = search(entries, input.value)
  active = 0
  renderResults()
}

function openMenu() {
  if (!menu || !input || menu.open) return
  menu.showModal()
  input.value = ""
  void refresh()
  input.focus()
}

if (menu && input && list) {
  lightDismiss(menu)
  for (const trigger of document.querySelectorAll("[data-command-trigger]")) trigger.addEventListener("click", openMenu)
  for (const key of document.querySelectorAll("[data-mod-key]")) key.textContent = isMac ? "⌘" : "Ctrl"
  document.addEventListener("keydown", (event) => {
    // composedPath()[0] is the real focused element, also inside a component's shadow root
    // (event.target is retargeted to the host, e.g. a tec-input).
    const target = (event.composedPath()[0] ?? event.target) as HTMLElement
    const typing =
      event.defaultPrevented ||
      target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
      target.closest?.("[contenteditable]") ||
      target.getAttribute?.("role") === "textbox" ||
      target.getAttribute?.("role") === "spinbutton"
    if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (menu.open) menu.close()
      else openMenu()
    } else if (event.key === "/" && !typing && !menu.open) {
      event.preventDefault()
      openMenu()
    }
  })
  input.addEventListener("input", () => void refresh())
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!results.length) return
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length
      updateActive()
    } else if (event.key === "Home" && event.ctrlKey) {
      active = 0
      updateActive()
    } else if (event.key === "Enter") {
      event.preventDefault()
      const result = results[active]
      if (result) {
        menu.close()
        location.href = result.url
      }
    }
  })
  list.addEventListener("click", (event) => {
    if ((event.target as Element).closest("[role=option]")) menu.close()
  })
  list.addEventListener("pointermove", (event) => {
    const option = (event.target as Element).closest<HTMLElement>("[role=option]")
    if (option && Number(option.dataset.index) !== active) {
      active = Number(option.dataset.index)
      updateActive(false)
    }
  })
  // Warm the index on first hover/focus of a trigger.
  for (const trigger of document.querySelectorAll("[data-command-trigger]")) {
    trigger.addEventListener("pointerenter", () => void loadIndex(), { once: true })
    trigger.addEventListener("focus", () => void loadIndex(), { once: true })
  }
}

/* On this page --------------------------------------------------------------------- */

const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")]
if (tocLinks.length) {
  const targets = tocLinks
    .map((link) => document.getElementById(link.dataset.tocLink!))
    .filter((el): el is HTMLElement => !!el)
  const setActive = (id: string) => {
    for (const link of tocLinks) link.dataset.active = String(link.dataset.tocLink === id)
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    },
    { rootMargin: "0% 0% -80% 0%" },
  )
  for (const target of targets) observer.observe(target)
}

/* Scrollable tables: keyboard-reachable only while they overflow ---------------------- */

// A wrapper that scrolls must be focusable (and then named) so keyboard users can scroll it;
// one that fits stays out of the tab order.
const scrollers = [...document.querySelectorAll<HTMLElement>(".typeset-scroll")]
if (scrollers.length) {
  const labelOf = (el: HTMLElement) => {
    let node: Element | null = el.previousElementSibling
    while (node && !/^H[1-6]$/.test(node.tagName)) node = node.previousElementSibling
    const heading = node?.textContent?.replace(/#$/, "").trim()
    const caption = el.querySelector("caption")?.textContent?.trim()
    return `${caption || heading || "Table"} (scrollable)`
  }
  const sync = (el: HTMLElement) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      el.tabIndex = 0
      el.setAttribute("role", "region")
      el.setAttribute("aria-label", labelOf(el))
    } else if (el.hasAttribute("tabindex")) {
      el.removeAttribute("tabindex")
      el.removeAttribute("role")
      el.removeAttribute("aria-label")
    }
  }
  const observer = new ResizeObserver((entries) => entries.forEach((entry) => sync(entry.target as HTMLElement)))
  for (const el of scrollers) observer.observe(el)
}
