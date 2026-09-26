# @tecton/wc

The Tecton design system as standard custom elements (Lit). See the repository README and the
documentation site (`apps/docs`) for the full guide.

```js
import "@tecton/wc/tecton.css"   // theme (--tec-* variables, light + dark)
import "@tecton/wc/fonts.css"    // Figtree + IBM Plex Mono
import "@tecton/wc"              // registers every tec-* element (or per family: "@tecton/wc/button")
```

- `@tecton/wc/<family>` registers a family; `@tecton/wc/<family>/<family>.js` exports its classes
  without registering them (scoped registries).
- `@tecton/wc/autoloader` — registers families on demand as their tags appear; pair it with
  `@tecton/wc/cloak.css`, which hides elements until they are defined (no flash of unstyled content).
- `@tecton/wc/tailwind.css` — optional Tailwind v4 preset for your own markup.
- `@tecton/wc/utilities.css` / `tailwind-utilities.css` — the scroll-fade and shimmer utilities.
- `@tecton/wc/custom-elements.json` — the Custom Elements Manifest (API of every element).
