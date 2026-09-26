import { css } from "lit"

const W = css`var(--tec-sidebar-width, 16rem)`
const W_ICON = css`var(--tec-sidebar-width-icon, 3rem)`
const W_MOBILE = css`var(--tec-sidebar-width-mobile, 18rem)`

/* ------------------------------------------------------------------ tec-sidebar */
export const sidebarStyles = css`
  :host {
    display: block;
    color: var(--tec-sidebar-foreground);
    --_w: ${W};
  }
  /* A right sidebar sits at the end of the provider's row even when it comes first in the markup. */
  :host([side="right"]) {
    order: 1;
  }
  :host(:state(mobile)) {
    display: contents;
  }
  :host([collapsible="none"]) {
    display: flex;
  }

  .inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--tec-sidebar);
  }

  /* collapsible="none": a plain column */
  .static {
    width: var(--_w);
    height: auto;
  }

  /* Desktop: a gap in the flow + a fixed container */
  .gap {
    position: relative;
    width: var(--_w);
    background: transparent;
  }
  :host(:state(offcanvas)) .gap {
    width: 0;
  }
  :host(:state(icon)) .gap {
    width: ${W_ICON};
  }
  :host(:state(icon):is([variant="floating"], [variant="inset"])) .gap {
    width: calc(${W_ICON} + 1rem);
  }

  .container {
    position: fixed;
    inset-block: 0;
    z-index: 10;
    display: flex;
    width: var(--_w);
    inset-inline-start: 0;
  }
  :host([side="right"]) .container {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  :host(:state(offcanvas)) .container {
    inset-inline-start: calc(var(--_w) * -1);
  }
  :host([side="right"]:state(offcanvas)) .container {
    inset-inline-start: auto;
    inset-inline-end: calc(var(--_w) * -1);
  }
  :host(:not([variant="floating"], [variant="inset"])) .container {
    border-inline-end: 1px solid var(--tec-border);
  }
  :host([side="right"]:not([variant="floating"], [variant="inset"])) .container {
    border-inline-end: 0;
    border-inline-start: 1px solid var(--tec-border);
  }
  :host(:state(icon)) .container {
    width: ${W_ICON};
  }
  :host(:is([variant="floating"], [variant="inset"])) .container {
    padding: 0.5rem;
  }
  :host(:state(icon):is([variant="floating"], [variant="inset"])) .container {
    width: calc(${W_ICON} + 1rem + 2px);
  }
  :host([variant="floating"]) .inner {
    border-radius: var(--tec-radius-lg);
    box-shadow:
      0 0 0 1px var(--tec-sidebar-border),
      var(--tec-shadow-sm);
  }

  @media (prefers-reduced-motion: no-preference) {
    .gap {
      transition: width 200ms linear;
    }
    .container {
      transition-property: inset-inline-start, inset-inline-end, width;
      transition-duration: 200ms;
      transition-timing-function: linear;
    }
  }

  /* Mobile: a modal sheet */
  .sheet {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    inset-inline-end: auto;
    width: ${W_MOBILE};
    max-width: 100%;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-inline-end: 1px solid var(--tec-border);
    background-color: var(--tec-sidebar);
    color: var(--tec-sidebar-foreground);
    box-shadow: var(--tec-shadow-lg);
    outline: none;
    overflow: hidden;
    font: inherit;
  }
  :host([side="right"]) .sheet {
    inset-inline-start: auto;
    inset-inline-end: 0;
    border-inline-end: 0;
    border-inline-start: 1px solid var(--tec-border);
  }
  .sheet:not([open]) {
    display: none;
  }
  .sheet::backdrop {
    background-color: color-mix(in oklab, var(--tecton-palette-black, #000) 10%, transparent);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }
  @media (prefers-reduced-motion: no-preference) {
    .sheet,
    .sheet::backdrop {
      transition:
        translate 200ms ease-in-out,
        opacity 200ms ease-in-out,
        display 200ms allow-discrete,
        overlay 200ms allow-discrete;
    }
    .sheet:not([open]),
    .sheet:not([open])::backdrop {
      opacity: 0;
    }
    .sheet:not([open]) {
      translate: -2.5rem 0;
    }
    @starting-style {
      .sheet[open],
      .sheet[open]::backdrop {
        opacity: 0;
      }
      .sheet[open] {
        translate: -2.5rem 0;
      }
    }
    :host(:dir(rtl)) .sheet:not([open]),
    :host([side="right"]:dir(ltr)) .sheet:not([open]) {
      translate: 2.5rem 0;
    }
    @starting-style {
      :host(:dir(rtl)) .sheet[open],
      :host([side="right"]:dir(ltr)) .sheet[open] {
        translate: 2.5rem 0;
      }
    }
    :host([side="right"]:dir(rtl)) .sheet:not([open]) {
      translate: -2.5rem 0;
    }
    @starting-style {
      :host([side="right"]:dir(rtl)) .sheet[open] {
        translate: -2.5rem 0;
      }
    }
  }
  @media (forced-colors: active) {
    .container,
    .sheet,
    .static {
      border-inline: 1px solid CanvasText;
    }
  }
`

/* ------------------------------------------------------------------ sections */
/* Layout lives on the host (so layout classes on the element work); the padded part inherits it. */
const forwardLayout = css`
  .base {
    flex-direction: inherit;
    flex-wrap: inherit;
    gap: inherit;
    align-items: inherit;
    justify-content: inherit;
  }
`

export const sidebarSectionStyles = [
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .base {
      display: flex;
      flex: 1 1 auto;
      padding: 0.5rem;
      min-width: 0;
    }
  `,
  forwardLayout,
]

export const sidebarContentStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1 1 0%;
    min-height: 0;
    min-width: 0;
  }
  .base {
    display: flex;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-items: inherit;
    justify-content: inherit;
    flex: 1 1 0%;
    gap: inherit;
    min-height: 0;
    overflow: auto;
    scrollbar-width: none;
  }
  .base::-webkit-scrollbar {
    display: none;
  }
  :host(:state(icon)) .base {
    overflow: hidden;
  }
`

export const sidebarGroupStyles = [
  css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
    }
    .base {
      position: relative;
      display: flex;
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      padding: 0.5rem;
    }
  `,
  forwardLayout,
]

export const sidebarGroupLabelStyles = css`
  :host {
    display: flex;
    flex-shrink: 0;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    color: color-mix(in oklab, var(--tec-sidebar-foreground) 70%, transparent);
    --tec-icon-size: 1rem;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.5rem;
    height: 2rem;
    padding-inline: 0.5rem;
    border-radius: var(--tec-radius-md);
    outline: none;
  }
  :host(:state(icon)) .base {
    margin-block-start: -2rem;
    opacity: 0;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition:
        margin 200ms linear,
        opacity 200ms linear;
    }
  }
`

export const sidebarGroupContentStyles = css`
  :host {
    display: block;
    width: 100%;
    font-size: var(--tec-text-sm);
    line-height: var(--tec-text-sm--line-height);
  }
`

/** Small square icon buttons: group action and menu action. */
export const sidebarActionStyles = css`
  :host {
    position: absolute;
    display: flex;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--tec-sidebar-foreground);
    --tec-icon-size: 1rem;
  }
  .base {
    all: unset;
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: var(--tec-radius-md);
    color: inherit;
    cursor: pointer;
    outline: none;
  }
  :host(:hover) .base {
    background-color: var(--tec-sidebar-accent);
    color: var(--tec-sidebar-accent-foreground);
  }
  :host(:state(focus-visible)) .base {
    box-shadow: 0 0 0 2px var(--tec-sidebar-ring);
  }
  /* A larger touch target on small screens. */
  @media (max-width: 767.98px) {
    .base::after {
      content: "";
      position: absolute;
      inset: -0.5rem;
    }
  }
  :host(:state(icon)) {
    display: none;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition: transform var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    :host(:state(focus-visible)) .base {
      outline: 2px solid Highlight;
    }
  }
`

export const sidebarGroupActionStyles = css`
  :host {
    top: 0.875rem;
    inset-inline-end: 0.75rem;
  }
`

export const sidebarMenuActionStyles = css`
  :host {
    top: 0.375rem;
    inset-inline-end: 0.25rem;
  }
  :host(:state(size-lg)) {
    top: 0.625rem;
  }
  :host(:state(size-sm)) {
    top: 0.25rem;
  }
  :host(:state(button-active)) {
    color: var(--tec-sidebar-accent-foreground);
  }
  @media (min-width: 768px) {
    :host([show-on-hover]:not(:state(engaged)):not([aria-expanded="true"])) {
      opacity: 0;
    }
  }
`

export const sidebarSeparatorStyles = css`
  :host {
    display: block;
  }
  .base {
    height: 1px;
    margin-inline: 0.5rem;
    background-color: var(--tec-sidebar-border);
  }
  @media (forced-colors: active) {
    .base {
      background-color: CanvasText;
    }
  }
`

/* ------------------------------------------------------------------ menu */
export const sidebarMenuStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    min-width: 0;
  }
`

export const sidebarMenuItemStyles = css`
  :host {
    display: block;
    position: relative;
  }
`

/** Menu button and sub button share the row look. */
const rowStyles = css`
  .base {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    border-radius: var(--tec-radius-md);
    color: inherit;
    text-align: start;
    cursor: pointer;
    outline: none;
  }
  :host(:hover) .base,
  :host(:active) .base,
  :host([aria-expanded="true"]:hover) .base,
  :host([active]) .base {
    background-color: var(--tec-sidebar-accent);
    color: var(--tec-sidebar-accent-foreground);
  }
  :host(:state(focus-visible)) .base {
    box-shadow: 0 0 0 2px var(--tec-sidebar-ring);
  }
  :host([disabled]),
  :host([aria-disabled="true"]) {
    pointer-events: none;
    opacity: 0.5;
  }
  ::slotted(svg),
  ::slotted(tec-icon) {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
    flex-shrink: 0;
  }
  ::slotted(span:last-child) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    :host(:state(focus-visible)) .base {
      outline: 2px solid Highlight;
    }
    :host([active]) .base {
      outline: 1px solid Highlight;
    }
  }
`

export const sidebarMenuButtonStyles = [
  rowStyles,
  css`
    :host {
      display: flex;
      width: 100%;
      height: 2rem;
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
      --tec-icon-size: 1rem;
    }
    :host([size="sm"]) {
      height: 1.75rem;
      font-size: var(--tec-text-xs);
      line-height: var(--tec-text-xs--line-height);
    }
    :host([size="lg"]) {
      height: 3rem;
    }
    .base {
      padding: 0.5rem;
    }
    :host(:state(has-action)) .base {
      padding-inline-end: 2rem;
    }
    :host([active]) .base {
      font-weight: var(--tec-font-weight-medium);
    }
    :host([variant="outline"]) .base {
      background-color: var(--tec-background);
      box-shadow: 0 0 0 1px var(--tec-sidebar-border);
    }
    :host([variant="outline"]:hover) .base {
      background-color: var(--tec-sidebar-accent);
      box-shadow: 0 0 0 1px var(--tec-sidebar-accent);
    }
    :host([variant="outline"]:state(focus-visible)) .base {
      box-shadow: 0 0 0 2px var(--tec-sidebar-ring);
    }
    /* Collapsed to icons: a 2rem square showing the leading icon. */
    :host(:state(icon)) {
      width: 2rem;
      height: 2rem;
    }
    :host(:state(icon)) .base {
      padding: 0.5rem;
    }
    :host([size="lg"]:state(icon)) .base {
      padding: 0;
    }
    @media (prefers-reduced-motion: no-preference) {
      .base {
        transition-property: width, height, padding, background-color, color, box-shadow;
        transition-duration: var(--tec-duration);
        transition-timing-function: var(--tec-ease);
      }
    }

    .tooltip {
      box-sizing: border-box;
      max-width: 20rem;
      padding: 0.375rem 0.75rem;
      border-radius: var(--tec-radius-md);
      background-color: var(--tec-foreground);
      color: var(--tec-background);
      font-family: var(--tec-font-sans);
      font-size: var(--tec-text-xs);
      line-height: var(--tec-text-xs--line-height);
      font-weight: 400;
      text-align: start;
      white-space: normal;
      pointer-events: none;
    }
    .tooltip:popover-open {
      display: inline-flex;
      align-items: center;
    }
    .arrow {
      position: absolute;
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 2px;
      background-color: var(--tec-foreground);
      rotate: 45deg;
    }
    .arrow[data-side="right"] {
      left: -0.25rem;
    }
    .arrow[data-side="left"] {
      right: -0.25rem;
    }
    @media (forced-colors: active) {
      .tooltip {
        border: 1px solid CanvasText;
      }
    }
  `,
]

export const sidebarMenuBadgeStyles = css`
  :host {
    position: absolute;
    top: 0.375rem;
    inset-inline-end: 0.25rem;
    display: flex;
    height: 1.25rem;
    min-width: 1.25rem;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    font-size: var(--tec-text-xs);
    line-height: var(--tec-text-xs--line-height);
    font-weight: var(--tec-font-weight-medium);
    font-variant-numeric: tabular-nums;
    color: var(--tec-sidebar-foreground);
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    padding-inline: 0.25rem;
    border-radius: var(--tec-radius-md);
  }
  :host(:state(size-lg)) {
    top: 0.625rem;
  }
  :host(:state(size-sm)) {
    top: 0.25rem;
  }
  :host(:state(button-active)),
  :host(:state(engaged)) {
    color: var(--tec-sidebar-accent-foreground);
  }
  :host(:state(icon)) {
    display: none;
  }
`

export const sidebarMenuSkeletonStyles = css`
  :host {
    display: block;
  }
  .base {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 2rem;
    padding-inline: 0.5rem;
    border-radius: var(--tec-radius-md);
  }
  .icon,
  .text {
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-muted);
  }
  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .text {
    height: 1rem;
    flex: 1 1 0%;
    max-width: var(--_skeleton-width, 70%);
  }
  @media (prefers-reduced-motion: no-preference) {
    .icon,
    .text {
      animation: tec-sidebar-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  }
  @keyframes tec-sidebar-pulse {
    50% {
      opacity: 0.5;
    }
  }
`

export const sidebarMenuSubStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .base {
    display: flex;
    flex: 1 1 auto;
    flex-direction: inherit;
    gap: inherit;
    min-width: 0;
    margin-inline: 0.875rem;
    padding-inline: 0.625rem;
    padding-block: 0.125rem;
    border-inline-start: 1px solid var(--tec-sidebar-border);
    translate: 1px 0;
  }
  :host(:dir(rtl)) .base {
    translate: -1px 0;
  }
  :host(:state(icon)) {
    display: none;
  }
  @media (forced-colors: active) {
    .base {
      border-inline-start-color: CanvasText;
    }
  }
`

export const sidebarMenuSubItemStyles = css`
  :host {
    display: block;
    position: relative;
  }
`

export const sidebarMenuSubButtonStyles = [
  rowStyles,
  css`
    :host {
      display: flex;
      min-width: 0;
      height: 1.75rem;
      color: var(--tec-sidebar-foreground);
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
      --tec-icon-size: 1rem;
    }
    :host([size="sm"]) {
      font-size: var(--tec-text-xs);
      line-height: var(--tec-text-xs--line-height);
    }
    .base {
      padding-inline: 0.5rem;
      translate: -1px 0;
    }
    :host(:dir(rtl)) .base {
      translate: 1px 0;
    }
    ::slotted(svg),
    ::slotted(tec-icon) {
      color: var(--tec-sidebar-accent-foreground);
    }
    :host(:state(icon)) {
      display: none;
    }
  `,
]

/* ------------------------------------------------------------------ trigger, rail, inset, input */
export const sidebarTriggerStyles = css`
  .icon {
    width: var(--tec-icon-size);
    height: var(--tec-icon-size);
  }
  :host(:dir(rtl)) .icon {
    transform: scaleX(-1);
  }
`

export const sidebarRailStyles = css`
  :host {
    position: absolute;
    inset-block: 0;
    z-index: 20;
    display: none;
    width: 1rem;
    inset-inline-end: -1rem;
    translate: -50% 0;
    cursor: w-resize;
  }
  :host(:dir(rtl)) {
    translate: 50% 0;
    cursor: e-resize;
  }
  @media (min-width: 640px) {
    :host {
      display: flex;
    }
  }
  :host(:state(right)) {
    inset-inline-end: auto;
    inset-inline-start: 0;
    cursor: e-resize;
  }
  :host(:state(right):dir(rtl)),
  :host(:state(collapsed)) {
    cursor: e-resize;
  }
  :host(:state(collapsed):dir(rtl)),
  :host(:state(right):state(collapsed)) {
    cursor: w-resize;
  }
  :host(:state(right):state(collapsed):dir(rtl)) {
    cursor: e-resize;
  }
  :host(:state(offcanvas)) {
    translate: 0 0;
    inset-inline-end: -0.5rem;
  }
  :host(:state(offcanvas):state(right)) {
    inset-inline-end: auto;
    inset-inline-start: -0.5rem;
  }
  .base {
    all: unset;
    position: relative;
    flex: 1 1 auto;
    cursor: inherit;
  }
  .base::after {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 50%;
    width: 2px;
  }
  :host(:state(offcanvas)) .base::after {
    inset-inline-start: 100%;
  }
  :host(:hover) .base::after {
    background-color: var(--tec-sidebar-border);
  }
  :host(:state(offcanvas):hover) .base {
    background-color: var(--tec-sidebar);
  }
  @media (prefers-reduced-motion: no-preference) {
    :host {
      transition: all 150ms linear;
    }
  }
`

export const sidebarInsetStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1 1 0%;
    width: 100%;
    min-width: 0;
  }
  .base {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    background-color: var(--tec-background);
  }
  :host(:state(inset)) .base {
    margin: 0.5rem;
    margin-inline-start: 0;
    border-radius: var(--tec-radius-xl);
    box-shadow: var(--tec-shadow-sm);
  }
  :host(:state(inset):state(collapsed)) .base {
    margin-inline-start: 0.5rem;
  }
`

export const sidebarInputStyles = css`
  :host {
    display: flex;
    width: 100%;
    height: 2rem;
    font-size: var(--tec-text-base);
    line-height: var(--tec-text-base--line-height);
  }
  @media (min-width: 768px) {
    :host {
      font-size: var(--tec-text-sm);
      line-height: var(--tec-text-sm--line-height);
    }
  }
  .base {
    box-sizing: border-box;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--tec-input);
    border-radius: var(--tec-radius-md);
    background-color: var(--tec-background);
    color: var(--tec-foreground);
    font: inherit;
    outline: none;
  }
  .base::placeholder {
    color: var(--tec-muted-foreground);
  }
  :host(:hover) .base {
    border-color: var(--tec-input-hover);
  }
  .base:focus-visible {
    border-color: var(--tec-ring);
    box-shadow: var(--tec-focus-ring);
  }
  :host(:state(user-invalid)) .base {
    border-color: var(--tec-destructive);
    box-shadow: var(--tec-focus-ring-invalid);
  }
  :host(:disabled) {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.5;
  }
  @media (prefers-reduced-motion: no-preference) {
    .base {
      transition:
        color var(--tec-duration) var(--tec-ease),
        border-color var(--tec-duration) var(--tec-ease),
        box-shadow var(--tec-duration) var(--tec-ease);
    }
  }
  @media (forced-colors: active) {
    .base:focus-visible {
      outline: 2px solid Highlight;
    }
  }
`
