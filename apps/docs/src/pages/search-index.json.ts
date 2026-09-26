import type { APIRoute } from "astro"
import { render } from "astro:content"

import { getVisiblePages, siteConfig } from "../lib/nav"

export interface SearchEntry {
  /** Result title. */
  t: string
  /** URL. */
  u: string
  /** Group (section title, or "Pages"). */
  g: string
  /** Description. */
  d?: string
  /** Custom element tags. */
  k?: string[]
  /** Headings of the page: [text, slug][]. */
  h?: [string, string][]
}

/** The command menu's index: every visible page with its h2/h3 headings. */
export const GET: APIRoute = async () => {
  const pages = await getVisiblePages()
  const entries: SearchEntry[] = [
    { t: "Home", u: "/", g: "Pages" },
    ...siteConfig.nav.map((item) => ({ t: item.title, u: item.href, g: "Pages" })),
    ...(await Promise.all(
      pages.map(async (page) => {
        const { headings } = await render(page.entry)
        return {
          t: page.isIndex && page.section ? `${page.sectionTitle} overview` : page.title,
          u: page.url,
          g: page.sectionTitle,
          d: page.description,
          k: page.tags.length ? page.tags : undefined,
          h: headings.filter((h) => h.depth <= 3).map((h): [string, string] => [h.text, h.slug]),
        }
      }),
    )),
  ]
  return new Response(JSON.stringify(entries), { headers: { "Content-Type": "application/json" } })
}
