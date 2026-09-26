// The components every MDX page can use without importing them. The docs route passes
// this map to <Content components={…} />.
import ApiReference from "../ApiReference.astro"
import ComponentPreview from "../ComponentPreview.astro"
import Callout from "./Callout.astro"
import CodeBlock from "./CodeBlock.astro"
import Correct from "./Correct.astro"
import Do from "./Do.astro"
import DoList from "./DoList.astro"
import Dont from "./Dont.astro"
import H2 from "./H2.astro"
import H3 from "./H3.astro"
import H4 from "./H4.astro"
import IconGallery from "./IconGallery.astro"
import Kbd from "./Kbd.astro"
import KeyboardTable from "./KeyboardTable.astro"
import Link from "./Link.astro"
import PaletteTable from "./PaletteTable.astro"
import SectionCards from "./SectionCards.astro"
import Steps from "./Steps.astro"
import Table from "./Table.astro"
import TokenTable from "./TokenTable.astro"
import Wrong from "./Wrong.astro"

export const mdxComponents = {
  // markdown elements
  h2: H2,
  h3: H3,
  h4: H4,
  a: Link,
  table: Table,
  // components
  ApiReference,
  Callout,
  CodeBlock,
  ComponentPreview,
  Correct,
  Do,
  DoList,
  Dont,
  IconGallery,
  Kbd,
  KeyboardTable,
  PaletteTable,
  SectionCards,
  Steps,
  TokenTable,
  Wrong,
}
