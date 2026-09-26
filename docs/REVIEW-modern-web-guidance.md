# Review against modern-web-guidance

Review of `@tecton/wc` and the docs site against the `modern-web-guidance` skill
(`.claude/skills/modern-web-guidance/`, v0.0.190), September 2026. Browser support policy: see
`CLAUDE.md` (Widely available: no fallback; Newly available: the guide's fallback or feature
detection).

Severity: **high** = user-visible bug or accessibility failure; **medium** = clear deviation with
real impact; **low** = modernization. "Verified" = reproduced in Chromium; otherwise found by
reading the code. Paths are relative to `packages/wc/src/` unless they start with `apps/`.

Fixed while the review ran: the toast stack no longer collapses when a toast arrives, chart x-axis
labels at the edges are no longer dropped (commit `139b21a`).

## High

| # | Area | Finding | Guide | Fix |
|---|------|---------|-------|-----|
| H1 | input, combobox, input-otp, date-field, button | **Enter never submits the form** (verified: 0 submits). The inner `<input>` is in a shadow root and has no form owner, and `tec-button type=submit` is not a native submitter, so implicit submission never happens — also from native inputs in a form whose only submit button is a `tec-button`. `input.mdx` promises it does. | forms, ime-safe-enter-submit | In `FormControlMixin` (opt-in for single-line controls): on unmodified, non-composing Enter, click the form's first submit button (`tec-button` included) or `form.requestSubmit()`. |
| H2 | sonner + dialog | **Toasts are inert while a modal is open** (verified): clicking a toast's action closes the dialog (`reason: "outside"`), the action never runs, the toast is absent from the accessibility tree and never announced. `showModal()` inerts everything outside the dialog, top layer or not. | persistent-top-layer-ui, accessibility §8 | While a modal is open, move the toaster into the topmost modal (`moveBefore()` when available, else move + `showPopover()`), back on close. Keep the live regions rendered outside `display: none`. |
| H3 | collapsible, accordion | **Collapsed panels stay focusable in engines without `content-visibility`** (Safari < 26, Firefox < 130): `hidden="until-found"` is overridden to `display:block; height:0; content-visibility:hidden`, so Tab reaches invisible controls inside an `aria-hidden` subtree (`collapsible/disclosure-panel.ts:24-29`). | search-hidden-content | Use `until-found` only when `'onbeforematch' in HTMLElement.prototype`, plain `hidden` otherwise; `@supports not (content-visibility: hidden)` → `display: none`. |
| H4 | theme | **Light by default, system dark preference ignored**: `:root { color-scheme: light }`, the dark tokens exist only under `.dark`/`[data-theme=dark]`, no `prefers-color-scheme` rule; `setTheme("system")` pins a resolved mode from a module script. | dark-mode | Emit `color-scheme: light dark` and the dark tokens under `@media (prefers-color-scheme: dark) { :root:not([data-theme=light], .light) }`; `setTheme("system")` removes the attribute. |
| H5 | theme-root | **A pinned `tec-theme-root` has no background**: `<tec-theme-root theme="dark">` on a light page draws light text on the light page (~1:1). | component-specific-light-dark-theme | `:host([data-theme]) { background-color: var(--tec-background) }`. |
| H6 | radio-group | **A required radio group can't be focused on a blocked submit** (verified: "invalid form control is not focusable", no bubble, focus skips to the next invalid field). No validation anchor (`radio-group.ts:85`). | required-field-feedback | Add a `validationAnchor` hook to the mixin; the group returns its active/first enabled radio. |
| H7 | field-error | **Errors are re-announced assertively on every keystroke** after the first blur: `role="alert"` + the browser's `validationMessage`, which changes as you type (`tooShort` counts characters). | forms §4, accessible-error-announcement | Freeze the shown message while focused (update on blur/submit, only clear on input); polite region, announce on first appearance. |
| H8 | carousel | **Next/Previous drop focus at the ends**: the focused button becomes `disabled` and focus falls to `<body>` (`carousel/carousel-controls.ts:34`). | accessibility §2 | `aria-disabled` + a guard in `activate()`, or move focus to the other button first. |
| H9 | carousel | **Slide changes are never announced in Safari < 26.2**: the announcement is only sent from `scrollend` (`carousel/carousel.ts:221,306`). | defer-work-until-scroll-ends | Debounced `scroll` fallback when `!('onscrollend' in window)`; handle "already at target". |
| H10 | docs site | **The render-blocking module waits for the whole HTML plus a 5-level module chain** with no `modulepreload` (`apps/docs/plugins/component-preload.mjs`): fast when cached, several round trips of blank/frozen page on a cold visit. | flicker-free-client-side-ab-testing | Emit `<link rel="modulepreload">` for the blocking graph; block only on family chunks and above-the-fold examples. |

## Medium

| # | Area | Finding | Guide | Fix |
|---|------|---------|-------|-----|
| M1 | dialog, popover, all popups | **Moving an open overlay breaks it** (verified): a moved dialog keeps `open` but loses modality (no inert, no top layer; scroll lock and trap remain); a moved popover reports `open` but isn't shown, next click closes it (`dialog/modal.ts:307`, `internal/popup.ts:194`). | persistent-top-layer-ui | Dialog: re-`showModal()` when not `:modal`. Popups: re-`show()` in `hostConnected` when open but not `:popover-open`. |
| M2 | popups, dialogs, toaster | **Popover API without feature detection** (Newly available): `matches(":popover-open")` throws where unsupported, which also breaks `tec-dialog` (`modal.ts:306` runs before `showModal()`). | animate-to-from-top-layer | Conditional `@oddbird/popover-polyfill`, `:is(:popover-open, .\:popover-open)` selectors, no Popover calls on the modal path. |
| M3 | dialog, sheet, drawer | **Exit animation relies on `overlay`** (Chromium only): `close()` runs immediately, so in Firefox/Safari the exit renders outside the top layer or vanishes (`dialog/modal.styles.ts:41`, `modal.ts:330`). | animate-to-from-top-layer | `data-state="closed"`, `await animateOut(dialog, { subtree: true })`, then `close()` (as `command-dialog.ts` already does). |
| M4 | popups | **Android back / platform close requests don't close menus, selects, popovers** (`internal/dismiss.ts:48`): only `keydown` Escape. | platform-controls-dismiss-dialog | `CloseWatcher` when available in `DismissController.activate()`, routed to `onDismiss("escape")`. |
| M5 | combobox, command, select, menus | **IME Enter check lacks Safari's `keyCode === 229` fallback**: confirming a Japanese conversion runs the highlighted command / picks the option. | ime-safe-enter-submit | Move `composer-input.ts`'s helper to `internal/` and use it everywhere. |
| M6 | form controls | **`form.checkValidity()` marks every field as interacted**: a "enable Save when valid" listener turns every untouched required field red (`internal/form-control.ts:267`). | validate-input-after-interaction | Treat `invalid` as a submit attempt only during a submission. |
| M7 | form controls | **`:state()` / `internals.states` without detection** (Newly available): throws in `updated()` in older engines, so no invalid styling or `aria-invalid` (`internal/tecton-element.ts:73`). | forms | Guard `toggleState`, sync ARIA first, mirror states as attributes. |
| M8 | color-swatch | **Editable swatch isn't a form control**: the picked colour isn't submitted or reset. | forms §1 | Apply `FormControlMixin` when `editable`. |
| M9 | input-otp | **Breaks IME composition**: full-width digits are rejected mid-composition. | forms §7 | Skip filtering while composing; NFKC-normalise on `compositionend`. |
| M10 | spinner | **Empty `role="status"` live region**: usually silent, and each spinner adds a live region. | spinner | `role="progressbar"` without value, plus the label. |
| M11 | progress | **Indeterminate bar under reduced motion looks complete** (full, still); animates `inset-inline-start` (layout per frame). | spinner | Slow `translate` sweep under `reduce`; transforms only. |
| M12 | data-table | **Long tasks per interaction**: synchronous filter per keystroke over all rows (no pagination by default); select-all toggling is O(selected × visible). | break-up-long-tasks, identify-inp-causes | `Set` lookups, debounce/yield the filter, `contain: content`, recommend pagination/virtualization for large data. |
| M13 | shimmer, avatar, bubble, badge, kbd, calendar, chart | **`light-dark()` and relative colours without fallback** (Newly available): shimmer text becomes **invisible** where unsupported; others lose fills/rings. | dark-mode, contrast-color | Plain value first, override in `@supports`. |
| M14 | message-scroller | "Scroll to end" passes `behavior: "smooth"` regardless of reduced motion. | accessibility §10 | `prefersReducedMotion() ? "instant" : …`. |
| M15 | carousel | `tec-slide-change` fires for every slide passed during a smooth scroll (loop from last to first emits 4 events). | scroll-snap-state-sync | Commit on `scrollsnapchange` (fallback `scrollend`/debounce); expose the pending index separately. |
| M16 | tabs | Find-in-page can't find text in inactive panels (`display: none`). | search-hidden-content | `hidden="until-found"` + `beforematch` → select, feature-detected. |
| M17 | sidebar, app-finder | Hidden scrollbars with no scroll affordance. | scrollability-affordance-hints | Reuse `ScrollFadeController` / mask fade. |
| M18 | scroll-area | `scrollbar-color` without `::-webkit-scrollbar` fallback (Safari < 26.2); thumb ~2.4:1; no `prefers-contrast`. | customize-scrollbar-color-and-thickness, adapt-scrollbar-to-contrast-preferences | `@supports not` fallback, `prefers-contrast: more` thumb. |
| M19 | docs TOC | Highlights the wrong section (scrolling up, short last sections, nothing on load); no `aria-current`. | scrollspy | Fix the observer logic, set `aria-current`; `scroll-target-group` as enhancement. |
| M20 | docs layout | "Skip to content" lands on the 97-link sidebar (it is inside `<main>`). | accessibility | Move the sidebar out of `<main>`; one labelled `<nav>`. |
| M21 | docs command menu | No result-count announcement; "No results" `<p>` inside `role=listbox`. | accessibility §8 | Debounced polite status; listbox holds only options. |
| M22 | docs theme | Defaults to dark, ignores the system preference, toggle can't return to system. | dark-mode | System default + `matchMedia` listener; system/opposite toggle. |
| M23 | docs prefetch | Prev/next (`tec-button href`) are never prefetched (shadow `<a>`); prefetch doesn't warm the blocking modules. | improve-next-page-load-performance | Speculation rules (prerender `/docs/*` moderate), Astro prefetch as fallback. |

## Low

- **Focus traps** in native modal dialogs (`modal.ts:313`) — the guide says not to; popover and date-picker trap Tab without `aria-modal`.
- **Dialog names** rely on ARIA element reflection (Newly available) with no `aria-label` fallback (`internal/aria.ts:83`).
- **Toasts without a close button** default: pointer users can only swipe; non-expiring toasts should always get one.
- **Tree view** collapsed children use `hidden` (find-in-page can't reach them).
- **Pagination** labels switch on a viewport media query, not a container query.
- **Message scroller** toggles `scrollbar-color` on every auto-scroll (WebKit flicker).
- **Autofill** highlight is suppressed with no replacement cue (`input.styles.ts:40`).
- **Textarea** `field-sizing: content` has no `max-block-size`.
- **Composer** has no `enterkeyhint="send"` in enter mode; combobox hard-codes `autocomplete="off"`.
- **English-only messages**: "Invalid value." (`form-control.ts:392`), `date-utils.ts:225`.
- **Avatar image** has no `loading="lazy"` / `fetchpriority` pass-through.
- **`--tec-focus-ring`** is only on `:root`, so a dark island shows the light ring.
- **`tec-empty`** sets `text-wrap: balance` on the whole host (title only; `pretty` for the description).
- **`tec-icon` registered SVG** goes to `unsafeSVG`: document that it must be trusted, or sanitise.
- **Font fallbacks**: no `font-size-adjust` (library and docs); Plex Mono not preloaded on the docs.
- **Docs**: cross-document view transitions (`@view-transition`) as an enhancement; `closedby="any"` for the site modals; close the mobile menu on `pagehide` (bfcache); save the sidebar scroll on `pagehide` instead of every scroll.

## Already following the guides

Native `<dialog>.showModal()` for every modal with cancelable `cancel` handling and a layered Escape
stack; keyframe + `animateOut` popup motion with reduced-motion support; floating-ui positioning
(anchor positioning isn't widely available); tooltips and hover cards meet WCAG 1.4.13; full
menu/listbox keyboard contracts; `hidden="until-found"` + `beforematch` on disclosure panels with
an interruptible WAAPI height animation; native scroll-snap carousel; splitter keyboard support;
`content-visibility: auto` + `contain-intrinsic-size` in the message scroller; forced-colors styles
in nearly every family; `FormControlMixin` covers `setFormValue`, validity, reset/disabled/restore;
`:user-invalid`-style timing; autocomplete/inputmode/enterkeyhint pass-through;
`@internationalized/date` for calendar systems; accessible charts (keyboard, live region, data
table); cloak with a timeout fail-safe; docs theme and sidebar scroll applied before paint.
