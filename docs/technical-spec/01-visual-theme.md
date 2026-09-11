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

| Role                               | Recipe                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Panel                              | `rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur`              |
| Dialog                             | `rounded-2xl border border-slate-700/50 bg-slate-800/80 p-5 backdrop-blur`              |
| Raised popup (unit/upgrade detail) | `rounded-2xl border-2 bg-slate-900/95 p-4 shadow-xl`                                    |
| Command Panel tab                  | `rounded-l-2xl border border-r-0 border-slate-700/60 bg-slate-900/85 p-3 backdrop-blur` |
| Map frame                          | `rounded-xs border border-slate-700/20 bg-slate-950/70`                                 |

Panel headings are always
`text-sm font-semibold tracking-wide text-sky-300 uppercase`.

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
`h-9 w-9 rounded-lg border border-slate-600/60 bg-slate-800/80`, disabled at `opacity-30`.

**Touch targets: ≥ 36 px.** The compact unit stepper was deliberately shrunk 40 → 36 px to
free ~75 px of row width for the unit name on phones; that is the floor, not a target.

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

The headline feature — "Online 2 Player Game" on the mode select — carries `.neon-border`
(`layout.css`, `@layer components`): a conic-gradient beam (`#6ee7b7` → `#ecfdf5`) masked to the
border ring with a soft `drop-shadow`, sweeping once per `3.2s linear infinite` via the
registered `--neon-angle` custom property. It is `pointer-events: none` and **disabled under
`prefers-reduced-motion: reduce`**. Reserve this treatment for the single entry point it marks;
if everything glows, nothing does.

## Overlays, stacking and the backdrop-filter trap

| Layer                                       | z-index |
| ------------------------------------------- | ------- |
| Dialogs and rule popups                     | `z-50`  |
| Command Panel tab (fixed to the right edge) | `z-40`  |
| Mission briefing sticky header              | `z-30`  |

Backdrop is the app-standard `bg-slate-950/70 backdrop-blur-sm`. Every dialog closes on
outside click **and** `Escape`.

**The trap:** a `fixed inset-0` overlay must render as a **sibling of `Panel`, never inside
it**. A non-`none` `backdrop-filter` makes the panel the containing block for its fixed
descendants, so the overlay would cover only that panel and every later panel would paint over
it. This was a real regression: extracting the Broken Morale / Ceasefire labels moved their
popup inside a `Panel` and the overlay silently stopped covering the screen. Hence the split
pattern — trigger component (`RuleLabels`, emits `onOpenRule`) + overlay component
(`RuleCalloutDialog`), with the parent holding the open state. See
`src/lib/components/CLAUDE.md`.

Fixed-position overlays also need **matching padding reserved** in the surrounding layout for
their collapsed state (`MissionDetail` keeps the right edge clear for the Command Panel tab);
the expanded panel intentionally covers content.

## Scrolling model

**One screen is full-height: `ArmyBuilderView`.** Its root is `h-dvh overflow-hidden` with a
pinned header, and each of the two sliding panels scrolls itself
(`overflow-y-auto overscroll-contain`).

This is load-bearing, not stylistic. With `min-h-dvh` the root grows to the length of the unit
list, the panels' `min-h-0 flex-1 overflow-y-auto` lists never receive a height to scroll
within, and the **document** becomes the single scroller shared by both panels — which strands
the player far below a short panel after scrolling a long one. `overscroll-contain` is still
needed on top of the definite height, because the document remains `100dvh + footer` tall
(`+layout.svelte` stacks `flex-1` content and the footer in a `min-h-dvh` column), so gestures
would otherwise chain into the page. Requires Safari 16+.

**Every other screen scrolls the document normally.** Internal scrolling elsewhere uses a
definite height (e.g. `max-h-[85dvh]` on the unit-card and upgrade popups). Dragging on the
builder's header or card padding still reaches ~90 px of document scroll — that is what keeps
the footer (artwork credit + version) reachable on that screen.

## Footer

Site-wide, in `+layout.svelte`: the fan-project disclaimer (no affiliation with FreeCompany
d.o.o.), the artwork-credit line for Freecompany d.o.o. under a free license, and the app
version. `text-[10px]`, centered. The version is `__APP_VERSION__`, injected by
`vite.config.ts` from `package.json` — bump it there for a release.

## Accessibility

No formal target (e.g. WCAG AA) — legibility is judged by eye, against the phone-in-daylight
use case. Practical rules that follow from it: never rely on colour alone (rounds carry a
numeric label as well as a hue; penalty boxes carry a sign), keep contrast high on small text,
honour `prefers-reduced-motion`, and mark decorative glyphs `aria-hidden`.

## Open questions

- **No shared header component.** Every screen currently invents its own header
  constellation: the briefing has a sticky 3-button bar, `MissionDetail` a lone right-aligned
  sky "Return" pill sitting in the flow, and the mode/season/mission selects, online screens and
  army builder each place and colour their buttons differently again. One shared header (title
  slot + left/right action slots, consistent button treatments, a decision on sticky vs in-flow)
  should replace all of them — this is the largest remaining inconsistency in the visual layer.
- Should the button recipes above become real shared components/classes? They are currently
  copy-pasted Tailwind strings, which is why the disabled treatment drifted between screens.
- The palette has no semantic names (`--color-danger` etc.), so "red means destructive" is
  convention, not enforcement. Worth revisiting if the button components happen.
- Faction logos (261–725 kB PNGs) and upgrade artwork (43–64 kB JPGs) are still unoptimized —
  the unit portraits were resized in v0.6.2 (~1.7 MB off the first screen) but these two were
  left as a follow-up.
