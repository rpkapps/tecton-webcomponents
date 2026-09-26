/**
 * @module define
 * Idempotent custom element registration.
 *
 * Every family's `define.ts` registers its tags through {@link defineElement} so that importing the
 * same entry point twice (two bundles, a CDN build next to an npm build, hot reload) never throws
 * `NotSupportedError: the name "tec-x" has already been used`.
 *
 * ```ts
 * // src/components/dialog/define.ts
 * import { defineElement } from "../../internal/define.js"
 * import { TecDialog, TecDialogHeader } from "./dialog.js"
 * import "../button/define.js" // families the dialog renders
 * defineElement("tec-dialog", TecDialog)
 * defineElement("tec-dialog-header", TecDialogHeader)
 * ```
 */

/**
 * Registers `ctor` as `tag` in `registry` (the global `customElements` by default) unless the tag is
 * already defined. When a *different* class already owns the tag (two copies of the library on one
 * page) a console warning is printed once and the existing definition is kept.
 */
export function defineElement(
  tag: string,
  ctor: CustomElementConstructor,
  registry: CustomElementRegistry = customElements
): void {
  const existing = registry.get(tag)
  if (!existing) {
    registry.define(tag, ctor)
    return
  }
  if (existing !== ctor && !warned.has(tag)) {
    warned.add(tag)
    console.warn(
      `[tecton] <${tag}> is already defined by another class; keeping the first definition. ` +
        `This usually means two copies of @tecton/wc are loaded.`
    )
  }
}

const warned = new Set<string>()
