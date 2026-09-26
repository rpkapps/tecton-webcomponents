# docs — the Tecton Web Components site

Astro (static output) + MDX + Shiki + Tailwind v4. The site loads the library's theme
(`tecton.css`), its Tailwind preset and fonts, and registers every `tec-*` element on every
page, so pages and examples use the real components.

```bash
pnpm --filter docs dev      # http://localhost:4321
pnpm --filter docs build    # static site in apps/docs/dist
pnpm --filter docs test     # build, then open every page in Chromium (scripts/smoke.mjs)
```

`node scripts/smoke.mjs button` re-checks only the pages whose URL contains `button`
(after a build). It fails on console errors, uncaught exceptions and failed requests.

## How to add a component page

A component family `<name>` needs **one page** and **its examples**. Nothing else: the sidebar,
the section overview cards, previous/next links and the search index are generated from the
content collection.

| What | Where |
| --- | --- |
| Page of a general component | `src/content/docs/components/<name>.mdx` |
| Page of a Tecton-only component | `src/content/docs/tecton/<name>.mdx` |
| Page of a utility | `src/content/docs/utils/<name>.mdx` |
| Examples | `src/examples/<name>-<example>.html` |
| Images / avatars for examples | `public/<folder>/…` (referenced as `/avatars/01.png`) |

Copy `src/content/docs/components/button.mdx` — it is the template.

### Frontmatter

```yaml
---
title: Button                                  # h1, sidebar label, search
description: Displays a button or a link that looks like a button.   # one sentence
tags: ["tec-button"]                           # every tag documented on the page
status: beta                                   # optional: beta | experimental | planned | deprecated
order: 3                                       # optional: position in the section (default: alphabetical)
sidebarTitle: Button                           # optional: shorter sidebar label
---
```

### Sections, in this order

1. Intro preview — `<ComponentPreview name="<name>-demo" />` right after the frontmatter, no heading.
2. `## Usage` — the import (```` ```ts import "@tecton/wc/<name>" ```` ) and the minimal markup (```` ```html ````).
3. One `## <Example>` section per example (variants, sizes, states, composition, forms, events…).
4. `## RTL` — `<ComponentPreview name="<name>-rtl" direction="rtl" />`.
5. `## Keyboard interactions` — `<KeyboardTable rows={[…]} />`.
6. `## Accessibility` — roles, labelling, focus, what the author must provide.
7. `## Usage guidelines` — `### Use it when`, `### Not for`, `### Do` (`<DoList>`), `### Don't` (`<Dont>`).
8. `## API Reference` — `<ApiReference tags={["tec-x", "tec-x-part"]} />`, last on the page.

### Components available in every page

No imports needed; they are passed to every MDX page by `src/pages/docs/[...slug].astro`
(`src/components/mdx/index.ts`).

| Component | Use |
| --- | --- |
| `<ComponentPreview name="x" />` | Renders `src/examples/x.html` live, with its highlighted source (collapsed, "View Code") and a copy button. Props: `direction="rtl"` (with an RTL/LTR toggle), `class="min-h-96 items-start"` (classes of the preview area), `align="start" \| "center" \| "end"`, `hideCode`, `caption="…"`. |
| `<ApiReference tags={["tec-x"]} />` | Attribute/property, event, slot, CSS part, CSS custom property, custom state and method tables from `packages/wc/custom-elements.json`. Undocumented JSDoc = missing rows. |
| `<KeyboardTable rows={[["Space", "Activates the button."], ["Shift+Tab", "…"]]} />` | Keys become `<kbd>`: `+` combines, `" / "` separates alternatives; `ArrowDown` renders ↓. Descriptions accept inline markdown. |
| `<Callout title="…" variant="info">…</Callout>` | Note in the prose; variants `default`, `info`, `success`, `warning`, `danger`. |
| `<DoList><Do>…</Do></DoList>` | The "Do" list of the usage guidelines. |
| `<Dont severity="HIGH" title="…"><Wrong>…</Wrong><Correct>…</Correct>Why.</Dont>` | One "Don't" entry: `CRITICAL`, `HIGH` or `MEDIUM`; `Wrong`/`Correct` wrap a code fence. |
| `<Steps>` with `### Step` headings inside | Numbered steps. |
| `<Kbd>Esc</Kbd>` | A key in prose. |
| `<CodeBlock code={…} lang="ts" title="x.ts" />` | Highlighted code from a string (use a fence for literal code). |
| `<SectionCards section="components" />` | Cards of every page of a section (overview pages). |
| `<TokenTable />`, `<PaletteTable />`, `<IconGallery />` | Theme, palette and icon tables (Theming, Icons pages). |

Markdown inside a component needs blank lines around it:

```mdx
<Do>

Put icons in `slot="start"`.

</Do>
```

Code fences: ```` ```html title="index.html" ```` adds a file title, `noCopy` hides the copy
button. Highlighted languages: `html`, `ts`, `tsx`, `js`, `css`, `bash`, `json`, `vue`,
`svelte`, `angular-html`, `diff`, `ini`.

Links to other pages are absolute: `[Dialog](/docs/components/dialog)`. A link to a page that
does not exist yet is fine (another agent is writing it).

### Example files

`src/examples/<name>-<example>.html` is an HTML **fragment**: the same file is rendered live and
shown as the code, so write it the way a user would copy it.

- **File name** starts with the family name: `dialog-demo.html`, `dialog-rtl.html`,
  `dialog-scrollable.html`. The first example of a page is `<name>-demo`.
- **No imports of components**: every element is registered on every page. Write the markup only.
- **Layout with Tailwind classes** (the site loads the Tecton preset): `flex gap-2`, `grid`,
  `w-full max-w-sm`, `text-sm text-muted-foreground`. **Tecton palette only**: semantic colours
  (`bg-card`, `text-muted-foreground`, `border-border`, `text-destructive`) or Tecton steps
  (`bg-blue-120 text-blue-830`). Stock Tailwind colours (`bg-red-500`, `text-zinc-400`) produce no
  CSS. Classes style your light DOM and the component host; never try to restyle a component's
  internals with classes — use its attributes, `::part()` or custom properties.
- **Icons**: inline Lucide SVG with `width="16" height="16"` and `aria-hidden="true"` (copy the
  markup from lucide.dev), or `<tec-icon name="well">` for Tecton domain icons. Slot them with
  `slot="start"` / `slot="end"` where the component offers those slots.
- **Ids are unique on the page and prefixed with the example name** (`id="dialog-demo-title"`):
  several examples render on one page, and `<label for>` / `aria-*` references must not collide.
- **Behaviour**: at most one `<script type="module">` at the end of the file. It runs once, after
  the page is parsed, and may import packages (`import { registerIcons } from "@tecton/wc/icon/registry.js"`).
  `document.currentScript` is null in modules, so find the example through its root id:

  ```html
  <div id="dialog-demo" class="flex gap-2">…</div>
  <script type="module">
    const root = document.getElementById("dialog-demo")
    root.querySelector("tec-button").addEventListener("click", () => root.querySelector("tec-dialog").show())
  </script>
  ```

- **RTL examples** use real right-to-left text and set `lang` on their root
  (`<div class="flex gap-2" lang="ar">…`); the preview sets `dir="rtl"`. Flip directional icons
  with `class="rtl:rotate-180"`.
- **Assets**: images go to `public/` and are referenced from `/` (`<img src="/avatars/01.png">`).
- **Width**: the preview is ~40rem wide and at least 18rem tall, content centred. Constrain wide
  examples (`w-full max-w-md`); change the area with `<ComponentPreview class="min-h-96 items-start">`.

## How the site works

| File | Role |
| --- | --- |
| `src/content.config.ts` | The `docs` collection (all `.mdx` under `src/content/docs`) and its frontmatter schema. |
| `src/lib/nav.ts` | Sections, sidebar order, URLs, previous/next — derived from folders and frontmatter. |
| `src/pages/docs/[...slug].astro` | Docs page layout: sidebar, header, MDX body, prev/next, "On this page". |
| `src/pages/index.astro` | Landing page (the hero is `src/examples/hero-preview.html`). |
| `src/pages/search-index.json.ts` | Index of the command menu (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd>, <kbd>/</kbd>). |
| `src/components/ComponentPreview.astro` | Example rendering + code; loads example scripts. |
| `src/components/ApiReference.astro`, `src/lib/manifest.ts` | API tables from the Custom Elements Manifest. |
| `plugins/tecton-docs.mjs` | Vite plugin: example scripts as modules (they import the families they use first). |
| `plugins/component-preload.mjs` | Astro integration: a render-blocking `<script type="module">` per page that imports its families and example scripts, so pages paint with every element defined (no pop-in or layout shift when navigating). |
| `src/lib/shiki-transformers.mjs` | Code block markup (title, copy button) for fences and generated code. |
| `src/styles/app.css`, `typeset.css` | Site CSS. Prose styles apply only inside `.typeset` and skip `[data-not-typeset]`, so examples render exactly as in an application. Keep new rules inside `@layer base` / `@layer components`. |
| `docs-*` classes (`docs-container`, `docs-no-scrollbar`…) | Site-only utilities in `app.css`; never use them in examples. |
| `src/scripts/site.ts` | Theme toggle (stored in `localStorage`, default dark), copy buttons, mobile menu, command menu, TOC highlighting. |

The API reference reads `custom-elements.json` from the `@tecton/wc` package; set
`TECTON_WC_MANIFEST=/path/to/custom-elements.json` to preview another manifest.
