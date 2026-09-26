import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

/**
 * Every docs page is an .mdx file under src/content/docs. The folder is the sidebar
 * section (root = Getting started, components/, tecton/, utils/); a page's `index.mdx`
 * is the section overview. Adding a file adds it to the sidebar, the search and the
 * section overview; nothing else needs editing.
 */
const docs = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    /** Page title (h1, sidebar label, search). */
    title: z.string(),
    /** One sentence shown under the title, on overview cards and in search results. */
    description: z.string(),
    /** Custom element tags documented on the page (`["tec-button"]`), used by search. */
    tags: z.array(z.string()).default([]),
    /** Maturity badge next to the title; omit for stable components. */
    status: z.enum(["stable", "beta", "experimental", "planned", "deprecated"]).optional(),
    /** Position in the sidebar section. Pages without `order` follow, alphabetically. */
    order: z.number().optional(),
    /** Shorter label for the sidebar, when the title is long. */
    sidebarTitle: z.string().optional(),
    /** Built but left out of the sidebar, overviews and search. */
    hidden: z.boolean().default(false),
  }),
})

export const collections = { docs }
