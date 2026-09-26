import type { MarkdownHeading } from "astro"

export interface TocItem {
  depth: number
  slug: string
  text: string
}

/**
 * "On this page": the h2/h3 headings of the page, plus one entry per element of an
 * <ApiReference tags={[…]} /> (its headings are rendered by the component, so the
 * markdown heading list does not know them).
 */
export function buildToc(headings: MarkdownHeading[], body = ""): TocItem[] {
  const items: TocItem[] = headings.filter((h) => h.depth === 2 || h.depth === 3).map(({ depth, slug, text }) => ({ depth, slug, text }))
  const apiItems: TocItem[] = []
  for (const match of body.matchAll(/<ApiReference\b[^>]*\btags=\{\s*\[([^\]]*)\]\s*\}/g)) {
    for (const tag of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) apiItems.push({ depth: 3, slug: tag[1], text: tag[1] })
  }
  if (!apiItems.length) return items
  const at = items.findIndex((item) => item.depth === 2 && /^api-reference/.test(item.slug))
  if (at === -1) return [...items, ...apiItems]
  let end = at + 1
  while (end < items.length && items[end].depth > 2) end++
  return [...items.slice(0, end), ...apiItems, ...items.slice(end)]
}
