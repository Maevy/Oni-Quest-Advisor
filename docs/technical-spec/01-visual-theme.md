# Visual Theme

The app is used **on a phone screen during a game session**, so every rule here is
subordinate to two things: legibility in variable lighting (a table, a hall, outdoors) and
touch targets that work with cold hands. Layouts are mobile-first; desktop is a wide phone.

Tooling: Tailwind CSS 4 via `@tailwindcss/vite` plus the `@tailwindcss/forms` plugin. Prettier
sorts utility classes automatically against `src/routes/layout.css` — run `npm run format`
rather than hand-ordering classes. There is no design-token layer; the palette _is_ the
Tailwind `slate`/`sky` scale, so consistency comes from reusing the recipes below.

## Palette

Dark, cold, blueish — not neutral black. `body` is `bg-slate-950 text-slate-100`
(`layout.css`, `@layer base`).

The fixed background is the official Eldfall Chronicles key art
(`assets/OniQuestAdvisorBackgroundv3.jpg`), rendered by `+layout.svelte` as a
`fixed inset-0 -z-10 bg-cover bg-center` layer under a **horizontal gradient scrim** —
`rgba(2,6,23,0.95)` at both edges falling to `0.15` across the middle 25–75%. The scrim is
what keeps text legible over artwork; do not put content on top of it without a panel.

Surface scale (all translucent, all with `backdrop-blur`):

| Role                                 | Recipe                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel                                | `rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur`                                                                                                                                                                                                                                                                                                                                                                            |
| Dialog                               | `rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur`                                                                                                                                                                                                                                                                                                                                                                            |
| Raised popup (unit/upgrade detail)   | `rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl`                                                                                                                                                                                                                                                                                                                                                                                                  |
| Command Panel tab (hot-seat)         | `rounded-l-2xl border border-r-0 border-slate-700/60 bg-slate-900/85 p-3 backdrop-blur`                                                                                                                                                                                                                                                                                                                                                               |
| Segmented tab switcher               | container `overflow-hidden rounded-xl border border-slate-600/60 bg-slate-900/60`; tab `px-3 py-2 text-sm font-semibold`, active `bg-sky-500/20 text-sky-100`, inactive `text-slate-400`                                                                                                                                                                                                                                                              |
| View switcher with sliding spotlight | container `relative grid grid-cols-3 rounded-xl border border-slate-600/60 bg-slate-900/60 p-0.5`; overlay `absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-lg bg-sky-500/25 ring-1 ring-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.45)] transition-transform duration-300`, translated `activeIndex × 100%`; buttons above it, `relative z-10 px-2 py-2 text-sm font-semibold`, active `text-sky-100`, inactive `text-slate-400` |
| Map frame                            | `rounded-xs border border-slate-700/20 bg-slate-950/70`                                                                                                                                                                                                                                                                                                                                                                                               |

Panel headings, where a panel has one, are always
`text-sm font-semibold tracking-wide text-sky-300 uppercase`. `title` is optional: the solo score
panel omits it, because a centred hero VP number is self-evident and a heading above it was noise.

The one deliberate exception to "soft rounded edges": the map frame uses `rounded-xs` (2 px)
so the 36″ board reads as a hard-edged playing surface, and its border is dropped to `/20` so
the frame does not compete with zone colours.

## Buttons

Outlined, never solid-bright: a coloured `border-2` at `/50` over a near-black fill, with the
label in that hue's `-100`. The fill tints toward the hue on hover/active.

```
rounded-xl border-2 border-{hue}-500/50 bg-slate-900/60 px-8 py-3 text-lg font-medium
text-{hue}-100 backdrop-blur transition
enabled:hover:bg-{hue}-500/10 enabled:active:bg-{hue}-500/20
disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:text-slate-600
```

Hue carries meaning — keep it consistent:

| Hue       | Meaning                                | Examples                                                                |
| --------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `sky`     | Neutral primary / navigation           | Select Mission, Import Army, mission grid tiles, Return on most screens |
| `emerald` | Go / confirm / positive                | Start Game, Save, "Yes" confirms                                        |
| `red`     | Destructive, or leave-and-lose-context | Close Game, Delete ✕, "No" cancels, the briefing's ← Return             |
| `orange`  | Randomness, and Player 2               | Random mission, upgrade/Schemes accents                                 |
| `violet`  | The hot-seat swap mechanic             | Swap Player                                                             |

Two inverted (solid-fill) exceptions exist on purpose, both places where a _filled_ button must
be unmissable: the army builder's panel **flip tabs** (`bg-sky-300` with a bold `text-slate-950`
glyph — inverted after players missed the translucent version) and the briefing's red
`bg-red-500` **← Return**.

Small square icon buttons (steppers, round ±, dialog close) are
`h-9 w-9 rounded-lg border border-slate-600/60 bg-slate-800/80`, disabled at `opacity-30`. The
vitality menu's step buttons are the one circular exception: `h-11 w-11 rounded-full`, each
carrying a `VitalityMarker` glyph with the − or + drawn _inside_ the heart or orb, so the button
reads as the action it performs. `VitalityMarker.svelte` is the single source of the heart and orb
glyphs — the row tracks and the menu both render through it, including the depleted and overheal
states.

**Touch targets: ≥ 36 px.** The compact unit stepper was deliberately shrunk 40 → 36 px to
free ~75 px of row width for the unit name on phones; that is the floor, not a target.

### Status glyphs

`StatusGlyph.svelte` owns the fifteen State markers of the vitality menu and the Army rows —
hand-drawn 24×24 SVG, like every other glyph in the app. Off, all of them read `slate-500`; on,
each State owns a colour. Inner cut-outs (skull eyes, poison numbers, the snail's spiral) are
`slate-900`, so they read on any fill, grey included.

| Status                      | Glyph                   | Colour when on |
| --------------------------- | ----------------------- | -------------- |
| Bleeding                    | blood drop              | `red-500`      |
| Blinded                     | dashed eye              | `yellow-400`   |
| Confused                    | stars above a head      | `orange-400`   |
| Crippled                    | broken bone             | `orange-400`   |
| Crouched                    | down arrow              | `purple-300`   |
| Dead                        | skull                   | `red-500`      |
| Flying                      | angel wing              | `cyan-400`     |
| Fatigued                    | hunched stickman        | `orange-400`   |
| Immobilized                 | slashed boot            | `purple-300`   |
| Incapacitated               | head with X eyes        | `yellow-400`   |
| Panicked                    | three exclamation marks | `orange-400`   |
| Weak Poison / Strong Poison | numbered drop (1 / 2)   | `emerald-500`  |
| Slowed                      | snail                   | `purple-300`   |
| Weakened                    | shield split in half    | `slate-200`    |

## Accent systems

### Player accents (two-player modes)

Player 1 keeps the standard sky-blue accent. Player 2 is orange throughout:
`border-orange-500/40`, `text-orange-300` / `text-orange-400`. The Command Panel tab always
shows the **active** player in that player's colour, so "whose turn is it" is readable at a
glance without reading a label.

### Round accents

`components/roundAccent.ts` owns the green → red ramp as the game closes on round 5. Shared by
the Command Panels' round tracker, the Results panels' per-round rows and the `ObjectiveRoundChip`
labels, so a round always reads the same colour everywhere.

| Round         | Border               | Text               | Row background      |
| ------------- | -------------------- | ------------------ | ------------------- |
| 1             | `border-emerald-500` | `text-emerald-300` | `bg-emerald-500/10` |
| 2             | `border-lime-500`    | `text-lime-300`    | `bg-lime-500/10`    |
| 3             | `border-amber-400`   | `text-amber-300`   | `bg-amber-400/10`   |
| 4             | `border-orange-500`  | `text-orange-300`  | `bg-orange-500/10`  |
| 5             | `border-red-500`     | `text-red-300`     | `bg-red-500/10`     |
| locked / none | `border-slate-600`   | `text-slate-400`   | `bg-slate-500/10`   |

Row backgrounds sit at `/10` — faint enough not to compete with the objective text. The map is
a plain object of **literal class strings**: Tailwind only sees whole class names at build time,
so these must never be constructed by string interpolation.

### Penalty vs score

`IncrementBoxes` takes a `tone` prop, `'score' | 'penalty'`. Score boxes are sky-blue with a ✓;
penalty boxes are red. Used for the "Ceasefire broken" objective (−4 VP per breach) so a
negative-value row does not render as a positive achievement.

### The neon border

`.neon-border` (`layout.css`, `@layer components`) is a conic-gradient beam masked to the border
ring with a soft `drop-shadow`, sweeping once per `3.2s linear infinite` via the registered
`--neon-angle` custom property, plus a resting `box-shadow` halo so the button still reads as lit
between passes. It is `pointer-events: none` and **disabled under `prefers-reduced-motion:
reduce`**. It marks the mode select's **Solo Quest Tracker** in the sky accent. The Online button
carried it in emerald while online play was the new feature and lost it once it wasn't — the
treatment announces what is new, not what is important. Reserve it for one entry point at a time;
if everything glows, nothing does.

## The top bar

`ScreenHeader.svelte` is the one bar four screens share — season select, mission select, the
mission briefing and the solo tracker. Chrome: `sticky top-0 z-30` over a
`border-b border-slate-700/40 bg-slate-950/80 backdrop-blur` strip, its row centred in the same
`max-w-xl px-4` column as the page body. Left: the red inverted **← Return** — the one filled
navigation button, the treatment the briefing established. Middle: an optional `title`, rendered
as the page's `h1` (the mission select's season name; screens that title themselves below, like
the season select's hero block, pass none). Right: an `actions` snippet — plain outlined buttons
on the selects and briefing, the tracker's spotlight view switcher on the tracker.

Sticky is a harmless no-op on the two full-height screens, whose layout pins the bar already, and
is what keeps Return in reach while a long mission list scrolls. The row carries `min-h-16` so the
bar is the same height on every screen: without it the height follows the tallest control, and a
lone border-less Return sits 6 px lower than the tracker's bordered switcher. The min-height has
to clear that control _plus_ the row's `py-2.5`, because `border-box` measures it on the padded
box — an earlier `min-h-11` silently did nothing for exactly that reason.

The mode select, the hot-seat tracker, the online screens and the army builder still carry their
own constellations; see Open questions.

## Overlays, stacking and the backdrop-filter trap

| Layer                                                 | z-index |
| ----------------------------------------------------- | ------- |
| Dialogs and rule popups                               | `z-50`  |
| Command Panel tab (hot-seat, fixed to the right edge) | `z-40`  |
| Sticky top bar (`ScreenHeader`)                       | `z-30`  |

Backdrop is `bg-slate-950/70 backdrop-blur-sm` for informational popups (rule callouts, the unit
card, the upgrade picker and its detail view) and the heavier `bg-slate-950/90` for dialogs that
gate a decision (Save Army, Load Army, Confirm). Every dialog closes on outside click **and**
`Escape`.

**`Escape` runs through one shared stack**, `components/escapeKey.ts`. Each open overlay
registers a handler from an `$effect`; a single window listener dispatches to the **topmost** one
only, so nested overlays — Load Army over the builder plus its delete confirmation, a unit card
plus its rules popups — close exactly one layer per keypress. Binding `onkeydown` to the backdrop
`div` instead does not work: that div is not focusable, so the handler only fires while focus
happens to sit inside the overlay. That is how Escape came to do nothing in the army dialogs.

Outside-click is detected with `event.target === event.currentTarget` on the backdrop, **not**
with `stopPropagation` on the card — a click handler on a `role="dialog"` div trips
`a11y_click_events_have_key_events`.

**The trap:** a `fixed inset-0` overlay must render as a **sibling of `Panel`, never inside
it**. A non-`none` `backdrop-filter` makes the panel the containing block for its fixed
descendants, so the overlay would cover only that panel and every later panel would paint over
it. This was a real regression: extracting the Broken Morale / Ceasefire labels moved their
popup inside a `Panel` and the overlay silently stopped covering the screen. Hence the split
pattern — trigger component (`RuleLabels`, emits `onOpenRule`) + overlay component
(`RuleCalloutDialog`), with the parent holding the open state. See
`src/lib/components/CLAUDE.md`.

Fixed-position overlays also need **matching padding reserved** in the surrounding layout for
their collapsed state (`MissionDetailTwoPlayer` keeps the right edge clear with `pr-10` for the
Command Panel tab); the expanded panel intentionally covers content. Solo reserves nothing — its
drawer was replaced by an inline panel when the tracker became a three-view screen.

The **segmented tab switcher** (army format tabs, saved-army filter) is a single monolithic pill
whose active segment tints. The solo tracker's **view switcher** is deliberately different: three
equal buttons in a `grid-cols-3`, with a glowing **spotlight** — a one-cell-wide overlay carrying a
sky fill, ring and drop-shadow — that _slides_ under the active button via `transition-transform`,
so pressing another view moves the light rather than repainting a background. Both mark the active
tab with `aria-pressed`; the spotlight adds `motion-reduce:transition-none`.

> The grid is load-bearing: an earlier `flex` version gave the buttons unequal widths, because
> `flex-1` floors each item at its label's content width, and the spotlight's thirds math then no
> longer matched any button. `grid-cols-3` makes the cells equal by definition.

**Swiping between views** reuses the army builder's gesture contract on the tracker root:
`touch-pan-y`, a ≥ 50 px mostly-horizontal pointer move, and `pointercancel` (the browser taking
over for scrolling) cancels it. It listens to **touch and pen pointers only**. A mouse drag is a
text selection on desktop, and letting it double as a swipe makes the browser cancel the gesture
and swallow the click mid-drag — precisely how the first implementation broke. The swipe surface
carries no ARIA role on purpose (an explicit `svelte-ignore` says why): the three labelled buttons
are the accessible control, the gesture is a redundant shortcut.

`touch-pan-y` must sit on the **scrolling panes**, not only on the root. A scroll container with
the default `touch-action: auto` makes Chromium reserve horizontal gestures for itself and fire
`pointercancel`, which silently kills the swipe — the first strip implementation failed exactly
this way until the panes got the property too.

## Scrolling model

**Two screens are full-height: `ArmyBuilderView` and the solo tracker (`MissionDetail`).** Both
have an `h-dvh overflow-hidden` root with a header pinned by layout, and each of their
side-by-side panels scrolls itself (`overflow-y-auto overscroll-contain`). The tracker needs it
for exactly the reason the builder does: its three views live in one sliding strip, and a shared
document scroller would strand the player below a short view after reading a long one. Per-view
scrollers also mean each view keeps its own scroll position across a switch.

This is load-bearing, not stylistic. With `min-h-dvh` the root grows to the length of the unit
list, the panels' `min-h-0 flex-1 overflow-y-auto` lists never receive a height to scroll
within, and the **document** becomes the single scroller shared by both panels — which strands
the player far below a short panel after scrolling a long one. The layout enforces the contract
from the outside: on these two screens `+layout.svelte` locks its column to `h-dvh
overflow-hidden` and omits the footer, so the document is exactly the viewport, the pinned
header can never scroll away, and the active panel is the one and only scroller.
`overscroll-contain` on the panels still stops gestures chaining into anything else. Requires
Safari 16+.

**Every other screen scrolls the document normally**, footer included. Internal scrolling
elsewhere uses a definite height (e.g. `max-h-[85dvh]` on the unit-card and upgrade popups).

## Footer

Site-wide, in `+layout.svelte`: the fan-project disclaimer (no affiliation with FreeCompany
d.o.o.), the artwork-credit line for Freecompany d.o.o. under a free license, and the app
version. `text-[10px]`, centered. The version is `__APP_VERSION__`, injected by
`vite.config.ts` from `package.json` — bump it there for a release. It is omitted on the two
full-height screens, where an in-flow footer would put a second scroller above their pinned
headers; every other screen still ends in it.

## Accessibility

No formal target (e.g. WCAG AA) — legibility is judged by eye, against the phone-in-daylight
use case. Practical rules that follow from it: never rely on colour alone (rounds carry a
numeric label as well as a hue; penalty boxes carry a sign), keep contrast high on small text,
honour `prefers-reduced-motion`, and mark decorative glyphs `aria-hidden`.

## Open questions

- **The shared top bar covers four screens.** `ScreenHeader` now renders the season and mission
  selects, the briefing and the solo tracker. The mode select, the hot-seat tracker (a lone
  right-aligned sky "Return" pill sitting in the flow), the online screens and the army builder
  still invent their own constellations and should move onto it.
- Should the button recipes above become real shared components/classes? They are currently
  copy-pasted Tailwind strings, which is why the disabled treatment drifted between screens.
- The palette has no semantic names (`--color-danger` etc.), so "red means destructive" is
  convention, not enforcement. Worth revisiting if the button components happen.
- Faction logos (261–725 kB PNGs) and upgrade artwork (43–64 kB JPGs) are still unoptimized —
  the unit portraits were resized in v0.6.2 (~1.7 MB off the first screen) but these two were
  left as a follow-up.
