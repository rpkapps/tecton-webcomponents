import { AppWindow, ArrowUp, Code, GitBranch, GitFork } from "lucide"
import "../src/index.js"
import { registerIcons } from "../src/components/icon/registry.js"
import { tectonIcons } from "../src/icons/index.js"

registerIcons({ AppWindow, ArrowUp, Code, GitBranch, GitFork })

for (const [id, variant] of [["icons", "outlined"], ["icons-filled", "filled"]] as const) {
  const row = document.getElementById(id)!
  for (const icon of tectonIcons) {
    const el = document.createElement("tec-icon")
    el.name = icon.name
    el.variant = variant
    el.label = icon.label
    row.append(el)
  }
}

const root = document.documentElement
const dark = document.getElementById("dark") as HTMLInputElement
const rtl = document.getElementById("rtl") as HTMLInputElement
const params = new URLSearchParams(location.search)
dark.checked = params.get("theme") === "dark"
rtl.checked = params.get("dir") === "rtl"
const apply = () => {
  root.classList.toggle("dark", dark.checked)
  root.dir = rtl.checked ? "rtl" : "ltr"
}
dark.addEventListener("change", apply)
rtl.addEventListener("change", apply)
apply()
