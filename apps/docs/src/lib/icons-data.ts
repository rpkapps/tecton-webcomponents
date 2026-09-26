// The Tecton domain icons of @tecton/wc (src/icons), for the icon gallery.
// Names come from the icon modules; a module (or the folder's index) may also export
// descriptions. Missing folder = empty list.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface IconInfo {
  name: string
  description?: string
}

const NOT_ICONS = /^(index|_.*|registry|types?|icon|runtime|.*\.test|.*\.d)$/

export async function getIcons(): Promise<IconInfo[]> {
  const dirs = [
    resolve(process.cwd(), "node_modules/@tecton/wc/src/icons"),
    resolve(process.cwd(), "../../packages/wc/src/icons"),
  ]
  const dir = dirs.find((d) => existsSync(d))
  if (!dir) return []
  const icons = new Map<string, IconInfo>()
  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(resolve(folder, entry.name))
        continue
      }
      const m = /^(.+)\.ts$/.exec(entry.name)
      if (!m || NOT_ICONS.test(m[1])) continue
      const source = readFileSync(resolve(folder, entry.name), "utf8")
      const description = /description:\s*["'`]([^"'`]+)["'`]/.exec(source)?.[1]
      const name = /name:\s*["'`]([a-z0-9-]+)["'`]/.exec(source)?.[1] ?? m[1]
      icons.set(name, { name, description })
    }
  }
  walk(dir)
  return [...icons.values()].sort((a, b) => a.name.localeCompare(b.name))
}
