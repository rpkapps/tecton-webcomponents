# Tecton Web Components — Architecture Research

_Status: input to the architecture decision. Researched 2026-09-26._

Goal: a framework-agnostic custom-element implementation of the Tecton design system (~80 components in the shadcn/ui vocabulary) with a React Aria–level accessibility and behaviour bar, plus a docs site. This report looks at how the leading libraries solve each problem and ends each section with a recommendation. Browser-support claims are as of September 2026. Where the sources disagreed, the text says so.

Reference libraries: Web Awesome (the Shoelace successor, Lit), Adobe Spectrum Web Components (Lit; "2nd-gen" core/swc split under way), Material Web (Lit, **in maintenance mode**), Microsoft FAST / Fluent UI Web Components v3 (FAST Element 2), IBM Carbon Web Components (Lit), Ionic (Stencil), Lion (Lit, light-DOM-heavy form system), PatternFly Elements (Lit), GitHub Catalyst (light DOM, now largely superseded inside GitHub by React), Salesforce LWC, Vaadin (Lit).

---

## 1. Authoring base

| | Lit 3 | FAST Element 2 | Stencil 4 | Vanilla |
|---|---|---|---|---|
| Runtime | ~5–6 kB min+gz, shared once | ~10 kB | compiler, small runtime per build | 0 |
| Reactivity | reactive properties + async batched update | observables/decorators | JSX + VDOM, `@State/@Prop` | hand-written |
| SSR | `@lit-labs/ssr` → Declarative Shadow DOM + hydration (still "labs") | DSD/hydration work in the proposed fast-element 4.0 | hydrate app (Ionic) | DIY |
| Ecosystem | `@lit/context`, `@lit/task`, reactive controllers, `@lit/localize`, `@lit-labs/virtualizer`, `@lit/react`; used by Web Awesome, Spectrum, Material, Carbon, PatternFly, Vaadin, Lion | Microsoft-centric | Ionic-centric, proprietary compiler output | none |
| Output | plain ES classes, no compiler required | plain ES classes | compiler-generated; framework output targets built in | plain |

- **Lit** is the de-facto standard. Most of the libraries surveyed build on it. It is stable at 3.3.x, and no Lit 4 had been released as of this writing ([npm](https://www.npmjs.com/package/lit)). **Reactive controllers** are the key feature for porting React Aria. Each React Aria hook (`useListState`, `useSelectableCollection`, `useTypeahead`, `usePress`, `useFocusRing`, `useOverlayPosition`) maps naturally to a controller that several components can compose. `@lit/context` replaces React context for compound components (`<tec-tabs>` → `<tec-tab>`, form field → control). Spectrum's 2nd-gen split into abstract **core** classes and controllers plus **swc** rendering/styles is the model to copy ([SWC contributor docs](https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/README.md)).
- **FAST** works well but its community is small, and v3 of Fluent Web Components spent a long time in beta ([discussion](https://github.com/microsoft/fluentui/discussions/34080)). A fast-element 4.0 rewrite has been proposed.
- **Stencil** is actively maintained (4.x in Aug 2026) ([releases](https://github.com/ionic-team/stencil/releases)). Its strengths are built-in framework output targets and lazy loading, but it locks the source into a compiler and a JSX/VDOM model. With React 19 and generated wrappers from the Custom Elements Manifest (section 6), those output targets no longer justify the lock-in.
- **Vanilla** leaves every problem Lit already solves (batching, template diffing, attribute/property reflection, SSR) for Tecton to solve.

**Recommendation:** Lit 3 with TypeScript, reactive controllers for all behaviour, and `@lit/context` for compound components. Follow Spectrum 2nd-gen's split: a headless `core` of controllers and base classes, and styled `components`.

---

## 2. Styling — the key question

### Does Tailwind work inside shadow DOM?

Technically yes, but in practice it is a poor fit for a distributable library:

1. **`@property` is ignored in shadow roots** in all three engines. Tailwind v4 registers many internal variables with `@property` (shadows, rings, transforms, gradients, `--tw-*` defaults), so utilities such as `shadow-*`, `ring-*` and `translate-*` break unless the `@property` rules are hoisted into the document ([tailwind#15005](https://github.com/tailwindlabs/tailwindcss/issues/15005), [discussion #16772](https://github.com/tailwindlabs/tailwindcss/discussions/16772), [CSSWG #10541](https://github.com/w3c/csswg-drafts/issues/10541)). A library that needs a global stylesheet just to render its shadow DOM loses much of the encapsulation that justified shadow DOM.
2. **Theme variables are declared on `:root`.** Inside a shadow root they only work through inheritance, and `:root` does not match there ([discussion #15556](https://github.com/tailwindlabs/tailwindcss/discussions/15556)).
3. **Class-based variants don't cross the boundary.** `dark:` (`.dark *`), `group-*`, `peer-*` and ancestor-based `rtl:` selectors cannot see ancestors outside the shadow root.
4. **Delivery.** Adopting one full utility sheet into every root (shared `CSSStyleSheet` via `adoptedStyleSheets`) is memory-cheap but ships every utility to every component. Per-component compiled sheets duplicate the preflight and `@property` problem. `@apply` inside component CSS is an extra build step that produces what hand-written CSS would.
5. **Customization.** A consumer cannot override utility classes inside a shadow root, so the class-list-as-API model of shadcn (`className` merging with `tailwind-merge`) does not exist in shadow DOM anyway.

### Options compared

| Option | Encapsulation | Consumer override | Theming | Verdict |
|---|---|---|---|---|
| (a) Tailwind in shadow roots | yes | none (classes are internal) | via inherited vars | fragile (`@property`), heavy |
| **(b) Scoped Lit `css` + token custom properties** | yes | `::part`, custom props, `:state()`, host attributes | inherited custom properties | **industry standard** (Web Awesome, Spectrum, Carbon, Material, Fluent) |
| (c) Light-DOM components + global stylesheet | no | full (incl. Tailwind) | global | works for simple leaf widgets; slot composition lost, styles collide with the app ([Frontend Masters](https://frontendmasters.com/blog/light-dom-only/)) |
| (d) CSS-in-JS | yes (runtime) | poor | runtime | runtime cost, no benefit over (b) |

### Theming

- Generate a **`tokens.css`** from the existing `tokens/tecton.map.json` / `tecton-tokens.css` pipeline, with namespaced variables (`--tec-color-primary`, `--tec-radius-md`, `--tec-color-blue-120`), declared on `:root, :host`. Custom properties **inherit through the shadow boundary**, which makes them the theming channel.
- **Light/dark:** set `color-scheme: light dark` on `:root` and write colour tokens as `light-dark(<light>, <dark>)` (Baseline 2024). `.tec-dark` / `.tec-light` classes (and the existing `.dark`) just set `color-scheme` on any subtree. This is how Web Awesome scopes schemes (`class="wa-dark"` on any section) ([Web Awesome themes](https://webawesome.com/docs/themes/)). Components need no `dark:` logic.
- Keep component CSS purely semantic (`var(--tec-color-primary)`). Only `tokens.css` knows palette steps.

### Customization hooks (public styling API, documented in the manifest)

- **Host attributes for variants**: `<tec-button variant="outline" size="sm">`, styled via `:host([variant="outline"])`. They map one-to-one onto the cva variants in `style-tecton.css` / `tecton.patch`.
- **`::part()`** on meaningful internals (`base`, `label`, `icon`, `popup`, `listbox`), with **`exportparts`** when components nest (Web Awesome and Spectrum do this).
- **Component custom properties** as documented knobs (`--tec-dialog-width`, `--tec-select-max-height`).
- **Custom states** through `ElementInternals.states` and `:state(open)`, `:state(checked)`, `:state(user-invalid)`. `:state()` is Baseline 2024 ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:state)).
- **`::slotted()`** only for light spacing and alignment of slotted content. It matches top-level slotted nodes only.
- **`@layer`**: styles inside a shadow root form their own cascade context. Outer-context rules targeting the host (`tec-button { … }`) or `::part()` beat `:host` rules, so consumers win without `!important`. Ship the global files (`tokens.css`, `cloak.css`, optional native-element styles) inside `@layer tecton.tokens, tecton.base` so consumer and Tailwind layers order predictably.
- **Sharing:** Lit `css` tagged templates already share one constructable `CSSStyleSheet` per module across all instances via `adoptedStyleSheets`. Put common styles (focus ring, reduced motion, forced colors, visually-hidden) in shared modules.

### Consumers and Tailwind

Consumers keep full Tailwind in their own light DOM: layout, spacing and slotted content (`<tec-card><div class="grid gap-4">…`). Ship a **Tailwind v4 preset** (`@tecton/wc/tailwind.css`) with `@theme inline { --color-primary: var(--tec-color-primary); … }` and a `@custom-variant` for component states (for example `tec-open: &:state(open)`), so app utilities and components share tokens. Tailwind classes on the host element (`<tec-button class="w-full">`) also work, because host-level outer rules win.

**Migration aid:** the Tailwind class lists in `scripts/registry-mirror/overlay/style-tecton.css` are the single source of the Tecton look. A one-time script can compile each component's class list with Tailwind (`@reference` + `@apply`) into plain CSS as a first draft. That CSS is then hand-tidied into token-based Lit `css`. Tailwind is not a runtime or build dependency of the library.

**Recommendation:** Option (b): shadow DOM with per-component Lit `css`, `--tec-*` design tokens as inherited custom properties, `light-dark()` + `color-scheme` for schemes, and a public styling API of variant attributes, `::part`, custom properties and `:state()`. No Tailwind inside shadow roots. Ship a Tailwind preset for consumers.

---

## 3. Accessibility across shadow DOM

### The ID-reference problem

IDREF attributes (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant`, `for`) cannot cross shadow roots. This is the single biggest a11y constraint ([Nolan Lawson](https://nolanlawson.com/2022/11/28/shadow-dom-and-accessibility-the-trouble-with-aria/), [Igalia](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/)).

- **ARIA element reflection** (`el.ariaLabelledByElements`, `ariaActiveDescendantElement`, `ariaControlsElements`, also on `ElementInternals`) is **Baseline 2025** (Firefox 136 was last) ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaLabelledByElements), [web-features #4147](https://github.com/web-platform-dx/web-features/issues/4147)). The limitation: an element may reference elements in its **own or an ancestor (outer) scope**, never into a deeper shadow root. In practice, an `<input>` inside `<tec-combobox>`'s shadow root **can** point `ariaActiveDescendantElement` at a slotted light-DOM `<tec-option>`. A light-DOM `<label>` still cannot target the shadow `<input>`.
- **Reference Target** (`shadowrootreferencetarget` / `ShadowRoot.referenceTarget`) forwards IDREFs aimed at the host (`<label for>`, `aria-labelledby`, `popovertarget`, `commandfor`) to an inner element. It is listed in the **Chrome 152** release notes ([Chrome 152](https://developer.chrome.com/release-notes/152)). Firefox has a prototype behind `dom.shadowdom.referenceTarget.enabled`, and Igalia wrote a WebKit implementation, but WebKit has **no signal** ([Interop #1011](https://github.com/web-platform-tests/interop/issues/1011), [Eric Meyer](https://meyerweb.com/eric/thoughts/2025/12/19/targeting-by-reference-in-the-shadow-dom/), [WHATWG DOM #1353](https://github.com/whatwg/dom/pull/1353)). **Not cross-browser in 2026.** Use it as a progressive enhancement (set `referenceTarget` when supported) and don't depend on it.

### Patterns that work today

1. **Keep each composite widget's ARIA relationships inside one scope.** For a combobox, the input, listbox and popup live in one shadow root, or the input sits in the shadow root and the options in the host's light DOM, linked by element reflection. The same applies to tabs (tablist + tabs), menu and tree.
2. **Slotted light-DOM items carry their own roles** (`<tec-option>` sets `role="option"`, `aria-selected` and `aria-disabled` on its host via `ElementInternals` or host attributes). Web Awesome, Spectrum and Lion all do this.
3. **Focus model:** use **`aria-activedescendant`** (via `ariaActiveDescendantElement`) when DOM focus must stay in a text input (combobox, command palette, autocomplete). Use **roving tabindex** on the item hosts for menus, tabs, tree view, radio group, toolbar and listbox without text entry. Roving tabindex works with slotted children because focus moves to real elements.
4. **Labels:** each form control renders its own `<label>` and description in its shadow root from a `label` attribute or slot (the Web Awesome / Shoelace pattern), plus `ElementInternals.ariaLabel` / `role` for simple hosts. `delegatesFocus: true` makes clicks and `.focus()` on the host reach the inner control. Use it for inputs and buttons.
5. **Form-associated custom elements** (`static formAssociated = true`, `attachInternals()`, `setFormValue`, `setValidity`, `formResetCallback`, `formDisabledCallback`, `formStateRestoreCallback`, `internals.labels`) are supported in all engines (Safari 16.4+). This gives native `<form>` submission, `FormData`, reset and `:invalid`/`:user-invalid`-style states (exposed via `:state(user-invalid)`). Validate restore-callback behaviour per engine, because autofill and session-restore support differs.
6. **Top layer instead of z-index:** use `<dialog>.showModal()` for dialogs, alert dialogs and sheets. It gives inert background, focus containment, Esc and `::backdrop` natively. Use the **Popover API** (`popover="auto"`/`"manual"`) for menus, listboxes, popovers, tooltips and toasts, with no portals. Invoker commands (`command`/`commandfor`) are Baseline as of Safari 26.2 ([InfoQ](https://www.infoq.com/news/2026/01/html-invoker-commands/)), but they reference by ID and so only work inside a shadow root until Reference Target lands. Treat `popover="hint"` and `dialog closedby` as enhancements, because Safari support is not yet stable ([oidaisdes](https://www.oidaisdes.org/blog/dialog-closedby-attribute/)).
7. **`inert`** (Baseline) for non-modal "trap" cases such as drawers built without `<dialog>`. Hand-rolled focus traps are only needed where `<dialog>` can't be used.
8. **`:focus-visible`** in shared styles, `:host(:focus-within)` for composite rings. Port React Aria's `usePress` / `useFocusRing` semantics into controllers (pointer vs keyboard modality).
9. **Announcements:** a single global live region (toaster/announcer) in light DOM. Live regions inside shadow roots are announced unreliably.

### Testing

- **axe-core** runs in the browser test runner. It traverses open shadow roots, but it cannot judge flattened-tree semantics perfectly, so pair it with accessibility-tree snapshots (Playwright `ariaSnapshot()`).
- **Manual screen-reader matrix per release:** NVDA+Firefox/Chrome, JAWS+Chrome, VoiceOver+Safari (macOS and iOS), TalkBack+Chrome. Consider Guidepup for scripted VoiceOver/NVDA smoke tests. Use the WAI-ARIA APG patterns as acceptance criteria. React Aria's behaviour is the reference implementation, so reuse its test cases.

**Recommendation:** Keep ARIA relationships within one scope. Use element reflection (Baseline 2025) for shadow→light references, use Reference Target only as an enhancement, and make every form control form-associated. Use `<dialog>`, Popover and `inert` for the top layer. Use `aria-activedescendant` only where focus must stay in an input and roving tabindex elsewhere. Gate CI on axe, back it with a manual screen-reader matrix.

---

## 4. Composition & API design

- **Compound components** use nested custom elements with light-DOM children: `<tec-select><tec-option value="a">A</tec-option></tec-select>`, `<tec-tabs><tec-tab panel="x">…<tec-tab-panel name="x">`, `<tec-menu><tec-menu-item>`. Parents discover children through `slotchange` + `assignedElements()` and pass shared state down with `@lit/context`. Data-heavy widgets (data table, virtualized combobox, tree with thousands of nodes, charts) take **properties** (`.items`, `.columns`) plus render callbacks or `<template>` slots, because DOM children don't scale there.
- **Slots vs attributes vs properties:** content (labels with markup, icons, prefix/suffix, footer) → **named slots**, with a string-attribute shortcut for plain text (`label="Name"` or `slot="label"`, the Web Awesome convention). Primitives (`variant`, `size`, `disabled`, `open`, `value`, `name`) → **attributes reflected to properties**. Complex data → **properties only**, never JSON attributes.
- **Reflection rules:** reflect attributes that are used for styling or state (`variant`, `size`, `disabled`, `open`, `checked`). Don't reflect `value` of text inputs (it mirrors native `defaultValue` semantics). Booleans follow HTML (presence = true; never `="false"`). Use kebab-case attributes and camelCase properties.
- **Events:** form controls fire **native-named `input` and `change`** (`bubbles: true, composed: true`) so framework bindings and `v-model` / `ngModel` bridges work. Other events are namespaced: `tec-show` / `tec-hide` (**cancelable**, `preventDefault()` stops the action), `tec-after-show` / `tec-after-hide`, `tec-select`, `tec-sort-change`. Always `composed: true` for public events and keep the payload in `detail`. Never fire events for programmatic property changes (the native convention).
- **Controlled vs uncontrolled:** components are **uncontrolled by default** (they own state, like native elements). "Controlled" use means listening to the cancelable `tec-*` event or `change` and setting the property. Document the React pattern (`value` + `onchange`) explicitly.
- **Avoid shadow-DOM-hostile patterns:** portals, ID lookups via `document.getElementById`, `event.target` checks without `composedPath()`, `closest()` across roots, and global `document` listeners that assume light DOM. Use `getRootNode()`-aware helpers throughout.
- **Tag prefix:** `tec-` (short, unlikely to collide). Export every class **without registering it** from `@tecton/wc/components/button/button.js`, plus a side-effect `…/button.define.js` (or a `define()` helper) that registers idempotently.
- **Scoped custom element registries** ship in Chrome 146 and Safari 26 and are an Interop 2026 focus area; Firefox has them in Nightly only ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/scoped-custom-element-registries/), [Chrome blog](https://developer.chrome.com/blog/scoped-registries), [Interop 2026](https://web.dev/blog/interop-2026)). Unregistered class exports keep that option open (micro-frontends with two Tecton versions). Don't rely on it for v1.
- **Loading:** primary path is explicit per-component imports with `"sideEffects": ["**/*.define.js", "*.css"]` for tree shaking. Offer a CDN **autoloader** (MutationObserver that imports `tec-*` on first sight) as Web Awesome does ([Web Awesome install](https://webawesome.com/docs/)).

**Recommendation:** Light-DOM child elements plus `@lit/context` for compound widgets, and properties for data-heavy widgets. Use native `input`/`change` plus cancelable `tec-*` events, uncontrolled by default, with the `tec-` prefix. Export unregistered classes alongside `*.define.js` side-effect entry points.

---

## 5. Floating UI

- **Popover API** (top layer, light dismiss) is Baseline and should host every floating surface.
- **CSS anchor positioning** became cross-engine in 2026: Chrome 125, Safari 26, **Firefox 147 (Jan 2026)** ([MDN Fx147](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/147), [web-features #3558](https://github.com/web-platform-dx/web-features/issues/3558)). It continues as an Interop 2026 focus area, so bugs are still being fixed. Caveats for a component library:
  - `anchor-name` references are **tree-scoped**, which gets awkward when the anchor is slotted or lives in another root.
  - There are no virtual anchors (context menu at pointer, text-selection toolbars).
  - `position-try` fallback behaviour is still being made consistent.
  - Available-size clamping (combobox list height), arrows and `hide`-when-clipped are weaker than Floating UI's middleware.
- **`@floating-ui/dom`** (~3 kB) handles all of those cases, virtual elements included. Web Awesome's popup combines it with `composed-offset-position` for shadow-DOM-correct offset parents.

**Recommendation:** Popover API + `<dialog>` for layering. Position with a single `PositionController` backed by `@floating-ui/dom` (`strategy: 'fixed'`, `flip`, `shift`, `size`, `arrow`, `hide`). Add a CSS-anchor-positioning code path behind the same controller later (tooltip, simple popover), once Interop 2026 results show the fallback behaviour is consistent.

---

## 6. Tooling

- **Custom Elements Manifest** (`@custom-elements-manifest/analyzer` with Lit support, or `@wc-toolkit/cem-generator`) is the single source for API docs and framework integration. Annotate with JSDoc: `@slot`, `@csspart`, `@cssprop`, `@cssstate`, `@event`, `@summary`.
- **Framework integration from the CEM:**
  - **React 19** supports custom elements natively: properties are set as properties and `on<event>` handles custom events, so no wrappers are needed ([React 19 notes](https://aleks-elkin.github.io/posts/2024-12-06-react-19/)). Generate JSX types with **`@wc-toolkit/jsx-types`** ([wc-toolkit](https://wc-toolkit.com/integrations/jsx/)). Optionally publish `@tecton/wc-react` generated by `@wc-toolkit/react-wrappers` for React 18 and idiomatic `onTecShow` names ([react-wrappers](https://wc-toolkit.com/integrations/react/); [Lit discussion](https://github.com/lit/lit/discussions/5068)).
  - **Vue:** generate `GlobalComponents` types and document `isCustomElement`.
  - **Angular:** `CUSTOM_ELEMENTS_SCHEMA` plus a small generated `ControlValueAccessor` directive for form controls.
- **Testing:** **Vitest 4 browser mode + Playwright provider** (stable since Vitest 4), running Chromium, Firefox and WebKit, with axe-core and screenshot diffs ([Vitest browser mode](https://vitest.dev/guide/browser/), [Lit testing](https://lit.dev/docs/tools/testing/)). Web Test Runner (Modern Web) still works but has less momentum. Vitest also matches the existing repo toolchain. Add Playwright e2e + `@axe-core/playwright` on the docs site.
- **Build:** `tsc` emitting one ESM file per module with `.d.ts` (no bundling for the npm package, so consumers tree-shake). Add an optional esbuild/Vite bundle for the CDN build. Keep `lit` a peer-ish dependency deduped by consumers. Use TS standard decorators (`accessor`) or `experimentalDecorators` consistently.
- **Docs site:** Web Awesome builds its docs with **Eleventy** ([podcast](https://www.podcastawesome.com/2092855/episodes/17268471-how-we-built-web-awesome-with-11ty-and-why-it-s-so-fast)), as did Shoelace and lit.dev. Storybook is common as a workbench (Spectrum) but is weak as a public docs site. **Astro (Starlight)** is the strongest current option: zero-JS static pages, MDX, custom elements work in `.astro` and MDX unchanged, and live demos need no hydration framework. Starlight's `.not-content` class opts demos out of prose styles, the same idea as the current `data-not-typeset` rule. Generate API tables (attributes, properties, events, slots, parts, CSS properties, states) from the CEM at build time, and generate the `tecton search`/`tecton docs` agent index from the same content.

**Recommendation:** Make the CEM the API source of truth, with generated JSX/Vue types and optional React-18 wrappers. Use Vitest browser mode (Playwright, 3 engines) with axe, and `tsc` unbundled ESM. Build the docs site with Astro + Starlight and CEM-generated API tables.

---

## 7. SSR

- Declarative Shadow DOM is Baseline (2024). `@lit-labs/ssr` renders Lit components to DSD and hydrates them, but it is still labelled **labs**, needs a Node renderer, and has per-framework integrations of uneven quality ([Lit SSR](https://lit.dev/docs/ssr/client-usage/), [labs feedback](https://github.com/lit/lit/discussions/3353)). None of the major design-system libraries relies on SSR for correctness.
- **FOUC mitigation:** ship `cloak.css` with `:not(:defined) { visibility: hidden }` scoped to `tec-*` (per tag, e.g. `tec-button:not(:defined)`), plus an opt-in `tec-cloak` class on `<html>` removed after `customElements.whenDefined()` for the components on the page, with a fail-safe timeout. Web Awesome ships an equivalent. Reserve layout size for above-the-fold controls with host `display`/`min-block-size` in the global file.

**Recommendation:** Don't make SSR a v1 deliverable, but keep components **SSR-safe**: no DOM access in constructors or `render()`, `ElementInternals` set up in the constructor, state derived from attributes. SSR then becomes a later add-on via `@lit-labs/ssr` when it leaves labs. Ship `cloak.css` for FOUC.

---

## 8. RTL, motion, forced colors, i18n

- **RTL:** logical properties only (`margin-inline-start`, `inset-inline-end`, `border-start-start-radius`). The Tecton overlay already uses logical corners on `button-group`, so this carries over. Use `:host(:dir(rtl))` (Baseline 2023) for icon mirroring and directional keyboard logic. Arrow-key handling reads `getComputedStyle(this).direction`, never `document.dir`.
- **Reduced motion:** all transitions go through `--tec-duration-*` tokens set to `0s` under `@media (prefers-reduced-motion: reduce)` in `tokens.css`, and JS animations (carousel autoplay, toasts) check `matchMedia`.
- **Forced colors:** a shared `forcedColors` style module with `@media (forced-colors: active)` to keep transparent borders visible and use system colours (`CanvasText`, `Highlight`, `HighlightText`, `ButtonText`, `GrayText` for disabled). Use `forced-color-adjust: none` only for colour swatches and charts. Test with Windows High Contrast in CI via Playwright's `forcedColors: 'active'`.
- **i18n:** `@internationalized/date` and `@internationalized/number` are framework-agnostic, so calendar, date picker and number field logic ports directly from React Aria's model. Use `Intl.*` for formatting. A `LocalizeController` resolves `lang`/`dir` from the nearest `[lang]` ancestor across shadow roots (walk `getRootNode().host`) and observes `<html lang dir>`, following Shoelace's `@shoelace-style/localize` approach. Translatable strings (such as "Close", "Next month") come from a small per-locale table, overridable by consumers.
- **Behaviour engines worth a spike:** Zag.js (framework-agnostic state machines with a vanilla adapter) for date picker, carousel, splitter/resizable, pin input and toast. TanStack Table core (`@tanstack/lit-table`) and `@tanstack/virtual-core` for data table and virtualization. Take them only if they respect `getRootNode()`. Otherwise port React Aria logic into controllers.

**Recommendation:** Use logical properties and `:dir()`, motion tokens zeroed under reduced motion, and a shared forced-colors module tested in CI. Use `@internationalized/*` + `Intl` for locale logic behind a `LocalizeController`.

---

## Decisions for Tecton Web Components

1. **Base:** Lit 3 + TypeScript. Behaviour lives in reactive controllers (ported from React Aria semantics) in a headless `core` package. Styled elements live in `components`. `@lit/context` for compound components.
2. **Styling:** Shadow DOM with per-component Lit `css`. **No Tailwind inside components.** The Tecton look is translated once from `style-tecton.css` / `tecton.patch` into token-based CSS.
3. **Tokens:** `--tec-*` custom properties generated from `tecton.map.json` into `tokens.css` (`:root, :host`). Light/dark via `color-scheme` + `light-dark()`, with `.tec-dark`/`.dark` scoping.
4. **Styling API:** reflected variant attributes (the cva axes), `::part` + `exportparts`, documented component custom properties, `:state()` custom states. Global files in `@layer tecton.*`.
5. **Consumers & Tailwind:** a Tailwind v4 preset that maps utilities to Tecton tokens and `:state()` variants, used for app layout and slotted content.
6. **A11y:** ARIA relationships kept within one scope. Element reflection for shadow→light references (combobox `ariaActiveDescendantElement` → slotted options). Reference Target as progressive enhancement only (Chromium-only in 2026).
7. **Forms:** every control is form-associated (`ElementInternals`: value, validity, reset, restore, labels, `:state(user-invalid)`), with `delegatesFocus` where there is an inner focusable.
8. **Overlays:** `<dialog>` for modals and sheets, Popover API for everything floating, `inert` for the rest. No portals, no z-index scale.
9. **Positioning:** `@floating-ui/dom` behind one `PositionController`, with CSS anchor positioning added behind it later.
10. **API conventions:** `tec-` prefix. Light-DOM child elements for items. Properties for large data. Native `input`/`change` for form controls. Cancelable `tec-show`/`tec-hide` and `tec-after-*` events, all `composed`. Uncontrolled by default.
11. **Packaging:** unbundled ESM from `tsc`. Unregistered class exports plus `*.define.js` side-effect entries (ready for scoped registries). CDN bundle + autoloader.
12. **Tooling:** Custom Elements Manifest as API source, with generated JSX/Vue types. React 19 used natively, optional generated React-18 wrappers, and an Angular CVA directive.
13. **Testing:** Vitest browser mode + Playwright on Chromium, Firefox and WebKit. axe-core and accessibility-tree snapshots in CI. Forced-colors and RTL runs. Manual screen-reader matrix per release.
14. **Docs:** Astro + Starlight, with CEM-generated API tables and live demos without a hydration framework.
15. **SSR:** not in v1. Components stay SSR-safe, and `cloak.css` handles FOUC.
16. **i18n/RTL/motion:** `@internationalized/date`/`number` + `Intl`, a `LocalizeController`, logical properties, `:dir()`, motion tokens and a shared forced-colors module.
17. **Spikes before committing:** (a) combobox with slotted options on VoiceOver/NVDA/JAWS; (b) date picker with `@internationalized/date` (React Aria port vs Zag.js); (c) data table with `@tanstack/lit-table` + virtualization.
