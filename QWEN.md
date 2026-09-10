# Oni Quest Advisor

Companion web app for the Oni Quest tabletop game. Built to run as an installable app
on any phone (Android/iOS/other) via the browser — a web app, not a
native/platform-specific one. Used on a phone screen during a game session.

## Stack

- SvelteKit (Svelte 5, runes — runes mode is force-enabled project-wide in
  `vite.config.ts`) + TypeScript (strict)
- Tailwind CSS 4 (`@tailwindcss/vite`, forms plugin); Prettier sorts Tailwind classes
  automatically against `src/routes/layout.css`
- Vitest for unit tests (node environment, no browser)
- No backend: runs entirely client-side. Game data ships as static JSON bundled with
  the app; session state persists via `localStorage`.
- Deploys to Fly.io: `@sveltejs/adapter-node` builds a standalone Node server
  (`build/index.js`), packaged by the root `Dockerfile` and configured via `fly.toml`.

## Domain model

- **Season** → top-level grouping of missions (e.g. "Season 1", "Season 2"). Old
  seasons stay selectable even when outdated.
- **Mission** → belongs to exactly one season. Has a name, lore description, setup
  items, a map (`MapSpec`: deployment zones + objective markers on a 36" board,
  optional `quarters` center cross, per-marker `labelPosition`), Results (scoreable
  objectives with VP and a scoreable-instance `count`), optional `important` callouts
  (rules notes shown alongside Results — not scored), and quest rules (prose sections).
  Ceasefire missions additionally get the automatic red-boxed "Ceasefire broken"
  objective (`CEASEFIRE_OBJECTIVE`, added by `getScoreableResults`): −4 VP per
  breach, scoreable 3 times, rendered as red boxes. Their own Results carry **no
  Round-1 objectives** — the ceasefire forbids VP in round 1 (guarded by
  `data/missions.spec.ts`).
  Marker rulers (`showRuler`) are measured from the **nearest** map edge
  (`rulerAnchor`) — always the shortest path a player would actually measure (≤ 18",
  one of the 4 corner combinations); never revert to measuring from top-left.
- **Faction** → a player-selectable side with its own 20-card Scheme deck; cards can
  be shared across several factions' decks. A `common` pool for cards in every
  faction's deck exists too (`COMMON_FACTION_ID`).
- **Scheme** → secret objective card drawn from a faction's deck (+ common pool).
  Draw count depends on intelligence: ≤12 → 1, 13–15 → 2, ≥16 → 3. Cards have
  `factionIds` (whose decks contain the card), `copies` (physical copies — a uniform
  number or per-faction overrides, e.g. Virtuous Commander: 4 Helian / 2 elsewhere;
  Stand Your Ground: 4 Sand / 2 elsewhere), `maxIncrements` (checkboxes), and either
  a uniform `vpPerIncrement` or per-box `incrementVp` values (e.g. Martial Valor:
  2 VP, then 1 VP).
- **Faction roster (as of v0.1.0)** → six factions, each deck exactly 20 physical
  cards drawn from 27 unique cards: Helian League, Empire of Soga, Coalition of
  Thenion, Sand Kingdoms, Monster Factions, Adventurers' Guild (no exclusive cards —
  its whole deck is shared). Card data: `data/content/schemes/shared.json` holds
  every card in 2+ decks, one `schemes/<faction>.json` per faction's exclusives —
  a card moves into `shared.json` as soon as a second deck gets it. Rulebook wording
  "X VP (to a maximum of Y)" with multiple boxes ⇒ `incrementVp` (e.g. `[2, 1]`),
  never a flat `vpPerIncrement` that would overshoot the cap.
- **Army Builder** → separate top-level feature (own screens, in-memory only): pick one
  of 7 factions (their RAL color as border/text + logo) and build a list under a
  format cap (Standard 85 / Tournament 125). Every copy of a unit is its own
  `ArmyEntry` (own id, independently mountable/removable). Unit content is
  imported from the producer's export: `scripts/importUnits.mjs` reads
  `data-import/units.json` and writes `content/units/<faction>.json` +
  `neutral.json` + `mounts.json` plus the centralized catalogs
  `classes.json` / `skills.json` / `traits.json` / `combat-arts.json` /
  `spellcrafts.json` (`ArmyRulesSpec`, leveled texts in a `levels` map),
  `spells.json`, `stratagems.json`, `items.json` (RCH parsed into structured
  range brackets) and `upgrades.json` (cost, per-army limit, faction, curated
  effects in the import's `UPGRADE_EFFECTS` table, requirements parsed from
  the descriptions: class, forbidden trait, size ceiling) — re-run on every
  producer update and review the diff.
  Units carry points, a copy `limit`, an 11-key statline (`STA`…`M`, null when
  a model has no value), a required `size` on the ordered `ArmyUnitSize`
  ladder (`small`…`epic` — sizes are compared by rank because every size rule
  is a ceiling or a "two Sizes larger" test, and the import **throws** on an
  unknown label since content JSON is loaded behind a type assertion), an
  optional portrait, catalog refs (class ids,
  `{ id, level }` skill/trait/combat-art/spellcraft refs; trait refs add
  `dynamicValue`/`dynamicElements` that fill `(X)`/`(Element)` templates at
  display time), stratagem ids, `inventorySpace` + inventory `{ id, qty }`
  slots, and optionally `upgradesLocked` (rulebook exceptions: Tomoe, Kogetsu,
  Seigen, Tharos, Anari, Na'ra, Chiyohime, Chanra). The unit card renders the
  rules refs as clickable tags (panels ordered Skills → Traits → Combat Arts →
  Spellcrafts, divider, then Inventory, Stratagems) opening stacked popups —
  leveled ones list every level white up to the unit's level and greyed beyond
  (roman suffixes); spellcraft popups show element-grouped spell cards with
  PW/STK resolved against the unit's stats; inventories and stratagems render
  inline (stat-box grid / type-grouped cards), upgrade effects applied via
  `upgradedArmyUnit`. **Upgrades (standard format)**: per-copy picks through a
  picker overlay with artwork and gating reasons; slots = 1 + Resourceful
  level + Pouch count; faction access (four main factions own + neutral;
  oni/goblin/guild neutral-only); effects automate stat boosts (incl.
  `insteadIfTrait`/`extraIfClasses` conditionals), grants, items, primary
  weapon replacement, stratagems, `costReduction` (Devotion: Paimon discounts
  every other upgrade army-wide by 1, min 1), spellcraft level-ups
  (`spellcraftLevelCap` from the affinity-filtered spell catalog + a choice
  step when several schools can advance) and `choice` upgrades —
  Glyphscribe: Reduce Weight (inscribe an item: STK +1/WGT −1 via per-row
  item overrides, or +1 AG/SPD/+1 space), Elemental Lineage (`grantTrait`
  option: pick 1 of 4 Affinities, merged into the unit's affinity trait ref)
  and Mana Catalyst (`replaceAffinity` option: swap one Affinity element for
  Fire/Water/Earth/Air — a single element auto-resolves, several open a
  second picker step); selections persist on the entry
  (`spellcraftChoices`, `upgradeChoices`). **Roster format** (125 pts):
  units keep mounts but carry no upgrades — the faction's upgrade catalog
  becomes a separate equipment pool (`rosterPicks`, steppers with per-army
  `limit` caps, costs count toward the cap; `addRosterPick`/`removeRosterPick`/
  `rosterPickPoints` in domain). Switching Standard↔Roster with a non-empty
  list asks for confirmation and clears it. Army codes carry the pool in an
  optional picks section (tournament only); saves carry a `format` field
  (absent on old saves = standard) and the Load Army dialog filters by it.
  Upgrade artwork lives in `assets/upgrades/<Faction>/`,
  matched by normalized filename + `UPGRADE_ICON_ALIASES`.
  NEUTRAL-tagged units are available to every faction except the monster ones
  (`NON_NEUTRAL_FACTION_IDS`); mounts are never recruitable standalone — a
  rider's `mount` adds the mount's cost when toggled, mount `stats` override
  the rider's (non-null only), `statChanges` add on top and a mounted model
  counts as the **mount's size** (`mount.size` via `effectiveUnitSize`) —
  because mounting can invalidate a size-capped pick, `mountToggleConflicts`
  lists what the toggle would drop and the page confirms before `toggleMount`
  removes it. **Army codes**
  (`domain/armyCode.ts`): a whole list (faction, format, copies, mounts,
  upgrades incl. all selections) serializes to a short share code — base36
  indexes into the sorted content catalogs behind a version char + FNV-1a
  roster fingerprint, so codes from a different roster are rejected loudly
  instead of decoding wrong units. `armyBuilderStore.importArmy` replays
  every pick through the domain guards (an import can never be invalid) and
  opens the builder on the Your-Army panel; export is the "Copy Army Code"
  button in the builder header (clipboard API; when the clipboard is
  unavailable the code is shown inline for manual copying). **Saved armies**:
  the builder's "Save Army" button opens a name dialog and stores
  `{ id, name, factionId, code, createdAt }` under
  `oni-quest-advisor:saved-armies` — the code carries the whole list, so a
  save is only metadata plus code (and shares the fingerprint check: saves
  from before a roster update refuse to load instead of decoding wrong).
  "Load Army" on the faction select lists them grouped by faction, newest
  first (`groupSavedArmies`), replays the stored code through `importArmy`,
  and deletes them via a per-row ✕ behind a Yes/No confirmation.
- **GameMode** → `'solo' | 'two-player'`, set by `GameModeSelect` and tracked in
  `navigationStore.gameMode`. Solo is the original single-player tracker; two-player
  is a hot-seat mode where both players share one device. The third
  **"Online 2 Player Game"** button opens the server-backed online flow — its own
  screens (`online-create`/`online-join`/`online-game`), not part of `GameMode`.
- **MissionProgress** (solo) → per-mission play state: checked objective counts, the
  chosen Scheme, a `schemeDraft` (faction/intelligence) that survives resets, and
  `currentRound` (tracked manually by the players, clamped to `MIN_ROUND`..`MAX_ROUND`
  = 1–5). Total VP = checked Results VP + checked Scheme increments, capped at
  `MAX_TOTAL_VP` = 10 (a player cannot earn more per mission); the Command Panel
  shows the total against that cap.
- **TwoPlayerMissionProgress** → 2-player equivalent: per-player `PlayerProgress`
  (checked objectives, scheme, schemeDraft, `schemeRevealed` flag) for `player1` and
  `player2`, plus a shared `currentRound`. Objectives are independently tracked per
  player; both can toggle freely. Schemes are gated by `activePlayer` — only the
  active player sees/interacts with their scheme; the other sees "Hidden" (chosen but
  unrevealed) or "No schemes" (not yet chosen). "Reveal" is permanent. The "Swap
  Player" button (in the Command Panel) triggers a 6-second countdown overlay, then
  flips `activePlayer`. The Command Panel tab always shows the active player (P1
  sky-blue / P2 orange). Per-player VP is calculated independently via
  `calculateTwoPlayerVP`; each is capped at `MAX_TOTAL_VP`.
- **OnlineGameState** (online 2-player, server-authoritative; `domain/online.ts`) →
  statuses `lobby`/`active`/`finished`/`closed`; two seats (nickname, seat-token
  hash, a `PlayerProgress`, `revealIntent`, private `drawnSchemeIds`); `pendingJoin`;
  season/mission; round × phase (`reveal`/`scoring`); round VP snapshots; winner.
  Scheme boxes are scoreable **only once revealed** (hidden schemes earn no scheme
  VP); `finishGame` auto-reveals everything and writes a `resultSummary` (winner,
  final VP, factions, mission) onto the state for later statistics export.
  Pure transition functions with `can*` guards plus the per-seat visibility filter
  (`viewForSeat` — the opponent's unrevealed scheme never leaves the server). The
  full player journey and phase model live in `MULTIPLAYER_PLAN.md` (local-only).

## Architecture

Layered structure. Dependencies only point downward — never sideways, never up.

```
src/
  routes/          → presentation: the page(s), just wire stores to components
                      (+ api/games/** endpoints for online mode)
  lib/
    components/    → presentation: reusable UI pieces (props in, callbacks out)
    stores/        → application/state layer (class-based singletons)
    server/        → server-only: SQLite persistence, SSE, auth, rate limiting
                      (online mode)
    domain/         → domain: types + pure logic functions (shared client/server)
    data/            → infrastructure: content loading + localStorage/API wrappers
```

Rule of thumb: **routes → components/stores → domain/data**; for the online API:
**routes/api → server → domain**. `server` never imports stores/components.

- `domain` never imports from `stores`, `data`, or Svelte; no `window`/`document`,
  no `Math.random()`/`Date.now()` — randomness/time are injected (`Rng` parameter)
  so every function is pure and unit-testable.
- `data` never contains business logic. Static content is loaded eagerly via
  `import.meta.glob` from `src/lib/data/content/{missions,factions,schemes}/*.json`
  (all bundled missions currently belong to Season 2); unit content (incl.
  mounts) is generated by `scripts/importUnits.mjs` from the producer dump in
  `data-import/`; progress persists to
  `localStorage` under the `oni-quest-advisor:mission-progress:` prefix (solo) and
  `oni-quest-advisor:2p-progress:` prefix (two-player), keyed by mission ID. Online
  mode adds the remote seam: `onlineApi.ts` (fetch wrapper for `/api/games/...`) and
  `onlineSession.ts` (seat session under `oni-quest-advisor:online-session`), plus
  `notices.ts` (one-time acknowledgements for the privacy notice and the online
  intro, under `oni-quest-advisor:notice:`).
- `stores` are classes in `.svelte.ts` files (`armyBuilderStore`, `contentStore`, `navigationStore`,
  `missionProgressStore`, `twoPlayerProgressStore`, `onlineGameStore`), exported as
  singletons from `stores/index.ts`. They orchestrate — decisions live in `domain`,
  side effects in `data` — and expose purposeful methods (`selectSeason()`,
  `rollRandomMission()`, `drawSchemes()`, `setRound()`, `swapPlayer()`,
  `revealScheme()`, ...), not raw mutable state. `onlineGameStore` is
  server-driven: it sends intents to the API and refetches the visibility-filtered
  game view (SSE change notifications trigger refetches) — it never mutates game
  state locally. Persisted progress is loaded by merging it onto
  `domain.createEmptyProgress()` / `domain.createEmptyTwoPlayerProgress()`, so fields
  added later get their defaults — keep this pattern when extending either progress
  type. `navigationStore` tracks `gameMode`, routes `selectMission()` to the correct
  progress store, and gates the one-time notices (privacy banner on first visit,
  online intro before first entering the online mode).
- `routes` (`+page.svelte`) switches screens on `navigationStore.screen` and wires
  store state/methods to component props/callbacks: the local flow
  (`game-mode` → `season-select` → `mission-select` → `mission-detail`, rendering
  `MissionDetail` or `MissionDetailTwoPlayer` by `navigationStore.gameMode`; army builder is `army-faction-select` \u2192
  `army-builder`) plus the online screens (`online-create` → `online-join` → `online-game`). It also resumes a
  stored online seat on mount. `api/games/**/+server.ts` are the online-mode
  endpoints (thin handlers over `lib/server`), `api/health/` is the
  unauthenticated ops probe, and `join/[code]/` is the invite-link entry point.
  No business logic, no direct `fetch`/`localStorage`, no new type definitions.
  Cross-cutting API concerns (body cap, rate limits, request logging) live in
  `src/hooks.server.ts`. `+layout.svelte` renders the fixed background (official
  Eldfall Chronicles key art), the site-wide footer (fan-project disclaimer +
  artwork credit for Freecompany d.o.o. + app version — `__APP_VERSION__`, injected
  by `vite.config.ts` from `package.json`; bump the version there for releases) and
  the one-time `PrivacyNotice`.
- `components` are presentational: `$props()` in, callbacks up. Avoid importing
  stores directly — the page wires them. Domain _types_ are fine for prop typing,
  domain _logic_ is not. Fixed-position overlays (e.g. the `CommandPanel` tab pinned
  to the right edge) need matching padding reserved in the page layout for their
  collapsed state; expanded overlays intentionally sit on top of content. 2-player
  mode has dedicated component variants (`ResultsPanelTwoPlayer`,
  `SchemesPanelTwoPlayer`, `CommandPanelTwoPlayer`, `MissionDetailTwoPlayer`) plus a
  `CountdownOverlay` for the swap transition; they reuse shared panels
  (`DescriptionPanel`, `SetupPanel`, `MissionMap`, `QuestRulesPanel`, `Panel`,
  `IncrementBoxes`) unchanged. Online mode has its own set (`OnlineCreate`,
  `OnlineJoin`, `OnlineLobby`, `OnlineGameView`, `OnlineStats`, `OnlineSchemeSetup`,
  `OnlineMissionView`, `OnlineResultsPanel`, `OnlineSchemesPanel`, `ConfirmDialog`,
  plus the one-time `OnlineIntroNotice` shown before first entry), also reusing the
  shared panels (collapsible there via `Panel`'s `collapsible` prop). The army
  builder adds `ArmyFactionSelect`, `ArmyBuilderView` (sliding panels, swipe,
  mount toggles) and the `UnitCard` statline popup. `ArmyBuilderView` is the
  app's only **full-height screen**: an `h-dvh overflow-hidden` root with a
  pinned header and per-panel `overflow-y-auto overscroll-contain` lists. Going
  back to `min-h-dvh` lets the root grow to the length of the unit list, which
  makes the document the one scroller shared by both panels and strands the
  player far below a short panel after scrolling a long one; every other screen
  scrolls the document normally.

Each layer folder has its own `CLAUDE.md` with the specific rules for that layer —
read it before adding files there.

## Conventions

- TypeScript strict, no `any`. Domain types in `lib/domain` are the single source of
  truth — don't redefine
  `Mission`/`SchemeCard`/`MissionProgress`/`TwoPlayerMissionProgress`/`PlayerProgress`
  shapes elsewhere.
- Svelte 5 runes only (`$state`, `$derived`, `$props`) — no legacy
  `writable`/`export let` style.
- Mobile-first, touch-friendly layouts, large touch targets. Visual theme: dark,
  cold, blueish; outlined buttons; translucent "frosted glass" panels (see
  `docs/technical-spec/01-visual-theme.md`). In 2-player mode, Player 1 uses the
  standard sky-blue accent and Player 2 uses orange (`border-orange-500/40`,
  `text-orange-300`/`text-orange-400`). The online-mode entry button carries a
  rotating neon border (`.neon-border` utility in `layout.css`, reduced-motion
  aware).
- Prefer pure functions in `domain` over logic in components/stores/routes. Game
  rules (draw counts, clamping, VP math, unique draws) belong there, covered by a
  colocated `*.spec.ts`.
- Formatting is Prettier: tabs, single quotes, no trailing commas, print width 100.
  Run `npm run format` rather than hand-formatting.
- Repo files are committed with LF endings (Prettier enforces LF). `.gitattributes`
  (`* text=auto eol=lf`, `*.png`/`*.jpg` binary) pins LF checkouts on every machine,
  so `core.autocrlf=true` on Windows no longer produces phantom `git status` noise.

## Commands

- `npm run dev` — dev server (http://localhost:5173) · `npm run build` /
  `npm run preview`
- `npm run check` — svelte-kit sync + svelte-check (type check, strict)
- `npm run lint` — prettier --check + eslint · `npm run format` — prettier --write
- `npm run test` — vitest run (tests: `src/**/*.{test,spec}.ts` — `lib/domain`,
  `lib/server`, plus a mission-content spec in `lib/data`)

After code changes, verify with `npm run check`, `npm run lint`, and `npm run test`.

## Git & releases

- Day-to-day work happens on **`develop`** (remote: GitHub `Maevy/Oni-Quest-Advisor`).
  Releases fast-forward merge `develop` into `main`, tag **`vX.Y.Z`** (annotated),
  and push branch + tag. Current release: **v0.6.4** — v0.6.2 finished the army
  builder (saved armies with the Save Army name dialog and the Load Army list
  with delete and Standard/Roster filter, the Roster format at 125 pts with a
  separate equipment pool and a guarded format switch, format-aware codes and
  saves, lazy-loaded army content, resized first-screen portraits and the
  phone-polish round), v0.6.3 migrated model size (`size_info` → a required,
  ordered `ArmyUnitSize`; Flying Carpet's "Medium or smaller" ceiling automated;
  a mounted model counts as its mount's size, with a confirmation before an
  invalidated upgrade is dropped) and fixed the builder's panel scrolling, and
  v0.6.4 is a scoring hotfix: "Ceasefire broken" is scoreable three times at
  −4 VP each (red boxes) and the ceasefire missions no longer offer Round-1 VP.
  Deployed to Fly.io.
- **Online mode needs a Fly volume**: before the first deploy containing it, run
  `fly volumes create oni_quest_data -a oni-quest-advisor --size 1` (the `[mounts]`
  entry in `fly.toml` expects it; the deploy fails without it).
- Don't stage local tooling state: `.idea/` and `.qwen/` are untracked and not yet
  gitignored — exclude them when staging (or add them to `.gitignore`).
- The first push on a fresh machine may hang until GitHub sign-in (Git Credential
  Manager) is completed.

## Docs

`docs/` holds the specs the app is built against — consult them before changing
behavior or visuals:

- `docs/functional-spec/` — behavior: navigation flow, mission detail panels,
  Results panel, Schemes panel. Entity glossary in its README.
- `docs/technical-spec/` — visual theme, mission JSON format, map rendering.

Spec docs end with **Open questions** sections; keep them updated when decisions
get made. Note: the specs currently **lag behind** the features added around v0.1.0
(Command Panel, rule popups, ceasefire objective, Scheme decks) and v0.4.01
(two-player hot seat mode, active-player gating, swap mechanic) — they were
intentionally left untouched; catch them up when the behavior is considered stable.
