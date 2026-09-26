// Reads the Custom Elements Manifest of @tecton/wc (packages/wc/custom-elements.json),
// the single source of the API Reference tables. A missing or unreadable manifest is
// not an error: the tables say so instead.
import { existsSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

export interface CemType {
  text: string
}
export interface CemAttribute {
  name: string
  type?: CemType
  default?: string
  description?: string
  summary?: string
  fieldName?: string
  deprecated?: boolean | string
}
export interface CemParameter {
  name: string
  type?: CemType
  optional?: boolean
  description?: string
}
export interface CemMember {
  kind: "field" | "method"
  name: string
  type?: CemType
  default?: string
  description?: string
  summary?: string
  privacy?: "public" | "private" | "protected"
  static?: boolean
  readonly?: boolean
  attribute?: string
  reflects?: boolean
  parameters?: CemParameter[]
  return?: { type?: CemType; description?: string }
  deprecated?: boolean | string
}
export interface CemEvent {
  name: string
  type?: CemType
  description?: string
  summary?: string
  deprecated?: boolean | string
}
export interface CemNamed {
  name: string
  description?: string
  summary?: string
  default?: string
  syntax?: string
  deprecated?: boolean | string
}
export interface CemDeclaration {
  kind: string
  name: string
  tagName?: string
  customElement?: boolean
  summary?: string
  description?: string
  attributes?: CemAttribute[]
  members?: CemMember[]
  events?: CemEvent[]
  slots?: CemNamed[]
  cssParts?: CemNamed[]
  cssProperties?: CemNamed[]
  cssStates?: CemNamed[]
  deprecated?: boolean | string
}
interface CemModule {
  path: string
  declarations?: CemDeclaration[]
}
interface Manifest {
  modules?: CemModule[]
}

function manifestPath(): string | undefined {
  const candidates: string[] = []
  try {
    const require = createRequire(join(process.cwd(), "package.json"))
    candidates.push(require.resolve("@tecton/wc/custom-elements.json"))
  } catch {
    // not exported (yet)
  }
  candidates.push(
    resolve(process.cwd(), "node_modules/@tecton/wc/custom-elements.json"),
    resolve(process.cwd(), "../../packages/wc/custom-elements.json"),
  )
  return candidates.find((file) => existsSync(file))
}

let cached: { file: string; mtime: number; manifest: Manifest } | undefined

export function loadManifest(): { manifest?: Manifest; file?: string; error?: string } {
  const file = manifestPath()
  if (!file) return {}
  try {
    const mtime = statSync(file).mtimeMs
    if (cached?.file !== file || cached.mtime !== mtime) {
      cached = { file, mtime, manifest: JSON.parse(readFileSync(file, "utf8")) }
    }
    return { manifest: cached.manifest, file }
  } catch (error) {
    return { file, error: String(error) }
  }
}

export interface ElementDoc {
  declaration: CemDeclaration
  modulePath: string
}

/** The declaration of a custom element by tag name. */
export function findElement(manifest: Manifest, tag: string): ElementDoc | undefined {
  for (const mod of manifest.modules ?? []) {
    for (const declaration of mod.declarations ?? []) {
      if (declaration.tagName === tag) return { declaration, modulePath: mod.path }
    }
  }
  return undefined
}

/** Every custom element tag in the manifest. */
export function allTags(manifest: Manifest): string[] {
  return (manifest.modules ?? [])
    .flatMap((mod) => mod.declarations ?? [])
    .filter((d) => d.customElement && d.tagName)
    .map((d) => d.tagName!)
}

export interface PropertyRow {
  attribute?: string
  property?: string
  type?: string
  default?: string
  description?: string
  reflects?: boolean
  readonly?: boolean
  deprecated?: boolean | string
}

/** Attributes and public properties merged into one row per field. */
export function propertyRows(declaration: CemDeclaration): PropertyRow[] {
  const rows: PropertyRow[] = []
  const fields = (declaration.members ?? []).filter(
    (m) => m.kind === "field" && !m.static && (m.privacy ?? "public") === "public" && !m.name.startsWith("_") && !m.name.startsWith("#"),
  )
  for (const field of fields) {
    const attribute = declaration.attributes?.find((a) => a.fieldName === field.name)?.name ?? field.attribute
    rows.push({
      attribute,
      property: field.name,
      type: field.type?.text,
      default: field.default,
      description: field.description ?? field.summary,
      reflects: field.reflects,
      readonly: field.readonly,
      deprecated: field.deprecated,
    })
  }
  for (const attribute of declaration.attributes ?? []) {
    if (rows.some((row) => row.attribute === attribute.name)) continue
    rows.push({
      attribute: attribute.name,
      property: attribute.fieldName,
      type: attribute.type?.text,
      default: attribute.default,
      description: attribute.description ?? attribute.summary,
      deprecated: attribute.deprecated,
    })
  }
  return rows
}

export function publicMethods(declaration: CemDeclaration): CemMember[] {
  return (declaration.members ?? []).filter(
    (m) =>
      m.kind === "method" &&
      !m.static &&
      (m.privacy ?? "public") === "public" &&
      !m.name.startsWith("_") &&
      !m.name.startsWith("#") &&
      // Lit lifecycle is not public API.
      !/^(connectedCallback|disconnectedCallback|attributeChangedCallback|firstUpdated|updated|willUpdate|update|render|shouldUpdate|createRenderRoot|getUpdateComplete|performUpdate|scheduleUpdate|requestUpdate|formResetCallback|formDisabledCallback|formStateRestoreCallback|formAssociatedCallback)$/.test(
        m.name,
      ),
  )
}

export function signature(method: CemMember): string {
  const params = (method.parameters ?? [])
    .map((p) => `${p.name}${p.optional ? "?" : ""}${p.type?.text ? `: ${p.type.text}` : ""}`)
    .join(", ")
  const ret = method.return?.type?.text
  return `${method.name}(${params})${ret ? `: ${ret}` : ""}`
}
