/**
 * Custom Elements Manifest analyzer config — `pnpm analyze` writes ./custom-elements.json, the API
 * source of truth for the docs site (API tables) and framework typings.
 * Element docs come from JSDoc: @summary @tag @slot @csspart @cssprop @cssstate @fires, and the
 * JSDoc of each public property.
 */
/** Class name → member/attribute names hidden by its `@hideInherited` JSDoc tag. */
const hiddenByClass = new Map()
/** Class name → the name of the class it extends (for classes the manifest does not declare). */
const superclassOf = new Map()

export default {
  globs: ["src/components/**/*.ts", "src/internal/tecton-element.ts", "src/internal/form-control.ts", "src/internal/listbox-core.ts"],
  exclude: ["src/**/*.test.ts", "src/**/*.styles.ts"],
  outdir: ".",
  litelement: true,
  plugins: [
    {
      name: "tecton-hide-inherited",
      // `@hideInherited href, target, rel, download` on a class drops those inherited members and
      // attributes from it and its subclasses (e.g. TecButton subclasses that always render a
      // <button> and ignore the link properties).
      analyzePhase({ ts, node }) {
        if (!ts.isClassDeclaration(node) || !node.name) return
        const heritage = node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
        if (heritage && ts.isIdentifier(heritage)) superclassOf.set(node.name.text, heritage.text)
        for (const tag of ts.getJSDocTags(node)) {
          if (tag.tagName.text !== "hideInherited") continue
          const text = typeof tag.comment === "string" ? tag.comment : (tag.comment ?? []).map((c) => c.text).join("")
          const names = text.split(/\s+-\s+/)[0].split(/[\s,]+/).filter(Boolean)
          const set = hiddenByClass.get(node.name.text) ?? new Set()
          for (const n of names) set.add(n)
          hiddenByClass.set(node.name.text, set)
        }
      },
      packageLinkPhase({ customElementsManifest }) {
        const classes = new Map()
        for (const mod of customElementsManifest.modules ?? [])
          for (const decl of mod.declarations ?? []) if (decl.kind === "class") classes.set(decl.name, decl)
        const hiddenFor = (name, seen = new Set()) => {
          if (!name || seen.has(name)) return new Set()
          seen.add(name)
          const own = hiddenByClass.get(name) ?? new Set()
          // Non-exported intermediate classes are not declarations: use the heritage recorded above.
          const parent = hiddenFor(superclassOf.get(name) ?? classes.get(name)?.superclass?.name, seen)
          return new Set([...own, ...parent])
        }
        for (const decl of classes.values()) {
          const hidden = hiddenFor(decl.name)
          if (!hidden.size) continue
          const keep = (m) => !(m.inheritedFrom && (hidden.has(m.name) || hidden.has(m.fieldName)))
          if (decl.members) decl.members = decl.members.filter(keep)
          if (decl.attributes) decl.attributes = decl.attributes.filter(keep)
        }
      },
    },
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
