# Tecton Web Components

`@tecton/wc` is the Tecton design system as standard custom elements: 82 component families
(359 elements) that work in any framework or none, with the Tecton theme, full keyboard support and
WAI-ARIA semantics. Components are written in [Lit](https://lit.dev), styled with scoped CSS inside
their shadow roots, and themed entirely through CSS custom properties.

```
packages/wc     @tecton/wc — the component library (Lit, TypeScript, Vitest browser tests)
apps/docs       the documentation site (Astro): every component with live examples and API tables
docs/           RESEARCH.md (architecture research), CONVENTIONS.md (the component contract),
                OVERFLOW-RULES.md (tec-overflow collapse rules)
```

## Quick start

```bash
pnpm install
pnpm dev          # docs site with live components (loads the library from source)
pnpm test         # 799 browser tests (Vitest + Playwright Chromium, axe checks)
pnpm build        # library (dist + custom-elements.json) and the static docs site
pnpm preview      # serve the built docs site on http://localhost:4321 (run pnpm build first)
```

`astro dev` and `astro preview` run in the background: stop them with
`pnpm --filter docs exec astro dev stop` / `astro preview stop`.

Requirements: Node ≥ 22 and pnpm 10, on Windows, macOS or Linux. The tests run in Playwright's
Chromium; download it once with `pnpm --filter @tecton/wc exec playwright install chromium`
(set `CHROMIUM_PATH` to use another Chromium instead).

On Windows, clone with the repository's line endings (`.gitattributes` keeps LF). A clone made
before that file existed can be fixed with `git rm --cached -r . && git reset --hard`.

## Using the library

```html
<link rel="stylesheet" href="@tecton/wc/tecton.css" />
<script type="module">
  import "@tecton/wc/button" // registers <tec-button>; `import "@tecton/wc"` registers everything
</script>

<tec-button variant="outline">Save</tec-button>
```

- **Theme**: `@tecton/wc/tecton.css` defines the `--tec-*` variables (light and dark;
  `data-theme="dark"` or `.dark` on any ancestor switches mode). Fonts: `@tecton/wc/fonts.css`.
- **Composition**: compound components are nested elements
  (`<tec-select><tec-select-item value="a">A</tec-select-item></tec-select>`); anchored overlays take
  their trigger in `slot="trigger"`.
- **Forms**: controls are form-associated custom elements — they submit, validate, reset and work
  with `<label for>`, like native inputs.
- **Customisation**: attributes for variants and sizes, documented `--tec-<component>-*` custom
  properties, `::part()` and `:state()`.
- **Tailwind (optional)**: `@tecton/wc/tailwind.css` maps the Tecton theme onto Tailwind for your own
  markup (`bg-primary`, `bg-blue-120`); components never need it.
- **Frameworks**: React 19, Vue, Angular and Svelte use the elements directly; types come from
  `custom-elements.json` and `HTMLElementTagNameMap`.
- **Loading**: `@tecton/wc/autoloader` registers only the families a page uses (on demand, as tags
  appear) and `@tecton/wc/cloak.css` hides elements until they are defined (no flash of unstyled
  content; a 2s failsafe reveals them if a definition never arrives).
- **Scoped registries**: `@tecton/wc/<family>/<family>.js` exports the classes without registering them.

## How it is built

Read [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) before adding or changing a component. In short:

1. One folder per family in `packages/wc/src/components/<name>/`: class modules without side
   effects, a `define.ts` that registers the family, a `*.styles.ts`, and a `*.test.ts`.
2. No Tailwind inside components; only `--tec-*` theme variables. Box styles live on inner parts
   (host documents' resets beat `:host`), layout containers make the host the layout box.
3. Every interactive component implements its WAI-ARIA APG pattern (keyboard, roles, focus), uses
   ElementInternals for host semantics and ARIA element reflection across shadow boundaries, and
   is covered by keyboard, accessibility-tree and axe tests.
4. JSDoc (`@slot`, `@csspart`, `@cssprop`, `@cssstate`, `@fires`) feeds the Custom Elements Manifest,
   from which the docs site renders its API tables.
5. Docs: `apps/docs/src/content/docs/<section>/<name>.mdx` plus examples in
   `apps/docs/src/examples/<name>-<example>.html` (the file is both the preview and the shown code).
   See [`apps/docs/README.md`](apps/docs/README.md).

The theme is generated from the Tecton token export in `packages/wc/tokens/`
(`pnpm --filter @tecton/wc build:theme`); replace those files with a newer export to update it.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm --filter @tecton/wc build` | Theme → `src/index.ts` → `tsc` to `dist/` → CSS → `custom-elements.json` |
| `pnpm --filter @tecton/wc test` | All browser tests; one family: `npx vitest run src/components/<name>` |
| `pnpm --filter @tecton/wc typecheck` | TypeScript |
| `pnpm --filter @tecton/wc analyze` | Regenerate `custom-elements.json` only |
| `pnpm --filter @tecton/wc dev` | Rebuild `dist/` on change (`tsc --watch`); `npx vite packages/wc/dev` opens the playground page |
| `pnpm --filter docs dev` / `build` / `test` | Docs site dev server / static build / Playwright smoke test |
