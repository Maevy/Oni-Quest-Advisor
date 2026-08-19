# Progress & how things work

Handoff notes for picking this project back up. See `TODO.md` for outstanding work,
and `CLAUDE.md` for the authoritative architecture rules.

## Where things stand

- Live at https://oni-quest-advisor.fly.dev/
- Latest release: **v0.3.0** on branch `develop`, pushed to
  `git@github.com:Maevy/Oni-Quest-Advisor.git` (this repo's remote — note the working
  branch is `develop`, not `main`).
- Missions currently in the app (`src/lib/data/content/missions/`): Treasure Hunt,
  Clue Trail, Magic Stones, Quarter War, Snail Chase, Supply Run, Toxic Infusion,
  Open Hostilities, Awaiting Reinforcements.

## What was done in the last session (v0.3.0)

1. **Rules update — Scheme draw threshold**: Intelligence 13 now draws 2 Scheme cards
   (was 1). New brackets: ≤12 → 1 card, 13–15 → 2 cards, ≥16 → 3 cards. Updated
   `drawCountForIntelligence` in `lib/domain/scheme.ts`, tests, and docs.
2. **Game Mode select screen**: Added a new title/landing screen (`GameModeSelect.svelte`)
   as the app's entry point, shown before season select. "Solo Quest Tracker" is the
   active mode; "2 Player Tracking" and "2 Player Lobby" are shown as disabled
   "Coming Soon" placeholders for future features.
3. **Navigation flow restructured**: `game-mode` → `season-select` → `mission-select`
   → `mission-detail`. Added `selectGameMode()` and `returnToGameMode()` to the
   navigation store.
4. **Inverted button styling**: Return/Back buttons across all screens now use the
   bright inverted style (`bg-sky-300 text-slate-950 font-semibold`), matching the
   Broken Morale labels. The Random button uses the same treatment in orange
   (`bg-orange-400`).

## What was done in the previous session (v0.2.0)

1. Added nearest-edge ruler measurements for map markers (rulers now measure from the
   closest map edge, not always top-left).
2. Added a 10 VP cap on total mission score (`MAX_TOTAL_VP`), shown in the Command
   Panel.
3. Added two new missions: Open Hostilities and Awaiting Reinforcements.
4. Added `CEASEFIRE_OBJECTIVE` — automatic −4 VP red-boxed objective for ceasefire
   missions.

## What was done in earlier sessions (v0.1.0 and before)

1. Migrated 6 new Season 2 missions from pasted rulebook text into JSON (Magic
   Stones, Clue Trail, Snail Chase, Toxic Infusion, Quarter War, Supply Run).
2. Deleted 3 placeholder/dummy missions (Cinder Vault, Obelisk Strike, Twin Spires).
3. Added an "Important" callout box under Results (bullet list, amber-highlighted) —
   new optional `important?: string[]` field on the `Mission` type.
4. Added a Round Tracker: a small fixed panel on the right edge of the mission-detail
   screen with +/- buttons, tracking the current round (1-5), persisted per-mission.
5. Added a `quarters` map feature: an optional `quarters?: boolean` on `MapSpec` draws
   a grey cross splitting the deployment map into 4 quadrants (used by Quarter War).
6. Replaced `Chiohime.png`/`Rasetsu.png` with compressed versions (same filenames,
   roughly half the size) and swapped the background image to a compressed `.jpg`.
7. Set up Fly.io deployment: `Dockerfile`, `fly.toml`, `.dockerignore`, switched the
   SvelteKit adapter from `adapter-auto` to `adapter-node`.
8. Added Command Panel with VP tracking, rule popups, all six faction Scheme decks,
   and app versioning.
9. Fixed 3 real bugs surfaced while building the above:
   - Ruler distance labels overlapping when two markers share a coordinate — now
     staggered (`rulerLabelOffset` in `MissionMap.svelte`).
   - Marker name labels overlapping when two markers sit close together — added
     `labelPosition?: 'above' | 'below'` on `Marker`.
   - The Results panel silently pushed VP text completely off-screen when a result
     had a high box count (8 boxes) — restructured to stack checkboxes under the
     text instead of squeezing them side by side.

## How things work

### Architecture

`routes/` (pages, just wire data to components) → `lib/components` (UI) +
`lib/stores` (app state, Svelte 5 runes) → `lib/domain` (pure types/logic, no
Svelte/browser APIs) + `lib/data` (localStorage + static JSON loading). Each layer
has its own `CLAUDE.md` — read it before adding files there.

### Mission data

One JSON file per mission in `src/lib/data/content/missions/`, auto-loaded via
`import.meta.glob` in `lib/data/missions.ts` — dropping in a new file is enough, no
registration step. Shape (see `lib/domain/mission.ts`):

```
{
  id, season, name, description, brokenMorale, ceasefire,
  setup: [{ label, description }],
  map: { zone: { type: 'horizontal' | 'radial', rangeInches }, markers: [...], quarters?: bool },
  results: [{ id, text, vp, count }],
  important?: [string],
  questRules: [{ label, description }]
}
```

Markers (`lib/domain/map.ts`): `{ id, x, y, shape: 'star'|'box'|'triangle'|'circle'|'x',
label, color, showRuler, labelPosition?: 'above'|'below' }`. The map is a fixed
36"x36" square (`MAP_SIZE_INCHES`). `showRuler: true` draws dashed guide lines plus
inch labels for that marker; if two ruler markers share a coordinate, their labels
auto-stagger so they don't overlap. `labelPosition: 'above'` flips a marker's name
label above it instead of below, useful when two markers sit close together.

### Round tracker

`MissionProgress.currentRound` (`lib/domain/progress.ts`), an integer 1-5 clamped by
`setRound()`. Store method: `missionProgressStore.setRound()`. UI is
`RoundTracker.svelte`, `position: fixed`, rendered only inside `MissionDetail.svelte`
(the mission-detail screen). `MissionDetail`'s content wrapper reserves `pr-16` of
right padding so page content never renders underneath the fixed panel.

### Deployment

- Fly app: `oni-quest-advisor`, region `fra`, https://oni-quest-advisor.fly.dev/
- `min_machines_running = 0` in `fly.toml` — machines stop when idle and cold-start
  on the next request, so the first hit after a while can take a few seconds.
- To redeploy: `fly deploy` from the project root. Needs either `fly auth login` or
  `FLY_API_TOKEN` set in the environment (see the security TODO about where that
  token currently lives).

### Known gotcha

A commit-time content gate (from a Claude Code plugin, not part of this repo's own
config) scans staged diffs for "task residue" patterns and can false-positive on
innocuous substrings (it once blocked a commit over the word "coincidentally"
because it contains "incident"). If a commit gets blocked over clearly-unrelated
content, just reword that line — the documented bypass flag didn't work reliably.
