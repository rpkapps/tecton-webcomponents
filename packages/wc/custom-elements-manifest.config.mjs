/**
 * Custom Elements Manifest analyzer config — `pnpm analyze` writes ./custom-elements.json, the API
 * source of truth for the docs site (API tables) and framework typings.
 * Element docs come from JSDoc: @summary @tag @slot @csspart @cssprop @cssstate @fires, and the
 * JSDoc of each public property.
 */
export default {
  globs: ["src/components/**/*.ts", "src/internal/tecton-element.ts", "src/internal/form-control.ts", "src/internal/listbox-core.ts"],
  exclude: ["src/**/*.test.ts", "src/**/*.styles.ts"],
  outdir: ".",
  litelement: true,
  plugins: [
    {
      name: "tecton-public-api",
      // Keep only the public API: drop #private, _underscored, private/protected members and the
      // static plumbing every element has (styles, shadowRootOptions, formAssociated).
      packageLinkPhase({ customElementsManifest }) {
        const plumbing = new Set(["styles", "shadowRootOptions", "formAssociated"])
        for (const mod of customElementsManifest.modules ?? []) {
          for (const decl of mod.declarations ?? []) {
            if (!decl.members) continue
            decl.members = decl.members.filter(
              (m) =>
                !m.name.startsWith("#") &&
                !m.name.startsWith("_") &&
                m.privacy !== "private" &&
                m.privacy !== "protected" &&
                !(m.static && plumbing.has(m.name))
            )
          }
        }
      },
    },
  ],
}
