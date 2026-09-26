/**
 * The Tecton domain icon set — the oil & gas / subsurface glyphs Lucide has no answer for, each in an
 * `outlined` and a `filled` variant. `<tec-icon name="well">` renders them (they are registered by
 * default); general-purpose glyphs come from Lucide (`registerIcons({ ... })`).
 *
 * Each glyph is drawn on a 16-unit grid; the `viewBox` is optically cropped (by up to one unit per side,
 * less where the glyph reaches the edge) so a Tecton icon matches a Lucide icon of the same size.
 */
import type { TectonIconData } from "./types.js"
import { christmasTreeIcon } from "./christmas-tree.js"
import { drillBitIcon } from "./drill-bit.js"
import { faultIcon } from "./fault.js"
import { geobodiesIcon } from "./geobodies.js"
import { geostructureIcon } from "./geostructure.js"
import { horizonIcon } from "./horizon.js"
import { logCurveIcon } from "./log-curve.js"
import { oilRigOffshoreIcon } from "./oil-rig-offshore.js"
import { rockFormationsIcon } from "./rock-formations.js"
import { seismicIcon } from "./seismic.js"
import { strataIcon } from "./strata.js"
import { surfaceIcon } from "./surface.js"
import { trajectoryIcon } from "./trajectory.js"
import { valveIcon } from "./valve.js"
import { velocityModelIcon } from "./velocity-model.js"
import { wellIcon } from "./well.js"
import { wellPickIcon } from "./well-pick.js"
import { wellPlanIcon } from "./well-plan.js"

export type { TectonIconData, TectonIconVariant } from "./types.js"
export { christmasTreeIcon }
export { drillBitIcon }
export { faultIcon }
export { geobodiesIcon }
export { geostructureIcon }
export { horizonIcon }
export { logCurveIcon }
export { oilRigOffshoreIcon }
export { rockFormationsIcon }
export { seismicIcon }
export { strataIcon }
export { surfaceIcon }
export { trajectoryIcon }
export { valveIcon }
export { velocityModelIcon }
export { wellIcon }
export { wellPickIcon }
export { wellPlanIcon }

/** Every Tecton domain icon, in gallery (alphabetical) order. */
export const tectonIcons: readonly TectonIconData[] = [
  christmasTreeIcon,
  drillBitIcon,
  faultIcon,
  geobodiesIcon,
  geostructureIcon,
  horizonIcon,
  logCurveIcon,
  oilRigOffshoreIcon,
  rockFormationsIcon,
  seismicIcon,
  strataIcon,
  surfaceIcon,
  trajectoryIcon,
  valveIcon,
  velocityModelIcon,
  wellIcon,
  wellPickIcon,
  wellPlanIcon,
]
