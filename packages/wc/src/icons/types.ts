/** Glyph style of a Tecton icon. */
export type TectonIconVariant = "outlined" | "filled"

/** One Tecton domain icon: SVG markup for both variants on a shared viewBox. */
export interface TectonIconData {
  /** kebab-case name, used as `<tec-icon name="…">`. */
  name: string
  /** Human-readable name ("Drill Bit"). */
  label: string
  /** What the glyph depicts (for galleries and search). */
  description: string
  /** SVG viewBox shared by both variants (optically cropped from the 16-unit source grid). */
  viewBox: string
  /** Multi-colour glyph: keeps its own colours instead of `currentColor`. */
  colored?: boolean
  /** Inner SVG markup of the outlined variant (fills inherit `currentColor`). */
  outlined: string
  /** Inner SVG markup of the filled variant. */
  filled: string
}
