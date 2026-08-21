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
  −4 VP objective (`CEASEFIRE_OBJECTIVE`, added by `getScoreableResults`).
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
  (all bundled missions currently belong to Season 2); progress persists to
  `localStorage` under the `oni-quest-advisor:mission-progress:` prefix (solo) and
  `oni-quest-advisor:2p-progress:` prefix (two-player), keyed by mission ID. Online
  mode adds the remote seam: `onlineApi.ts` (fetch wrapper for `/api/games/...`) and
  `onlineSession.ts` (seat session under `oni-quest-advisor:online-session`).
- `stores` are classes in `.svelte.ts` files (`contentStore`, `navigationStore`,
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
  type. `navigationStore` tracks `gameMode` and routes `selectMission()` to the
  correct progress store.
- `routes` (`+page.svelte`) switches screens on `navigationStore.screen` and wires
  store state/methods to component props/callbacks: the local flow
  (`game-mode` → `season-select` → `mission-select` → `mission-detail`, rendering
  `MissionDetail` or `MissionDetailTwoPlayer` by `navigationStore.gameMode`) plus the
  online screens (`online-create` → `online-join` → `online-game`). It also resumes a
  stored online seat on mount. `api/games/**/+server.ts` are the online-mode
  endpoints (thin handlers over `lib/server`), `api/health/` is the
  unauthenticated ops probe, and `join/[code]/` is the invite-link entry point.
  No business logic, no direct `fetch`/`localStorage`, no new type definitions.
  Cross-cutting API concerns (body cap, rate limits, request logging) live in
  `src/hooks.server.ts`. `+layout.svelte` renders the fixed background and the
  site-wide footer
  (fan-project disclaimer + app version — `__APP_VERSION__`, injected by
  `vite.config.ts` from `package.json`; bump the version there for releases).
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
  `OnlineMissionView`, `OnlineResultsPanel`, `OnlineSchemesPanel`, `ConfirmDialog`),
  also reusing the shared panels (collapsible there via `Panel`'s `collapsible` prop).

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
  `text-orange-300`/`text-orange-400`).
- Prefer pure functions in `domain` over logic in components/stores/routes. Game
  rules (draw counts, clamping, VP math, unique draws) belong there, covered by a
  colocated `*.spec.ts`.
- Formatting is Prettier: tabs, single quotes, no trailing commas, print width 100.
  Run `npm run format` rather than hand-formatting.
- Repo files are committed with LF endings (Prettier enforces LF). On a Windows
  checkout with `core.autocrlf=true`, `git status` can list many files whose
  `git diff` is empty — trust the diff, not the status file count.

## Commands

- `npm run dev` — dev server (http://localhost:5173) · `npm run build` /
  `npm run preview`
- `npm run check` — svelte-kit sync + svelte-check (type check, strict)
- `npm run lint` — prettier --check + eslint · `npm run format` — prettier --write
- `npm run test` — vitest run (tests: `src/**/*.{test,spec}.ts`, currently all in
  `lib/domain`)

After code changes, verify with `npm run check`, `npm run lint`, and `npm run test`.

## Git & releases

- Day-to-day work happens on **`develop`** (remote: GitHub `Maevy/Oni-Quest-Advisor`).
  Releases fast-forward merge `develop` into `main`, tag **`vX.Y.Z`** (annotated),
  and push branch + tag. Current release: **v0.5.0** — the online 2-player mode
  (phases 1–4) plus a cross-cutting hardening pass, deployed to Fly.io.
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
(Command Panel, rule popups, ceasefire objective, Scheme decks) and v0.4.0
(two-player hot seat mode, active-player gating, swap mechanic) — they were
intentionally left untouched; catch them up when the behavior is considered stable.
