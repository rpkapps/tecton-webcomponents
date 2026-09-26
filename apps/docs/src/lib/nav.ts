import { getCollection, type CollectionEntry } from "astro:content"

export type DocsEntry = CollectionEntry<"docs">

/** Sidebar sections, in order. The key is the folder under src/content/docs ("" = root). */
export const SECTIONS: { id: string; title: string }[] = [
  { id: "", title: "Getting started" },
  { id: "components", title: "Components" },
  { id: "tecton", title: "Tecton" },
  { id: "utils", title: "Utils" },
]

export const siteConfig = {
  name: "Tecton",
  title: "Tecton Web Components",
  description:
    "The Tecton design system as framework-agnostic web components: accessible, themeable custom elements built with Lit.",
  package: "@tecton/wc",
  nav: [
    { title: "Docs", href: "/docs" },
    { title: "Components", href: "/docs/components" },
    { title: "Tecton", href: "/docs/tecton" },
    { title: "Themes", href: "/themes" },
  ],
}

export interface DocsPage {
  entry: DocsEntry
  /** Path under /docs without slashes at the ends ("" for /docs, "components/button"). */
  slug: string
  url: string
  title: string
  /** Sidebar label. */
  label: string
  description: string
  section: string
  sectionTitle: string
  isIndex: boolean
  tags: string[]
  status?: DocsEntry["data"]["status"]
}

function slugOf(entry: DocsEntry) {
  const path = (entry.filePath ?? entry.id)
    .replace(/\\/g, "/")
    .replace(/^.*?src\/content\/docs\//, "")
    .replace(/\.mdx?$/, "")
  return path.replace(/(^|\/)index$/, "")
}

function sectionTitle(id: string) {
  return SECTIONS.find((s) => s.id === id)?.title ?? id.replace(/(^|-)(\w)/g, (_, d, c) => (d ? " " : "") + c.toUpperCase())
}

let cache: Promise<DocsPage[]> | undefined

/** Every page, in sidebar order (sections in SECTIONS order, then any other folder). */
export function getDocsPages(): Promise<DocsPage[]> {
  cache ??= (async () => {
    const entries = await getCollection("docs")
    const pages = entries.map((entry): DocsPage => {
      const slug = slugOf(entry)
      const segments = slug.split("/").filter(Boolean)
      const isIndex = /(^|\/)index\.mdx?$/.test(entry.filePath ?? "") || slug === ""
      const section = isIndex ? segments.join("/") : segments.slice(0, -1).join("/")
      return {
        entry,
        slug,
        url: slug ? `/docs/${slug}` : "/docs",
        title: entry.data.title,
        label: entry.data.sidebarTitle ?? entry.data.title,
        description: entry.data.description,
        section,
        sectionTitle: sectionTitle(section),
        isIndex,
        tags: entry.data.tags,
        status: entry.data.status,
      }
    })
    const sectionRank = (id: string) => {
      const i = SECTIONS.findIndex((s) => s.id === id)
      return i === -1 ? SECTIONS.length : i
    }
    return pages.sort(
      (a, b) =>
        sectionRank(a.section) - sectionRank(b.section) ||
        a.section.localeCompare(b.section) ||
        Number(b.isIndex) - Number(a.isIndex) ||
        (a.entry.data.order ?? Infinity) - (b.entry.data.order ?? Infinity) ||
        a.label.localeCompare(b.label),
    )
  })()
  return cache
}

/** The pages shown in navigation (sidebar, search, prev/next, overviews). */
export async function getVisiblePages() {
  return (await getDocsPages()).filter((page) => !page.entry.data.hidden)
}

export interface NavSection {
  id: string
  title: string
  pages: DocsPage[]
}

export async function getNavSections(): Promise<NavSection[]> {
  const pages = await getVisiblePages()
  const sections: NavSection[] = []
  for (const page of pages) {
    let section = sections.find((s) => s.id === page.section)
    if (!section) {
      section = { id: page.section, title: page.sectionTitle, pages: [] }
      sections.push(section)
    }
    section.pages.push(page)
  }
  return sections
}

/** The pages of one section, without its overview page, alphabetical by title. */
export async function getSectionPages(section: string) {
  return (await getVisiblePages())
    .filter((page) => page.section === section && !page.isIndex)
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** Is `href` (a header nav item) the current page or the section it belongs to? */
export function isNavActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/"
  if (href === "/docs") {
    return (
      path === "/docs" ||
      (path.startsWith("/docs/") && !siteConfig.nav.some((item) => item.href !== "/docs" && path.startsWith(item.href)))
    )
  }
  return path === href || path.startsWith(`${href}/`)
}
