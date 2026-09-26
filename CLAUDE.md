# Working in this repository

- For HTML, CSS and client-side JS work (components in `packages/wc`, the docs site in `apps/docs`),
  use the `modern-web-guidance` skill (`.claude/skills/modern-web-guidance/`) before implementing:
  search for the use case, retrieve the guide, and check the result against it.
- **Browser support:** Baseline Widely available features are used without fallbacks. Features
  that are only Newly available (or not Baseline) get the fallback the guide recommends, or are
  feature-detected and degrade gracefully (e.g. `blocking="render"` on the docs site).
