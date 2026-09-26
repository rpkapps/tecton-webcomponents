import { css, unsafeCSS } from "lit"

/**
 * Corner custom properties the group sets on its children. `tec-button` reads `--tec-button-radius`;
 * the other form controls read their own `--tec-<component>-radius`.
 */
export const JOINED_RADIUS_PROPERTIES = [
  "--tec-button-radius",
  "--tec-input-radius",
  "--tec-input-group-radius",
  "--tec-select-radius",
  "--tec-textarea-radius",
  "--tec-native-select-radius",
  "--tec-button-group-text-radius",
] as const

/** Wrappers whose `slot="trigger"` child is the joined control (they render `display: contents`). */
export const TRIGGER_WRAPPERS = ["tec-dropdown-menu", "tec-popover", "tec-tooltip", "tec-hover-card", "tec-context-menu"]

const radius = (value: string) => unsafeCSS(JOINED_RADIUS_PROPERTIES.map((p) => `${p}: ${value};`).join(" "))
const joined = unsafeCSS(`:not(tec-button-group, ${TRIGGER_WRAPPERS.join(", ")})`)

export const buttonGroupStyles = css`
  :host {
    --_group-radius: var(--tec-button-group-radius, var(--tec-radius-md));
    --_group-first: var(--_group-radius) 0 0 var(--_group-radius);
    --_group-last: 0 var(--_group-radius) var(--_group-radius) 0;
    display: flex;
    width: fit-content;
    align-items: stretch;
  }
  :host(:dir(rtl)) {
    --_group-first: 0 var(--_group-radius) var(--_group-radius) 0;
    --_group-last: var(--_group-radius) 0 0 var(--_group-radius);
  }
  :host([orientation="vertical"]) {
    --_group-first: var(--_group-radius) var(--_group-radius) 0 0;
    --_group-last: 0 0 var(--_group-radius) var(--_group-radius);
    flex-direction: column;
  }
  :host(:state(has-groups)) {
    gap: 0.5rem;
  }

  /* Joined corners (logical: they mirror in RTL). */
  ::slotted(${joined}:first-child:not(:last-child)) {
    ${radius("var(--_group-first)")}
  }
  ::slotted(${joined}:not(:first-child):not(:last-child)) {
    ${radius("0")}
  }
  ::slotted(${joined}:last-child:not(:first-child)) {
    ${radius("var(--_group-last)")}
  }
  ::slotted(${joined}:only-child) {
    ${radius("var(--_group-radius)")}
  }

  /* Overlapping borders. !important: a document reset (\`* { margin: 0 }\`) would beat a ::slotted rule. */
  ::slotted(${joined}:not(:first-child)) {
    margin-inline-start: -1px !important;
  }
  :host([orientation="vertical"]) ::slotted(${joined}:not(:first-child)) {
    margin-inline-start: 0 !important;
    margin-block-start: -1px !important;
  }

  /* The hovered / focused / open / invalid control draws its border over its neighbours. */
  ::slotted(:hover),
  ::slotted(:focus-within),
  ::slotted([aria-expanded="true"]),
  ::slotted([aria-invalid="true"]),
  ::slotted([invalid]) {
    position: relative;
    z-index: 10;
  }

  /* Filled buttons next to outlined controls get the outline border colour. */
  :host(:state(bordered)) ::slotted(tec-button:not([variant="outline"])) {
    --tec-button-border-color: var(--tec-outline-border);
  }

  ::slotted(input) {
    flex: 1 1 0%;
  }
  ::slotted(tec-select:not([class*="w-"])) {
    width: fit-content;
  }
`

export const buttonGroupTextStyles = css`
  :host {
    display: flex;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
    font-weight: var(--tec-font-weight-medium);
    --tec-icon-size: 1rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.625rem;
    border: 1px solid var(--tec-border);
    border-radius: var(--tec-button-group-text-radius, var(--tec-radius-md));
    background-color: var(--tec-muted);
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  ::slotted(label) {
    cursor: default;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`

export const buttonGroupSeparatorStyles = css`
  :host {
    display: block;
    position: relative;
    flex-shrink: 0;
    align-self: stretch;
  }
  :host(:state(vertical)) {
    width: 1px;
  }
  :host(:state(horizontal)) {
    height: 1px;
  }
  .base {
    position: absolute;
    inset: 0;
    background-color: var(--tec-input);
  }
  :host(:state(vertical)) .base {
    inset-block: 1px;
  }
  :host(:state(horizontal)) .base {
    inset-inline: 1px;
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
  }
`
