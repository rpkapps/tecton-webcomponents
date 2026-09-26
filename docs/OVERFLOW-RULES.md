# Overflow and collapse rules

How a row of controls (`tec-overflow`, `tec-toolbar`, and the rows built on them:
`tec-page-header-actions`, `tec-action-bar-actions`, an overflow row inside `tec-panel-actions`)
gives up space when its container gets narrower, and how it takes the space back. These rules are
the contract of `packages/wc/src/components/overflow/` and of every host built on it.

## 1. Vocabulary

| Term | Meaning |
| --- | --- |
| Host | The element that owns the row and decides placement (`tec-action-bar`, `tec-page-header`, …). |
| Row | The single flex line the items are laid out on (the `tec-overflow` / `tec-toolbar` element). Horizontal by default; vertical for side toolbars. |
| Item | One control wrapped in `tec-overflow-item`. Has a `value`, a `priority` and an overflow form. |
| Fixed item | A child that is not wrapped, or an item with `fixed`. It never leaves the row. |
| Elastic item | An item with `elastic`: it shrinks between `--tec-overflow-item-min` and `--tec-overflow-item-max` before anything else happens (search field, combobox). |
| Group | Items inside one `tec-overflow-group`. A group can collapse as one unit. |
| Divider | `tec-overflow-divider`. Never counted as an item. |
| Spacer | `tec-overflow-spacer`: flexible space that costs nothing. |
| More menu | The trailing More button and its menu. Present only while at least one item is hidden. |
| Reserve | Width the host keeps for content outside the row (selection summary, title, dismiss). |
| Stage | One of the ordered steps below. A row is always in exactly one stage and moves one step at a time. |

`priority` is an integer, default `0`. A higher priority stays in the row longer. Priority never
reorders anything; it only decides who leaves first.

## 2. Order of stages

The row moves down this list only when the previous stage cannot recover enough space, and back up
in reverse order when space returns.

| Stage | What gives | Who decides |
| --- | --- | --- |
| 0 | Nothing. Every item at its natural size. | Layout |
| 1 | Elastic items shrink towards their minimum. | CSS (`flex-shrink`, `min-inline-size`) |
| 2 | Labels drop on items that allow it; those items become icon-only. | Measured, in the same pass as stage 3 |
| 3 | Items move to the More menu, lowest priority first. | Measured (`ResizeObserver`) |
| 4 | The host reserve compacts (the selection summary shortens, Clear becomes an icon). | CSS container queries on the host |
| 5 | Last resort: the row wraps to a second line or scrolls inline. Never both. | `last-resort="wrap"` (default) or `"scroll"` |

Stages 2 and 3 share one measurement pass. Stages 1 and 4 are pure CSS. Because 2 and 4 change item
widths, the observer fires and stage 3 recomputes with the new numbers; that is the only coupling
between the CSS stages and the measured ones.

Stage 4 sits after 3 on purpose: the reserve tells the user what the actions apply to, and it is
better to hide a third-tier action than to turn "12 of 340 selected" into "12" while every action
is still visible.

## 3. Stage 1: elastic items

1. An elastic item has a minimum and a maximum inline size (`--tec-overflow-item-min`, default
   `12rem`; `--tec-overflow-item-max`, default `100%`).
2. Only elastic items shrink. Buttons, selects and dividers do not.
3. Several elastic items shrink proportionally (the browser's flex behaviour); no priority applies.
4. From stage 3 on, an elastic item is a normal item whose cost is its minimum, never the width it
   happens to fill. It overflows into a dialog (rule 6.6).

## 4. Stage 2: label collapse

1. Labels collapse for every item at once, as soon as the row with every item at full width no
   longer fits (`labels="auto"`, the default). `labels="always"` disables this stage;
   `labels="never"` renders icon-only from the start.
2. Labels come back only when every item, including the hidden ones, would fit again with its label.
   Each item caches two sizes, full and compact, so the decision needs no extra measurement and cannot
   oscillate.
3. Only an item with an icon can go icon-only. `label-behavior` defaults to `collapse` when the item
   has a label (`label` or a `tec-overflow-label`) and its control shows an icon (`svg`, `img`,
   `tec-icon`, `[data-icon]`), and to `keep` otherwise. `label-behavior="collapse"` on an item
   without an icon is warned about once.
4. An icon-only item keeps its label as its accessible name (the `tec-overflow-label` is visually
   hidden, not removed) and shows it as a tooltip. The item does this, not the application.
5. `label-behavior="keep"` opts one item out of this stage. Use it for destructive actions, where a
   lone icon invites mistakes, and for any action whose icon is not self-explanatory.
6. The primary action always keeps its label (it is fixed, rule 7.1).
7. Dropdown triggers keep their chevron; toggles keep their pressed styling.
8. Collapsing never changes an item's element or its focus position. It is a state change only.

## 5. Stage 3: overflow

### Which item leaves

1. Candidates are all non-fixed items in the row, including elastic items at their minimum and
   disabled items.
2. The next item to leave is the candidate with the lowest priority. On a tie, the one nearest the
   logical end of the row leaves first (rightmost in LTR, leftmost in RTL), so items disappear from
   the end inward, where the More button sits.
3. A group with `collapse="together"` leaves as one unit when its lowest-priority item would leave.
   `collapse="individually"` (the default) is transparent to this rule.
4. The row keeps overflowing until the remaining items, the dividers still showing and the More
   button all fit. If nothing else can leave and it still does not fit, the row enters stage 4, then 5.
5. `minimum-visible` (default `0`) keeps at least that many candidates in the row regardless of
   width. Use it sparingly; it forces stage 5.

### Width accounting

6. Each child's size is measured by the row's `ResizeObserver` and cached. An item is measured again
   only when its own box resizes while visible (its label collapsed, its text changed).
7. Hidden items are `display: none`. They are not measured while hidden; their cached size decides
   whether they can come back.
8. Gaps count: the row's gap is added per visible child. So do a child's inline margins. A fixed
   child outside the flex flow (`display: none`, absolutely or fixed positioned) costs nothing.
9. The More button's size is reserved as soon as one item is hidden and released only when the last
   hidden item returns.
10. Dividers are measured like items but never counted as candidates.

### Coming back

11. Every pass recomputes the hidden set from scratch out of the cached sizes, so an item returns
    exactly when its cached size plus its gap fits with the More button still reserved, or when it is
    the last hidden item and the button's size counts as freed.
12. Items return in the reverse order they left: highest priority first, on a tie the one nearest
    the logical start.
13. Returning is decided in the same pass as leaving. There is never a frame where the row has both
    hidden an item and shown another for the same width.

### Groups and dividers

14. A divider is visible only while something visible remains on both sides of it (a spacer does not
    count; the More button counts for the trailing side). A spacer follows the same rule.
15. Two dividers never show next to each other. When the items between dividers have all left, only
    the last of them stays, beside the items after it.
16. A group is a `group` with its `label` as accessible name while its members are visible, and
    passes the label to the menu section that holds them when they are hidden.

### Deferral

17. An item whose own popup is open (an element inside it with `aria-expanded="true"` or `open`) is
    not hidden while it is open. The next lower-priority candidate leaves instead.
18. An item that holds focus is hidden like any other, and focus moves to the More button (not into
    the menu: opening a menu on resize is disruptive).
19. An elastic item with a value is hidden like any other; the value stays in the field, which the
    overflow dialog shows (rule 6.6).

## 6. Overflow forms

Every non-fixed item has a form in the More menu, derived from the control it wraps. Source order is
preserved; the menu never sorts by priority. `menu-type` forces a form; the `menuForm` property
replaces it with any entries.

| Control | Overflow form (`menu-type`) | Acts by |
| --- | --- | --- |
| Button, link | Menu item (`item`) with icon, label and shortcut | clicking the control |
| Destructive button | Destructive menu item | clicking the control (keeps its source position) |
| Toggle (`aria-pressed`, `tec-toggle`, checkbox, switch) | Checkbox item (`checkbox`); `radio` for exclusive tools | clicking the control |
| Tabs, toggle group, radio group | Labelled section of radio items, or checkbox items for a multiple toggle group (`section`) | clicking the original tab or option |
| Dropdown menu | Submenu with the same items (`submenu`) | clicking the original menu item |
| Select | Submenu of radio items (`submenu`) | setting the select's value and firing `input` / `change` |
| Text field, combobox, date picker | Menu item that opens a dialog holding the same field (`dialog`) | the field itself |
| Divider | Separator between the hidden items on either side of it | |
| Group | Section headed by the group's `label` | |
| Anything else | `menuForm` entries | the entry's `onSelect` |

6.1. `fixed` keeps an item in the row; it must fit in the reserve (rule 7).

6.2. A disabled control gives a disabled menu entry.

6.3. `shortcut` on the item is shown in its menu entry.

6.4. Every derived form acts through the row control, so the handlers the application attached to it
run in both forms. The overflow form never introduces a second code path. Items whose form is a menu
item also fire `tec-select` from both forms.

6.5. A submenu is one level deep; a dropdown's own submenus are left out. There is never a third level.

6.6. The dialog form moves the field (the same element, with its value and validation) into a modal
dialog titled with the item's label. Enter or Escape closes it, and focus returns to the More button.

6.7. Nothing exists only in the menu. Every entry corresponds to an item that is in the row at some
width. For secondary actions that should always live in a menu, put a dropdown menu in the row.

6.8. The More button is an icon button named `menu-label` ("More actions") with `aria-haspopup="menu"`,
and a count badge only with `overflow-badge`. The badge is `aria-hidden`: the menu lists the items it
counts. The button sits at the logical end of the row, after any fixed trailing item. A custom button
goes in `slot="menu-trigger"`.

## 7. Fixed items and the host reserve

7.1. The primary action of a host is fixed (not wrapped) and keeps its label. At most one per row.

7.2. Dismiss, Clear selection and the More button are fixed.

7.3. The host reserve is not part of the row's measurement. The row receives the remaining space
through normal flex layout and measures only itself.

7.4. Fixed items plus the More button define the row's minimum inline size, which the row writes as
its `min-inline-size` so a flex parent cannot squeeze it below. A host that can be narrower than
that relies on the last resort.

7.5. A host may promote an item to primary by markup (leaving it unwrapped), never by measurement.

## 8. Stage 4: reserve compaction

Host specific, container-query driven, three steps at most:

| Host | Full | Medium (below 32rem) | Compact (below 24rem) |
| --- | --- | --- | --- |
| `tec-action-bar-selection` | "12 of 340 selected · Clear" | "12 selected · Clear" | count badge + X button |

The count is announced through a polite live region that does not compact, so the spoken text stays
"12 of 340 selected" at every width.

## 9. Stage 5: last resort

9.1. `last-resort="wrap"` lets the row wrap. The More menu still appears first; wrapping starts only
when fixed items alone do not fit.

9.2. `last-resort="scroll"` clips the row and scrolls it inline, with the More button stuck to the end.

9.3. Reaching stage 5 is logged once per row (`console.warn` with the space needed and the space
available). It means the host was given too many fixed items for its container, or a
`minimum-visible` it cannot honour.

## 10. Orientation

10.1. A vertical row applies every rule on block size. With `labels="auto"` a column never collapses
labels (dropping one narrows an item but does not shorten it); `labels="never"` still renders
icon-only. A column never wraps; its last resort is to scroll.

10.2. The logical end of a vertical row is its bottom: items leave from the bottom and the More
button sits at the bottom.

10.3. The More menu of a vertical row opens to the inline end.

## 11. Direction

All positions are logical. "End" is right in LTR and left in RTL, from the row's computed direction.
Nothing uses `left` or `right`.

## 12. Focus and keyboard

12.1. A `tec-toolbar` is one tab stop. Arrow keys move between visible controls in visual order and
skip hidden ones; the More button is the last stop; Home and End go to the first and last. Arrow keys
inside a text field move the caret.

12.2. A `tec-overflow` (no toolbar semantics) leaves tabbing to the browser; hidden items are
`display: none` and so unreachable.

12.3. When a focused item is hidden, focus moves to the More button in the same task, before paint.
When a hidden item returns while the button has focus, focus stays on it (unless it is the last one,
12.4).

12.4. The More menu closes when its last item returns to the row, and focus goes to that item if the
button or the menu had it.

12.5. The menu follows the WAI-ARIA menu button pattern: Enter, Space or ArrowDown on the button
open it on the first item, ArrowUp on the last; arrows, Home, End and typeahead move; Enter or Space
activate; ArrowRight (ArrowLeft in RTL) opens a submenu and ArrowLeft closes it; Escape closes the
top-most menu; Tab closes the menu.

## 13. State preservation

13.1. Hidden items stay in the DOM. Their state, listeners and field values survive a resize.

13.2. Visibility uses `display: none` and the `overflowing` custom state. Style it for debugging, but
never rely on it for behaviour.

## 14. Rendering cost

14.1. One `ResizeObserver` per row observes a zero-height sizer (the row's available inline size)
and each direct child. Never `window.resize`. A `MutationObserver` on the row's (and its groups')
child list picks up children that come and go.

14.2. Sizes are cached per element. A pass is one walk over the cache in priority order with no layout
reads; when a pass reveals a state that was never measured (the first collapse), the new sizes are
read once, together, and the pass runs again before paint.

14.3. A pass that computes the same visible set as before writes nothing and notifies nobody.

14.4. A pass started by the row's own size runs inside the observer callback, before paint. A pass
started by children alone runs on the next frame, so the row never writes at an observer depth that
was already delivered (no "ResizeObserver loop" errors).

14.5. First paint: every item renders visible with its label, the first observation measures
everything and collapses what does not fit before the first paint. There is no flash of overflow.

14.6. No transition on hide or show. Items appear and disappear in one frame; only the host's own
enter transition (the action bar) animates.

## 15. One row per host

A host has one overflow row, never two side by side: two rows in one flex line cannot both measure a
stable width. The page header therefore puts section tabs and actions in the same row, with a
`tec-overflow-spacer` between them, and lets priorities decide.

15.1. Section tabs are one item and collapse all at once into a single-selection section of the More
menu, never one tab at a time: hiding single tabs breaks arrow-key navigation and can hide the
selected tab.

15.2. A row that contains a tab list is a `tec-overflow`, not a `tec-toolbar`, so the two do not
compete for the arrow keys.

15.3. A spacer leaves once nothing visible remains on one side of it, so a collapsed row is never
pushed to the far end by an empty spacer.

## 16. What never happens

- Items are never reordered by collapsing.
- An item is never hidden without being reachable from the More menu.
- There is never more than one More menu per row, and never a nested one.
- Nothing collapses on hover, focus or the open state of a menu. Only container size drives collapsing.
- Priority never affects visual order or menu order.
- A fixed item is never hidden, even in stage 5.
- The overflow form never gains capabilities the row form lacks, and never loses an action the row
  form has.
