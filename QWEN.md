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
  Draw count depends on intelligence: ≤13 → 1, 14–15 → 2, ≥16 → 3. Cards have
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
- **MissionProgress** → per-mission play state: checked objective counts, the chosen
  Scheme, a `schemeDraft` (faction/intelligence) that survives resets, and
  `currentRound` (tracked manually by the players, clamped to `MIN_ROUND`..`MAX_ROUND`
  = 1–5). Total VP = checked Results VP + checked Scheme increments, capped at
  `MAX_TOTAL_VP` = 10 (a player cannot earn more per mission); the Command Panel
  shows the total against that cap.

## Architecture

Layered structure. Dependencies only point downward — never sideways, never up.

```
src/
  routes/          → presentation: the page(s), just wire stores to components
  lib/
    components/    → presentation: reusable UI pieces (props in, callbacks out)
    stores/        → application/state layer (class-based singletons)
    domain/         → domain: types + pure logic functions
    data/            → infrastructure: content loading + localStorage wrappers
```

Rule of thumb: **routes → components/stores → domain/data**.

- `domain` never imports from `stores`, `data`, or Svelte; no `window`/`document`,
  no `Math.random()`/`Date.now()` — randomness/time are injected (`Rng` parameter)
  so every function is pure and unit-testable.
- `data` never contains business logic. Static content is loaded eagerly via
  `import.meta.glob` from `src/lib/data/content/{missions,factions,schemes}/*.json`
  (all bundled missions currently belong to Season 2); progress persists to
  `localStorage` under the `oni-quest-advisor:` key prefix. Swapping the source later
  (e.g. for a real backend) must not touch other layers.
- `stores` are classes in `.svelte.ts` files (`contentStore`, `navigationStore`,
  `missionProgressStore`), exported as singletons from `stores/index.ts`. They
  orchestrate — decisions live in `domain`, side effects in `data` — and expose
  purposeful methods (`selectSeason()`, `rollRandomMission()`, `drawSchemes()`,
  `setRound()`, ...), not raw mutable state. Persisted progress is loaded by merging
  it onto `domain.createEmptyProgress()`, so fields added later get their defaults —
  keep this pattern when extending `MissionProgress`.
- `routes` (`+page.svelte`) switches between the three screens
  (`season-select` → `mission-select` → `mission-detail`) on
  `navigationStore.screen` and wires store state/methods to component props/callbacks.
  No business logic, no direct `fetch`/`localStorage`, no new type definitions.
  `+layout.svelte` renders the fixed background and the site-wide footer (fan-project
  disclaimer + app version — `__APP_VERSION__`, injected by `vite.config.ts` from
  `package.json`; bump the version there for releases).
- `components` are presentational: `$props()` in, callbacks up. Avoid importing
  stores directly — the page wires them. Domain _types_ are fine for prop typing,
  domain _logic_ is not. Fixed-position overlays (e.g. the `CommandPanel` tab pinned
  to the right edge) need matching padding reserved in the page layout for their
  collapsed state; expanded overlays intentionally sit on top of content.

Each layer folder has its own `CLAUDE.md` with the specific rules for that layer —
read it before adding files there.

## Conventions

- TypeScript strict, no `any`. Domain types in `lib/domain` are the single source of
  truth — don't redefine `Mission`/`SchemeCard`/`MissionProgress` shapes elsewhere.
- Svelte 5 runes only (`$state`, `$derived`, `$props`) — no legacy
  `writable`/`export let` style.
- Mobile-first, touch-friendly layouts, large touch targets. Visual theme: dark,
  cold, blueish; outlined buttons; translucent "frosted glass" panels (see
  `docs/technical-spec/01-visual-theme.md`).
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
  and push branch + tag. Current release: **v0.2.0**.
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
(Command Panel, rule popups, ceasefire objective, Scheme decks) — they were
intentionally left untouched; catch them up when the behavior is considered stable.
