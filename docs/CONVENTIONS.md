# Tecton Web Components — conventions

This is the contract every component in `@tecton/wc` follows. It exists so ~80 components written
in parallel read like one library. `docs/RESEARCH.md` explains *why*; this file says *what*.

The component set, anatomy and look follow the Tecton design system (the shadcn/ui component
vocabulary with the Tecton theme), and every interactive component meets the accessibility bar set
by React Aria: WAI-ARIA APG roles and states, the full keyboard model, focus management, and
internationalisation (RTL, locale-aware formatting).

---

## 1. Repository layout

```
packages/wc                    @tecton/wc — the library
  src/components/<name>/       one folder per component family
    <name>.ts                  element class(es) of the family — no side effects
    define.ts                  registers every tag of the family (and the families it renders)
    <name>.styles.ts           Lit `css` for the family (may be split per part)
    <part>.ts                  extra elements of a compound family (e.g. dialog-header.ts)
    <name>.test.ts             Vitest browser tests (behaviour, keyboard, ARIA, axe)
  src/internal/                shared, non-public building blocks (controllers, mixins, helpers)
  src/styles/                  GENERATED theme (scripts/build-theme.mjs) — never hand-edit
  src/icons/                   Tecton domain icons (tec-icon registry)
  src/index.ts                 GENERATED: imports every component entry (scripts/build-index.mjs)
  tokens/                      Tecton token export (raw tokens, colour ramps, semantic map)
apps/docs                      the documentation site (Astro)
  src/content/docs/…           pages (.mdx)
  src/examples/<example>.html  live examples: the file is both the rendered preview and the shown code
docs/                          RESEARCH.md, CONVENTIONS.md
```

Shared files (`src/index.ts`, docs navigation, `package.json` exports) are generated or discovered
from the folder structure, so adding a component never requires editing a shared file.

## 2. Naming

| Thing | Rule | Example |
| --- | --- | --- |
| Tag | `tec-` + kebab name of the part | `DialogHeader` → `<tec-dialog-header>` |
| Class | `Tec` + PascalCase | `TecDialogHeader` |
| Module | `@tecton/wc/<family>` registers the whole family; `@tecton/wc/<family>/<family>.js` exports the classes without registering them (scoped registries) | `import "@tecton/wc/dialog"` |
| Custom event | `tec-` + kebab verb/noun | `tec-open-change`, `tec-select`, `tec-remove` |
| CSS part | kebab noun, no prefix | `part="base"`, `part="label"`, `part="indicator"` |
| Custom property (public, per component) | `--tec-<component>-<thing>` | `--tec-sidebar-width` |
| Theme variable | `--tec-<name>` (generated, see §5) | `--tec-primary`, `--tec-radius-md` |

React parts that exist only for wiring (`*Trigger` wrappers around a button, `*Portal`, `*Value`,
`*Overlay`) are folded into slots/attributes rather than becoming elements, **unless** the element
carries real semantics or styling. Everything that renders something visible gets an element.

Every tag is declared for TypeScript:

```ts
declare global {
  interface HTMLElementTagNameMap { "tec-dialog": TecDialog }
}
```

## 3. Authoring

- **Lit 3**, TypeScript, legacy decorators (`experimentalDecorators`, `useDefineForClassFields: false`):
  `@property({ reflect: true }) variant: ButtonVariant = "default"`. No `accessor` keyword.
- Extend `TectonElement` (`src/internal/tecton-element.ts`) — it adds `emit()`, and a lazily
  attached `internals` (ElementInternals). Register in the family's `define.ts` with
  `defineElement("tec-x", TecX)` (`src/internal/define.ts`), which no-ops if the tag is already
  defined. No `@customElement`, no registration in class modules.
- Shadow DOM always (`static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }`
  when the element wraps a single focusable control).
- Document every public API with JSDoc tags the Custom Elements Manifest analyzer reads:
  `@summary`, `@slot`, `@csspart`, `@cssprop`, `@cssstate`, `@fires`, `@property` descriptions,
  and `@tag tec-x`. The docs site's API tables are generated from these — **undocumented = missing**.
- No runtime dependencies beyond `lit`, `@lit/context`, `@floating-ui/dom`, `lucide` (icon nodes),
  `@internationalized/date` (calendar), `@tanstack/table-core` (data table). Anything else needs a
  strong reason (and is written down in the component's JSDoc).

## 4. API design (props, attributes, events)

Map React Aria / shadcn props to HTML-native vocabulary:

| React | Web component |
| --- | --- |
| `isDisabled` | `disabled` (boolean attribute, reflected) |
| `isSelected` / `defaultSelected` (checkbox, switch, toggle) | `checked` / `default-checked`? — no: **`checked` attribute = initial, `checked` property = current** (like native `<input>`), reflect after interaction is *not* done for `checked`/`value` |
| `isIndeterminate` | `indeterminate` |
| `isInvalid` | `invalid` (reflected); validity also comes from constraints |
| `isRequired`, `isReadOnly` | `required`, `readonly` |
| `value` / `defaultValue` | `value` property (current) + `value` attribute (initial / default) |
| `onChange` | native-named `change` event (and `input` for continuous changes) — `Event`, `bubbles`, `composed` |
| `onOpenChange` / `isOpen` / `defaultOpen` | `open` (boolean, reflected) + `tec-open-change` (`CustomEvent<{ open }>`, cancelable: `preventDefault()` keeps the current state) + `show()` / `hide()` / `toggle()` methods |
| `onAction` (menu items, buttons in lists) | `tec-select` on the item, bubbling (`detail: { value }`) |
| `onRemove` (tags) | `tec-remove` (cancelable) |
| `selectionMode="multiple"` | `multiple` boolean; `value` becomes `string[]` (property) / space-separated? — **no**: multi values are exposed as the `values: string[]` property and submitted as repeated form entries |
| `orientation`, `variant`, `size`, `appearance`, `side`, `align` | same names, string attributes, reflected |
| `className` | not needed — use `class`, `::part()`, custom properties |
| `children` render props | slots |

Rules:

- **Attributes are for configuration, properties for state and data.** Strings/numbers/booleans are
  attributes (kebab-case: `close-label`, `max-visible`). Arrays/objects/functions are properties
  only (`attribute: false`).
- Boolean attributes are false by default (`hide-close`, never `show-close="false"`).
- Reflect `variant`, `size`, `open`, `disabled`, `invalid`, `orientation` (they drive styling).
- Events fire only for **user** interaction, never for programmatic property changes (same as native).
- Value-holding components are **uncontrolled by default** (they update themselves). To control them
  the application listens to `change` and sets the property; to veto, `preventDefault()` on the
  cancelable `tec-*` events.
- Methods mirror native elements: `focus()`, `blur()`, `click()`, `show()`, `hide()`, `select()`,
  `checkValidity()`, `reportValidity()`, `setCustomValidity()`.
- Localisable strings (visually hidden labels like "Close", "Remove", "Previous page") are attributes
  with English defaults (`close-label`, `remove-label` …). Numbers and dates go through `Intl`.

### Composition

- Compound components are **nested custom elements in the light DOM** one element per part:

  ```html
  <tec-select name="fruit" placeholder="Pick a fruit">
    <tec-select-group label="Fruits">
      <tec-select-item value="apple">Apple</tec-select-item>
    </tec-select-group>
  </tec-select>
  ```

  The parent discovers its items with `slotchange` + `:scope` queries (or `@lit/context` when
  descendants can be deep), never by position-dependent magic.
- **Anchored overlays take their trigger through `slot="trigger"`** (popover, dropdown-menu, tooltip,
  hover-card, context-menu target, dialog/sheet/drawer/alert-dialog triggers). They also work without
  a trigger via `open` / `show()`. The overlay wires `aria-expanded`, `aria-haspopup`,
  `aria-controls` on the slotted trigger's focusable element (or the host when it is a `tec-button`,
  which forwards them to its inner `<button>`).
- Content that React libraries pass as props (`title`, `description`, `icon`) is a **slot** when
  it can hold markup and an **attribute** when it is plain text; offer both only when both are common.
- Icons are slotted SVG/`tec-icon`/lucide elements; `slot="start"` / `slot="end"` for leading/trailing
  adornments (maps to shadcn's `data-icon="inline-start|inline-end"`).

## 5. Styling

- **No Tailwind inside components.** Each shadow root gets hand-written, scoped CSS (`css` tagged
  templates). Tailwind remains available to *applications* for their own light DOM via the generated
  preset `@tecton/wc/tailwind.css` (the docs site uses it for example layout).
- **Theme = CSS custom properties.** `src/styles/theme.css` (generated from the Tecton token map)
  defines the semantic variables — `--tec-background`, `--tec-foreground`, `--tec-primary`,
  `--tec-primary-hover`, `--tec-muted-foreground`, `--tec-border`, `--tec-ring`, `--tec-destructive`,
  status colours (`--tec-success`, `--tec-warning-surface` …), state colours (`--tec-ghost-hover`,
  `--tec-outline-pressed-border` …), `--tec-radius-{sm,md,lg,xl,2xl,3xl,4xl}`, `--tec-font-sans`,
  `--tec-font-mono`, `--tec-text-{xs,sm,base,lg,xl,2xl}` (+ `--line-height`), `--tec-shadow-{xs…xl}`,
  `--tec-duration*`, `--tec-ease*`, `--tec-focus-ring`. They inherit through shadow roots, so light/dark
  (`data-theme="dark"` / `.dark` on any ancestor) and re-theming need no component code.
  The raw `--tecton-*` tokens and `--tecton-palette-<family>-<step>` ramps are also available.
  **Never hard-code a colour**; use a variable or `color-mix(in oklab, var(--tec-x) N%, transparent)`
  for the Tailwind `/N` opacity modifier.
- **Values follow the Tecton spec, written in Tailwind v4 units** where a spec lists utility classes: spacing `N` = `N * 0.25rem` (`h-8` = 2rem, `px-2.5` = 0.625rem), `text-sm` =
  `var(--tec-text-sm)` / `line-height: var(--tec-text-sm--line-height)`, `rounded-md` =
  `var(--tec-radius-md)`, `ring-2 ring-ring` = `box-shadow: var(--tec-focus-ring)`, `size-4` = 1rem ×
  1rem, `gap-1.5` = 0.375rem, `font-medium` = 500. `dark:` variants become
  **`light-dark(<light>, <dark>)`** (works because `color-scheme` is set by the theme and inherits);
  non-colour dark differences need a theme variable (ask the integrator).
  `data-[size=sm]:…` / `aria-invalid:…` / `hover:` / `focus-visible:` become `:host([size="sm"])`,
  `:host([invalid])`, `:hover`, `:focus-visible` selectors.
- **Variants and states are host attributes**: `:host([variant="outline"]) .base { … }`. Expose
  read-only states to consumers as custom states (`this.internals.states.add("checked")` →
  `tec-checkbox:state(checked)`) and document them with `@cssstate`.
- **Public styling hooks**: `::part()` on every meaningful internal element (documented with
  `@csspart`), a few documented `--tec-<component>-*` custom properties for sizes consumers commonly
  tune, and `exportparts` where a component renders another component internally.
- Every host sets its `display` (`:host { display: inline-flex }`) and honours `[hidden]`
  (`:host([hidden]) { display: none !important }`). Include `hostStyles` from `src/internal/styles.ts`
  (box-sizing, font inheritance, `[hidden]`).
- **Logical properties only** (`margin-inline-start`, `inset-inline-end`, `padding-block`), so RTL
  works with `dir="rtl"` on any ancestor; direction-dependent icons (chevrons) flip with `:dir(rtl)`
  or `:host(:dir(rtl))`.
- **Motion**: Tecton overlays use short enter/exit animations (`fade-in-0 zoom-in-95`,
  `slide-in-from-top-2`, 100–200 ms). Use the shared keyframes in `src/internal/animations.ts`, and
  wrap every animation/transition in `@media (prefers-reduced-motion: no-preference)` (or neutralise
  it under `reduce`).
- **Forced colours**: borders and focus indicators must stay visible under
  `@media (forced-colors: active)` (use `CanvasText`, `Highlight`, `outline` instead of box-shadow
  rings there). `src/internal/styles.ts` exports `focusRingStyles` that already do this.

## 6. Accessibility (non-negotiable)

- Implement the **WAI-ARIA APG pattern** React Aria implements for the component, including the full
  keyboard model (Arrow keys, Home/End, PageUp/PageDown, typeahead, Escape, Enter/Space, Tab
  behaviour), `aria-*` states, focus management and focus restoration. List the keyboard support in
  the component's docs page ("Keyboard interactions" table) and test it.
- **Semantics location**: native elements inside the shadow root when the component *is* a native
  control (`<button>`, `<input>`, `<dialog>`, `<a>`); **ElementInternals default semantics**
  (`this.internals.role = "option"`, `internals.ariaSelected = "true"`) when the host itself is the
  semantic node (items of collections: options, menu items, tabs, tree items, radios in a group,
  rows). Don't sprout `role` attributes on hosts.
- **Never use ID references across shadow boundaries.** From inside a shadow root to light-DOM
  content (slotted labels, options), use **ARIA element reflection**:
  `input.ariaLabelledByElements = [...]`, `ariaDescribedByElements`, `ariaControlsElements`,
  `ariaActiveDescendantElement` (references from a shadow root *outward* to its host's tree are
  allowed). Keep a widget whose parts reference each other *inside one tree scope*.
- **Composite widgets**: roving `tabindex` over light-DOM items (menu, tabs, radio group, toggle
  group, tree, listbox without text input) using `RovingFocusController`; `aria-activedescendant`
  (via `ariaActiveDescendantElement`) when focus must stay in a text input (combobox, command).
- **Form controls are form-associated custom elements** (`static formAssociated = true`, via
  `FormControlMixin`): name, value submission (`setFormValue`), constraint validation (`setValidity`
  mirroring the inner control), `form-reset`/`form-state-restore` callbacks, `disabled` via
  `formDisabledCallback` (fieldset), and `<label for>` association (`internals.labels` →
  `ariaLabelledByElements` on the inner control). A `label` attribute/slot is also accepted.
- **Overlays**: modal = native `<dialog>` + `showModal()` (top layer, inert page, Esc); non-modal
  anchored = element with `popover="manual"` (top layer, no z-index wars) positioned by
  `@floating-ui/dom` through the shared `PopupController`. Light dismiss (outside press, Esc) and
  focus restoration to the trigger are in the controller.
- Hidden labels use the shared `.sr-only` style. Decorative SVGs get `aria-hidden="true"`.
- **Tests**: every component has an axe check (`expectAccessible(el)` from
  `src/internal/test-utils.ts`), keyboard tests, and ARIA state assertions.

## 7. Tests

- Vitest browser mode (Playwright Chromium): `pnpm --filter @tecton/wc test` (single file:
  `pnpm --filter @tecton/wc exec vitest run src/components/button`).
- `fixture(html\`…\`)` renders into a fresh container and awaits `updateComplete`; use `userEvent`
  from `vitest/browser` (real keyboard/pointer via CDP) for interaction; `expectAccessible(el)` runs
  axe-core.

## 8. Documentation contract (apps/docs)

For every component family `<name>`:

- `apps/docs/src/content/docs/components/<name>.mdx` (general components) or
  `apps/docs/src/content/docs/tecton/<name>.mdx` (Tecton-specific components), with the sections:
  intro preview, Usage
  (import + minimal markup), one section per example, RTL, **Keyboard interactions**, **Accessibility**,
  **API Reference** (`<ApiReference tags={["tec-x", "tec-x-part"]} />`, generated from the manifest),
  **Usage guidelines** (when to use it, what not to use it for, do/don't).
- Examples: `apps/docs/src/examples/<name>-<example>.html` — an HTML fragment; the same file is the
  rendered preview and the displayed code. Layout uses Tailwind classes (the site loads the Tecton Tailwind preset). An example
  may include one `<script type="module">` for behaviour; scope queries to the example
  (`document.currentScript` is null in modules — give the example's root element a unique `id`
  prefixed with the example name).

## 9. Definition of done (per component family)

1. Every part, variant, size and state of the Tecton component exists, with examples.
2. Styles use only theme variables; checked visually in light and dark.
3. Keyboard + ARIA behaviour follows the APG pattern; form participation where applicable.
4. Tests pass (`pnpm --filter @tecton/wc test`), including axe.
5. `pnpm --filter @tecton/wc typecheck` passes; JSDoc complete (manifest shows all slots, parts,
   events, properties).
6. Docs page + all examples written; the page builds.
