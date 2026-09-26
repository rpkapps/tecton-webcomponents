const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * Inline markdown of JSDoc descriptions (manifest): `code`, **strong**, *em* and
 * [links](url). Everything else is escaped text.
 */
export function inlineMarkdown(text: string | undefined): string {
  if (!text) return ""
  const parts = text.split(/(`[^`]+`)/g)
  return parts
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
          const external = /^https?:/.test(href)
          return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${label}</a>`
        })
        .replace(/\n{2,}/g, "<br /><br />")
    })
    .join("")
}

export { escapeHtml }
